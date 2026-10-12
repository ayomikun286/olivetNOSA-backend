import mongoose from "mongoose";

const financialReportNotificationJobSchema =
  new mongoose.Schema(
    {
      report: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FinancialReport",
        required: true,
       
      },

      status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending",
        index: true,
      },

      lockToken: {
  type: String,
  default: null,
},

lockExpiresAt: {
  type: Date,
  default: null,
  index: true,
},
      lastProcessedUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      totalRecipients: {
        type: Number,
        default: 0,
      },

      processedRecipients: {
        type: Number,
        default: 0,
      },

      notificationFailures: {
        type: Number,
        default: 0,
      },

      preparationComplete: {
  type: Boolean,
  default: false,
},

preparationCursor: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null,
},

preparationStartedAt: {
  type: Date,
  default: null,
},

preparationCompletedAt: {
  type: Date,
  default: null,
},

preparationAttempts: {
  type: Number,
  default: 0,
},

      emailFailures: {
        type: Number,
        default: 0,
      },

      attempts: {
        type: Number,
        default: 0,
      },

      nextRunAt: {
        type: Date,
        default: Date.now,
        index: true,
      },

      startedAt: {
        type: Date,
        default: null,
      },

      completedAt: {
        type: Date,
        default: null,
      },

      lastError: {
        type: String,
        default: null,
      },
    },
    { timestamps: true }
  );

// One notification job per report.
financialReportNotificationJobSchema.index(
  { report: 1 },
  { unique: true }
);

const FinancialReportNotificationJob =
  mongoose.models.FinancialReportNotificationJob ||
  mongoose.model(
    "FinancialReportNotificationJob",
    financialReportNotificationJobSchema
  );

export default FinancialReportNotificationJob;