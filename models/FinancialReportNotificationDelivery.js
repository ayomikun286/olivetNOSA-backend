
import mongoose from "mongoose";

const financialReportNotificationDeliverySchema =
    new mongoose.Schema(
        {
            report: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "FinancialReport",
                required: true,
                index: true,
            },

            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
                index: true,
            },

            // Keep the recipient details used for this delivery.
            email: {
                type: String,
                required: true,
                trim: true,
                lowercase: true,
            },

            firstName: {
                type: String,
                default: "Member",
            },

            notification: {
                status: {
                    type: String,
                    enum: ["pending", "processing", "sent", "failed"],
                    default: "pending",
                },

                claimExpiresAt: {
                    type: Date,
                    default: null,
                },

                attempts: {
                    type: Number,
                    default: 0,
                },
                sentAt: {
                    type: Date,
                    default: null,
                },
                lastError: {
                    type: String,
                    default: null,
                },
                nextAttemptAt: {
                    type: Date,
                    default: Date.now,
                },
            },

            emailDelivery: {
                status: {
                    type: String,
                    enum: ["pending", "processing", "sent", "failed"],
                    default: "pending",
                },
                claimExpiresAt: {
                    type: Date,
                    default: null,
                },
                attempts: {
                    type: Number,
                    default: 0,
                },
                sentAt: {
                    type: Date,
                    default: null,
                },
                lastError: {
                    type: String,
                    default: null,
                },
                nextAttemptAt: {
                    type: Date,
                    default: Date.now,
                },
            },

            completedAt: {
                type: Date,
                default: null,
            },
        },
        { timestamps: true }
    );

// A member gets only one delivery record per report.
financialReportNotificationDeliverySchema.index(
    { report: 1, user: 1 },
    { unique: true }
);

// Find deliveries that still need processing.
financialReportNotificationDeliverySchema.index({
    "notification.status": 1,
    "notification.nextAttemptAt": 1,
});

financialReportNotificationDeliverySchema.index({
    "emailDelivery.status": 1,
    "emailDelivery.nextAttemptAt": 1,
});

const FinancialReportNotificationDelivery =
    mongoose.models.FinancialReportNotificationDelivery ||
    mongoose.model(
        "FinancialReportNotificationDelivery",
        financialReportNotificationDeliverySchema
    );

export default FinancialReportNotificationDelivery;
