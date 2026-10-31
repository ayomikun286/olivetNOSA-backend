
import mongoose from "mongoose";
import User from "../../models/User.js";
import ObligationAssignment from "../../models/ObligationAssignment.js";
import Payment from "../../models/Payment.js";
import { updateMemberFinancialStatus } from "../../services/memberFinancialStatus.service.js";
import { createAuditLog } from "../../services/auditLog.service.js";

const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getTreasurerMembers = async (req, res) => {
    try {
        const page = Math.max(Number(req.query.page) || 1, 1);

        const limit = Math.min(
            Math.max(Number(req.query.limit) || 20, 1),
            100
        );

        const skip = (page - 1) * limit;

        const search = String(req.query.search || "").trim();
        const status = String(req.query.status || "").trim();
        const financialStatus = String(
            req.query.financialStatus || ""
        ).trim();

        const filter = {
            role: "member",
        };

        // ACCOUNT STATUS FILTER
        const allowedStatuses = [
            "pending",
            "active",
            "suspended",
            "inactive",
            "deactivated",
        ];

        if (status) {
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid member status.",
                });
            }

            filter.status = status;
        }

        // FINANCIAL STATUS FILTER
        const allowedFinancialStatuses = [
            "financial",
            "non_financial",
        ];

        if (financialStatus) {
            if (!allowedFinancialStatuses.includes(financialStatus)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid financial status.",
                });
            }

            filter.financialStatus = financialStatus;
        }

        // MEMBER SEARCH
        if (search) {
            const regex = new RegExp(escapeRegex(search), "i");

            filter.$or = [
                { firstName: regex },
                { middleName: regex },
                { lastName: regex },
                { email: regex },
                { alumniId: regex },
                { phone: regex },
            ];
        }

        // FETCH MEMBERS
        const [members, total] = await Promise.all([
            User.find(filter)
                .select(
                    "firstName middleName lastName email phone alumniId enrollmentYear graduationYear status financialStatus isEmailVerified yearSet chapter createdAt"
                )
                .populate("yearSet", "year name")
                .populate("chapter", "name code")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),

            User.countDocuments(filter),
        ]);

        // FETCH FINANCIAL SUMMARIES FOR CURRENT PAGE
        const memberIds = members.map((member) => member._id);

        const financialSummaries = memberIds.length
            ? await ObligationAssignment.aggregate([
                {
                    $match: {
                        user: { $in: memberIds },
                    },
                },
                {
                    $group: {
                        _id: "$user",

                        totalAssignments: {
                            $sum: 1,
                        },

                        totalDue: {
                            $sum: "$amountDue",
                        },

                        totalPaid: {
                            $sum: "$amountPaid",
                        },

                        paidAssignments: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$status", "paid"] },
                                    1,
                                    0,
                                ],
                            },
                        },

                        partialAssignments: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$status", "partial"] },
                                    1,
                                    0,
                                ],
                            },
                        },

                        pendingAssignments: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$status", "pending"] },
                                    1,
                                    0,
                                ],
                            },
                        },

                        overdueAssignments: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$status", "overdue"] },
                                    1,
                                    0,
                                ],
                            },
                        },
                    },
                },
                {
                    $project: {
                        totalAssignments: 1,
                        totalDue: 1,
                        totalPaid: 1,

                        outstandingBalance: {
                            $max: [
                                0,
                                { $subtract: ["$totalDue", "$totalPaid"] },
                            ],
                        },

                        paidAssignments: 1,
                        partialAssignments: 1,
                        pendingAssignments: 1,
                        overdueAssignments: 1,
                    },
                },
            ])
            : [];

        // MAP FINANCIAL SUMMARIES TO MEMBERS
        const summaryMap = new Map(
            financialSummaries.map((summary) => [
                summary._id.toString(),
                summary,
            ])
        );

        const formattedMembers = members.map((member) => {
            const summary = summaryMap.get(member._id.toString());

            return {
                ...member,

                financialSummary: {
                    totalAssignments: summary?.totalAssignments || 0,
                    totalDue: summary?.totalDue || 0,
                    totalPaid: summary?.totalPaid || 0,
                    outstandingBalance: summary?.outstandingBalance || 0,

                    paidAssignments: summary?.paidAssignments || 0,
                    partialAssignments: summary?.partialAssignments || 0,
                    pendingAssignments: summary?.pendingAssignments || 0,
                    overdueAssignments: summary?.overdueAssignments || 0,
                },
            };
        });

        return res.status(200).json({
            success: true,

            members: formattedMembers,

            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Get treasurer members error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load Treasurer members.",
        });
    }
};



export const getTreasurerMemberDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid member ID.",
            });
        }

        const member = await User.findOne({
            _id: userId,
            role: "member",
        }).select(
            "firstName middleName lastName email phone alumniId enrollmentYear graduationYear yearSet chapter status financialStatus"
        )
            .populate("yearSet", "year name")
            .populate("chapter", "name code");

        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found.",
            });
        }

        const assignments = await ObligationAssignment.find({
            user: userId,
        })
            .populate("obligation")
            .sort({ createdAt: -1 });

        const payments = await Payment.find({
            user: userId,
        })
            .populate("obligationAssignment")
            .sort({ createdAt: -1 });

        const totalDue = assignments.reduce(
            (sum, item) => sum + item.amountDue,
            0
        );

        const totalPaid = assignments.reduce(
            (sum, item) => sum + item.amountPaid,
            0
        );

        return res.status(200).json({
            success: true,
            member,
            financialSummary: {
                totalAssignments: assignments.length,
                totalDue,
                totalPaid,
                outstandingBalance: Math.max(0, totalDue - totalPaid),
                paidAssignments: assignments.filter(
                    item => item.status === "paid"
                ).length,
                partialAssignments: assignments.filter(
                    item => item.status === "partial"
                ).length,
                pendingAssignments: assignments.filter(
                    item => item.status === "pending"
                ).length,
                overdueAssignments: assignments.filter(
                    item => item.status === "overdue"
                ).length,
            },
            assignments,
            payments,
        });

    } catch (error) {
        console.error("Get Treasurer Member Details Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load member financial details.",
        });
    }
};


export const recordOfflinePayment = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const {
            userId,
            assignmentId,
            amount,
            paymentMethod,
            paidAt,
            reference,
            notes,
        } = req.body;

        // Validate required fields.
        if (!userId || !assignmentId || amount === undefined || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: "Member, obligation, amount and payment method are required.",
            });
        }

        const paymentAmount = Number(amount);

        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid payment amount.",
            });
        }

        if (!["cash", "bank_transfer"].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Invalid offline payment method.",
            });
        }

        if (
            (reference !== undefined && typeof reference !== "string") ||
            (notes !== undefined && typeof notes !== "string")
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment reference or notes.",
            });
        }

        if (
            !mongoose.Types.ObjectId.isValid(userId) ||
            !mongoose.Types.ObjectId.isValid(assignmentId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid member or assignment ID.",
            });
        }

        const paymentDate = paidAt ? new Date(paidAt) : new Date();

        if (Number.isNaN(paymentDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment date.",
            });
        }

        let createdPayment;
        let updatedAssignment;
        let financialStatus;

        await session.withTransaction(async () => {
            // Confirm that this assignment belongs to this member.
            const assignment = await ObligationAssignment.findOne({
                _id: assignmentId,
                user: userId,
            })
                .populate("obligation")
                .session(session);

            if (!assignment) {
                throw new Error("Obligation assignment not found for this member.");
            }

            if (!assignment.obligation) {
                throw new Error("The obligation linked to this assignment was not found.");
            }

            if (assignment.obligation.category !== "individual") {
                throw new Error("This endpoint only supports individual obligations.");
            }

            const outstandingBalance =
                Number(assignment.amountDue) - Number(assignment.amountPaid || 0);

            if (outstandingBalance <= 0) {
                throw new Error("This obligation has already been fully paid.");
            }

            if (paymentAmount > outstandingBalance) {
                throw new Error(
                    `Payment exceeds the outstanding balance of ₦${outstandingBalance.toLocaleString()}.`
                );
            }

            const newAmountPaid =
                Number(assignment.amountPaid || 0) + paymentAmount;

            const newStatus =
                newAmountPaid >= Number(assignment.amountDue)
                    ? "paid"
                    : "partial";

            // Create the successful manual payment record.
            const [payment] = await Payment.create(
                [
                    {
                        user: userId,
                        obligationAssignment: assignmentId,
                        amount: paymentAmount,
                        currency: "NGN",
                        status: "successful",
                        paymentMethod,
                        gateway: "manual",
                        paidAt: paymentDate,
                        metadata: {
                            manualReference: reference?.trim() || null,
                            notes: notes?.trim() || "",
                            recordedBy: req.user._id,
                        },
                    },
                ],
                { session }
            );

            // Update the assignment.
            updatedAssignment = await ObligationAssignment.findByIdAndUpdate(
                assignmentId,
                {
                    $set: {
                        amountPaid: newAmountPaid,
                        status: newStatus,
                    },
                },
                {
                    new: true,
                    runValidators: true,
                    session,
                }
            ).populate("obligation");


            if (!updatedAssignment) {
  throw new Error("Failed to update obligation assignment.");
}


            // Recalculate the member's financial standing.
            financialStatus = await updateMemberFinancialStatus(
                userId,
                assignment.obligation.year,
                session,
                {
                    actor: req.user._id,
                    req,
                    source: "manual_payment",
                    paymentId: payment._id,
                    reference: reference?.trim() || null,
                }
            );

            // Record which Treasurer performed the action.
            await createAuditLog({
                actor: req.user._id,
                action: "payment.manual_recorded",
                resource: "Payment",
                resourceId: payment._id,
                targetUser: userId,
                req,
                session,
                details: {
                    amount: paymentAmount,
                    currency: "NGN",
                    paymentMethod,
                    gateway: "manual",
                    assignmentId,
                    previousAmountPaid: Number(assignment.amountPaid || 0),
                    newAmountPaid,
                    amountDue: Number(assignment.amountDue),
                    outstandingBalance: Math.max(
                        0,
                        Number(assignment.amountDue) - newAmountPaid
                    ),
                    reference: reference?.trim() || null,
                    notes: notes?.trim() || "",
                },
            });

            createdPayment = payment;
        });

        return res.status(201).json({
            success: true,
            message: "Offline payment recorded successfully.",
            payment: createdPayment,
            assignment: updatedAssignment,
            financialStatus,
        });
    } catch (error) {
        console.error("Record Offline Payment Error:", error);

        const clientErrors = [
            "Obligation assignment not found for this member.",
            "The obligation linked to this assignment was not found.",
            "This endpoint only supports individual obligations.",
            "This obligation has already been fully paid.",
        ];

        const isClientError =
            clientErrors.includes(error.message) ||
            error.message.startsWith("Payment exceeds the outstanding balance");

        return res.status(isClientError ? 400 : 500).json({
            success: false,
            message: isClientError
                ? error.message
                : "Failed to record offline payment.",
        });
    } finally {
        await session.endSession();
    }
};