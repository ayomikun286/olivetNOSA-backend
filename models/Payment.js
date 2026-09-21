import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        // ========================================
        // MEMBER
        // ========================================
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // ========================================
        // OBLIGATION ASSIGNMENT
        // The member-specific obligation being paid
        // ========================================
        obligationAssignment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ObligationAssignment",
            default: null,
            index: true,
        },

        // ========================================
        // PAYMENT DETAILS
        // ========================================
        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        currency: {
            type: String,
            default: "NGN",
            uppercase: true,
            trim: true,
        },

        // ========================================
        // STATUS
        // ========================================
        status: {
            type: String,
            enum: [
                "pending",
                "successful",
                "failed",
                "cancelled",
                "refunded",
            ],
            default: "pending",
            index: true,
        },

        // ========================================
        // PAYMENT METHOD
        // ========================================
        paymentMethod: {
            type: String,
            enum: [
                "card",
                "bank_transfer",
                "ussd",
                "mobile_money",
                "paypal",
                "other",
            ],
            default: "card",
        },

        // ========================================
        // PAYMENT GATEWAY
        // ========================================
        gateway: {
            type: String,
            enum: [
                "paystack",
                "flutterwave",
                "paypal",
                "manual",
            ],
            required: true,
            index: true,
        },

        // ========================================
        // GATEWAY REFERENCE
        // ========================================
        gatewayReference: {
            type: String,
            trim: true,
            index: true,
            unique: true,
            sparse: true,
        },

        // ========================================
        // PAYMENT DATE
        // ========================================
        paidAt: {
            type: Date,
            default: null,
        },

        // ========================================
        // GATEWAY / EXTRA DATA
        // ========================================
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

// ========================================
// INDEXES
// ========================================

paymentSchema.index({
    user: 1,
    createdAt: -1,
});

paymentSchema.index({
    obligationAssignment: 1,
    createdAt: -1,
});

paymentSchema.index({
    status: 1,
    createdAt: -1,
});

paymentSchema.index({
    gateway: 1,
    gatewayReference: 1,
});

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;