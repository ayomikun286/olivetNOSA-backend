import mongoose from "mongoose";

const websiteContentSchema = new mongoose.Schema(
  {
    pageKey: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      index: true,
      enum: [
        "home",
        "about-gosa",
        "about-school",
        "contact",
        "gallery",
        "news",
        "events",
        "olivetians",
        "leaders-chapters",
        "legacy-leadership",
        "privacy-policy",
        "terms-and-conditions",
      ],
    },

    draftContent: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },

    publishedContent: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const WebsiteContent = mongoose.model(
  "WebsiteContent",
  websiteContentSchema
);

export default WebsiteContent;