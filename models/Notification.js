import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        type: {
            type: String,
            enum: [
                "account",
                "payment",
                "payment_success",
                "obligation",
                "announcement",
                "system",
                "payment_failed"
            ],
            required: true,
        },

        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150,
        },

        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500,
        },

        link: {
            type: String,
            default: null,
            trim: true,
        },

        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

notificationSchema.index({
    user: 1,
    isRead: 1,
    createdAt: -1,
});

notificationSchema.index({
    user: 1,
    createdAt: -1,
});

export default mongoose.model("Notification", notificationSchema);