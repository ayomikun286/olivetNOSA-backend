import mongoose from "mongoose";

const newsEventSchema = new mongoose.Schema(
  {
    // ========================================
    // BASIC INFORMATION
    // ========================================

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["news", "event"],
      required: true,
    },

    category: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    excerpt: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    content: {
      type: String,
      trim: true,
    },

    image: {
      type: String,
      trim: true,
    },

    imagePublicId: {
      type: String,
      trim: true,
    },
    // ========================================
    // EVENT INFORMATION
    // ========================================

    eventDate: {
      type: Date,
      default: null,
    },

    startTime: {
      type: String,
      trim: true,
      maxlength: 30,
    },

    endTime: {
      type: String,
      trim: true,
      maxlength: 30,
    },

    location: {
      type: String,
      trim: true,
      maxlength: 250,
    },

    registrationUrl: {
      type: String,
      trim: true,
    },

    // ========================================
    // PUBLISHING
    // ========================================

    isPublished: {
      type: Boolean,
      default: false,
    },

    isFeatured: {
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

newsEventSchema.index({ type: 1 });
newsEventSchema.index({ category: 1 });
newsEventSchema.index({ isPublished: 1 });
newsEventSchema.index({ isFeatured: 1 });
newsEventSchema.index({ eventDate: 1 });
newsEventSchema.index({ publishedAt: -1 });

const NewsEvent = mongoose.model("NewsEvent", newsEventSchema);

export default NewsEvent;