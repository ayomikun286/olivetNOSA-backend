import mongoose from "mongoose";

const presidentialTenureSchema = new mongoose.Schema(
    {
        president: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        startDate: {
            type: Date,
            required: true,
        },

        endDate: {
            type: Date,
            default: null,
        },

        status: {
            type: String,
            enum: ["active", "completed"],
            default: "active",
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    { timestamps: true }
);

// Only one active presidential tenure at a time.
presidentialTenureSchema.index(
    { status: 1 },
    {
        unique: true,
        partialFilterExpression: { status: "active" },
    }
);

// Ensure the end date is after the start date.
presidentialTenureSchema.pre("validate", function () {
    if (this.endDate && this.endDate <= this.startDate) {
        this.invalidate(
            "endDate",
            "The tenure end date must be after its start date."
        );
    }

    if (this.status === "completed" && !this.endDate) {
        this.invalidate(
            "endDate",
            "A completed tenure must have an end date."
        );
    }
});

const PresidentialTenure = mongoose.model(
    "PresidentialTenure",
    presidentialTenureSchema
);

export default PresidentialTenure;