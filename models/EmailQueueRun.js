import mongoose from "mongoose";

const emailQueueRunSchema = new mongoose.Schema(
    {
        workerId: {
            type: String,
            required: true,
            index: true,
        },

        status: {
            type: String,
            enum: ["running", "completed", "failed"],
            default: "running",
            index: true,
        },

        startedAt: {
            type: Date,
            default: Date.now,
            required: true,
        },

        finishedAt: {
            type: Date,
            default: null,
        },

        duration: {
            type: Number,
            default: null,
        },

        processed: {
            type: Number,
            default: 0,
        },

        sent: {
            type: Number,
            default: 0,
        },

        failed: {
            type: Number,
            default: 0,
        },

        retrying: {
            type: Number,
            default: 0,
        },

        error: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

emailQueueRunSchema.index({
    startedAt: -1,
});

emailQueueRunSchema.index({
    status: 1,
    startedAt: -1,
});

const EmailQueueRun = mongoose.model(
    "EmailQueueRun",
    emailQueueRunSchema
);

export default EmailQueueRun;