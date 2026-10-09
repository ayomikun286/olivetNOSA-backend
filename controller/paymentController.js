import mongoose from "mongoose";
import crypto from "crypto";
import Payment from "../models/Payment.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import Obligation from "../models/Obligation.js"; import { paystackRequest } from "../config/paystack.js";
import { completeSuccessfulPayment } from "../services/paymentService.js";
import { verifyPendingPayments } from "../services/pendingPaymentVerificationService.js";
import { handleFailedPayment, handlePaymentVerificationMismatch } from "../services/paymentService.js";




export const getMyPayments = async (req, res) => {
    try {
        const payments = await Payment.find({
            user: req.user._id,
        })
            .populate({
                path: "obligationAssignment",

                select:
                    "amountDue amountPaid status dueDate",

                populate: {
                    path: "obligation",

                    select:
                        "name category year",
                },
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
            await ObligationAssignment.findOne({
                _id: obligationAssignmentId,
                user: userId,
            }).populate({
                path: "obligation",
                select:
                    "name category year description isActive",
            });

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message:
                    "Obligation assignment not found.",
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
                        email:
                            req.user.email,

                        amount:
                            requestedAmount * 100,

                        currency:
                            "NGN",

                        reference,

                        callback_url:
                            process.env
                                .PAYSTACK_CALLBACK_URL,

                        metadata: {
                            paymentId:
                                payment._id.toString(),

                            userId:
                                userId.toString(),

                            obligationAssignmentId:
                                assignment._id.toString(),
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

    const expectedAmount = Number(payment.amount) * 100;
    const receivedAmount = Number(transaction.amount);
    const expectedCurrency = payment.currency || "NGN";

    const amountMismatch =
      !Number.isFinite(receivedAmount) ||
      receivedAmount !== expectedAmount;

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
      const result = await completeSuccessfulPayment(
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
        assignment: result.assignment,
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

    const expectedAmount = Number(payment.amount) * 100;
    const receivedAmount = Number(data.amount);
    const expectedCurrency = payment.currency || "NGN";

    const amountMismatch =
      !Number.isFinite(receivedAmount) ||
      receivedAmount !== expectedAmount;

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

    await completeSuccessfulPayment(payment._id, data, {
      req,
      source: "paystack_webhook",
    });

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

            // ====================================
            // GET OBLIGATION ASSIGNMENT
            // ====================================
            {
                $lookup: {
                    from:
                        ObligationAssignment
                            .collection
                            .name,
                    localField:
                        "obligationAssignment",
                    foreignField: "_id",
                    as: "assignment",
                },
            },

            {
                $unwind: "$assignment",
            },

            // ====================================
            // GET OBLIGATION
            // ====================================
            {
                $lookup: {
                    from:
                        Obligation
                            .collection
                            .name,
                    localField:
                        "assignment.obligation",
                    foreignField: "_id",
                    as: "obligation",
                },
            },

            {
                $unwind: "$obligation",
            },

            // ====================================
            // GROUP BY OPTIONAL / MANDATORY
            // + OBLIGATION CATEGORY
            // ====================================
            {
                $group: {
                    _id: {
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

                        category:
                            "$obligation.category",
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