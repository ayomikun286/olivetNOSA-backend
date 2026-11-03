
import mongoose from "mongoose";

const albumSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    category: {
      type: String,
      required: true,
      enum: [
        "Heritage",
        "Olivet",
        "Community",
        "People",
        "Students",
        "Campus",
      ],
    },

    year: {
      type: Number,
      required: true,
      min: 1900,
      max: 2100,
    },

    // Selected from an image already inside this album
    coverImage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gallery",
      default: null,
    },

    isPublished: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

albumSchema.index({
  isPublished: 1,
  category: 1,
  year: -1,
  createdAt: -1,
});

const Album = mongoose.model("Album", albumSchema);

export default Album;
