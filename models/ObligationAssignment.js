import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema(
  {
    sent: { type: Boolean, default: false },
    sentAt: { type: Date, default: null },
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

    // Exactly one owner: an individual member, a Year Set, or a Chapter.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },

    yearSet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "YearSet",
      default: undefined,
    },

    chapter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
      default: undefined,
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

    reminders: {
      thirtyDay: { type: reminderSchema, default: () => ({}) },
      sevenDay: { type: reminderSchema, default: () => ({}) },
      oneDay: { type: reminderSchema, default: () => ({}) },
      due: { type: reminderSchema, default: () => ({}) },
      overdue: {
        lastSentAt: { type: Date, default: null },
      },
    },
  },
  { timestamps: true }
);

// Every assignment must have exactly one owner.
obligationAssignmentSchema.pre("validate", function (next) {
  const ownerCount = [
    this.user,
    this.yearSet,
    this.chapter,
  ].filter(Boolean).length;

  if (ownerCount !== 1) {
    this.invalidate(
      "user",
      "An obligation assignment must belong to exactly one member, Year Set, or Chapter."
    );
  }

  next();
});

// Prevent duplicates for each owner type independently.
// Partial indexes are important: collective assignments have no `user`.
obligationAssignmentSchema.index(
  { obligation: 1, user: 1 },
  {
    unique: true,
    partialFilterExpression: { user: { $type: "objectId" } },
  }
);

obligationAssignmentSchema.index(
  { obligation: 1, yearSet: 1 },
  {
    unique: true,
    partialFilterExpression: { yearSet: { $type: "objectId" } },
  }
);

obligationAssignmentSchema.index(
  { obligation: 1, chapter: 1 },
  {
    unique: true,
    partialFilterExpression: { chapter: { $type: "objectId" } },
  }
);

obligationAssignmentSchema.index({ user: 1, status: 1 });
obligationAssignmentSchema.index({ yearSet: 1, status: 1 });
obligationAssignmentSchema.index({ chapter: 1, status: 1 });
obligationAssignmentSchema.index({ obligation: 1, status: 1 });
obligationAssignmentSchema.index({ dueDate: 1, status: 1 });

const ObligationAssignment = mongoose.model(
  "ObligationAssignment",
  obligationAssignmentSchema
);

export default ObligationAssignment;