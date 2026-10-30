
import crypto from "crypto";

import Donation from "../models/Donation.js";
import { paystackRequest } from "../config/paystack.js";

import {
    verifyPendingDonations,
} from "../services/donationVerification.service.js";

import {
    logDonationAudit,
    completeSuccessfulDonation,
    handleFailedDonation,
    handleDonationVerificationMismatch,
} from "../services/donationService.js";

import {
    isPaystackAmountValid,
} from "../services/paystackAmount.js";


// ========================================
// INITIALIZE DONATION
// ========================================

export const initializeDonation = async (req, res) => {
    let donation = null;

    try {
        const {
            donorName,
            email,
            amount,
            message,
            isAnonymous = false,
        } = req.body;

        // VALIDATION

        if (typeof isAnonymous !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "Invalid anonymous donation selection.",
            });
        }

        if (typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Email address is required.",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address.",
            });
        }

        const donationAmount = Number(amount);

        if (
            !Number.isFinite(donationAmount) ||
            !Number.isSafeInteger(donationAmount) ||
            donationAmount < 100 ||
            !Number.isSafeInteger(donationAmount * 100)
        ) {
            return res.status(400).json({
                success: false,
                message: "Minimum donation amount is ₦100. Enter a valid whole amount.",
            });
        }

        if (
            donorName !== undefined &&
            typeof donorName !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid donor name.",
            });
        }

        if (
            message !== undefined &&
            typeof message !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid donation message.",
            });
        }

        const normalizedName = donorName?.trim() || "";
        const normalizedMessage = message?.trim() || "";

        if (normalizedName.length > 120) {
            return res.status(400).json({
                success: false,
                message: "Donor name cannot exceed 120 characters.",
            });
        }

        if (normalizedMessage.length > 500) {
            return res.status(400).json({
                success: false,
                message: "Donation message cannot exceed 500 characters.",
            });
        }

        // GENERATE UNIQUE REFERENCE

        const reference = `NOSA-DON-${Date.now()}-${crypto
            .randomBytes(4)
            .toString("hex")
            .toUpperCase()}`;

        // CREATE PENDING DONATION

        donation = await Donation.create({
            donorName: isAnonymous
                ? "Anonymous"
                : normalizedName || "Anonymous",

            email: normalizedEmail,
            amount: donationAmount,
            currency: "NGN",
            message: normalizedMessage,
            isAnonymous,
            user: req.user?._id || null,
            status: "pending",
            gateway: "paystack",
            gatewayReference: reference,
        });

        // INITIALIZE PAYSTACK

        let paystackData;

        try {
            paystackData = await paystackRequest(
                "/transaction/initialize",
                {
                    method: "POST",

                    body: JSON.stringify({
                        email: normalizedEmail,
                        amount: donationAmount * 100,
                        currency: "NGN",
                        reference,

                        callback_url:
                            process.env.PAYSTACK_DONATION_CALLBACK_URL,

                        metadata: {
                            donationId: donation._id.toString(),
                            donationType: "NOSA_DONATION",
                            isAnonymous,
                        },
                    }),
                }
            );

            if (
                !paystackData?.data?.authorization_url ||
                !paystackData?.data?.access_code
            ) {
                throw new Error(
                    "Paystack did not return valid checkout details."
                );
            }

        } catch (paystackError) {
            donation.status = "failed";

            donation.metadata = {
                ...donation.metadata,
                initializationError: paystackError.message,
            };

            await donation.save();

            await logDonationAudit({
                actor: req.user?._id || null,
                action: "donation.initialization_failed",
                resource: "Donation",
                resourceId: donation._id,

                details: {
                    amount: donation.amount,
                    currency: donation.currency,
                    gatewayReference: donation.gatewayReference,
                    reason: paystackError.message,
                },

                req,
            });

            throw paystackError;
        }

        // AUDIT INITIALIZATION

        await logDonationAudit({
            actor: req.user?._id || null,
            action: "donation.initialized",
            resource: "Donation",
            resourceId: donation._id,

            details: {
                amount: donation.amount,
                currency: donation.currency,
                gateway: donation.gateway,
                gatewayReference: donation.gatewayReference,
                isAnonymous: donation.isAnonymous,
                donorEmail: donation.email,
            },

            req,
        });

        return res.status(200).json({
            success: true,
            message: "Donation payment initialized successfully.",

            donation: {
                id: donation._id,
                amount: donation.amount,
                reference,
            },

            authorizationUrl:
                paystackData.data.authorization_url,

            accessCode:
                paystackData.data.access_code,
        });

    } catch (error) {
        console.error("Initialize donation error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to initialize donation. Please try again.",
        });
    }
};


// ========================================
// INTERNAL DONATION RECONCILIATION
// ========================================

export const verifyPendingDonationsInternal = async (req, res) => {
    try {
        const internalSecret = req.headers["x-internal-secret"];

        if (
            !internalSecret ||
            !process.env.INTERNAL_PAYMENT_SECRET ||
            internalSecret !== process.env.INTERNAL_PAYMENT_SECRET
        ) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized.",
            });
        }

        const result = await verifyPendingDonations();

        return res.status(200).json({
            success: true,
            message: "Pending donations checked successfully.",
            result,
        });

    } catch (error) {
        console.error(
            "Internal pending donation verification error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Pending donation verification failed.",
        });
    }
};


// ========================================
// VERIFY DONATION
// ========================================

export const verifyDonation = async (req, res) => {
    try {
        const reference =
            req.params.reference ||
            req.query.reference ||
            req.body.reference;

        // VALIDATE REFERENCE

        if (
            typeof reference !== "string" ||
            !reference.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Donation reference is required.",
            });
        }

        const normalizedReference = reference.trim();

        // FIND DONATION

        const donation = await Donation.findOne({
            gatewayReference: normalizedReference,
            gateway: "paystack",
        });

        if (!donation) {
            return res.status(404).json({
                success: false,
                message: "Donation record not found.",
            });
        }

        // IDEMPOTENCY CHECK

        if (donation.status === "successful") {
            return res.status(200).json({
                success: true,
                message: "This donation has already been verified.",

                donation: {
                    id: donation._id,
                    amount: donation.amount,
                    currency: donation.currency,
                    reference: donation.gatewayReference,
                    status: donation.status,
                    paidAt: donation.paidAt,
                },
            });
        }

        if (donation.status !== "pending") {
            return res.status(409).json({
                success: false,
                message: `This donation is already marked as ${donation.status}.`,
                donation: {
                    id: donation._id,
                    reference: donation.gatewayReference,
                    status: donation.status,
                },
            });
        }

        // VERIFY TRANSACTION WITH PAYSTACK

        const paystackResponse = await paystackRequest(
            `/transaction/verify/${encodeURIComponent(normalizedReference)}`,
            {
                method: "GET",
            }
        );

        const transaction = paystackResponse?.data;

        if (!transaction) {
            return res.status(502).json({
                success: false,
                message: "Unable to retrieve transaction details from Paystack.",
            });
        }

        // VERIFY REFERENCE

        if (transaction.reference !== normalizedReference) {
            await handleDonationVerificationMismatch(
                donation,
                transaction,
                {
                    actor: req.user?._id || null,
                    req,
                    source: "browser_verification",
                    reason: "Transaction reference mismatch.",
                }
            );

            return res.status(409).json({
                success: false,
                message: "Transaction reference verification failed.",
            });
        }

        // VERIFY AMOUNT AND CURRENCY

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
            await handleDonationVerificationMismatch(
                donation,
                transaction,
                {
                    actor: req.user?._id || null,
                    req,
                    source: "browser_verification",

                    reason: amountMatches
                        ? "Transaction currency mismatch."
                        : "Transaction amount mismatch.",
                }
            );

            return res.status(409).json({
                success: false,
                message: "Transaction amount or currency could not be verified.",
            });
        }

        // SUCCESSFUL TRANSACTION

        if (transaction.status === "success") {
            const result = await completeSuccessfulDonation(
                donation._id,
                transaction,
                {
                    actor: req.user?._id || null,
                    req,
                    source: "browser_verification",
                }
            );

            const finalDonation = result.donation;

            if (finalDonation.status === "successful") {
                return res.status(200).json({
                    success: true,
                    message: "Donation payment verified successfully.",

                    donation: {
                        id: finalDonation._id,
                        amount: finalDonation.amount,
                        currency: finalDonation.currency,
                        reference: finalDonation.gatewayReference,
                        status: finalDonation.status,
                        paidAt: finalDonation.paidAt,
                    },
                });
            }

            return res.status(409).json({
                success: false,
                message: `Donation is currently marked as ${finalDonation.status}. Please contact support if you have been charged.`,
                donation: {
                    id: finalDonation._id,
                    reference: finalDonation.gatewayReference,
                    status: finalDonation.status,
                },
            });
        }

        // FAILED / REVERSED / ABANDONED TRANSACTION

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
                    actor: req.user?._id || null,
                    req,
                    source: "browser_verification",
                }
            );

            const finalDonation = result.donation;

            if (finalDonation?.status === "successful") {
                return res.status(200).json({
                    success: true,
                    message: "Donation payment verified successfully.",

                    donation: {
                        id: finalDonation._id,
                        reference: finalDonation.gatewayReference,
                        status: finalDonation.status,
                        paidAt: finalDonation.paidAt,
                    },
                });
            }

            return res.status(200).json({
                success: false,

                message:
                    finalDonation?.status === "cancelled"
                        ? "Donation checkout was abandoned."
                        : "Donation payment was not successful.",

                donation: {
                    id: finalDonation?._id,
                    reference: finalDonation?.gatewayReference,
                    status: finalDonation?.status,
                },
            });
        }

        // TRANSACTION STILL PROCESSING

        const currentDonation = await Donation.findById(
            donation._id
        );

        return res.status(202).json({
            success: false,
            pending: true,
            message: "Donation payment is still being processed. Please check again shortly.",

            donation: {
                id: currentDonation._id,
                reference: currentDonation.gatewayReference,
                status: currentDonation.status,
            },
        });

    } catch (error) {
        console.error("Verify donation error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to verify donation at this time. Please try again.",
        });
    }
};


// ========================================
// PAYSTACK DONATION WEBHOOK
// ========================================

export const handleDonationWebhook = async (req, res) => {
    try {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        const signature = req.headers["x-paystack-signature"];

        // CONFIRM RAW REQUEST BODY

        if (!Buffer.isBuffer(req.body)) {
            return res.status(400).json({
                success: false,
                message: "Invalid webhook request body.",
            });
        }

        if (!secret || !signature) {
            return res.status(401).json({
                success: false,
                message: "Invalid webhook signature.",
            });
        }

        // VERIFY PAYSTACK SIGNATURE

        const hash = crypto
            .createHmac("sha512", secret)
            .update(req.body)
            .digest("hex");

        const receivedSignature = Buffer.from(
            signature,
            "utf8"
        );

        const expectedSignature = Buffer.from(
            hash,
            "utf8"
        );

        if (
            receivedSignature.length !== expectedSignature.length ||
            !crypto.timingSafeEqual(
                receivedSignature,
                expectedSignature
            )
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid webhook signature.",
            });
        }

        // PARSE WEBHOOK

        const payload = JSON.parse(
            req.body.toString("utf8")
        );

        const { event, data } = payload;

        const reference = data?.reference;

        if (!reference) {
            return res.status(200).json({
                success: true,
                message: "Webhook received.",
            });
        }

        // IGNORE UNRELATED EVENTS

        if (
            event !== "charge.success" &&
            event !== "charge.failed"
        ) {
            return res.status(200).json({
                success: true,
                message: "Event ignored.",
            });
        }

        // FIND DONATION

        const donation = await Donation.findOne({
            gatewayReference: reference,
            gateway: "paystack",
        });

        if (!donation) {
            return res.status(200).json({
                success: true,
                message: "Donation not found.",
            });
        }

        // IDEMPOTENCY CHECK

        if (donation.status === "successful") {
            return res.status(200).json({
                success: true,
                message: "Donation already processed.",
            });
        }

        // VERIFY REFERENCE

        if (data.reference !== donation.gatewayReference) {
            await handleDonationVerificationMismatch(
                donation,
                data,
                {
                    source: "paystack_webhook",
                    reason: "Webhook transaction reference mismatch.",
                }
            );

            return res.status(200).json({
                success: true,
                message: "Transaction reference mismatch recorded.",
            });
        }

        // VERIFY AMOUNT AND CURRENCY

        const amountMatches = isPaystackAmountValid(
            donation,
            data
        );

        const expectedCurrency = String(
            donation.currency || "NGN"
        ).toUpperCase();

        const receivedCurrency = String(
            data.currency || ""
        ).toUpperCase();

        const currencyMatches =
            receivedCurrency === expectedCurrency;

        if (!amountMatches || !currencyMatches) {
            await handleDonationVerificationMismatch(
                donation,
                data,
                {
                    source: "paystack_webhook",

                    reason: amountMatches
                        ? "Webhook transaction currency mismatch."
                        : "Webhook transaction amount mismatch.",
                }
            );

            return res.status(200).json({
                success: true,
                message: "Transaction amount or currency mismatch recorded.",
            });
        }

        // SUCCESSFUL PAYMENT

        if (event === "charge.success") {
            const result = await completeSuccessfulDonation(
                donation._id,
                data,
                {
                    source: "paystack_webhook",
                }
            );

            return res.status(200).json({
                success: true,
                message: result.alreadyProcessed
                    ? "Donation already processed."
                    : "Donation webhook processed.",
            });
        }

        // FAILED PAYMENT

        if (event === "charge.failed") {
            await handleFailedDonation(
                donation,
                data,
                "failed",
                {
                    source: "paystack_webhook",
                }
            );
        }

        return res.status(200).json({
            success: true,
            message: "Donation webhook processed.",
        });

    } catch (error) {
        console.error("Donation webhook error:", error);

        return res.status(500).json({
            success: false,
            message: "Donation webhook processing failed.",
        });
    }
};
