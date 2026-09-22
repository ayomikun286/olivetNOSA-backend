import Payment from "../models/Payment.js";
import { paystackRequest } from "../config/paystack.js";
import { completeSuccessfulPayment, handleFailedPayment } from "./paymentService.js"
export const verifyPendingPayments = async () => {
    try {
        const pendingPayments = await Payment.find({
            status: "pending",
            gateway: "paystack",
            gatewayReference: {
                $exists: true,
                $ne: "",
            },
        }).limit(50);

        console.log(
            `🔎 Checking ${pendingPayments.length} pending Paystack payment(s)...`
        );

        let successful = 0;
        let failed = 0;
        let stillPending = 0;

        for (const payment of pendingPayments) {
            try {
                const paystackResponse =
                    await paystackRequest(
                        `/transaction/verify/${encodeURIComponent(
                            payment.gatewayReference
                        )}`,
                        {
                            method: "GET",
                        }
                    );

                const transaction =
                    paystackResponse.data;

                // ================================
                // AMOUNT SAFETY CHECK
                // ================================

                const expectedAmount =
                    Number(payment.amount) * 100;

                if (
                    Number(transaction.amount) !==
                    expectedAmount
                ) {
                    payment.status = "failed";

                    payment.metadata = {
                        ...payment.metadata,
                        verificationError:
                            "Paystack amount mismatch.",
                        paystackAmount:
                            transaction.amount,
                        verifiedAt: new Date(),
                    };

                    await payment.save();

                    failed++;

                    console.warn(
                        `⚠️ Payment ${payment.gatewayReference} failed: amount mismatch.`
                    );

                    continue;
                }

                // ================================
                // PAYSTACK SUCCESS
                // ================================

                if (
                    transaction.status ===
                    "success"
                ) {
                    await completeSuccessfulPayment(
                        payment._id,
                        transaction
                    );

                    successful++;

                    console.log(
                        `✅ Pending payment completed successfully: ${payment.gatewayReference}`
                    );

                    continue;
                }

                // ================================
                // PAYSTACK FAILED
                // ================================

                if (
                    transaction.status === "failed" ||
                    transaction.status === "reversed" ||
                    transaction.status === "abandoned"
                ) {
                    await handleFailedPayment(
                        payment,
                        transaction,
                        transaction.status === "abandoned"
                            ? "cancelled"
                            : "failed"
                    );

                    failed++;

                    console.log(
                        `❌ Payment failed: ${payment.gatewayReference}`
                    );

                    continue;
                }

                // ================================
                // STILL PENDING
                // ================================

                stillPending++;

                console.log(
                    `⏳ Payment still pending: ${payment.gatewayReference} (${transaction.status})`
                );
            } catch (error) {
                console.error(
                    `❌ Failed to verify ${payment.gatewayReference}:`,
                    error.message
                );
            }
        }

        return {
            checked: pendingPayments.length,
            successful,
            failed,
            stillPending,
        };
    } catch (error) {
        console.error(
            "❌ Pending payment verification error:",
            error.message
        );

        throw error;
    }
};