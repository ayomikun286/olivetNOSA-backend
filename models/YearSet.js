import mongoose from "mongoose";

const yearSetSchema = new mongoose.Schema(
  {
    year: {
      type: Number,
      required: true,
      unique: true,
      min: 1900,
    },

    name: {
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

const YearSet = mongoose.model("YearSet", yearSetSchema);

export default YearSet;