import mongoose from "mongoose";
import crypto from "crypto";

import Payment from "../models/Payment.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import YearSet from "../models/YearSet.js";
import Chapter from "../models/Chapter.js";

import { paystackRequest } from "../config/paystack.js";
import { isPaystackAmountValid } from "../services/paystackAmount.js";

import {
    completeSuccessfulCombinedPayment,
} from "../services/combinedPaymentService.js";

import {
    handleFailedPayment,
    handlePaymentVerificationMismatch,
} from "../services/paymentService.js";


/**
 * Initialize one Paystack transaction for multiple obligation assignments.
 *
 * Supported assignment types:
 * - Individual: member pays their own assignment.
 * - Year Set: only the Year Set leader can pay.
 * - Chapter: only the Chapter leader can pay.
 *
 * The backend calculates all outstanding amounts.
 * Client-supplied amounts are never trusted.
 */
export const initializeCombinedPayment = async (req, res) => {
    let payment = null;

    try {
        const userId = req.user._id;
        const { obligationAssignmentIds } = req.body;

        // Validate the selected assignments.
        if (
            !Array.isArray(obligationAssignmentIds) ||
            obligationAssignmentIds.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Please select at least one obligation to pay.",
            });
        }

        if (obligationAssignmentIds.length > 50) {
            return res.status(400).json({
                success: false,
                message: "You cannot combine more than 50 obligations in one payment.",
            });
        }

        const invalidId = obligationAssignmentIds.some(
            (id) => !mongoose.Types.ObjectId.isValid(id)
        );

        if (invalidId) {
            return res.status(400).json({
                success: false,
                message: "One or more selected obligation IDs are invalid.",
            });
        }

        const uniqueIds = [
            ...new Set(obligationAssignmentIds.map(String)),
        ];

        if (uniqueIds.length !== obligationAssignmentIds.length) {
            return res.status(400).json({
                success: false,
                message: "Duplicate obligations were selected.",
            });
        }

        // Retrieve every selected assignment.
        const assignments = await ObligationAssignment.find({
            _id: { $in: uniqueIds },
        }).populate({
            path: "obligation",
            select: "name title category year description isActive",
        });

        if (assignments.length !== uniqueIds.length) {
            return res.status(404).json({
                success: false,
                message: "One or more selected obligations could not be found.",
            });
        }

        // Collect Year Set and Chapter IDs that require leader authorization.
        const yearSetIds = assignments
            .filter((assignment) => assignment.yearSet)
            .map((assignment) => assignment.yearSet);

        const chapterIds = assignments
            .filter((assignment) => assignment.chapter)
            .map((assignment) => assignment.chapter);

        // Only actual leaders are authorized to pay collective assignments.
        const [authorizedYearSets, authorizedChapters] = await Promise.all([
            yearSetIds.length
                ? YearSet.find({
                    _id: { $in: yearSetIds },
                    leader: userId,
                }).select("_id").lean()
                : [],

            chapterIds.length
                ? Chapter.find({
                    _id: { $in: chapterIds },
                    leader: userId,
                }).select("_id").lean()
                : [],
        ]);

        const authorizedYearSetIds = new Set(
            authorizedYearSets.map((item) => String(item._id))
        );

        const authorizedChapterIds = new Set(
            authorizedChapters.map((item) => String(item._id))
        );

        // Validate ownership, assignment category, and obligation status.
        for (const assignment of assignments) {
            const obligation = assignment.obligation;

            if (!obligation) {
                return res.status(400).json({
                    success: false,
                    message: "A selected assignment has no valid obligation.",
                });
            }

            if (obligation.isActive === false) {
                return res.status(400).json({
                    success: false,
                    message: `"${obligation.name || obligation.title || "An obligation"}" is no longer active.`,
                });
            }

            let authorized = false;

            if (
                obligation.category === "individual" &&
                assignment.user &&
                String(assignment.user) === String(userId)
            ) {
                authorized = true;
            }

            if (
                obligation.category === "yearSet" &&
                assignment.yearSet &&
                authorizedYearSetIds.has(String(assignment.yearSet))
            ) {
                authorized = true;
            }

            if (
                obligation.category === "chapter" &&
                assignment.chapter &&
                authorizedChapterIds.has(String(assignment.chapter))
            ) {
                authorized = true;
            }

            if (!authorized) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to pay one or more of the selected obligations.",
                });
            }
        }

        // Calculate the outstanding balance for each assignment.
        const allocations = [];
        let totalAmount = 0;

        for (const assignment of assignments) {
            const amountDue = Number(assignment.amountDue || 0);
            const amountPaid = Number(assignment.amountPaid || 0);

            const outstanding = Number(
                (amountDue - amountPaid).toFixed(2)
            );

            if (!Number.isFinite(outstanding) || outstanding <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "One or more selected obligations have no outstanding balance.",
                });
            }

            allocations.push({
                obligationAssignment: assignment._id,
                amount: outstanding,
            });

            totalAmount += outstanding;
        }

        totalAmount = Number(totalAmount.toFixed(2));

        if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "The combined payment amount is invalid.",
            });
        }

        // Use the same fallback email behavior as the existing payment flow.
        const payerEmail =
            req.user.email || process.env.PAYSTACK_FALLBACK_EMAIL;

        if (!payerEmail) {
            return res.status(500).json({
                success: false,
                message: "Payment email configuration is missing.",
            });
        }

        const reference = `NOSA-${Date.now()}-${crypto
            .randomBytes(4)
            .toString("hex")
            .toUpperCase()}`;

        // Create one pending payment containing all allocations.
        payment = new Payment({
            user: userId,
            obligationAssignment: null,
            allocations,
            amount: totalAmount,
            currency: "NGN",
            status: "pending",
            gateway: "paystack",
            gatewayReference: reference,
            metadata: {
                paymentType: "combined",
                allocationCount: allocations.length,
                obligationNames: assignments.map(
                    (assignment) =>
                        assignment.obligation.name ||
                        assignment.obligation.title ||
                        "Obligation"
                ),
            },
        });

        await payment.save();

        // Initialize one Paystack checkout for the combined amount.
        const paystackResponse = await paystackRequest(
            "/transaction/initialize",
            {
                method: "POST",
                body: JSON.stringify({
                    email: payerEmail,
                    amount: Math.round(totalAmount * 100),
                    currency: "NGN",
                    reference,
                    callback_url: process.env.PAYSTACK_CALLBACK_URL,
                    metadata: {
                        paymentId: String(payment._id),
                        userId: String(userId),
                        paymentType: "combined",
                        allocationCount: allocations.length,
                        obligationAssignmentIds: allocations.map(
                            (item) => String(item.obligationAssignment)
                        ),
                    },
                }),
            }
        );

        // paystackRequest returns the Paystack response wrapper.
        // The authorization URL is inside response.data, not response.data.data.
        const paystackData = paystackResponse.data;

        if (!paystackData?.authorization_url) {
            throw new Error(
                "Paystack did not return a valid checkout URL."
            );
        }

        return res.status(200).json({
            success: true,
            message: "Combined payment initialized successfully.",
            authorizationUrl: paystackData.authorization_url,
            accessCode: paystackData.access_code,
            reference,
            allocations: allocations.map((allocation) => ({
                obligationAssignment: allocation.obligationAssignment,
                amount: allocation.amount,
            })),
            totalAmount,
        });
    } catch (error) {
        console.error(
            "Combined payment initialization error:",
            error
        );

        // Remove the pending record if Paystack initialization failed.
        if (payment?._id) {
            try {
                await Payment.deleteOne({
                    _id: payment._id,
                    status: "pending",
                });
            } catch (deleteError) {
                console.error(
                    "Failed to remove uninitialized combined payment:",
                    deleteError
                );
            }
        }

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Unable to initialize combined payment.",
        });
    }
};


/**
 * Verify a combined Paystack payment.
 */
export const verifyCombinedPayment = async (req, res) => {
    try {
        const { reference } = req.params;
        const userId = req.user._id;

        if (!reference) {
            return res.status(400).json({
                success: false,
                message: "Payment reference is required.",
            });
        }

        const payment = await Payment.findOne({
            gatewayReference: reference,
            user: userId,
            gateway: "paystack",
            "metadata.paymentType": "combined",
        });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Combined payment record not found.",
            });
        }

        // Protect against processing a successful payment twice.
        if (payment.status === "successful") {
            return res.status(200).json({
                success: true,
                message: "This payment has already been verified.",
                payment,
                alreadyProcessed: true,
            });
        }

        const paystackResponse = await paystackRequest(
            `/transaction/verify/${encodeURIComponent(reference)}`,
            {
                method: "GET",
            }
        );

        // paystackRequest returns the wrapper; transaction is one level inside data.
        const transaction = paystackResponse.data;

        if (!transaction) {
            return res.status(400).json({
                success: false,
                message: "Paystack returned an invalid verification response.",
            });
        }

        const amountIsValid = isPaystackAmountValid(
            payment,
            transaction
        );

        const currencyIsValid =
            String(transaction.currency || "").toUpperCase() ===
            String(payment.currency || "NGN").toUpperCase();

        if (!amountIsValid || !currencyIsValid) {
            const reason = !amountIsValid
                ? "Paystack transaction amount does not match the expected combined payment amount."
                : "Paystack transaction currency does not match the expected payment currency.";

            await handlePaymentVerificationMismatch(
                payment,
                transaction,
                {
                    req,
                    actor: userId,
                    source: "combined_verification",
                    reason,
                }
            );

            return res.status(400).json({
                success: false,
                message:
                    "Payment verification failed because the transaction details do not match.",
            });
        }

        if (transaction.status === "success") {
            const result = await completeSuccessfulCombinedPayment(
                payment._id,
                transaction,
                {
                    actor: userId,
                    req,
                    source: "combined_verification",
                }
            );

            return res.status(200).json({
                success: true,
                message: "Combined payment verified successfully.",
                payment: result.payment,
                assignments: result.assignments,
                alreadyProcessed: result.alreadyProcessed || false,
            });
        }

        if (
            ["failed", "reversed", "abandoned"].includes(
                transaction.status
            )
        ) {
            const paymentStatus =
                transaction.status === "abandoned"
                    ? "cancelled"
                    : "failed";

            await handleFailedPayment(
                payment,
                transaction,
                paymentStatus,
                {
                    actor: userId,
                    req,
                    source: "combined_verification",
                }
            );

            return res.status(400).json({
                success: false,
                message: "This combined payment was not successful.",
                paymentStatus,
            });
        }

        return res.status(202).json({
            success: false,
            pending: true,
            message:
                "Your payment is still being processed. Please check again shortly.",
        });
    } catch (error) {
        console.error(
            "Combined payment verification error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Unable to verify combined payment.",
        });
    }
};