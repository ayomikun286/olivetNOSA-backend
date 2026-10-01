import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema(
  {
    sent: {
      type: Boolean,
      default: false,
    },

    sentAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const obligationAssignmentSchema = new mongoose.Schema(
  {
    obligation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Obligation",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    amountDue: {
      type: Number,
      required: true,
      min: 0,
    },

    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ["pending", "partial", "paid", "overdue"],
      default: "pending",
    },

    dueDate: {
      type: Date,
      default: null,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ========================================
    // PAYMENT REMINDERS
    // ========================================

    reminders: {
      thirtyDay: {
        type: reminderSchema,
        default: () => ({}),
      },

      sevenDay: {
        type: reminderSchema,
        default: () => ({}),
      },

      oneDay: {
        type: reminderSchema,
        default: () => ({}),
      },

      due: {
        type: reminderSchema,
        default: () => ({}),
      },

      overdue: {
        lastSentAt: {
          type: Date,
          default: null,
        },
      },
    },
  },
  { timestamps: true }
);

// ========================================
// INDEXES
// ========================================

obligationAssignmentSchema.index(
  { obligation: 1, user: 1 },
  { unique: true }
);

obligationAssignmentSchema.index({
  user: 1,
  status: 1,
});

obligationAssignmentSchema.index({
  obligation: 1,
  status: 1,
});

// Useful for reminder scheduler
obligationAssignmentSchema.index({
  dueDate: 1,
  status: 1,
});

const ObligationAssignment = mongoose.model(
  "ObligationAssignment",
  obligationAssignmentSchema
);

export default ObligationAssignment;