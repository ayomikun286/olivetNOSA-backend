import Payment from "../models/Payment.js";
import { paystackRequest } from "../config/paystack.js";
import {
  completeSuccessfulPayment,
  handleFailedPayment,
  handlePaymentVerificationMismatch,
} from "./paymentService.js";

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
      `Checking ${pendingPayments.length} pending Paystack payment(s)...`
    );

    let successful = 0;
    let failed = 0;
    let stillPending = 0;
    let errors = 0;

    for (const payment of pendingPayments) {
      try {
        const paystackResponse = await paystackRequest(
          `/transaction/verify/${encodeURIComponent(
            payment.gatewayReference
          )}`,
          { method: "GET" }
        );

        const transaction = paystackResponse.data;

        if (!transaction) {
          errors++;
          continue;
        }

        const expectedAmount = Number(payment.amount) * 100;
        const receivedAmount = Number(transaction.amount);
        const expectedCurrency = payment.currency || "NGN";
        const receivedCurrency = transaction.currency;

        // Do not mark a payment failed if Paystack has not
        // returned a valid amount or currency to verify.
        const amountMismatch =
          !Number.isFinite(receivedAmount) ||
          receivedAmount !== expectedAmount;

        const currencyMismatch =
          !receivedCurrency ||
          receivedCurrency.toUpperCase() !==
            expectedCurrency.toUpperCase();

        // Record amount/currency discrepancies.
        if (amountMismatch || currencyMismatch) {
          const reason = amountMismatch
            ? "Paystack transaction amount mismatch."
            : "Paystack transaction currency mismatch.";

          await handlePaymentVerificationMismatch(
            payment,
            transaction,
            {
              source: "scheduled_reconciliation",
              reason,
            }
          );

          failed++;

          console.warn(
            `Payment ${payment.gatewayReference}: ${reason}`
          );

          continue;
        }

        // Paystack confirms successful payment.
        if (transaction.status === "success") {
          const result = await completeSuccessfulPayment(
            payment._id,
            transaction,
            {
              source: "scheduled_reconciliation",
            }
          );

          if (!result.alreadyProcessed) {
            successful++;
          }

          continue;
        }

        // Paystack confirms an unsuccessful payment.
        if (
          ["failed", "reversed", "abandoned"].includes(
            transaction.status
          )
        ) {
          const failedStatus =
            transaction.status === "abandoned"
              ? "cancelled"
              : "failed";

          const previousStatus = payment.status;

          await handleFailedPayment(
            payment,
            transaction,
            failedStatus,
            {
              source: "scheduled_reconciliation",
            }
          );

          if (previousStatus !== failedStatus) {
            failed++;
          }

          continue;
        }

        // Paystack has not reached a final state yet.
        stillPending++;

        console.log(
          `Payment still pending: ${payment.gatewayReference} (${transaction.status})`
        );
      } catch (error) {
        errors++;

        console.error(
          `Failed to verify ${payment.gatewayReference}:`,
          error.message
        );
      }
    }

    return {
      checked: pendingPayments.length,
      successful,
      failed,
      stillPending,
      errors,
    };
  } catch (error) {
    console.error(
      "Pending payment verification error:",
      error.message
    );

    throw error;
  }
};