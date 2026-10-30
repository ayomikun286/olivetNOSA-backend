import mongoose from "mongoose";

const nosaLeaderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    position: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    image: {
      type: String,
      trim: true,
      default: "",
    },

    imagePublicId: {
      type: String,
      trim: true,
      default: "",
    },

    isPresident: {
      type: Boolean,
      default: false,
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

nosaLeaderSchema.index({
  isPublished: 1,
  displayOrder: 1,
});

nosaLeaderSchema.index({
  isPresident: 1,
});

const NOSALeader = mongoose.model(
  "NOSALeader",
  nosaLeaderSchema
);

export default NOSALeader;