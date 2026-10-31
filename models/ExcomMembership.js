import mongoose from "mongoose";

const excomMembershipSchema = new mongoose.Schema(
    {
        tenure: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PresidentialTenure",
            required: true,
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        position: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },

        appointedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active",
        },

        appointedAt: {
            type: Date,
            default: Date.now,
        },

        removedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// A member can hold only one active EXCOM position per tenure.
excomMembershipSchema.index(
    { tenure: 1, user: 1 },
    {
        unique: true,
        partialFilterExpression: { status: "active" },
    }
);

// Prevent duplicate active holders of the same position per tenure.
excomMembershipSchema.index(
    { tenure: 1, position: 1 },
    {
        unique: true,
        partialFilterExpression: { status: "active" },
    }
);

const ExcomMembership = mongoose.model(
    "ExcomMembership",
    excomMembershipSchema
);

export default ExcomMembership;