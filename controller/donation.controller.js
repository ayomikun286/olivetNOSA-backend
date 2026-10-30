
import crypto from "crypto";

import Donation from "../models/Donation.js";
import { paystackRequest } from "../config/paystack.js";
import { createAuditLog } from "../services/auditLog.service.js";
import { sendEmail } from "../services/email.service.js";
import { verifyPendingDonations } from "../services/donationVerification.service.js";
// ========================================
// SAFE AUDIT LOGGER
// ========================================

export const logDonationAudit = async (auditData) => {
    try {
        await createAuditLog(auditData);
    } catch (error) {
        // Audit failure must never interfere with payment processing.
        console.error("Donation audit log error:", error);
    }
};


export const sendDonationStatusEmail = async (donation, status) => {
    const isSuccessful = status === "successful";

    const subject = isSuccessful
        ? "Thank You for Your Donation - OlivetNOSA"
        : "Donation Payment Unsuccessful - OlivetNOSA";

    const heading = isSuccessful
        ? "Thank you for your generosity!"
        : "Your donation payment was unsuccessful";

    const message = isSuccessful
        ? `We sincerely appreciate your generous contribution to
           <strong style="color: #123B6D;">OlivetNOSA</strong>.
           Your support helps us strengthen our alumni community
           and support our shared initiatives.`
        : `Unfortunately, your donation payment could not be completed.
           You may try making your donation again. If you believe this
           is an error, please contact the OlivetNOSA support team.`;

    try {
        await sendEmail({
            to: donation.email,
            subject,
            html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>${subject}</title>
            </head>

            <body style="
                margin: 0;
                padding: 0;
                background-color: #EAF1F8;
                font-family: Arial, Helvetica, sans-serif;
                color: #0B294D;
            ">

                <table width="100%" cellpadding="0" cellspacing="0" border="0"
                    style="background-color: #EAF1F8; padding: 40px 15px;">
                    <tr>
                        <td align="center">

                            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                                style="
                                    max-width: 620px;
                                    background-color: #ffffff;
                                    border-radius: 12px;
                                    overflow: hidden;
                                ">

                                <!-- Header -->
                                <tr>
                                    <td style="
                                        background-color: #0B294D;
                                        padding: 30px 35px;
                                        text-align: center;
                                    ">
                                        <img
                                            src="https://res.cloudinary.com/bx4pnrek/image/upload/v1792582571/onw-gosa/website-content/ob1t3jspsuqz8wvxnkba.png"
                                            alt="OlivetNOSA"
                                            width="70"
                                            style="display: block; margin: 0 auto 15px; max-width: 70px;"
                                        />

                                        <div style="
                                            color: #ffffff;
                                            font-size: 22px;
                                            font-weight: bold;
                                            letter-spacing: 0.5px;
                                        ">
                                            OlivetNOSA
                                        </div>

                                        <div style="
                                            color: #C9A227;
                                            font-size: 11px;
                                            font-weight: bold;
                                            letter-spacing: 2px;
                                            margin-top: 7px;
                                            text-transform: uppercase;
                                        ">
                                            Global Old Students' Association
                                        </div>
                                    </td>
                                </tr>

                                <!-- Gold Divider -->
                                <tr>
                                    <td style="
                                        height: 4px;
                                        background-color: #C9A227;
                                        font-size: 0;
                                        line-height: 0;
                                    ">&nbsp;</td>
                                </tr>

                                <!-- Content -->
                                <tr>
                                    <td style="padding: 40px 35px;">

                                        <p style="
                                            margin: 0 0 8px;
                                            color: #C9A227;
                                            font-size: 12px;
                                            font-weight: bold;
                                            letter-spacing: 1.5px;
                                            text-transform: uppercase;
                                        ">
                                            Donation Update
                                        </p>

                                        <h1 style="
                                            margin: 0 0 20px;
                                            color: #0B294D;
                                            font-size: 28px;
                                            line-height: 1.25;
                                        ">
                                            ${heading}
                                        </h1>

                                        <p style="
                                            margin: 0 0 18px;
                                            color: #4B6075;
                                            font-size: 15px;
                                            line-height: 1.7;
                                        ">
                                            Hello ${donation.isAnonymous ? "Donor" : donation.donorName},
                                        </p>

                                        <p style="
                                            margin: 0 0 25px;
                                            color: #4B6075;
                                            font-size: 15px;
                                            line-height: 1.7;
                                        ">
                                            ${message}
                                        </p>

                                        <!-- Donation Details -->
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0"
                                            style="
                                                background-color: #EAF1F8;
                                                border-radius: 7px;
                                                padding: 18px;
                                            ">
                                            <tr>
                                                <td style="padding: 7px 0; color: #4B6075; font-size: 13px;">
                                                    Donation Reference
                                                </td>
                                                <td align="right" style="padding: 7px 0; color: #0B294D; font-size: 13px; font-weight: bold;">
                                                    ${donation.gatewayReference}
                                                </td>
                                            </tr>

                                            <tr>
                                                <td style="padding: 7px 0; color: #4B6075; font-size: 13px;">
                                                    Amount
                                                </td>
                                                <td align="right" style="padding: 7px 0; color: #0B294D; font-size: 13px; font-weight: bold;">
                                                    ${donation.currency} ${donation.amount.toLocaleString("en-NG")}
                                                </td>
                                            </tr>

                                            <tr>
                                                <td style="padding: 7px 0; color: #4B6075; font-size: 13px;">
                                                    Payment Status
                                                </td>
                                                <td align="right" style="
                                                    padding: 7px 0;
                                                    color: ${isSuccessful ? "#16803C" : "#B42318"};
                                                    font-size: 13px;
                                                    font-weight: bold;
                                                ">
                                                    ${isSuccessful ? "Successful" : "Unsuccessful"}
                                                </td>
                                            </tr>
                                        </table>

                                        ${
                                            isSuccessful
                                                ? `
                                                <p style="
                                                    margin: 25px 0 0;
                                                    color: #4B6075;
                                                    font-size: 15px;
                                                    line-height: 1.7;
                                                ">
                                                    Thank you for being part of the OlivetNOSA community.
                                                    Your generosity is truly appreciated.
                                                </p>
                                                `
                                                : `
                                                <p style="
                                                    margin: 25px 0 0;
                                                    color: #4B6075;
                                                    font-size: 13px;
                                                    line-height: 1.7;
                                                ">
                                                    If you have already been charged, please allow some time
                                                    for your payment to be reconciled before trying again.
                                                </p>
                                                `
                                        }

                                        <p style="
                                            margin: 30px 0 0;
                                            padding-top: 25px;
                                            border-top: 1px solid #E5EAF0;
                                            color: #6B7C8F;
                                            font-size: 12px;
                                            line-height: 1.6;
                                        ">
                                            This email confirms the payment status recorded for your donation.
                                            Please keep it for your records.
                                        </p>

                                    </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                    <td style="
                                        background-color: #0B294D;
                                        padding: 25px 35px;
                                        text-align: center;
                                    ">
                                        <p style="
                                            margin: 0;
                                            color: #ffffff;
                                            font-size: 13px;
                                            font-weight: bold;
                                        ">
                                            OlivetNOSA
                                        </p>

                                        <p style="
                                            margin: 7px 0 0;
                                            color: rgba(255,255,255,0.65);
                                            font-size: 11px;
                                            line-height: 1.6;
                                        ">
                                            Global Old Students' Association
                                            <br />
                                            Olivet Baptist High School
                                        </p>

                                        <p style="
                                            margin: 15px 0 0;
                                            color: #C9A227;
                                            font-size: 10px;
                                            letter-spacing: 1px;
                                        ">
                                            CUM CHRISTO PROGREDERE
                                        </p>
                                    </td>
                                </tr>

                            </table>

                            <p style="
                                margin: 20px 0 0;
                                color: #7A8A9A;
                                font-size: 10px;
                                text-align: center;
                            ">
                                This is an automated email from OlivetNOSA.
                                Please do not reply directly to this message.
                            </p>

                        </td>
                    </tr>
                </table>

            </body>
            </html>
            `,
        });
    } catch (emailErr) {
        console.error(
            "Failed to deliver donation status email via provider:",
            emailErr
        );
    }
};

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

        // ====================================
        // VALIDATION
        // ====================================

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

        // Basic email validation
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
            donationAmount < 100
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

        // ====================================
        // GENERATE UNIQUE REFERENCE
        // ====================================

        const reference = `NOSA-DON-${Date.now()}-${crypto
            .randomBytes(4)
            .toString("hex")
            .toUpperCase()}`;

        // ====================================
        // CREATE PENDING DONATION
        // ====================================

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

        // ====================================
        // INITIALIZE PAYSTACK
        // ====================================

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
            // =================================
            // MARK INITIALIZATION AS FAILED
            // =================================

            donation.status = "failed";

            donation.metadata = {
                ...donation.metadata,
                initializationError: paystackError.message,
            };

            await donation.save();

            // =================================
            // AUDIT INITIALIZATION FAILURE
            // =================================

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

        // ====================================
        // AUDIT SUCCESSFUL INITIALIZATION
        // ====================================

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

        // ====================================
        // RESPONSE
        // ====================================

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

            message:
                "Failed to initialize donation. Please try again.",
        });
    }
};




export const verifyPendingDonationsInternal = async (req, res) => {
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

        // ====================================
        // VALIDATE REFERENCE
        // ====================================

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

        // ====================================
        // FIND DONATION
        // ====================================

        const donation = await Donation.findOne({
            gatewayReference: normalizedReference,
        });

        if (!donation) {
            return res.status(404).json({
                success: false,
                message: "Donation record not found.",
            });
        }

        // ====================================
        // IDEMPOTENCY CHECK
        // ====================================

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

        // ====================================
        // VERIFY TRANSACTION WITH PAYSTACK
        // ====================================

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

        // ====================================
        // VERIFY REFERENCE
        // ====================================

        if (transaction.reference !== normalizedReference) {
            await logDonationAudit({
                actor: req.user?._id || null,
                action: "donation.verification_mismatch",
                resource: "Donation",
                resourceId: donation._id,
                details: {
                    reason: "Transaction reference mismatch.",
                    expectedReference: normalizedReference,
                    receivedReference: transaction.reference || null,
                },
                req,
            });

            return res.status(409).json({
                success: false,
                message: "Transaction reference verification failed.",
            });
        }

        // ====================================
        // VERIFY AMOUNT AND CURRENCY
        // ====================================

        const expectedAmount = donation.amount * 100;

        const amountMatches =
            Number.isSafeInteger(transaction.amount) &&
            transaction.amount === expectedAmount;

        const currencyMatches =
            transaction.currency === donation.currency;

        if (!amountMatches || !currencyMatches) {
            await logDonationAudit({
                actor: req.user?._id || null,
                action: "donation.verification_mismatch",
                resource: "Donation",
                resourceId: donation._id,
                details: {
                    expectedAmount,
                    receivedAmount: transaction.amount ?? null,
                    expectedCurrency: donation.currency,
                    receivedCurrency: transaction.currency || null,
                },
                req,
            });

            return res.status(409).json({
                success: false,
                message: "Transaction amount or currency could not be verified.",
            });
        }

        // ====================================
        // HANDLE SUCCESSFUL TRANSACTION
        // ====================================

        if (transaction.status === "success") {
            const updatedDonation = await Donation.findOneAndUpdate(
                {
                    _id: donation._id,
                    status: { $ne: "successful" },
                },
                {
                    $set: {
                        status: "successful",
                        paidAt: transaction.paid_at
                            ? new Date(transaction.paid_at)
                            : new Date(),
                        "metadata.paystackTransactionId": transaction.id || null,
                        "metadata.channel": transaction.channel || null,
                        "metadata.verifiedAt": new Date(),
                    },
                },
                {
                    new: true,
                }
            );

            // Only the request that successfully changes the status
            // sends the email and creates the success audit log.
            if (updatedDonation) {
                await sendDonationStatusEmail(
                    updatedDonation,
                    "successful"
                );

                await logDonationAudit({
                    actor: req.user?._id || null,
                    action: "donation.successful",
                    resource: "Donation",
                    resourceId: updatedDonation._id,
                    details: {
                        amount: updatedDonation.amount,
                        currency: updatedDonation.currency,
                        gatewayReference: updatedDonation.gatewayReference,
                        paystackTransactionId: transaction.id,
                        isAnonymous: updatedDonation.isAnonymous,
                    },
                    req,
                });
            }

            const finalDonation =
                updatedDonation ||
                await Donation.findById(donation._id);

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

        // ====================================
        // HANDLE FAILED TRANSACTION
        // ====================================

        if (
            transaction.status === "failed" ||
            transaction.status === "abandoned"
        ) {
            const newStatus =
                transaction.status === "abandoned"
                    ? "cancelled"
                    : "failed";

            const updatedDonation = await Donation.findOneAndUpdate(
                {
                    _id: donation._id,
                    status: "pending",
                },
                {
                    $set: {
                        status: newStatus,
                        "metadata.verificationStatus": transaction.status,
                        "metadata.verifiedAt": new Date(),
                    },
                },
                {
                    new: true,
                }
            );

            // Only send the failure email and audit once.
            if (updatedDonation) {
                await sendDonationStatusEmail(
                    updatedDonation,
                    "failed"
                );

                await logDonationAudit({
                    actor: req.user?._id || null,
                    action: `donation.${updatedDonation.status}`,
                    resource: "Donation",
                    resourceId: updatedDonation._id,
                    details: {
                        gatewayReference: updatedDonation.gatewayReference,
                        paystackStatus: transaction.status,
                    },
                    req,
                });
            }

            const finalDonation =
                updatedDonation ||
                await Donation.findById(donation._id);

            // A successful payment must never be reported as failed.
            if (finalDonation.status === "successful") {
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
                    finalDonation.status === "cancelled"
                        ? "Donation checkout was abandoned."
                        : "Donation payment was not successful.",
                donation: {
                    id: finalDonation._id,
                    reference: finalDonation.gatewayReference,
                    status: finalDonation.status,
                },
            });
        }

        // ====================================
        // TRANSACTION STILL PROCESSING
        // ====================================

        const currentDonation =
            await Donation.findById(donation._id);

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






export const handleDonationWebhook = async (req, res) => {
    try {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        const signature = req.headers["x-paystack-signature"];

        // Confirm that Paystack sent a raw request body.
        if (!Buffer.isBuffer(req.body)) {
            return res.status(400).json({
                success: false,
                message: "Invalid webhook request body",
            });
        }

        if (!secret || !signature) {
            return res.status(401).json({
                success: false,
                message: "Invalid webhook signature",
            });
        }

        // Verify Paystack's signature.
        const hash = crypto
            .createHmac("sha512", secret)
            .update(req.body)
            .digest("hex");

        const receivedSignature = Buffer.from(signature, "utf8");
        const expectedSignature = Buffer.from(hash, "utf8");

        if (
            receivedSignature.length !== expectedSignature.length ||
            !crypto.timingSafeEqual(receivedSignature, expectedSignature)
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid webhook signature",
            });
        }

        const payload = JSON.parse(req.body.toString("utf8"));
        const { event, data } = payload;

        const reference = data?.reference;

        if (!reference) {
            return res.status(200).json({
                success: true,
                message: "Webhook received",
            });
        }

        const donation = await Donation.findOne({
            gatewayReference: reference,
            gateway: "paystack",
        });

        if (!donation) {
            return res.status(200).json({
                success: true,
                message: "Donation not found",
            });
        }

        // Ignore events we do not need.
        if (event !== "charge.success" && event !== "charge.failed") {
            return res.status(200).json({
                success: true,
                message: "Event ignored",
            });
        }

        // Never allow a failed event to downgrade a successful donation.
        if (donation.status === "successful") {
            return res.status(200).json({
                success: true,
                message: "Donation already processed",
            });
        }

        // Confirm the amount and currency before updating the donation.
        const expectedAmount = donation.amount * 100;
        const receivedAmount = Number(data?.amount);
        const receivedCurrency = String(data?.currency || "").toUpperCase();

        if (
            !Number.isSafeInteger(expectedAmount) ||
            receivedAmount !== expectedAmount ||
            receivedCurrency !== donation.currency.toUpperCase()
        ) {
            await logDonationAudit({
                action: "donation.webhook_mismatch",
                resource: "donation",
                resourceId: donation._id,
                details: {
                    reference,
                    expectedAmount,
                    receivedAmount,
                    expectedCurrency: donation.currency,
                    receivedCurrency,
                    event,
                },
            });

            return res.status(200).json({
                success: true,
                message: "Transaction details did not match",
            });
        }

        // ====================================
        // HANDLE SUCCESSFUL PAYMENT
        // ====================================

        if (event === "charge.success") {
            const updatedDonation = await Donation.findOneAndUpdate(
                {
                    _id: donation._id,
                    status: { $ne: "successful" },
                },
                {
                    $set: {
                        status: "successful",
                        paidAt: data.paid_at
                            ? new Date(data.paid_at)
                            : new Date(),
                        "metadata.paystackTransactionId": data.id || null,
                        "metadata.paystackChannel": data.channel || null,
                        "metadata.webhookVerifiedAt": new Date(),
                    },
                },
                {
                    new: true,
                }
            );

            if (updatedDonation) {
                await logDonationAudit({
                    action: "donation.payment_successful",
                    resource: "donation",
                    resourceId: updatedDonation._id,
                    details: {
                        reference,
                        amount: updatedDonation.amount,
                        currency: updatedDonation.currency,
                        source: "paystack_webhook",
                    },
                });

                await sendDonationStatusEmail(
                    updatedDonation,
                    "successful"
                );
            }

            return res.status(200).json({
                success: true,
                message: "Donation webhook processed",
            });
        }

        // ====================================
        // HANDLE FAILED PAYMENT
        // ====================================

        if (event === "charge.failed") {
            const updatedDonation = await Donation.findOneAndUpdate(
                {
                    _id: donation._id,
                    status: "pending",
                },
                {
                    $set: {
                        status: "failed",
                        "metadata.webhookVerifiedAt": new Date(),
                        "metadata.failureMessage":
                            data.gateway_response ||
                            data.message ||
                            "Payment failed",
                    },
                },
                {
                    new: true,
                }
            );

            if (updatedDonation) {
                await logDonationAudit({
                    action: "donation.payment_failed",
                    resource: "donation",
                    resourceId: updatedDonation._id,
                    details: {
                        reference,
                        amount: updatedDonation.amount,
                        currency: updatedDonation.currency,
                        source: "paystack_webhook",
                    },
                });

                await sendDonationStatusEmail(
                    updatedDonation,
                    "failed"
                );
            }
        }

        return res.status(200).json({
            success: true,
            message: "Donation webhook processed",
        });

    } catch (error) {
        console.error("Donation webhook error:", error);

        return res.status(500).json({
            success: false,
            message: "Donation webhook processing failed",
        });
    }
};