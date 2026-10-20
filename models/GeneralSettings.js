
import mongoose from "mongoose";

const generalSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "general",
      unique: true,
      immutable: true,
    },
    associationName: {
      type: String,
      default: "ONW GOSA",
      trim: true,
      maxlength: 150,
    },
    shortName: {
      type: String,
      default: "ONW GOSA",
      trim: true,
      maxlength: 50,
    },
    contactEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 30,
    },
    address: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    website: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    logoUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    socialLinks: {
      facebook: { type: String, default: "", trim: true, maxlength: 500 },
      instagram: { type: String, default: "", trim: true, maxlength: 500 },
      youtube: { type: String, default: "", trim: true, maxlength: 500 },
      linkedin: { type: String, default: "", trim: true, maxlength: 500 },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const GeneralSettings = mongoose.model(
  "GeneralSettings",
  generalSettingsSchema
);

export default GeneralSettings;
