import mongoose from "mongoose";

const excomReplySchema = new mongoose.Schema(
    {
        conversation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ExcomConversation",
            required: true,
            index: true,
        },

        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        message: {
            type: String,
            required: true,
            trim: true,
        },

        editedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

excomReplySchema.index({ conversation: 1, createdAt: 1 });

const ExcomReply = mongoose.model("ExcomReply", excomReplySchema);

export default ExcomReply;