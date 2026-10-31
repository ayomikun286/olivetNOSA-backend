
import mongoose from "mongoose";

const stewardshipReportSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150,
        },

        reportingMonth: {
            type: Number,
            required: true,
            min: 1,
            max: 12,
        },

        reportingYear: {
            type: Number,
            required: true,
            min: 2020,
        },

        content: {
            type: String,
            required: true,
            trim: true,
        },

        pdfUrl: {
            type: String,
            required: true,
        },

        pdfPublicId: {
            type: String,
            required: true,
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

// Prevent duplicate reports for the same month and year.
stewardshipReportSchema.index(
    { reportingMonth: 1, reportingYear: 1 },
    { unique: true }
);

const StewardshipReport = mongoose.model(
    "StewardshipReport",
    stewardshipReportSchema
);

export default StewardshipReport;
