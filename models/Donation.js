
import mongoose from "mongoose";

const donationSchema = new mongoose.Schema(
    {
        donorName: {
            type: String,
            trim: true,
            maxlength: 120,
            default: "Anonymous",
        },

        email: {
            type: String,
            trim: true,
            lowercase: true,
            required: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 1,
        },

        currency: {
            type: String,
            default: "NGN",
        },

        message: {
            type: String,
            trim: true,
            maxlength: 500,
            default: "",
        },

        isAnonymous: {
            type: Boolean,
            default: false,
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        status: {
            type: String,
            enum: [
                "pending",
                "successful",
                "failed",
                "cancelled",
            ],
            default: "pending",
        },

        gateway: {
            type: String,
            default: "paystack",
        },

        gatewayReference: {
            type: String,
            unique: true,
            sparse: true,
        },

        paidAt: {
            type: Date,
            default: null,
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

donationSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Donation", donationSchema);
