import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    yearSet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "YearSet",
      required: true,
    },

    chapter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
      required: true,
    },

    sequence: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// One counter per Year Set + Chapter
counterSchema.index(
  { yearSet: 1, chapter: 1 },
  { unique: true }
);

const Counter = mongoose.model("Counter", counterSchema);

export default Counter;