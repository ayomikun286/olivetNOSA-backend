import mongoose from "mongoose";

const excomConversationSchema = new mongoose.Schema(
    {
        tenure: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PresidentialTenure",
            required: true,
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        subject: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },

        message: {
            type: String,
            required: true,
            trim: true,
        },

        status: {
            type: String,
            enum: ["draft", "published", "archived"],
            default: "draft",
        },

        publishedAt: {
            type: Date,
            default: null,
        },

        lastActivityAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

excomConversationSchema.index({ tenure: 1, status: 1, lastActivityAt: -1 });

const ExcomConversation = mongoose.model(
    "ExcomConversation",
    excomConversationSchema
);

export default ExcomConversation;