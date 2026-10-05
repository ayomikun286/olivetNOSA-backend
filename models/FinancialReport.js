import mongoose from "mongoose";

const financialReportSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150,
        },

        month: {
            type: Number,
            required: true,
            min: 1,
            max: 12,
        },

        year: {
            type: Number,
            required: true,
            min: 1900,
        },

        status: {
            type: String,
            enum: ["draft", "published"],
            default: "draft",
            index: true,
        },

        summary: {
            totalExpected: {
                type: Number,
                default: 0,
                min: 0,
            },

            totalCollected: {
                type: Number,
                default: 0,
                min: 0,
            },

            totalOutstanding: {
                type: Number,
                default: 0,
                min: 0,
            },

            totalOverdue: {
                type: Number,
                default: 0,
                min: 0,
            },

            collectionRate: {
                type: Number,
                default: 0,
                min: 0,
                max: 100,
            },
        },

       categoryBreakdown: [
    {
        category: {
            type: String,
            enum: ["individual", "yearSet", "chapter"],
            required: true,
        },

        mandatory: {
            expected: {
                type: Number,
                default: 0,
                min: 0,
            },
            collected: {
                type: Number,
                default: 0,
                min: 0,
            },
            outstanding: {
                type: Number,
                default: 0,
                min: 0,
            },
            overdue: {
                type: Number,
                default: 0,
                min: 0,
            },
            collectionRate: {
                type: Number,
                default: 0,
                min: 0,
                max: 100,
            },
        },

        optional: {
            expected: {
                type: Number,
                default: 0,
                min: 0,
            },
            collected: {
                type: Number,
                default: 0,
                min: 0,
            },
            outstanding: {
                type: Number,
                default: 0,
                min: 0,
            },
            overdue: {
                type: Number,
                default: 0,
                min: 0,
            },
            collectionRate: {
                type: Number,
                default: 0,
                min: 0,
                max: 100,
            },
        },
    },
],

        obligationBreakdown: [
            {
                obligation: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Obligation",
                    default: null,
                },

                name: {
                    type: String,
                    required: true,
                    trim: true,
                },

                category: {
                    type: String,
                    enum: ["individual", "yearSet", "chapter"],
                    required: true,
                },

                isOptional: {
                    type: Boolean,
                    default: false,
                },

                expected: {
                    type: Number,
                    default: 0,
                    min: 0,
                },

                collected: {
                    type: Number,
                    default: 0,
                    min: 0,
                },

                outstanding: {
                    type: Number,
                    default: 0,
                    min: 0,
                },

                overdue: {
                    type: Number,
                    default: 0,
                    min: 0,
                },

                collectionRate: {
                    type: Number,
                    default: 0,
                    min: 0,
                    max: 100,
                },
            },
        ],

        paymentSummary: {
            totalPayments: {
                type: Number,
                default: 0,
                min: 0,
            },

            successfulPayments: {
                type: Number,
                default: 0,
                min: 0,
            },

            pendingPayments: {
                type: Number,
                default: 0,
                min: 0,
            },

            failedPayments: {
                type: Number,
                default: 0,
                min: 0,
            },

            refundedPayments: {
                type: Number,
                default: 0,
                min: 0,
            },

            totalCollectedThisMonth: {
                type: Number,
                default: 0,
                min: 0,
            },
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        publishedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },

        publishedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);


// One official report per month/year
financialReportSchema.index(
    { month: 1, year: 1 },
    { unique: true }
);

financialReportSchema.index({
    year: 1,
    month: -1,
});

financialReportSchema.index({
    status: 1,
    year: 1,
    month: -1,
});


const FinancialReport = mongoose.model(
    "FinancialReport",
    financialReportSchema
);

export default FinancialReport;