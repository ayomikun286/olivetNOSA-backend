import mongoose from "mongoose";

const memorialSubmissionSchema = new mongoose.Schema(
  {
    // ========================================
    // EXISTING MEMORIAL
    // ========================================

    memorial: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Memorial",
      default: null,
    },

    // ========================================
    // PERSON BEING SUGGESTED
    // Used when memorial does not yet exist
    // ========================================

    suggestedFullName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },

    suggestedSchoolSet: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    suggestedYearsAttended: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "",
    },

    suggestedGraduationYear: {
      type: Number,
      default: null,
    },

    // ========================================
    // SUBMITTER
    // ========================================

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ========================================
    // SUBMISSION TYPE
    // ========================================

    submissionType: {
      type: String,
      enum: [
        "photograph",
        "biography",
        "condolence",
        "correction",
        "new_memorial",
      ],
      required: true,
    },

    // ========================================
    // CONTENT
    // ========================================

    message: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    // ========================================
    // PHOTOGRAPHS
    // ========================================

    photographs: [
      {
        url: {
          type: String,
          trim: true,
        },

        publicId: {
          type: String,
          trim: true,
        },
      },
    ],

    // ========================================
    // REVIEW
    // ========================================

    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
      ],
      default: "pending",
      index: true,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    adminNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

memorialSubmissionSchema.index({
  submittedBy: 1,
});

memorialSubmissionSchema.index({
  memorial: 1,
});

memorialSubmissionSchema.index({
  status: 1,
});

memorialSubmissionSchema.index({
  createdAt: -1,
});

const MemorialSubmission =
  mongoose.model(
    "MemorialSubmission",
    memorialSubmissionSchema
  );

export default MemorialSubmission;