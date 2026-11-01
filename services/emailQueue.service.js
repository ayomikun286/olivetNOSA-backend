import EmailJob from "../models/EmailJob.js";

export const queueEmail = async ({
    recipientEmail,
    recipientUser = null,
    subject,
    html,
    category = "general",
    dedupeKey,
}) => {
    if (!recipientEmail || !subject || !html) {
        throw new Error(
            "Recipient email, subject and HTML content are required."
        );
    }

    if (!dedupeKey) {
        throw new Error("Email deduplication key is required.");
    }

    try {
        const emailJob = await EmailJob.create({
            recipientEmail,
            recipientUser,
            subject,
            html,
            category,
            dedupeKey,
        });

        return {
            success: true,
            queued: true,
            job: emailJob,
        };
    } catch (error) {
        // Handle duplicate email jobs
        if (error.code === 11000) {
            return {
                success: true,
                queued: false,
                duplicate: true,
            };
        }

        throw error;
    }
};