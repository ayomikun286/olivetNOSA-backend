import mongoose from "mongoose";

const memorialSchema = new mongoose.Schema(
  {
    // ========================================
    // BASIC INFORMATION
    // ========================================

    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    photograph: {
      type: String,
      trim: true,
      default: "",
    },

    photographPublicId: {
      type: String,
      trim: true,
      default: "",
    },

    schoolSet: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    yearsAttended: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "",
    },

    graduationYear: {
      type: Number,
      default: null,
    },

    // ========================================
    // REMEMBRANCE
    // ========================================

    shortRemembrance: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    biography: {
      type: String,
      trim: true,
      default: "",
    },

    contributions: {
      type: String,
      trim: true,
      default: "",
    },

    memories: {
      type: String,
      trim: true,
      default: "",
    },

    // ========================================
    // MEMORIAL SERVICE
    // ========================================

    memorialService: {
      type: String,
      trim: true,
      default: "",
    },

    // ========================================
    // ADDITIONAL PHOTOS
    // ========================================

    additionalPhotos: [
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
    // PUBLISHING
    // ========================================

    isPublished: {
      type: Boolean,
      default: false,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    // ========================================
    // AUTHOR
    // ========================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// ========================================
// INDEXES
// ========================================

memorialSchema.index({ fullName: 1 });
memorialSchema.index({ schoolSet: 1 });
memorialSchema.index({ graduationYear: 1 });
memorialSchema.index({ isPublished: 1 });
memorialSchema.index({ publishedAt: -1 });

const Memorial = mongoose.model("Memorial", memorialSchema);

export default Memorial;