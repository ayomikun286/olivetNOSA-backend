
import { randomUUID } from "crypto";

import EmailJob from "../models/EmailJob.js";
import EmailQueueRun from "../models/EmailQueueRun.js";
import { sendEmail } from "./email.service.js";

const BATCH_SIZE = 10;
const LOCK_TIMEOUT_MINUTES = 30;

// Retry delays for temporary failures
const RETRY_DELAYS = [
    1,  // 1 minute
    5,  // 5 minutes
    15, // 15 minutes
    60, // 1 hour
];

const isQuotaError = (error) => {
    const message = error.message?.toLowerCase() || "";

    return (
        message.includes("quota") ||
        message.includes("rate limit") ||
        message.includes("too many requests") ||
        message.includes("429")
    );
};

// Recover jobs abandoned by a crashed worker


export const recoverStaleJobs = async (jobFilter = {}) => {
    const staleBefore = new Date(
        Date.now() - LOCK_TIMEOUT_MINUTES * 60 * 1000
    );

    const result = await EmailJob.updateMany(
        {
            ...jobFilter,
            status: "processing",
            lockedAt: { $lte: staleBefore },
        },
        {
            $set: {
                status: "uncertain",
                lockedAt: null,
                lockedBy: null,
                lastError:
                    "Worker stopped before delivery status could be confirmed. Manual review required.",
            },
        }
    );

    return result.modifiedCount;
};



// Atomically claim one pending job
const claimEmailJob = async (workerId, jobFilter = {}) => {
    const lockToken = `${workerId}:${randomUUID()}`;

    return EmailJob.findOneAndUpdate(
        {
            ...jobFilter,
            status: "pending",
            nextAttemptAt: { $lte: new Date() },
        },
        {
            $set: {
                status: "processing",
                lockedAt: new Date(),
                lockedBy: lockToken,
                lastAttemptAt: new Date(),
            },
            $inc: {
                attempts: 1,
            },
        },
        {
            returnDocument: "after",
            sort: { createdAt: 1 },
        }
    );
};

// Process one email

const processEmailJob = async (
    job,
    emailSender = sendEmail,
    retryDelays = RETRY_DELAYS
) => {
    const lockToken = job.lockedBy;
    let heartbeat;

    const startHeartbeat = () => {
        heartbeat = setInterval(async () => {
            try {
                const result = await EmailJob.updateOne(
                    {
                        _id: job._id,
                        status: "processing",
                        lockedBy: lockToken,
                    },
                    {
                        $set: {
                            lockedAt: new Date(),
                        },
                    }
                );

                if (result.modifiedCount === 0) {
                    console.error(
                        `Heartbeat could not renew lock for email ${job._id}.`
                    );
                }
            } catch (error) {
                console.error(
                    "Email job heartbeat failed:",
                    error.message
                );
            }
        }, 5 * 60 * 1000);
    };

    try {
        startHeartbeat();

        // STEP 1: Send the email.
        // Only errors from the email sender enter this catch block.
        let response;

        try {
            response = await emailSender({
                to: job.recipientEmail,
                subject: job.subject,
                html: job.html,
            });
        } catch (error) {
            const quotaError = isQuotaError(error);
            const maxAttemptsReached = job.attempts >= job.maxAttempts;

            let nextAttemptAt = null;
            let status = "pending";

            if (quotaError) {
                nextAttemptAt = new Date(
                    Date.now() + 6 * 60 * 60 * 1000
                );
            } else if (maxAttemptsReached) {
                status = "failed";
            } else {
                const delay =
                    retryDelays[job.attempts - 1] ?? 60;

                nextAttemptAt = new Date(
                    Date.now() + delay * 60 * 1000
                );
            }

            const updateResult = await EmailJob.updateOne(
                {
                    _id: job._id,
                    status: "processing",
                    lockedBy: lockToken,
                },
                {
                    $set: {
                        status,
                        nextAttemptAt,
                        lastError: error.message,
                        lockedAt: null,
                        lockedBy: null,
                    },
                }
            );

            if (updateResult.modifiedCount === 0) {
                console.error(
                    `Email ${job._id} could not be updated because its worker lock was lost.`
                );

                return "retry";
            }

            console.error(
                `Email failed for ${job.recipientEmail}:`,
                error.message
            );

            return status === "failed" ? "failed" : "retry";
        }

        // STEP 2: The email provider accepted the email.
        const providerMessageId = response?.data?.id || null;

        // STEP 3: Save successful delivery separately.
        // A database error here must NOT be treated as a sending error.
        let updateResult;

        try {
            updateResult = await EmailJob.updateOne(
                {
                    _id: job._id,
                    status: "processing",
                    lockedBy: lockToken,
                },
                {
                    $set: {
                        status: "sent",
                        sentAt: new Date(),
                        providerMessageId,
                        lastError: null,
                        lockedAt: null,
                        lockedBy: null,
                    },
                }
            );
        } catch (error) {
            console.error(
                `Email ${job._id} may have been accepted, but saving its delivery status failed:`,
                error.message
            );

            throw error;
        }

        if (updateResult.modifiedCount === 0) {
            console.error(
                `Email ${job._id} was accepted by the provider, but its worker lock was lost.`
            );

            return "retry";
        }

        return "sent";

    } finally {
        if (heartbeat) {
            clearInterval(heartbeat);
        }
    }
};


// Main cron worker
export const processEmailQueue = async ({
    batchSize = BATCH_SIZE,
    emailSender = sendEmail,
    retryDelays = RETRY_DELAYS,
    jobFilter = {},
} = {}) => {
    const workerId = randomUUID();
    const startedAt = new Date();

    const result = {
        processed: 0,
        sent: 0,
        failed: 0,
        retrying: 0,
    };

    // Create monitoring record
    const run = await EmailQueueRun.create({
        workerId,
        status: "running",
        startedAt,
    });

    try {
        // Recover abandoned jobs
        await recoverStaleJobs(jobFilter);

        // Process available jobs
        for (let i = 0; i < batchSize; i++) {
            const job = await claimEmailJob(workerId, jobFilter);

            if (!job) break;

            result.processed++;

            const status = await processEmailJob(
                job,
                emailSender,
                retryDelays
            );

            if (status === "sent") {
                result.sent++;
            } else if (status === "failed") {
                result.failed++;
            } else {
                result.retrying++;
            }
        }

        const finishedAt = new Date();

        // Complete monitoring record
        await EmailQueueRun.updateOne(
            { _id: run._id },
            {
                $set: {
                    status: "completed",
                    finishedAt,
                    duration: finishedAt - startedAt,
                    ...result,
                },
            }
        );

        console.log("Email queue processing result:", result);

        return result;

    } catch (error) {
        const finishedAt = new Date();

        // Record unexpected worker failure
        try {
            await EmailQueueRun.updateOne(
                { _id: run._id },
                {
                    $set: {
                        status: "failed",
                        finishedAt,
                        duration: finishedAt - startedAt,
                        ...result,
                        error: error.message,
                    },
                }
            );
        } catch (logError) {
            console.error(
                "Could not update email queue run:",
                logError.message
            );
        }

        throw error;
    }
};
