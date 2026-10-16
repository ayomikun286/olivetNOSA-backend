import mongoose from "mongoose";

const gallerySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
      required: true,
      trim: true,
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

    size: {
      type: String,
      enum: ["normal", "large", "tall"],
      default: "normal",
    },

    imageSource: {
      type: String,
      enum: ["local", "cloudinary"],
      default: "local",
    },

    cloudinaryPublicId: {
      type: String,
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

gallerySchema.index({ isPublished: 1, category: 1, createdAt: -1 });

const Gallery = mongoose.model("Gallery", gallerySchema);

export default Gallery;