import Donation from "../models/Donation.js";
import { paystackRequest } from "../config/paystack.js";

import {
    logDonationAudit,
    sendDonationStatusEmail,
} from "../controller/donation.controller.js";

// ========================================
// VERIFY PENDING DONATIONS
// ========================================

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

                // Verify transaction reference.
                if (
                    transaction.reference !== donation.gatewayReference
                ) {
                    mismatched++;

                    await logDonationAudit({
                        actor: null,
                        action: "donation.verification_mismatch",
                        resource: "Donation",
                        resourceId: donation._id,
                        details: {
                            source: "scheduled_reconciliation",
                            reason: "Transaction reference mismatch.",
                            expectedReference: donation.gatewayReference,
                            receivedReference: transaction.reference || null,
                        },
                    });

                    continue;
                }

                // Verify amount and currency.
                const expectedAmount = donation.amount * 100;

                const amountMatches =
                    Number.isSafeInteger(expectedAmount) &&
                    Number.isSafeInteger(transaction.amount) &&
                    transaction.amount === expectedAmount;

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

                    await logDonationAudit({
                        actor: null,
                        action: "donation.verification_mismatch",
                        resource: "Donation",
                        resourceId: donation._id,
                        details: {
                            source: "scheduled_reconciliation",
                            reason: amountMatches
                                ? "Transaction currency mismatch."
                                : "Transaction amount mismatch.",
                            expectedAmount,
                            receivedAmount: transaction.amount ?? null,
                            expectedCurrency,
                            receivedCurrency,
                            gatewayReference: donation.gatewayReference,
                        },
                    });

                    console.warn(
                        `Donation ${donation.gatewayReference}: amount/currency mismatch.`
                    );

                    continue;
                }

                // ====================================
                // SUCCESSFUL TRANSACTION
                // ====================================

                if (transaction.status === "success") {
                    const updatedDonation =
                        await Donation.findOneAndUpdate(
                            {
                                _id: donation._id,
                                status: "pending",
                            },
                            {
                                $set: {
                                    status: "successful",
                                    paidAt: transaction.paid_at
                                        ? new Date(transaction.paid_at)
                                        : new Date(),

                                    "metadata.paystackTransactionId":
                                        transaction.id || null,

                                    "metadata.channel":
                                        transaction.channel || null,

                                    "metadata.verifiedAt": new Date(),

                                    "metadata.verificationSource":
                                        "scheduled_reconciliation",
                                },
                            },
                            { returndocument: "after" }
                        );

                    if (updatedDonation) {
                        await sendDonationStatusEmail(
                            updatedDonation,
                            "successful"
                        );

                        await logDonationAudit({
                            actor: null,
                            action: "donation.successful",
                            resource: "Donation",
                            resourceId: updatedDonation._id,
                            details: {
                                amount: updatedDonation.amount,
                                currency: updatedDonation.currency,
                                gatewayReference:
                                    updatedDonation.gatewayReference,
                                paystackTransactionId: transaction.id,
                                source: "scheduled_reconciliation",
                                isAnonymous: updatedDonation.isAnonymous,
                            },
                        });

                        successful++;
                    }

                    continue;
                }

                // ====================================
                // FAILED / REVERSED / ABANDONED
                // ====================================

                if (
                    ["failed", "reversed", "abandoned"].includes(
                        transaction.status
                    )
                ) {
                    const newStatus =
                        transaction.status === "abandoned"
                            ? "cancelled"
                            : "failed";

                    const updatedDonation =
                        await Donation.findOneAndUpdate(
                            {
                                _id: donation._id,
                                status: "pending",
                            },
                            {
                                $set: {
                                    status: newStatus,

                                    "metadata.verificationStatus":
                                        transaction.status,

                                    "metadata.verifiedAt": new Date(),

                                    "metadata.verificationSource":
                                        "scheduled_reconciliation",
                                },
                            },
                            { returndocument: "after" }
                        );

                    if (updatedDonation) {
                        await sendDonationStatusEmail(
                            updatedDonation,
                            "failed"
                        );

                        await logDonationAudit({
                            actor: null,
                            action: `donation.${newStatus}`,
                            resource: "Donation",
                            resourceId: updatedDonation._id,
                            details: {
                                gatewayReference:
                                    updatedDonation.gatewayReference,
                                paystackStatus: transaction.status,
                                source: "scheduled_reconciliation",
                            },
                        });

                        if (newStatus === "cancelled") {
                            cancelled++;
                        } else {
                            failed++;
                        }
                    }

                    continue;
                }

                // ====================================
                // STILL PROCESSING
                // ====================================

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