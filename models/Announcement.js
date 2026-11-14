
import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

attachment: {
    url: {
        type: String,
        default: null,
    },
    publicId: {
        type: String,
        default: null,
    },
    fileName: {
        type: String,
        default: null,
    },
    storage: {
        type: String,
        enum: ["cloudinary", "local"],
        default: "cloudinary",
    },
},

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },

    publishedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Announcement = mongoose.model("Announcement", announcementSchema);

export default Announcement;
