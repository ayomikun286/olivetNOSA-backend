import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import { createNotification } from "../services/notificationService.js";
import { sendEmail } from "../services/email.service.js";
import User from "../models/User.js";


export const completeSuccessfulPayment = async (
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


export const handleFailedPayment = async (
    payment,
    transaction,
    status = "failed"
) => {
    payment.status = status;

    payment.metadata = {
        ...payment.metadata,

        paystackStatus:
            transaction?.status || status,

        gatewayResponse:
            transaction?.gateway_response ||
            "Payment was not successful.",

        failureReason:
            transaction?.gateway_response ||
            "Payment was not successful.",

        failedAt: new Date(),
    };

    await payment.save();

    // ========================================
    // CREATE FAILURE NOTIFICATION
    // ========================================

    await createNotification({
        userId: payment.user,
        type: "payment_failed",
        title: "Payment Failed",
        message: `Your payment of ₦${payment.amount.toLocaleString()} was not successful. Please try again.`,
        link: "/portal/member/dashboard/payment-history",
    });

    // ========================================
    // SEND FAILURE EMAIL
    // ========================================

    try {
        const user = await User.findById(payment.user)
            .select("email firstName lastName")
            .lean();

        if (user?.email) {
            await sendEmail({
                to: user.email,
                subject: "Payment Failed - Olivet NOSA",
                html: `
                    <h2>Payment Failed</h2>

                    <p>
                        Hello ${user.firstName || "Member"},
                    </p>

                    <p>
                        Your payment of
                        <strong>
                            ₦${payment.amount.toLocaleString()}
                        </strong>
                        was not successful.
                    </p>

                    <p>
                        <strong>Reference:</strong>
                        ${payment.gatewayReference}
                    </p>

                    <p>
                        <strong>Reason:</strong>
                        ${
                            transaction?.gateway_response ||
                            "Payment was not successful."
                        }
                    </p>

                    <p>
                        Please try the payment again from your
                        payment history.
                    </p>

                    <p>
                        <strong>Olivet NOSA</strong>
                    </p>
                `,
            });
        }
    } catch (emailError) {
        console.error(
            "Payment failure email error:",
            emailError.message
        );
    }

    return payment;
};


export  const mapPaystackPaymentMethod = (
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