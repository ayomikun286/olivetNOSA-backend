import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    company: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    employmentType: {
      type: String,
      enum: [
        "Full-time",
        "Part-time",
        "Contract",
        "Internship",
        "Remote",
        "Other",
      ],
      default: "Full-time",
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },

    applicationUrl: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2048,
    },

    applicationEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    deadline: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["draft", "published", "closed"],
      default: "draft",
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

jobSchema.index({ status: 1, deadline: 1, createdAt: -1 });

const Job = mongoose.model("Job", jobSchema);

export default Job;