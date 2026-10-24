import mongoose from "mongoose";

const legacyLeaderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    title: {
      type: String,
      trim: true,
      default: "President",
      maxlength: 100,
    },

    startYear: {
      type: Number,
      required: true,
    },

    endYear: {
      type: Number,
      default: null,
    },

    portrait: {
      type: String,
      trim: true,
      default: "",
    },

    portraitPublicId: {
      type: String,
      trim: true,
      default: "",
    },

    biography: {
      type: String,
      trim: true,
      default: "",
    },

    achievements: {
      type: [String],
      default: [],
    },

    displayOrder: {
      type: Number,
      default: 0,
    },

    isPublished: {
      type: Boolean,
      default: false,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

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

legacyLeaderSchema.index({ isPublished: 1, displayOrder: 1 });
legacyLeaderSchema.index({ startYear: 1, endYear: 1 });

const LegacyLeader = mongoose.model(
  "LegacyLeader",
  legacyLeaderSchema
);

export default LegacyLeader;