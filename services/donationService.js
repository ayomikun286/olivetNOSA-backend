import Donation from "../models/Donation.js";
import { createAuditLog } from "./auditLog.service.js";
import { sendEmail } from "./email.service.js";

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



export const completeSuccessfulDonation = async (
    donationId,
    transaction,
    { actor = null, req = null, source = "system" } = {}
) => {
    const updatedDonation = await Donation.findOneAndUpdate(
        {
            _id: donationId,
            status: "pending",
        },
        {
            $set: {
                status: "successful",
                paidAt: transaction.paid_at
                    ? new Date(transaction.paid_at)
                    : new Date(),

                "metadata.paystackTransactionId": transaction.id || null,
                "metadata.paystackStatus": transaction.status,
                "metadata.channel": transaction.channel || null,
                "metadata.currency": transaction.currency || "NGN",
                "metadata.gatewayResponse": transaction.gateway_response || null,
                "metadata.paystackAmount": transaction.amount ?? null,
                "metadata.paystackFees": transaction.fees ?? null,
                "metadata.requestedAmount": transaction.requested_amount ?? null,
                "metadata.verifiedAt": new Date(),
                "metadata.verificationSource": source,
            },
        },
        { returnDocument: "after" }
    );

    if (!updatedDonation) {
        const existingDonation = await Donation.findById(donationId);

        if (!existingDonation) {
            throw new Error("Donation record not found.");
        }

        return {
            donation: existingDonation,
           alreadyProcessed: true
        };
    }

    await logDonationAudit({
        actor,
        action: "donation.successful",
        resource: "Donation",
        resourceId: updatedDonation._id,
        targetUser: updatedDonation.user || null,
        req,
        details: {
            reference: updatedDonation.gatewayReference,
            donationAmount: updatedDonation.amount,
            transactionAmount: transaction.amount,
            transactionFees: transaction.fees ?? null,
            requestedAmount: transaction.requested_amount ?? null,
            currency: updatedDonation.currency,
            transactionId: transaction.id ?? null,
            source,
            isAnonymous: updatedDonation.isAnonymous,
        },
    });

    await sendDonationStatusEmail(updatedDonation, "successful");

    return {
        donation: updatedDonation,
        alreadyProcessed: false,
    };
};



export const handleFailedDonation = async (
    donation,
    transaction,
    status = "failed",
    { actor = null, req = null, source = "system" } = {}
) => {
    const updatedDonation = await Donation.findOneAndUpdate(
        {
            _id: donation._id,
            status: "pending",
        },
        {
            $set: {
                status,
                "metadata.paystackStatus": transaction?.status || status,
                "metadata.gatewayResponse":
                    transaction?.gateway_response ||
                    "Donation payment unsuccessful.",
                "metadata.failedAt": new Date(),
                "metadata.verificationSource": source,
            },
        },
        { returnDocument: "after" }
    );

    if (!updatedDonation) {
    return {
        donation: await Donation.findById(donation._id),
        alreadyProcessed: true,
    };
}

    await logDonationAudit({
        actor,
        action: `donation.${status}`,
        resource: "Donation",
        resourceId: updatedDonation._id,
        targetUser: updatedDonation.user || null,
        req,
        details: {
            previousStatus: donation.status,
            newStatus: status,
            reference: updatedDonation.gatewayReference,
            transactionId: transaction?.id ?? null,
            source,
        },
    });

    await sendDonationStatusEmail(updatedDonation, "failed");

    return {
    donation: updatedDonation,
    alreadyProcessed: false,
};
};


export const handleDonationVerificationMismatch = async (
    donation,
    transaction,
    {
        actor = null,
        req = null,
        source = "system",
        reason,
    } = {}
) => {
    if (donation.status === "successful") {
        return donation;
    }

    await logDonationAudit({
        actor,
        action: "donation.verification_mismatch",
        resource: "Donation",
        resourceId: donation._id,
        targetUser: donation.user || null,
        req,
        details: {
            reference: donation.gatewayReference,
            expectedAmount: Math.round(Number(donation.amount) * 100),
            requestedAmount: transaction?.requested_amount ?? null,
            receivedAmount: transaction?.amount ?? null,
            receivedFees: transaction?.fees ?? null,
            expectedCurrency: donation.currency || "NGN",
            receivedCurrency: transaction?.currency ?? null,
            transactionId: transaction?.id ?? null,
            reason,
            source,
        },
    });

    return donation;
};