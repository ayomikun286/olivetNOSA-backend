import mongoose from "mongoose";

const chapterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 2,
      maxlength: 10,
    },

    country: {
      type: String,
      trim: true,
      maxlength: 100,
    },

      leader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    leaderAssignedAt: {
  type: Date,
  default: null,
},

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Chapter = mongoose.model("Chapter", chapterSchema);

export default Chapter;