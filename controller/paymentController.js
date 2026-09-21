import crypto from "crypto";
import mongoose from "mongoose";

import Payment from "../models/Payment.js";
import ObligationAssignment from "../models/ObligationAssignment.js";

import { paystackRequest } from "../config/paystack.js";

import { createNotification } from "../services/notificationService.js";
import { sendEmail } from "../services/email.service.js";

import User from "../models/User.js";

/**
 * Complete a successful payment
 *
 * This function updates:
 * - Payment
 * - ObligationAssignment
 *
 * It is designed to be safe against
 * duplicate Paystack callbacks/webhooks.
 */
const completeSuccessfulPayment = async (
    paymentId,
    transaction
) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        // ========================================
        // FIND PAYMENT
        // ========================================

        const payment = await Payment.findById(paymentId)
            .session(session);

        if (!payment) {
            throw new Error(
                "Payment record not found."
            );
        }

        // ========================================
        // ALREADY PROCESSED
        // ========================================

        if (payment.status === "successful") {
            const assignment =
                await ObligationAssignment.findById(
                    payment.obligationAssignment
                ).session(session);

            await session.commitTransaction();

            return {
                payment,
                assignment,
            };
        }

        // ========================================
        // FIND ASSIGNMENT
        // ========================================

        const assignment =
            await ObligationAssignment.findById(
                payment.obligationAssignment
            ).session(session);

        if (!assignment) {
            throw new Error(
                "Obligation assignment not found."
            );
        }

        // ========================================
        // FINAL AMOUNT SAFETY CHECK
        // ========================================

        const amountDue =
            Number(assignment.amountDue || 0);

        const amountPaid =
            Number(assignment.amountPaid || 0);

        const paymentAmount =
            Number(payment.amount || 0);

        const outstanding =
            Math.max(
                amountDue - amountPaid,
                0
            );

        if (paymentAmount > outstanding) {
            throw new Error(
                "Payment exceeds the outstanding obligation balance."
            );
        }

        // ========================================
        // UPDATE PAYMENT
        // ========================================

        payment.status = "successful";

        payment.paidAt =
            transaction.paid_at
                ? new Date(transaction.paid_at)
                : new Date();

        payment.paymentMethod =
            mapPaystackPaymentMethod(
                transaction.channel
            );

        payment.metadata = {
            ...payment.metadata,

            paystackTransactionId:
                transaction.id,

            paystackStatus:
                transaction.status,

            channel:
                transaction.channel,

            currency:
                transaction.currency,

            gatewayResponse:
                transaction.gateway_response,

            paidAt:
                transaction.paid_at,
        };

        await payment.save({
            session,
        });

        // ========================================
        // UPDATE OBLIGATION
        // ========================================

        const newAmountPaid =
            amountPaid + paymentAmount;

        assignment.amountPaid =
            Math.min(
                newAmountPaid,
                amountDue
            );

        assignment.status =
            assignment.amountPaid >= amountDue
                ? "paid"
                : assignment.amountPaid > 0
                    ? "partial"
                    : "pending";

        await assignment.save({
            session,
        });

        // ========================================
        // COMMIT DATABASE TRANSACTION
        // ========================================

        await session.commitTransaction();

        // ========================================
        // CREATE PAYMENT NOTIFICATION
        // ========================================

        await createNotification({
            userId: payment.user,
            type: "payment_success",
            title: "Payment Successful",
            message: `Your payment of ₦${payment.amount.toLocaleString()} was successful.`,
            link: "/portal/member/dashboard/payment-history",
        });

        // ========================================
        // SEND PAYMENT SUCCESS EMAIL
        // ========================================

        try {
            const user = await User.findById(payment.user)
                .select("email firstName lastName")
                .lean();

            if (user?.email) {
                await sendEmail({
                    to: user.email,

                    subject:
                        "Payment Successful - Olivet NOSA",

                    html: `
                        <h2>Payment Successful</h2>

                        <p>
                            Hello ${user.firstName || "Member"},
                        </p>

                        <p>
                            Your payment of
                            <strong>
                                ₦${payment.amount.toLocaleString()}
                            </strong>
                            has been successfully received.
                        </p>

                        <p>
                            <strong>Reference:</strong>
                            ${payment.gatewayReference}
                        </p>

                        <p>
                            <strong>Payment Method:</strong>
                            ${payment.paymentMethod}
                        </p>

                        <p>
                            Thank you for your payment.
                        </p>

                        <p>
                            <strong>Olivet NOSA</strong>
                        </p>
                    `,
                });
            }
        } catch (emailError) {
            console.error(
                "Payment success email error:",
                emailError.message
            );
        }

        // ========================================
        // RETURN RESULT
        // ========================================

        return {
            payment,
            assignment,
        };

    } catch (error) {
        await session.abortTransaction();
        throw error;

    } finally {
        await session.endSession();
    }
};


/**
 * Map Paystack channel to our payment method
 */
const mapPaystackPaymentMethod = (
    channel
) => {
    switch (channel) {
        case "card":
            return "card";

        case "bank":
        case "bank_transfer":
            return "bank_transfer";

        case "ussd":
            return "ussd";

        case "mobile_money":
            return "mobile_money";

        default:
            return "other";
    }
};


/**
 * Get current user's payment history
 */
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


/**
 * Initialize Paystack payment
 */
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

        // ========================================
        // VALIDATE INPUT
        // ========================================

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

        // ========================================
        // FIND ASSIGNMENT
        // ========================================

        const assignment =
            await ObligationAssignment.findOne({
                _id: obligationAssignmentId,
                user: userId,
            }).populate({
                path: "obligation",
                select:
                    "name category year description",
            });

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message:
                    "Obligation assignment not found.",
            });
        }

        // ========================================
        // CALCULATE OUTSTANDING
        // ========================================

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

        // ========================================
        // ALREADY PAID
        // ========================================

        if (outstanding <= 0) {
            return res.status(400).json({
                success: false,
                message:
                    "This obligation has already been fully paid.",
            });
        }

        // ========================================
        // AMOUNT TOO HIGH
        // ========================================

        if (requestedAmount > outstanding) {
            return res.status(400).json({
                success: false,

                message:
                    `Payment amount cannot exceed the outstanding balance of ₦${outstanding.toLocaleString()}.`,

                outstanding,
            });
        }

        // ========================================
        // GENERATE UNIQUE REFERENCE
        // ========================================

        const reference =
            `NOSA-${Date.now()}-${Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase()}`;

        // ========================================
        // CREATE PENDING PAYMENT
        // ========================================

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

        // ========================================
        // INITIALIZE PAYSTACK
        // ========================================

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

        // ========================================
        // RESPONSE
        // ========================================

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


/**
 * Verify Paystack payment
 */
export const verifyPayment = async (
    req,
    res
) => {
    try {
        const userId = req.user._id;

        const {
            reference,
        } = req.params;

        if (!reference) {
            return res.status(400).json({
                success: false,
                message:
                    "Payment reference is required.",
            });
        }

        // ========================================
        // FIND OUR PAYMENT FIRST
        // ========================================

        const payment =
            await Payment.findOne({
                gatewayReference:
                    reference,

                user:
                    userId,

                gateway:
                    "paystack",
            });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message:
                    "Payment record not found.",
            });
        }

        // ========================================
        // ALREADY PROCESSED
        // ========================================

        if (
            payment.status ===
            "successful"
        ) {
            return res.status(200).json({
                success: true,

                message:
                    "Payment already verified.",

                payment,
            });
        }

        // ========================================
        // ASK PAYSTACK FOR REAL STATUS
        // ========================================

        const paystackResponse =
            await paystackRequest(
                `/transaction/verify/${encodeURIComponent(
                    reference
                )}`,
                {
                    method: "GET",
                }
            );

        const transaction =
            paystackResponse.data;

        // ========================================
        // VERIFY AMOUNT
        // ========================================

        const expectedAmount =
            Number(payment.amount) * 100;

        if (
            Number(transaction.amount) !==
            expectedAmount
        ) {
            payment.status =
                "failed";

            payment.metadata = {
                ...payment.metadata,

                verificationError:
                    "Paystack amount mismatch.",

                paystackAmount:
                    transaction.amount,
            };

            await payment.save();

            return res.status(400).json({
                success: false,

                message:
                    "Payment amount verification failed.",
            });
        }

        // ========================================
        // SUCCESSFUL PAYMENT
        // ========================================

        if (
            transaction.status ===
            "success"
        ) {
            const result =
                await completeSuccessfulPayment(
                    payment._id,
                    transaction
                );

            return res.status(200).json({
                success: true,

                message:
                    "Payment verified successfully.",

                payment:
                    result.payment,

                assignment:
                    result.assignment,
            });
        }

        // ========================================
        // FAILED / ABANDONED
        // ========================================

        const failedStatus =
            transaction.status ===
            "abandoned"
                ? "cancelled"
                : "failed";

        payment.status =
            failedStatus;

        payment.metadata = {
            ...payment.metadata,

            paystackStatus:
                transaction.status,

            gatewayResponse:
                transaction.gateway_response,
        };

        await payment.save();

        return res.status(200).json({
            success: false,

            message:
                "Payment was not successful.",

            payment,
        });

    } catch (error) {

        console.error(
            "Verify payment error:",
            error
        );

        res.status(500).json({
            success: false,

            message:
                error.message ||
                "Failed to verify payment.",
        });
    }
};


/**
 * Paystack webhook
 */
export const handlePaystackWebhook = async (
    req,
    res
) => {
    try {
        const signature =
            req.headers[
                "x-paystack-signature"
            ];

        // ========================================
        // CHECK SIGNATURE
        // ========================================

        if (!signature) {
            return res.status(401).json({
                success: false,
                message:
                    "Missing Paystack signature.",
            });
        }

        // ========================================
        // VERIFY WEBHOOK SIGNATURE
        // ========================================

        // Because this route uses express.raw(),
        // req.body is a Buffer containing the
        // original request body.

        const rawBody =
            req.body;

        if (
            !Buffer.isBuffer(rawBody)
        ) {
            console.error(
                "Paystack webhook body is not a raw Buffer."
            );

            return res.status(400).json({
                success: false,
                message:
                    "Invalid webhook body.",
            });
        }

        const hash =
            crypto
                .createHmac(
                    "sha512",
                    process.env
                        .PAYSTACK_SECRET_KEY
                )
                .update(rawBody)
                .digest("hex");

        if (
            hash !== signature
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Invalid Paystack signature.",
            });
        }

        // ========================================
        // PARSE BODY
        // ========================================

        let payload;

        try {
            payload =
                JSON.parse(
                    rawBody.toString(
                        "utf8"
                    )
                );

        } catch (parseError) {

            console.error(
                "Paystack webhook JSON parse error:",
                parseError
            );

            return res.status(400).json({
                success: false,
                message:
                    "Invalid webhook payload.",
            });
        }

        const {
            event,
            data,
        } = payload;

        // ========================================
        // HANDLE EVENT
        // ========================================

        if (
            event !==
            "charge.success"
        ) {
            return res.status(200).json({
                success: true,
                message:
                    "Event received.",
            });
        }

        // ========================================
        // GET REFERENCE
        // ========================================

        const reference =
            data?.reference;

        if (!reference) {
            return res.status(200).json({
                success: true,

                message:
                    "Webhook received without reference.",
            });
        }

        // ========================================
        // FIND PAYMENT
        // ========================================

        const payment =
            await Payment.findOne({
                gatewayReference:
                    reference,

                gateway:
                    "paystack",
            });

        if (!payment) {

            console.warn(
                "Paystack payment not found:",
                reference
            );

            return res.status(200).json({
                success: true,

                message:
                    "Payment record not found.",
            });
        }

        // ========================================
        // ALREADY COMPLETED
        // ========================================

        if (
            payment.status ===
            "successful"
        ) {
            return res.status(200).json({
                success: true,

                message:
                    "Payment already processed.",
            });
        }

        // ========================================
        // VERIFY AMOUNT
        // ========================================

        const expectedAmount =
            Number(payment.amount) * 100;

        const receivedAmount =
            Number(data.amount);

        if (
            !Number.isFinite(
                receivedAmount
            ) ||
            receivedAmount !==
                expectedAmount
        ) {
            payment.status =
                "failed";

            payment.metadata = {
                ...payment.metadata,

                webhookError:
                    "Paystack amount mismatch.",

                expectedAmount,

                paystackAmount:
                    receivedAmount,
            };

            await payment.save();

            console.error(
                `Paystack amount mismatch for ${reference}. Expected ${expectedAmount}, received ${receivedAmount}.`
            );

            return res.status(200).json({
                success: true,

                message:
                    "Payment amount mismatch recorded.",
            });
        }

        // ========================================
        // VERIFY CURRENCY
        // ========================================

        if (
            data.currency &&
            data.currency.toUpperCase() !==
                "NGN"
        ) {
            payment.status =
                "failed";

            payment.metadata = {
                ...payment.metadata,

                webhookError:
                    "Paystack currency mismatch.",

                expectedCurrency:
                    "NGN",

                paystackCurrency:
                    data.currency,
            };

            await payment.save();

            return res.status(200).json({
                success: true,

                message:
                    "Payment currency mismatch recorded.",
            });
        }

        // ========================================
        // COMPLETE PAYMENT
        // ========================================

        await completeSuccessfulPayment(
            payment._id,
            data
        );

        // ========================================
        // SUCCESS RESPONSE
        // ========================================

        return res.status(200).json({
            success: true,

            message:
                "Payment processed successfully.",
        });

    } catch (error) {

        console.error(
            "Paystack webhook error:",
            error
        );

        /*
         * Return 500 when processing genuinely fails.
         * This allows Paystack to retry the webhook.
         */

        return res.status(500).json({
            success: false,

            message:
                "Webhook processing failed.",
        });
    }
};


/**
 * Paystack callback
 *
 * Paystack redirects the member here after checkout.
 *
 * We do NOT mark the payment successful here.
 *
 * We simply redirect the member back to the frontend
 * with the payment reference.
 */
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
                `${process.env.FRONTEND_URL}/portal/member/dashboard/payments?payment=failed`
            );
        }

        return res.redirect(
            `${process.env.FRONTEND_URL}/portal/member/dashboard/payments?payment=verify&reference=${encodeURIComponent(
                reference
            )}`
        );

    } catch (error) {

        console.error(
            "Paystack callback error:",
            error
        );

        return res.redirect(
            `${process.env.FRONTEND_URL}/portal/member/dashboard/payments?payment=failed`
        );
    }
};