import mongoose from "mongoose";

const emailJobSchema = new mongoose.Schema(
    {
        // Recipient
        recipientUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        recipientEmail: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },

        // Email information
        subject: {
            type: String,
            required: true,
            trim: true,
        },

        html: {
            type: String,
            required: true,
        },

        // Email category
        category: {
            type: String,
            default: "general",
            trim: true,
            index: true,
        },

        // Prevent duplicate jobs
        dedupeKey: {
            type: String,
            required: true,
            unique: true,
        },

        // Queue processing
        status: {
            type: String,
            enum: [
                "pending",
                "processing",
                "sent",
                "failed",
                "cancelled",
                "uncertain",
            ],
            default: "pending",
            index: true,
        },

        attempts: {
            type: Number,
            default: 0,
            min: 0,
        },

        maxAttempts: {
            type: Number,
            default: 5,
            min: 1,
        },

        nextAttemptAt: {
            type: Date,
            default: Date.now,
        },

        // Worker locking
        lockedAt: {
            type: Date,
            default: null,
        },

        lockedBy: {
            type: String,
            default: null,
        },

        // Delivery tracking
        sentAt: {
            type: Date,
            default: null,
        },

        providerMessageId: {
            type: String,
            default: null,
        },

        lastAttemptAt: {
            type: Date,
            default: null,
        },

        lastError: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Efficient queue retrieval
emailJobSchema.index({
    status: 1,
    nextAttemptAt: 1,
    createdAt: 1,
});

// Recover jobs abandoned by crashed workers
emailJobSchema.index({
    status: 1,
    lockedAt: 1,
});

const EmailJob = mongoose.model("EmailJob", emailJobSchema);

export default EmailJob;