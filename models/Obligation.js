import mongoose from "mongoose";

const obligationSchema = new mongoose.Schema(
  {
    // ========================================
    // BASIC INFORMATION
    // ========================================

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // ========================================
    // OBLIGATION CATEGORY
    // ========================================

    category: {
      type: String,
      enum: ["individual", "yearSet", "chapter"],
      required: true,
    },

    // ========================================
    // TOTAL OBLIGATION
    // ========================================

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // ========================================
    // PAYMENT PLANS
    // Suggested ways to satisfy the obligation
    // ========================================

    paymentPlans: [
      {
        frequency: {
          type: String,
          enum: ["monthly", "quarterly", "annual"],
          required: true,
        },

        amount: {
          type: Number,
          required: true,
          min: 0,
        },

        isActive: {
          type: Boolean,
          default: true,
        },
      },
    ],

    // ========================================
    // OBLIGATION PERIOD
    // ========================================

    year: {
      type: Number,
      required: true,
      min: 1900,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    // ========================================
    // STATUS
    // ========================================

    isActive: {
      type: Boolean,
      default: true,
    },

    // ========================================
    // AUDIT
    // ========================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    //   required: true,
     default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ========================================
// INDEXES
// ========================================

obligationSchema.index({
  category: 1,
  year: 1,
});

obligationSchema.index({
  isActive: 1,
});

obligationSchema.index({
  dueDate: 1,
});

obligationSchema.index({
  createdBy: 1,
});

const Obligation = mongoose.model(
  "Obligation",
  obligationSchema
);

export default Obligation;