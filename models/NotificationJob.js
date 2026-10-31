
import mongoose from "mongoose";

const notificationJobSchema = new mongoose.Schema(
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

    // Related records
    obligation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Obligation",
      required: true,
    },

    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ObligationAssignment",
      required: true,
    },

    // Email content
    subject: {
      type: String,
      required: true,
    },

    html: {
      type: String,
      required: true,
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
      enum: ["pending", "processing", "sent", "failed"],
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
notificationJobSchema.index({
  status: 1,
  nextAttemptAt: 1,
  createdAt: 1,
});

// Recover jobs abandoned by crashed workers
notificationJobSchema.index({
  status: 1,
  lockedAt: 1,
});

const NotificationJob = mongoose.model(
  "NotificationJob",
  notificationJobSchema
);

export default NotificationJob;
