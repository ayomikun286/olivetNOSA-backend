
import mongoose from "mongoose";
import { createAuditLog } from "../../services/auditLog.service.js";
import EmailJob from "../../models/EmailJob.js";
import EmailQueueRun from "../../models/EmailQueueRun.js";

// ========================================
// EMAIL QUEUE SUMMARY
// ========================================

export const getEmailQueueSummary = async (req, res) => {
    try {
        const [
            statusCounts,
            totalJobs,
            recentRun,
        ] = await Promise.all([
            EmailJob.aggregate([
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 },
                    },
                },
            ]),

            EmailJob.countDocuments(),

            EmailQueueRun.findOne()
                .sort({ startedAt: -1 })
                .lean(),
        ]);

        const counts = {
            pending: 0,
            processing: 0,
            sent: 0,
            failed: 0,
            cancelled: 0,
            uncertain: 0,
        };

        statusCounts.forEach((item) => {
            counts[item._id] = item.count;
        });

        const duePending = await EmailJob.countDocuments({
            status: "pending",
            nextAttemptAt: { $lte: new Date() },
        });

        return res.status(200).json({
            success: true,
            summary: {
                total: totalJobs,
                ...counts,
                duePending,
                scheduledForRetry: counts.pending - duePending,
            },
            recentRun,
        });
    } catch (error) {
        console.error("Get email queue summary error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load email queue summary.",
        });
    }
};


// ========================================
// EMAIL JOB LIST
// ========================================

export const getAdminEmailJobs = async (req, res) => {
    try {
        const page = Math.max(
            Number(req.query.page) || 1,
            1
        );

        const limit = Math.min(
            Math.max(Number(req.query.limit) || 20, 1),
            100
        );

        const skip = (page - 1) * limit;

        const status = String(req.query.status || "").trim();
        const category = String(req.query.category || "").trim();
        const search = String(req.query.search || "").trim();

        const filter = {};

        const allowedStatuses = [
            "pending",
            "processing",
            "sent",
            "failed",
            "cancelled",
            "uncertain",
        ];

        if (status) {
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email status.",
                });
            }

            filter.status = status;
        }

        if (category) {
            filter.category = category;
        }

        if (search) {
            filter.$or = [
                {
                    recipientEmail: {
                        $regex: search.replace(
                            /[.*+?^${}()|[\]\\]/g,
                            "\\$&"
                        ),
                        $options: "i",
                    },
                },
                {
                    subject: {
                        $regex: search.replace(
                            /[.*+?^${}()|[\]\\]/g,
                            "\\$&"
                        ),
                        $options: "i",
                    },
                },
            ];
        }

        const [jobs, total] = await Promise.all([
            EmailJob.find(filter)
                .select(
                    "-html -dedupeKey"
                )
                .populate(
                    "recipientUser",
                    "firstName middleName lastName alumniId"
                )
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),

            EmailJob.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            jobs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Get admin email jobs error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load email jobs.",
        });
    }
};


// ========================================
// EMAIL QUEUE RUN HISTORY
// ========================================

export const getEmailQueueRuns = async (req, res) => {
    try {
        const page = Math.max(
            Number(req.query.page) || 1,
            1
        );

        const limit = Math.min(
            Math.max(Number(req.query.limit) || 20, 1),
            100
        );

        const skip = (page - 1) * limit;

        const [runs, total] = await Promise.all([
            EmailQueueRun.find()
                .sort({ startedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),

            EmailQueueRun.countDocuments(),
        ]);

        return res.status(200).json({
            success: true,
            runs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Get email queue runs error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load email queue history.",
        });
    }
};


// ========================================
// MANUALLY RETRY FAILED EMAIL
// ========================================

export const retryFailedEmailJob = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const { jobId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email job ID.",
            });
        }

        let retriedJob = null;

        await session.withTransaction(async () => {
            // Capture the actual attempt count before resetting it.
            const previousJob = await EmailJob.findById(jobId)
                .select("attempts")
                .session(session)
                .lean();

            if (!previousJob) {
                throw new Error("EMAIL_JOB_NOT_FOUND");
            }

            retriedJob = await EmailJob.findOneAndUpdate(
                {
                    _id: jobId,
                    status: "failed",
                },
                {
                    $set: {
                        status: "pending",
                        attempts: 0,
                        nextAttemptAt: new Date(),
                        lockedAt: null,
                        lockedBy: null,
                        sentAt: null,
                        providerMessageId: null,
                        lastAttemptAt: null,
                        lastError: null,
                    },
                },
                {
                    new: true,
                    session,
                }
            );

            if (!retriedJob) {
                throw new Error("EMAIL_JOB_NOT_FAILED");
            }

            await createAuditLog({
                actor: req.user._id,
                action: "email.retry_requested",
                resource: "EmailJob",
                resourceId: retriedJob._id,
                targetUser: retriedJob.recipientUser,
                details: {
                    recipientEmail: retriedJob.recipientEmail,
                    category: retriedJob.category,
                    previousStatus: "failed",
                    newStatus: "pending",
                    previousAttempts: previousJob.attempts,
                },
                req,
                session,
            });
        });

        return res.status(200).json({
            success: true,
            message: "Email job successfully queued for retry.",
            job: {
                _id: retriedJob._id,
                recipientEmail: retriedJob.recipientEmail,
                subject: retriedJob.subject,
                category: retriedJob.category,
                status: retriedJob.status,
                attempts: retriedJob.attempts,
                maxAttempts: retriedJob.maxAttempts,
                nextAttemptAt: retriedJob.nextAttemptAt,
            },
        });

    } catch (error) {
        console.error("Retry failed email error:", error);

        if (error.message === "EMAIL_JOB_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: "Email job not found.",
            });
        }

        if (error.message === "EMAIL_JOB_NOT_FAILED") {
            return res.status(400).json({
                success: false,
                message: "Only failed email jobs can be retried.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to retry email job.",
        });

    } finally {
        await session.endSession();
    }
};




// ========================================
// GET SINGLE EMAIL JOB DETAILS
// ========================================

export const getEmailJobDetails = async (req, res) => {
    try {
        const { jobId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email job ID.",
            });
        }

        const job = await EmailJob.findById(jobId)
            .select("-html -dedupeKey")
            .populate(
                "recipientUser",
                "firstName middleName lastName email alumniId"
            )
            .lean();

        if (!job) {
            return res.status(404).json({
                success: false,
                message: "Email job not found.",
            });
        }

        return res.status(200).json({
            success: true,
            job,
        });

    } catch (error) {
        console.error("Get email job details error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve email job details.",
        });
    }
};


// ========================================
// CANCEL PENDING EMAIL JOB
// ========================================

export const cancelEmailJob = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const { jobId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email job ID.",
            });
        }

        let cancelledJob = null;

        await session.withTransaction(async () => {
            cancelledJob = await EmailJob.findOneAndUpdate(
                {
                    _id: jobId,
                    status: "pending",
                },
                {
                    $set: {
                        status: "cancelled",
                        lockedAt: null,
                        lockedBy: null,
                    },
                },
                {
                    new: true,
                    session,
                }
            );

            if (!cancelledJob) {
                const existingJob = await EmailJob.findById(jobId)
                    .session(session);

                if (!existingJob) {
                    throw new Error("EMAIL_JOB_NOT_FOUND");
                }

                throw new Error("EMAIL_JOB_NOT_PENDING");
            }

            await createAuditLog({
                actor: req.user._id,
                action: "email.cancelled",
                resource: "EmailJob",
                resourceId: cancelledJob._id,
                targetUser: cancelledJob.recipientUser,
                details: {
                    recipientEmail: cancelledJob.recipientEmail,
                    subject: cancelledJob.subject,
                    category: cancelledJob.category,
                    previousStatus: "pending",
                    newStatus: "cancelled",
                },
                req,
                session,
            });
        });

        return res.status(200).json({
            success: true,
            message: "Email job successfully cancelled.",
            job: {
                _id: cancelledJob._id,
                recipientEmail: cancelledJob.recipientEmail,
                subject: cancelledJob.subject,
                status: cancelledJob.status,
            },
        });

    } catch (error) {
        console.error("Cancel email job error:", error);

        if (error.message === "EMAIL_JOB_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: "Email job not found.",
            });
        }

        if (error.message === "EMAIL_JOB_NOT_PENDING") {
            return res.status(400).json({
                success: false,
                message: "Only pending email jobs can be cancelled.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to cancel email job.",
        });

    } finally {
        await session.endSession();
    }
};



export const markUncertainEmailAsSent = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const { jobId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email job ID.",
            });
        }

        let job = null;

        await session.withTransaction(async () => {
            job = await EmailJob.findOneAndUpdate(
                {
                    _id: jobId,
                    status: "uncertain",
                },
                {
                    $set: {
                        status: "sent",
                        sentAt: new Date(),
                        lockedAt: null,
                        lockedBy: null,
                        lastError: "Manually marked as sent after administrator verification.",
                    },
                },
                {
                    new: true,
                    session,
                }
            );

            if (!job) {
                const existingJob = await EmailJob.findById(jobId)
                    .session(session);

                if (!existingJob) {
                    throw new Error("EMAIL_JOB_NOT_FOUND");
                }

                throw new Error("EMAIL_JOB_NOT_UNCERTAIN");
            }

            await createAuditLog({
                actor: req.user._id,
                action: "email.uncertain_marked_sent",
                resource: "EmailJob",
                resourceId: job._id,
                targetUser: job.recipientUser,
                details: {
                    recipientEmail: job.recipientEmail,
                    category: job.category,
                    previousStatus: "uncertain",
                    newStatus: "sent",
                },
                req,
                session,
            });
        });

        return res.status(200).json({
            success: true,
            message: "Email job marked as sent.",
            job: {
                _id: job._id,
                recipientEmail: job.recipientEmail,
                subject: job.subject,
                category: job.category,
                status: job.status,
                sentAt: job.sentAt,
            },
        });

    } catch (error) {
        console.error("Mark uncertain email as sent error:", error);

        if (error.message === "EMAIL_JOB_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: "Email job not found.",
            });
        }

        if (error.message === "EMAIL_JOB_NOT_UNCERTAIN") {
            return res.status(400).json({
                success: false,
                message: "Only uncertain email jobs can be marked as sent.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to update email job.",
        });

    } finally {
        await session.endSession();
    }
};

// ========================================
// MANUALLY RETRY UNCERTAIN EMAIL
// ========================================

export const retryUncertainEmailJob = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const { jobId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email job ID.",
            });
        }

        let retriedJob = null;

        await session.withTransaction(async () => {
            retriedJob = await EmailJob.findOneAndUpdate(
                {
                    _id: jobId,
                    status: "uncertain",
                },
                {
                    $set: {
                        status: "pending",
                        nextAttemptAt: new Date(),
                        lockedAt: null,
                        lockedBy: null,
                        lastError: "Manually approved for retry after delivery investigation.",
                    },
                },
                {
                    new: true,
                    session,
                }
            );

            if (!retriedJob) {
                const existingJob = await EmailJob.findById(jobId)
                    .session(session);

                if (!existingJob) {
                    throw new Error("EMAIL_JOB_NOT_FOUND");
                }

                throw new Error("EMAIL_JOB_NOT_UNCERTAIN");
            }

            await createAuditLog({
                actor: req.user._id,
                action: "email.uncertain_retry_requested",
                resource: "EmailJob",
                resourceId: retriedJob._id,
                targetUser: retriedJob.recipientUser,
                details: {
                    recipientEmail: retriedJob.recipientEmail,
                    category: retriedJob.category,
                    previousStatus: "uncertain",
                    newStatus: "pending",
                    attempts: retriedJob.attempts,
                },
                req,
                session,
            });
        });

        return res.status(200).json({
            success: true,
            message: "Uncertain email queued for manual retry.",
            job: {
                _id: retriedJob._id,
                recipientEmail: retriedJob.recipientEmail,
                subject: retriedJob.subject,
                status: retriedJob.status,
                attempts: retriedJob.attempts,
            },
        });

    } catch (error) {
        console.error("Retry uncertain email error:", error);

        if (error.message === "EMAIL_JOB_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: "Email job not found.",
            });
        }

        if (error.message === "EMAIL_JOB_NOT_UNCERTAIN") {
            return res.status(400).json({
                success: false,
                message: "Only uncertain email jobs can be retried.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to retry uncertain email.",
        });

    } finally {
        await session.endSession();
    }
};
