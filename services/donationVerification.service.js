
import Donation from "../models/Donation.js";
import { paystackRequest } from "../config/paystack.js";

import {
    completeSuccessfulDonation,
    handleFailedDonation,
    handleDonationVerificationMismatch,
} from "./donationService.js";

import { isPaystackAmountValid } from "./paystackAmount.js";

export const verifyPendingDonations = async () => {
    try {
        const pendingDonations = await Donation.find({
            status: "pending",
            gateway: "paystack",
            gatewayReference: {
                $exists: true,
                $ne: "",
            },
        }).limit(50);

        console.log(
            `Checking ${pendingDonations.length} pending Paystack donation(s)...`
        );

        let successful = 0;
        let failed = 0;
        let cancelled = 0;
        let stillPending = 0;
        let mismatched = 0;
        let errors = 0;

        for (const donation of pendingDonations) {
            try {
                const paystackResponse = await paystackRequest(
                    `/transaction/verify/${encodeURIComponent(
                        donation.gatewayReference
                    )}`,
                    { method: "GET" }
                );

                const transaction = paystackResponse?.data;

                if (!transaction) {
                    errors++;
                    continue;
                }

                console.log("PAYSTACK DONATION VERIFICATION:", {
                    reference: transaction.reference,
                    status: transaction.status,
                    amount: transaction.amount,
                    fees: transaction.fees,
                    requested_amount: transaction.requested_amount,
                    currency: transaction.currency,
                });

                // Verify transaction reference.
                if (
                    transaction.reference !== donation.gatewayReference
                ) {
                    mismatched++;

                    await handleDonationVerificationMismatch(
                        donation,
                        transaction,
                        {
                            source: "scheduled_reconciliation",
                            reason: "Transaction reference mismatch.",
                        }
                    );

                    continue;
                }

                // Verify amount and currency.
                const amountMatches = isPaystackAmountValid(
                    donation,
                    transaction
                );

                const expectedCurrency = String(
                    donation.currency || "NGN"
                ).toUpperCase();

                const receivedCurrency = String(
                    transaction.currency || ""
                ).toUpperCase();

                const currencyMatches =
                    receivedCurrency === expectedCurrency;

                if (!amountMatches || !currencyMatches) {
                    mismatched++;

                    await handleDonationVerificationMismatch(
                        donation,
                        transaction,
                        {
                            source: "scheduled_reconciliation",
                            reason: amountMatches
                                ? "Transaction currency mismatch."
                                : "Transaction amount mismatch.",
                        }
                    );

                    console.warn(
                        `Donation ${donation.gatewayReference}: amount/currency mismatch.`
                    );

                    continue;
                }

                // SUCCESSFUL TRANSACTION.
                if (transaction.status === "success") {
                    const result = await completeSuccessfulDonation(
                        donation._id,
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

                // FAILED / REVERSED / ABANDONED.
                if (
                    ["failed", "reversed", "abandoned"].includes(
                        transaction.status
                    )
                ) {
                    const newStatus =
                        transaction.status === "abandoned"
                            ? "cancelled"
                            : "failed";

                    const result = await handleFailedDonation(
                        donation,
                        transaction,
                        newStatus,
                        {
                            source: "scheduled_reconciliation",
                        }
                    );

                    // Count only when this process actually updates it.
                    if (!result.alreadyProcessed) {
                        if (newStatus === "cancelled") {
                            cancelled++;
                        } else {
                            failed++;
                        }
                    }

                    continue;
                }

                // STILL PROCESSING.
                stillPending++;

                console.log(
                    `Donation still pending: ${donation.gatewayReference} (${transaction.status})`
                );

            } catch (error) {
                errors++;

                console.error(
                    `Failed to verify donation ${donation.gatewayReference}:`,
                    error.message
                );
            }
        }

        return {
            checked: pendingDonations.length,
            successful,
            failed,
            cancelled,
            stillPending,
            mismatched,
            errors,
        };

    } catch (error) {
        console.error(
            "Pending donation verification error:",
            error.message
        );

        throw error;
    }
};
