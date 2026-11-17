import mongoose from "mongoose";
import crypto from "crypto";
import Payment from "../models/Payment.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import Obligation from "../models/Obligation.js";
import { paystackRequest } from "../config/paystack.js";
import { completeSuccessfulPayment } from "../services/paymentService.js";
import { verifyPendingPayments } from "../services/pendingPaymentVerificationService.js";
import { handleFailedPayment, handlePaymentVerificationMismatch } from "../services/paymentService.js";
import { isPaystackAmountValid } from "../services/paystackAmount.js";
import {
    completeSuccessfulCombinedPayment,
} from "../services/combinedPaymentService.js";


import YearSet from "../models/YearSet.js";
import Chapter from "../models/Chapter.js";



export const getMyPayments = async (req, res) => {
    try {
        const payments = await Payment.find({
            user: req.user._id,
        })
            .populate({
                path: "obligationAssignment",
                select: "amountDue amountPaid status dueDate",
                populate: {
                    path: "obligation",
                    select: "name category year",
                },
            })
            .populate({
                path: "allocations.obligationAssignment",
                select: "amountDue amountPaid status dueDate obligation",
                populate: {
                    path: "obligation",
                    select: "name category year",
                },
            })
            .populate({
                path: "user",
                select: "firstName middleName lastName email alumniId",
            })
            .sort({
                createdAt: -1,
            })
            .lean();


        const summary = {
            totalPaid: 0,
            successful: 0,
            pending: 0,
            failed: 0,
        };

        payments.forEach((payment) => {

            if (payment.status === "successful") {
                summary.totalPaid += payment.amount;
                summary.successful += 1;
            }

            if (payment.status === "pending") {
                summary.pending += 1;
            }

            if (
                payment.status === "failed" ||
                payment.status === "cancelled"
            ) {
                summary.failed += 1;
            }
        });

        res.status(200).json({
            success: true,
            summary,
            payments,
        });

    } catch (error) {

        console.error(
            "Get payment history error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to load payment history.",
        });
    }
};


export const initializePayment = async (
    req,
    res
) => {
    try {
        const userId = req.user._id;

        const {
            obligationAssignmentId,
            amount,
        } = req.body;



        if (!obligationAssignmentId) {
            return res.status(400).json({
                success: false,
                message:
                    "Obligation assignment is required.",
            });
        }

        const requestedAmount = Number(amount);

        if (
            !Number.isFinite(requestedAmount) ||
            requestedAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Please enter a valid payment amount.",
            });
        }



        const assignment =
            await ObligationAssignment.findById(
                obligationAssignmentId
            ).populate({
                path: "obligation",
                select: "name category year description isActive",
            });

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: "Obligation assignment not found.",
            });
        }

        let isAuthorizedPayer = false;

        if (assignment.user) {
            // Individual assignments can only be paid by their owner.
            isAuthorizedPayer =
                assignment.user.toString() === userId.toString();
        } else if (assignment.yearSet) {
            // A Year Set assignment belongs to the Year Set,
            // not to its current leader personally.
            const yearSet = await YearSet.findById(
                assignment.yearSet
            ).select("leader isActive");

            isAuthorizedPayer =
                Boolean(yearSet) &&
                yearSet.isActive !== false &&
                yearSet.leader?.toString() === userId.toString();
        } else if (assignment.chapter) {
            // A Chapter assignment belongs to the Chapter.
            const chapter = await Chapter.findById(
                assignment.chapter
            ).select("leader isActive");

            isAuthorizedPayer =
                Boolean(chapter) &&
                chapter.isActive !== false &&
                chapter.leader?.toString() === userId.toString();
        }

        if (!isAuthorizedPayer) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not authorized to pay this obligation.",
            });
        }

        if (!assignment.obligation?.isActive) {
            return res.status(400).json({
                success: false,
                message:
                    "This obligation is currently inactive and cannot receive payments.",
            });
        }


        // CALCULATE OUTSTANDING
        const amountDue =
            Number(
                assignment.amountDue || 0
            );

        const amountPaid =
            Number(
                assignment.amountPaid || 0
            );

        const outstanding =
            Math.max(
                amountDue - amountPaid,
                0
            );


        // ALREADY PAID
        if (outstanding <= 0) {
            return res.status(400).json({
                success: false,
                message:
                    "This obligation has already been fully paid.",
            });
        }



        // AMOUNT TOO HIGH
        if (requestedAmount > outstanding) {
            return res.status(400).json({
                success: false,

                message:
                    `Payment amount cannot exceed the outstanding balance of ₦${outstanding.toLocaleString()}.`,

                outstanding,
            });
        }

        if (requestedAmount <= 0) {
            throw new Error(
                "Invalid payment amount."
            );
        }

        // GENERATE UNIQUE REFERENCE
        const reference =
            `NOSA-${Date.now()}-${Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase()}`;

        const payerEmail = req.user.email || process.env.PAYSTACK_FALLBACK_EMAIL;

        if (!payerEmail) {
            return res.status(500).json({
                success: false,
                message: "Payment email configuration is missing.",
            });
        }


        // CREATE PENDING PAYMENT
        const payment = await Payment.create({
            user: userId,

            obligationAssignment:
                assignment._id,

            amount:
                requestedAmount,

            currency:
                "NGN",

            status:
                "pending",

            gateway:
                "paystack",

            gatewayReference:
                reference,

            metadata: {
                obligationName:
                    assignment.obligation?.name,

                obligationCategory:
                    assignment.obligation?.category,
            },
        });


        // INITIALIZE PAYSTACK
        const paystackData =
            await paystackRequest(
                "/transaction/initialize",
                {
                    method: "POST",

                    body: JSON.stringify({
                        email: payerEmail,

                        amount:
                            requestedAmount * 100,

                        currency:
                            "NGN",

                        reference,

                        callback_url:
                            process.env
                                .PAYSTACK_CALLBACK_URL,

                        metadata: {
                            paymentId: payment._id.toString(),

                            userId: userId.toString(),

                            obligationAssignmentId: assignment._id.toString(),
                            payerEmail,

                        },
                    }),
                }
            );


        // RESPONSE
        res.status(200).json({
            success: true,

            message:
                "Payment initialized successfully.",

            payment: {
                id:
                    payment._id,

                amount:
                    payment.amount,

                reference,
            },

            authorizationUrl:
                paystackData.data.authorization_url,

            accessCode:
                paystackData.data.access_code,
        });

    } catch (error) {

        console.error(
            "Initialize payment error:",
            error
        );

        res.status(500).json({
            success: false,

            message:
                error.message ||
                "Failed to initialize payment.",
        });
    }
};

export const verifyPayment = async (req, res) => {
    try {
        const userId = req.user._id;
        const { reference } = req.params;

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
        });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment record not found.",
            });
        }

        if (payment.status === "successful") {
            return res.status(200).json({
                success: true,
                message: "Payment already verified.",
                payment,
            });
        }

        const paystackResponse = await paystackRequest(
            `/transaction/verify/${encodeURIComponent(reference)}`,
            { method: "GET" }
        );

        const transaction = paystackResponse.data;

        if (!transaction) {
            return res.status(502).json({
                success: false,
                message: "Unable to verify the transaction with Paystack.",
            });
        }


        const expectedCurrency = payment.currency || "NGN";

        const amountMismatch = !isPaystackAmountValid(
            payment,
            transaction // Use `data` inside the webhook instead.
        );

        const currencyMismatch =
            !transaction.currency ||
            transaction.currency.toUpperCase() !==
            expectedCurrency.toUpperCase();

        if (amountMismatch || currencyMismatch) {
            const reason = amountMismatch
                ? "Paystack transaction amount mismatch."
                : "Paystack transaction currency mismatch.";

            await handlePaymentVerificationMismatch(
                payment,
                transaction,
                {
                    actor: userId,
                    req,
                    source: "member_verification",
                    reason,
                }
            );

            return res.status(400).json({
                success: false,
                message:
                    "Payment verification failed. Please contact support.",
            });
        }

        if (transaction.status === "success") {
            const isCombinedPayment =
                payment.metadata?.paymentType === "combined";

            const completionFunction = isCombinedPayment
                ? completeSuccessfulCombinedPayment
                : completeSuccessfulPayment;

            const result = await completionFunction(
                payment._id,
                transaction,
                {
                    actor: userId,
                    req,
                    source: "member_verification",
                }
            );

            return res.status(200).json({
                success: true,
                message: result.alreadyProcessed
                    ? "Payment already verified."
                    : "Payment verified successfully.",
                payment: result.payment,
                assignment: result.assignment || null,
                assignments: result.assignments || [],
            });
        }

        if (
            ["failed", "reversed", "abandoned"].includes(
                transaction.status
            )
        ) {
            const failedStatus =
                transaction.status === "abandoned"
                    ? "cancelled"
                    : "failed";

            await handleFailedPayment(
                payment,
                transaction,
                failedStatus,
                {
                    actor: userId,
                    req,
                    source: "member_verification",
                }
            );

            return res.status(200).json({
                success: false,
                message: "Payment was not successful.",
            });
        }

        return res.status(200).json({
            success: false,
            message: "Payment is still being processed.",
            payment,
        });
    } catch (error) {
        console.error("Verify payment error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to verify payment.",
        });
    }
};



export const handlePaystackWebhook = async (req, res) => {
    try {
        const signature = req.headers["x-paystack-signature"];

        if (!signature || !process.env.PAYSTACK_SECRET_KEY) {
            return res.status(401).json({
                success: false,
                message: "Missing or invalid Paystack signature.",
            });
        }

        const rawBody = req.body;

        if (!Buffer.isBuffer(rawBody)) {
            return res.status(400).json({
                success: false,
                message: "Invalid webhook body.",
            });
        }

        const expectedSignature = crypto
            .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
            .update(rawBody)
            .digest("hex");

        const receivedBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSignature);

        if (
            receivedBuffer.length !== expectedBuffer.length ||
            !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid Paystack signature.",
            });
        }

        let payload;

        try {
            payload = JSON.parse(rawBody.toString("utf8"));
        } catch {
            return res.status(400).json({
                success: false,
                message: "Invalid webhook payload.",
            });
        }

        const { event, data } = payload;
        const reference = data?.reference;

        if (!reference) {
            return res.status(200).json({
                success: true,
                message: "Webhook received without reference.",
            });
        }

        const payment = await Payment.findOne({
            gatewayReference: reference,
            gateway: "paystack",
        });

        if (!payment) {
            console.warn("Paystack payment not found:", reference);

            // Acknowledge unknown references to prevent endless retries.
            return res.status(200).json({
                success: true,
                message: "Payment record not found.",
            });
        }

        if (payment.status === "successful") {
            return res.status(200).json({
                success: true,
                message: "Payment already processed.",
            });
        }

        if (event === "charge.failed") {
            await handleFailedPayment(payment, data, "failed", {
                req,
                source: "paystack_webhook",
            });

            return res.status(200).json({
                success: true,
                message: "Failed payment event handled.",
            });
        }

        if (event !== "charge.success") {
            return res.status(200).json({
                success: true,
                message: "Event received.",
            });
        }


        const expectedCurrency = payment.currency || "NGN";

        const amountMismatch = !isPaystackAmountValid(
            payment,
            data // Use `data` inside the webhook instead.
        );

        const currencyMismatch =
            !data.currency ||
            data.currency.toUpperCase() !==
            expectedCurrency.toUpperCase();

        if (amountMismatch || currencyMismatch) {
            const reason = amountMismatch
                ? "Paystack transaction amount mismatch."
                : "Paystack transaction currency mismatch.";

            await handlePaymentVerificationMismatch(
                payment,
                data,
                {
                    req,
                    source: "paystack_webhook",
                    reason,
                }
            );

            console.error(
                `Payment verification mismatch for ${reference}: ${reason}`
            );

            // The event was handled and recorded. Do not retry it endlessly.
            return res.status(200).json({
                success: true,
                message: "Payment verification discrepancy recorded.",
            });
        }

        const isCombinedPayment =
            payment.metadata?.paymentType === "combined";

        if (isCombinedPayment) {
            await completeSuccessfulCombinedPayment(
                payment._id,
                data,
                {
                    req,
                    source: "paystack_webhook",
                }
            );
        } else {
            await completeSuccessfulPayment(
                payment._id,
                data,
                {
                    req,
                    source: "paystack_webhook",
                }
            );
        }

        return res.status(200).json({
            success: true,
            message: "Payment processed successfully.",
        });
    } catch (error) {
        console.error("Paystack webhook error:", error);

        return res.status(500).json({
            success: false,
            message: "Webhook processing failed.",
        });
    }
};



export const handlePaystackCallback = async (
    req,
    res
) => {
    try {
        const {
            reference,
        } = req.query;

        if (!reference) {
            return res.redirect(
                `${process.env.FRONTEND_URL}/portal/member/dashboard/payment-history?payment=failed`
            );
        }

        return res.redirect(
            `${process.env.FRONTEND_URL}/portal/member/dashboard/payment-history?payment=verify&reference=${encodeURIComponent(
                reference
            )}`
        );

    } catch (error) {

        console.error(
            "Paystack callback error:",
            error
        );

        return res.redirect(
            `${process.env.FRONTEND_URL}/portal/member/dashboard/payment-history?payment=failed`
        );
    }
};






export const verifyPendingPaymentsInternal = async (req, res) => {
    try {
        const internalSecret = req.headers["x-internal-secret"];

        if (
            !internalSecret ||
            internalSecret !== process.env.INTERNAL_PAYMENT_SECRET
        ) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized.",
            });
        }

        const result = await verifyPendingPayments();

        return res.status(200).json({
            success: true,
            message: "Pending payments checked successfully.",
            result,
        });
    } catch (error) {
        console.error(
            "Internal pending payment verification error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Pending payment verification failed.",
        });
    }
};




export const getAdminPayments = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = "",
            status = "",
            gateway = "",
            paymentMethod = "",
            startDate = "",
            endDate = "",
        } = req.query;

        const pageNumber = Math.max(Number(page) || 1, 1);

        const limitNumber = Math.min(
            Math.max(Number(limit) || 20, 1),
            100
        );

        const skip =
            (pageNumber - 1) * limitNumber;

        const query = {};

        // ========================================
        // STATUS
        // ========================================

        if (status) {
            query.status = status;
        }

        // ========================================
        // GATEWAY
        // ========================================

        if (gateway) {
            query.gateway = gateway;
        }

        // ========================================
        // PAYMENT METHOD
        // ========================================

        if (paymentMethod) {
            query.paymentMethod = paymentMethod;
        }

        // ========================================
        // DATE FILTER
        // ========================================

        if (startDate || endDate) {
            query.createdAt = {};

            if (startDate) {
                query.createdAt.$gte =
                    new Date(
                        `${startDate}T00:00:00.000Z`
                    );
            }

            if (endDate) {
                query.createdAt.$lte =
                    new Date(
                        `${endDate}T23:59:59.999Z`
                    );
            }
        }

        // ========================================
        // SEARCH
        // ========================================

        if (search.trim()) {
            const searchRegex =
                new RegExp(
                    search.trim(),
                    "i"
                );

            const users = await mongoose
                .model("User")
                .find({
                    $or: [
                        {
                            email: searchRegex,
                        },
                        {
                            alumniId: searchRegex,
                        },
                        {
                            firstName: searchRegex,
                        },
                        {
                            middleName: searchRegex,
                        },
                        {
                            lastName: searchRegex,
                        },
                    ],
                })
                .select("_id")
                .lean();

            const userIds = users.map(
                (user) => user._id
            );

            query.$or = [
                {
                    gatewayReference:
                        searchRegex,
                },
                {
                    user: {
                        $in: userIds,
                    },
                },
            ];
        }

        // ========================================
        // PAYMENTS + TOTAL
        // ========================================

        const [
            payments,
            total,
        ] = await Promise.all([
            Payment.find(query)
                .populate({
                    path: "user",
                    select:
                        "firstName middleName lastName email alumniId",
                })
                .populate({
                    path: "obligationAssignment",
                    select:
                        "amountDue amountPaid status dueDate obligation isOptional",
                    populate: {
                        path: "obligation",
                        select:
                            "name category year isActive isOptional",
                    },
                })
                .populate({
                    path: "allocations.obligationAssignment",
                    select: "amountDue amountPaid status dueDate obligation isOptional",
                    populate: {
                        path: "obligation",
                        select: "name category year isActive isOptional",
                    },
                })
                .sort({
                    createdAt: -1,
                })
                .skip(skip)
                .limit(limitNumber)
                .lean(),

            Payment.countDocuments(query),
        ]);

        // ========================================
        // SUMMARY
        // ========================================

        const summary = await Payment.aggregate([
            {
                $match: query,
            },

            {
                $group: {
                    _id: null,

                    totalPayments: {
                        $sum: 1,
                    },

                    successful: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: [
                                        "$status",
                                        "successful",
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },

                    pending: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: [
                                        "$status",
                                        "pending",
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },

                    failed: {
                        $sum: {
                            $cond: [
                                {
                                    $in: [
                                        "$status",
                                        [
                                            "failed",
                                            "cancelled",
                                        ],
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },

                    totalReceived: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: [
                                        "$status",
                                        "successful",
                                    ],
                                },
                                "$amount",
                                0,
                            ],
                        },
                    },
                },
            },
        ]);

        const summaryData =
            summary[0] || {
                totalPayments: 0,
                successful: 0,
                pending: 0,
                failed: 0,
                totalReceived: 0,
            };

        // ========================================
        // COLLECTION BY OBLIGATION TYPE + CATEGORY
        // ========================================
        //
        // Only successful payments count as actual
        // collection.
        //
        // IMPORTANT:
        // summary.totalReceived is already the
        // authoritative total received amount.
        // collectionBreakdown is only used to show
        // mandatory vs optional + category breakdown.
        //
        // ========================================

        const collectionResult = await Payment.aggregate([
            {
                $match: {
                    ...query,
                    status: "successful",
                },
            },

            // Normalize old single payments and new combined payments.
            {
                $project: {
                    allocationItems: {
                        $cond: [
                            {
                                $and: [
                                    {
                                        $eq: [
                                            "$metadata.paymentType",
                                            "combined",
                                        ],
                                    },
                                    {
                                        $gt: [
                                            {
                                                $size: {
                                                    $ifNull: [
                                                        "$allocations",
                                                        [],
                                                    ],
                                                },
                                            },
                                            0,
                                        ],
                                    },
                                ],
                            },

                            {
                                $map: {
                                    input: "$allocations",
                                    as: "allocation",
                                    in: {
                                        assignmentId:
                                            "$$allocation.obligationAssignment",
                                        amount: "$$allocation.amount",
                                    },
                                },
                            },

                            {
                                $cond: [
                                    {
                                        $ne: [
                                            "$obligationAssignment",
                                            null,
                                        ],
                                    },
                                    [
                                        {
                                            assignmentId:
                                                "$obligationAssignment",
                                            amount: "$amount",
                                        },
                                    ],
                                    [],
                                ],
                            },
                        ],
                    },
                },
            },

            {
                $unwind: "$allocationItems",
            },

            // Find each allocation's assignment.
            {
                $lookup: {
                    from: ObligationAssignment.collection.name,
                    localField: "allocationItems.assignmentId",
                    foreignField: "_id",
                    as: "assignment",
                },
            },

            {
                $unwind: "$assignment",
            },

            // Find the corresponding obligation.
            {
                $lookup: {
                    from: Obligation.collection.name,
                    localField: "assignment.obligation",
                    foreignField: "_id",
                    as: "obligation",
                },
            },

            {
                $unwind: "$obligation",
            },

            // First group: combine allocations belonging to the
            // same payment and obligation category.
            {
                $group: {
                    _id: {
                        paymentId: "$_id",

                        type: {
                            $cond: [
                                {
                                    $eq: [
                                        "$obligation.isOptional",
                                        true,
                                    ],
                                },
                                "optional",
                                "mandatory",
                            ],
                        },

                        category: "$obligation.category",
                    },

                    amount: {
                        $sum: "$allocationItems.amount",
                    },
                },
            },

            // Second group: aggregate category totals.
            // Each original payment counts only once per category.
            {
                $group: {
                    _id: {
                        type: "$_id.type",
                        category: "$_id.category",
                    },

                    amount: {
                        $sum: "$amount",
                    },

                    transactions: {
                        $sum: 1,
                    },
                },
            },
        ]);

        // ========================================
        // NORMALIZED COLLECTION BREAKDOWN
        // ========================================

        const createCollectionBucket = () => ({
            amount: 0,
            transactions: 0,

            individual: {
                amount: 0,
                transactions: 0,
            },

            yearSet: {
                amount: 0,
                transactions: 0,
            },

            chapter: {
                amount: 0,
                transactions: 0,
            },
        });

        const collectionBreakdown = {
            mandatory: createCollectionBucket(),
            optional: createCollectionBucket(),

            // IMPORTANT:
            // Do NOT calculate this separately.
            // totalReceived below is the source of truth.
            total: {
                amount: Number(
                    summaryData.totalReceived || 0
                ),
                transactions: Number(
                    summaryData.successful || 0
                ),
            },
        };

        // ========================================
        // MAP AGGREGATED RESULTS
        // ========================================

        for (const item of collectionResult) {
            const type =
                item._id?.type === "optional"
                    ? "optional"
                    : "mandatory";

            const category =
                item._id?.category;

            const amount =
                Number(item.amount || 0);

            const transactions =
                Number(item.transactions || 0);

            // ====================================
            // TYPE TOTAL
            // ====================================

            collectionBreakdown[type].amount +=
                amount;

            collectionBreakdown[type].transactions +=
                transactions;

            // ====================================
            // CATEGORY TOTAL
            // ====================================

            if (
                [
                    "individual",
                    "yearSet",
                    "chapter",
                ].includes(category)
            ) {
                collectionBreakdown[type][
                    category
                ].amount += amount;

                collectionBreakdown[type][
                    category
                ].transactions += transactions;
            }
        }

        // ========================================
        // RESPONSE
        // ========================================

        return res.status(200).json({
            success: true,

            data: {
                payments,

                summary: summaryData,

                collectionBreakdown,

                pagination: {
                    page: pageNumber,
                    limit: limitNumber,
                    total,
                    totalPages:
                        Math.ceil(
                            total /
                            limitNumber
                        ),
                },
            },
        });
    } catch (error) {
        console.error(
            "Get admin payments error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to load admin payments.",
        });
    }
};


export const getAdminPaymentById = async (
    req,
    res
) => {
    try {
        const { paymentId } = req.params;

        const payment =
            await Payment.findById(paymentId)
                .populate({
                    path: "user",
                    select:
                        "firstName middleName lastName email phone alumniId yearSet chapter",
                })
                .populate({
                    path: "obligationAssignment",
                    select:
                        "amountDue amountPaid status dueDate obligation",
                    populate: {
                        path: "obligation",
                        select: "name category year description isActive",
                    },
                })
                .populate({
                    path: "allocations.obligationAssignment",
                    select: "amountDue amountPaid status dueDate obligation",
                    populate: {
                        path: "obligation",
                        select: "name category year description isActive",
                    },
                })
                .lean();

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found.",
            });
        }

        return res.status(200).json({
            success: true,
            payment,
        });
    } catch (error) {
        console.error(
            "Get admin payment error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to load payment details.",
        });
    }
};


export const recoverFailedPayment = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const reason = req.body?.reason?.trim();

        // Validate payment ID
        if (!mongoose.isValidObjectId(paymentId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment ID.",
            });
        }

        // Require an audit reason
        if (!reason || reason.length < 10) {
            return res.status(400).json({
                success: false,
                message:
                    "Please provide a recovery reason of at least 10 characters.",
            });
        }

        if (reason.length > 500) {
            return res.status(400).json({
                success: false,
                message:
                    "Recovery reason cannot exceed 500 characters.",
            });
        }

        const payment = await Payment.findById(paymentId);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found.",
            });
        }

        // Only recover failed or cancelled Paystack payments
        if (
            payment.gateway !== "paystack" ||
            !payment.gatewayReference
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "This payment cannot be recovered through Paystack.",
            });
        }

        if (
            !["failed", "cancelled"].includes(payment.status)
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Only failed or cancelled payments can be recovered.",
            });
        }

        // Always verify against Paystack before recovery
        const paystackResponse = await paystackRequest(
            `/transaction/verify/${encodeURIComponent(
                payment.gatewayReference
            )}`,
            { method: "GET" }
        );

        const transaction = paystackResponse?.data;

        if (!transaction) {
            return res.status(502).json({
                success: false,
                message:
                    "Paystack did not return transaction details.",
            });
        }

        // Confirm this is the exact transaction
        if (
            transaction.reference !== payment.gatewayReference
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Paystack transaction reference does not match.",
            });
        }

        if (transaction.status !== "success") {
            return res.status(409).json({
                success: false,
                message:
                    "Paystack has not confirmed this transaction as successful.",
            });
        }

        // Validate original payment amount, including fee handling
        if (!isPaystackAmountValid(payment, transaction)) {
            return res.status(409).json({
                success: false,
                message:
                    "The verified transaction amount does not match the payment record.",
            });
        }

        const expectedCurrency = (
            payment.currency || "NGN"
        ).toUpperCase();

        if (
            !transaction.currency ||
            transaction.currency.toUpperCase() !==
            expectedCurrency
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "The verified transaction currency does not match the payment record.",
            });
        }

        // Use the existing service to update the payment,
        // obligation assignment, financial status and audit log.
        const isCombinedPayment =
            payment.metadata?.paymentType === "combined";

        const completionFunction = isCombinedPayment
            ? completeSuccessfulCombinedPayment
            : completeSuccessfulPayment;

        const result = await completionFunction(
            payment._id,
            transaction,
            {
                actor: req.user._id,
                req,
                source: "superadmin_recovery",
                recoveryReason: reason,
            }
        );

        if (result.alreadyProcessed) {
            return res.status(409).json({
                success: false,
                message:
                    "This payment has already been processed.",
            });
        }

        return res.status(200).json({
            success: true,
            message:
                "Payment recovered and verified successfully.",
            data: {
                payment: result.payment,
                assignment: result.assignment || null,
                assignments: result.assignments || [],
            },
        });
    } catch (error) {
        console.error(
            "Super Admin payment recovery error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Payment recovery failed. Check the server logs before retrying.",
        });
    }
};




export const getAdminPaymentHistoryExport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const isValidDate = (value) =>
            /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
            !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
            new Date(`${value}T00:00:00.000Z`)
                .toISOString()
                .startsWith(value);

        if (!isValidDate(startDate) || !isValidDate(endDate)) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid startDate and endDate are required (YYYY-MM-DD).",
            });
        }

        const start = new Date(`${startDate}T00:00:00.000Z`);
        const end = new Date(`${endDate}T23:59:59.999Z`);

        if (start > end) {
            return res.status(400).json({
                success: false,
                message: "Start date cannot be after end date.",
            });
        }

        const paymentDateFilter = {
            status: "successful",
            paidAt: { $gte: start, $lte: end },
        };

        const userSelect =
            "firstName middleName lastName email alumniId yearSet chapter graduationYear";

        const [
            payments,
            assignments,
            yearSets,
            chapters,
        ] = await Promise.all([
            Payment.find(paymentDateFilter)
                .populate({
                    path: "user",
                    select: userSelect,
                    populate: [
                        { path: "yearSet", select: "name year" },
                        { path: "chapter", select: "name code" },
                    ],
                })
                .populate({
                    path: "obligationAssignment",
                    select:
                        "user yearSet chapter amountDue amountPaid status dueDate obligation",
                    populate: [
                        {
                            path: "obligation",
                            select: "name category year isOptional",
                        },
                        {
                            path: "yearSet",
                            select: "name year",
                        },
                        {
                            path: "chapter",
                            select: "name code",
                        },
                    ],
                })
                .populate({
                    path: "allocations.obligationAssignment",
                    select:
                        "user yearSet chapter amountDue amountPaid status dueDate obligation",
                    populate: [
                        {
                            path: "obligation",
                            select: "name category year isOptional",
                        },
                        {
                            path: "yearSet",
                            select: "name year",
                        },
                        {
                            path: "chapter",
                            select: "name code",
                        },
                    ],
                })
                .sort({ paidAt: 1, _id: 1 })
                .lean(),

            ObligationAssignment.find({})
                .populate({
                    path: "user",
                    select: userSelect,
                    populate: [
                        { path: "yearSet", select: "name year" },
                        { path: "chapter", select: "name code" },
                    ],
                })
                .populate({
                    path: "yearSet",
                    select: "name year",
                })
                .populate({
                    path: "chapter",
                    select: "name code",
                })
                .populate({
                    path: "obligation",
                    select: "name category year isOptional",
                })
                .lean(),

            YearSet.find({})
                .select("name year")
                .sort({ year: 1, name: 1 })
                .lean(),

            Chapter.find({})
                .select("name code")
                .sort({ name: 1 })
                .lean(),
        ]);

        // ========================================
        // HELPERS
        // ========================================

        const getMemberName = (user) =>
            [
                user?.firstName,
                user?.middleName,
                user?.lastName,
            ]
                .filter(Boolean)
                .join(" ") || "Unknown member";

        const getId = (value) =>
            value?._id?.toString() || value?.toString() || "";

        const getYearSetName = (user) => {
            const yearSet = user?.yearSet;

            if (!yearSet) {
                return user?.graduationYear
                    ? String(user.graduationYear)
                    : "";
            }

            return (
                yearSet.name ||
                yearSet.year?.toString() ||
                ""
            );
        };

        const getObligationName = (assignment) =>
            assignment?.obligation?.name || "Unassigned obligation";

        const getCategory = (assignment) =>
            assignment?.obligation?.category || "unclassified";

        const createGroup = (name) => ({
            name,
            amountDue: 0,
            amountPaid: 0,
            outstanding: 0,
            successfulPaymentCount: 0,
        });

        // ========================================
        // INITIALIZE COLLECTIVE GROUPS
        // ========================================

        const yearSetGroups = new Map();
        const chapterGroups = new Map();

        for (const yearSet of yearSets) {
            yearSetGroups.set(
                getId(yearSet),
                createGroup(
                    yearSet.name ||
                    yearSet.year?.toString() ||
                    "Unnamed Year Set"
                )
            );
        }

        for (const chapter of chapters) {
            chapterGroups.set(
                getId(chapter),
                createGroup(chapter.name || "Unnamed Chapter")
            );
        }

        // ========================================
        // INDEX ASSIGNMENTS AND PAYMENTS
        // ========================================

        const assignmentsById = new Map();

        for (const assignment of assignments) {
            assignmentsById.set(getId(assignment), assignment);
        }

        const paymentsById = new Map();

        for (const payment of payments) {
            paymentsById.set(getId(payment), payment);
        }

        // ========================================
        // ATTRIBUTE PAYMENTS TO ASSIGNMENTS
        // ========================================

        const paidByAssignment = new Map();

        for (const payment of payments) {
            const isCombined =
                payment.metadata?.paymentType === "combined";

            if (
                isCombined &&
                Array.isArray(payment.allocations) &&
                payment.allocations.length > 0
            ) {
                for (const allocation of payment.allocations) {
                    const assignmentId = getId(
                        allocation.obligationAssignment
                    );

                    if (!assignmentId) continue;

                    paidByAssignment.set(
                        assignmentId,
                        (paidByAssignment.get(assignmentId) || 0) +
                        Number(allocation.amount || 0)
                    );
                }

                continue;
            }

            // Preserve existing single-payment behaviour.
            const assignmentId = getId(
                payment.obligationAssignment
            );

            if (!assignmentId) continue;

            paidByAssignment.set(
                assignmentId,
                (paidByAssignment.get(assignmentId) || 0) +
                Number(payment.amount || 0)
            );
        }

        // ========================================
        // OBLIGATION SUMMARIES
        // ========================================

        const individualObligations = [];
        const legacyOwnershipReview = [];

        for (const assignment of assignments) {
            const category = getCategory(assignment);
            const user = assignment.user;

            const assignmentId = getId(assignment);
            const amountDue = Number(assignment.amountDue || 0);

            const currentAmountPaid = Number(
                assignment.amountPaid || 0
            );

            const amountPaidDuringPeriod = Number(
                paidByAssignment.get(assignmentId) || 0
            );

            const outstanding = Math.max(
                amountDue - currentAmountPaid,
                0
            );

            if (category === "individual") {
                individualObligations.push({
                    alumniId: user?.alumniId || "",
                    memberName: getMemberName(user),
                    yearSet: getYearSetName(user),
                    obligation: getObligationName(assignment),
                    amountDue,
                    amountPaid: amountPaidDuringPeriod,
                    outstanding,
                    currentAmountPaid,
                    assignmentStatus: assignment.status || "",
                    recordNote: !user
                        ? "Assignment has no linked member"
                        : !user.alumniId
                            ? "Member record has no Alumni ID"
                            : "",
                });

                continue;
            }

            if (
                category !== "yearSet" &&
                category !== "chapter"
            ) {
                continue;
            }

            if (category === "yearSet") {
                const yearSetId = getId(assignment.yearSet);
                const group = yearSetGroups.get(yearSetId);

                if (!group) {
                    legacyOwnershipReview.push({
                        assignmentId,
                        category,
                        obligation: getObligationName(assignment),
                        amountDue,
                        currentAmountPaid,
                        outstanding,
                        amountPaidDuringPeriod,
                        assignmentStatus: assignment.status || "",
                        yearSetId: yearSetId || null,
                        chapterId: null,
                        formerPayerId: getId(assignment.user) || null,
                        recordNote: !yearSetId
                            ? "Collective assignment has no linked Year Set"
                            : "Linked Year Set was not found",
                    });

                    continue;
                }

                group.amountDue += amountDue;
                group.outstanding += outstanding;
                group.amountPaid += amountPaidDuringPeriod;
            }

            if (category === "chapter") {
                const chapterId = getId(assignment.chapter);
                const group = chapterGroups.get(chapterId);

                if (!group) {
                    legacyOwnershipReview.push({
                        assignmentId,
                        category,
                        obligation: getObligationName(assignment),
                        amountDue,
                        currentAmountPaid,
                        outstanding,
                        amountPaidDuringPeriod,
                        assignmentStatus: assignment.status || "",
                        yearSetId: null,
                        chapterId: chapterId || null,
                        formerPayerId: getId(assignment.user) || null,
                        recordNote: !chapterId
                            ? "Collective assignment has no linked Chapter"
                            : "Linked Chapter was not found",
                    });

                    continue;
                }

                group.amountDue += amountDue;
                group.outstanding += outstanding;
                group.amountPaid += amountPaidDuringPeriod;
            }
        }

        // ========================================
        // PAYMENT HISTORY ROW BUILDER
        // ========================================

        const buildPaymentHistoryRow = (
            payment,
            assignment,
            amount,
            allocationIndex = null
        ) => {
            const user = payment.user;
            const category = getCategory(assignment);

            const yearSet =
                category === "yearSet"
                    ? assignment?.yearSet
                    : user?.yearSet;

            const chapter =
                category === "chapter"
                    ? assignment?.chapter
                    : user?.chapter;

            let recordNote = "";

            if (!assignment) {
                recordNote =
                    "Successful payment has no linked obligation assignment";
            } else if (!assignment.obligation) {
                recordNote = "Linked assignment has no obligation";
            } else if (!user) {
                recordNote = "Linked payment has no member record";
            } else if (
                category === "yearSet" &&
                !assignment.yearSet
            ) {
                recordNote =
                    "Year Set assignment has no linked Year Set; review required";
            } else if (
                category === "chapter" &&
                !assignment.chapter
            ) {
                recordNote =
                    "Chapter assignment has no linked Chapter; review required";
            } else if (
                category === "yearSet" &&
                !yearSetGroups.has(getId(assignment.yearSet))
            ) {
                recordNote =
                    "Linked Year Set was not found; review required";
            } else if (
                category === "chapter" &&
                !chapterGroups.has(getId(assignment.chapter))
            ) {
                recordNote =
                    "Linked Chapter was not found; review required";
            } else if (
                category === "individual" &&
                !assignment.user
            ) {
                recordNote =
                    "Individual assignment has no linked member; review required";
            }

            const isClassifiable =
                !recordNote &&
                ["individual", "yearSet", "chapter"].includes(category);

            return {
                rowId:
                    allocationIndex === null
                        ? getId(payment)
                        : `${getId(payment)}-${allocationIndex}`,

                transactionDate: payment.paidAt || null,
                paymentId: getId(payment),
                assignmentId: getId(assignment) || null,

                payer: getMemberName(user),
                email: user?.email || "",
                alumniId: user?.alumniId || "",

                payerCategory: isClassifiable
                    ? category
                    : "unclassified",

                yearSet:
                    yearSet?.name ||
                    yearSet?.year?.toString() ||
                    "",

                chapter: chapter?.name || "",
                obligation: getObligationName(assignment),
                reference: payment.gatewayReference || "",
                paymentStatus: payment.status,
                paymentMethod: payment.paymentMethod || "",
                gateway: payment.gateway || "",
                currency: payment.currency || "NGN",
                amount: Number(amount || 0),
                recordNote,
            };
        };

        // ========================================
        // BUILD PAYMENT HISTORY
        // ========================================

        const paymentHistory = [];

        for (const payment of payments) {
            const isCombined =
                payment.metadata?.paymentType === "combined";

            if (
                isCombined &&
                Array.isArray(payment.allocations) &&
                payment.allocations.length > 0
            ) {
                let allocatedTotal = 0;

                payment.allocations.forEach(
                    (allocation, index) => {
                        const amount = Number(
                            allocation.amount || 0
                        );

                        allocatedTotal += amount;

                        paymentHistory.push(
                            buildPaymentHistoryRow(
                                payment,
                                allocation.obligationAssignment,
                                amount,
                                index
                            )
                        );
                    }
                );

                // Preserve any amount without a corresponding
                // allocation as an unclassified record.
                const unallocatedAmount = Number(
                    (
                        Number(payment.amount || 0) -
                        allocatedTotal
                    ).toFixed(2)
                );

                if (unallocatedAmount > 0) {
                    const row = buildPaymentHistoryRow(
                        payment,
                        null,
                        unallocatedAmount,
                        "unallocated"
                    );

                    row.recordNote =
                        "Part of this combined payment has no recorded allocation; review required";

                    paymentHistory.push(row);
                }

                continue;
            }

            // Existing single payments remain unchanged.
            paymentHistory.push(
                buildPaymentHistoryRow(
                    payment,
                    payment.obligationAssignment,
                    payment.amount
                )
            );
        }

        // ========================================
        // COLLECTION RECONCILIATION
        // ========================================

        const collectionByCategory = {
            individual: { amount: 0, transactions: 0 },
            yearSet: { amount: 0, transactions: 0 },
            chapter: { amount: 0, transactions: 0 },
            unclassified: { amount: 0, transactions: 0 },
        };

        // Distinct Paystack transaction IDs per category.
        const categoryPaymentIds = {
            individual: new Set(),
            yearSet: new Set(),
            chapter: new Set(),
            unclassified: new Set(),
        };

        // Distinct Paystack transaction IDs per collective group.
        const yearSetPaymentIds = new Map();
        const chapterPaymentIds = new Map();

        for (const row of paymentHistory) {
            const amount = Number(row.amount || 0);

            const category = [
                "individual",
                "yearSet",
                "chapter",
            ].includes(row.payerCategory)
                ? row.payerCategory
                : "unclassified";

            collectionByCategory[category].amount += amount;

            categoryPaymentIds[category].add(row.paymentId);

            // Resolve the original assignment directly by ID.
            const assignment = row.assignmentId
                ? assignmentsById.get(row.assignmentId)
                : null;

            if (
                category === "yearSet" &&
                assignment
            ) {
                const yearSetId = getId(assignment.yearSet);

                if (
                    yearSetId &&
                    yearSetGroups.has(yearSetId)
                ) {
                    if (!yearSetPaymentIds.has(yearSetId)) {
                        yearSetPaymentIds.set(
                            yearSetId,
                            new Set()
                        );
                    }

                    yearSetPaymentIds
                        .get(yearSetId)
                        .add(row.paymentId);
                }
            }

            if (
                category === "chapter" &&
                assignment
            ) {
                const chapterId = getId(assignment.chapter);

                if (
                    chapterId &&
                    chapterGroups.has(chapterId)
                ) {
                    if (!chapterPaymentIds.has(chapterId)) {
                        chapterPaymentIds.set(
                            chapterId,
                            new Set()
                        );
                    }

                    chapterPaymentIds
                        .get(chapterId)
                        .add(row.paymentId);
                }
            }
        }

        for (const category of Object.keys(collectionByCategory)) {
            collectionByCategory[category].transactions =
                categoryPaymentIds[category].size;
        }

        for (const [yearSetId, paymentIds] of yearSetPaymentIds) {
            yearSetGroups.get(yearSetId).successfulPaymentCount =
                paymentIds.size;
        }

        for (const [chapterId, paymentIds] of chapterPaymentIds) {
            chapterGroups.get(chapterId).successfulPaymentCount =
                paymentIds.size;
        }

        // ========================================
        // FINAL TOTALS
        // ========================================

        // Count original Paystack payments, not allocation rows.
        const totalCollected = payments.reduce(
            (sum, payment) =>
                sum + Number(payment.amount || 0),
            0
        );

        const successfulTransactionCount = payments.length;

        const categoryCollected = Object.values(
            collectionByCategory
        ).reduce(
            (sum, item) => sum + item.amount,
            0
        );

        const reconciliationDifference = Number(
            (totalCollected - categoryCollected).toFixed(2)
        );

        const unclassifiedPayments = paymentHistory.filter(
            (payment) => payment.payerCategory === "unclassified"
        );

        // ========================================
        // RESPONSE
        // ========================================

        return res.status(200).json({
            success: true,
            data: {
                startDate,
                endDate,

                collectionSummary: {
                    successfulTransactionCount,
                    totalCollected,
                    collectionByCategory,
                    categoryCollected,
                    reconciliationDifference,
                    reconciled: reconciliationDifference === 0,

                    unclassifiedTransactionCount:
                        new Set(
                            unclassifiedPayments.map(
                                (payment) => payment.paymentId
                            )
                        ).size,

                    unclassifiedAmount: unclassifiedPayments.reduce(
                        (sum, payment) =>
                            sum + Number(payment.amount || 0),
                        0
                    ),
                },

                yearSetSummary: [...yearSetGroups.values()],
                chapterSummary: [...chapterGroups.values()],
                individualObligations,
                paymentHistory,
                legacyOwnershipReview,
                legacyOwnershipReviewCount:
                    legacyOwnershipReview.length,

                notes: {
                    collectionDate:
                        "Only successful payments with paidAt inside the selected date range are included.",

                    collectionTotal:
                        "Total collected is calculated directly from the successful payment ledger. Each Paystack transaction is counted once.",

                    amountPaid:
                        "Amount Paid in obligation summaries means successful payments during the selected period.",

                    outstanding:
                        "Outstanding is the current assignment balance, not the balance as of the selected end date.",

                    unclassified:
                        "Successful payments with missing obligation relationships or allocation data remain included in total collections and are flagged for review.",

                    individualRecords:
                        "Individual obligation rows without Alumni IDs are retained and flagged for identification.",

                    collectiveOwnership:
                        "Year Set and Chapter obligations are attributed using explicit assignment ownership. Legacy collective assignments with missing or invalid ownership appear in legacyOwnershipReview and are excluded from group totals until reviewed.",

                    combinedPayments:
                        "Combined payments appear as separate allocation rows in paymentHistory. Transaction counts still count each original Paystack payment only once.",
                },
            },
        });
    } catch (error) {
        console.error("Payment history export data error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to prepare payment history export.",
        });
    }
};





export const verifyAdminPendingPayment = async (req, res) => {
    try {
        const { paymentId } = req.params;

        if (!mongoose.isValidObjectId(paymentId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment ID.",
            });
        }

        const payment = await Payment.findById(paymentId);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found.",
            });
        }

        if (
            payment.gateway !== "paystack" ||
            !payment.gatewayReference
        ) {
            return res.status(400).json({
                success: false,
                message: "This payment cannot be verified through Paystack.",
            });
        }

        if (payment.status !== "pending") {
            return res.status(409).json({
                success: false,
                message: "Only pending payments can be verified.",
            });
        }

        const paystackResponse = await paystackRequest(
            `/transaction/verify/${encodeURIComponent(
                payment.gatewayReference
            )}`,
            { method: "GET" }
        );

        const transaction = paystackResponse?.data;

        if (!transaction) {
            return res.status(502).json({
                success: false,
                message: "Paystack did not return transaction details.",
            });
        }

        if (transaction.reference !== payment.gatewayReference) {
            return res.status(409).json({
                success: false,
                message: "Paystack transaction reference does not match.",
            });
        }

       const expectedCurrency = (payment.currency || "NGN").toUpperCase();

const amountIsValid = isPaystackAmountValid(payment, transaction);

const currencyIsValid =
    transaction.currency &&
    transaction.currency.toUpperCase() === expectedCurrency;

if (!amountIsValid || !currencyIsValid) {
    const reason = !amountIsValid
        ? "Paystack transaction amount mismatch."
        : "Paystack transaction currency mismatch.";

    await handlePaymentVerificationMismatch(
        payment,
        transaction,
        {
            source: "admin_manual_verification",
            reason,
            actor: req.user._id,
            req,
        }
    );

    return res.status(409).json({
        success: false,
        message: reason,
    });
}

        if (transaction.status === "success") {
            const isCombinedPayment =
                payment.metadata?.paymentType === "combined";

            const completionFunction = isCombinedPayment
                ? completeSuccessfulCombinedPayment
                : completeSuccessfulPayment;

            const result = await completionFunction(
                payment._id,
                transaction,
                {
                    actor: req.user._id,
                    req,
                    source: "admin_manual_verification",
                }
            );

            if (result.alreadyProcessed) {
                return res.status(409).json({
                    success: false,
                    message: "This payment has already been processed.",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Payment verified successfully.",
                data: {
                    payment: result.payment,
                    assignment: result.assignment || null,
                    assignments: result.assignments || [],
                },
            });
        }

        if (
            ["failed", "reversed", "abandoned"].includes(
                transaction.status
            )
        ) {
            const failedStatus =
                transaction.status === "abandoned"
                    ? "cancelled"
                    : "failed";

            await handleFailedPayment(
                payment,
                transaction,
                failedStatus,
                {
                    source: "admin_manual_verification",
                    actor: req.user._id,
                    req,
                }
            );

            return res.status(200).json({
                success: true,
                message: `Paystack confirmed this payment as ${failedStatus}.`,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Payment is still pending on Paystack.",
            data: {
                status: "pending",
                gatewayStatus: transaction.status,
            },
        });
    } catch (error) {
        console.error("Admin payment verification error:", error);

        return res.status(500).json({
            success: false,
            message: "Payment verification failed. Please try again.",
        });
    }
};