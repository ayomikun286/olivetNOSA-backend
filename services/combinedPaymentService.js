
import mongoose from "mongoose";
import User from "../models/User.js";
import { sendEmail } from "./email.service.js";
import { createAuditLog } from "./auditLog.service.js";
import Payment from "../models/Payment.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import Obligation from "../models/Obligation.js";
import { updateMemberFinancialStatus } from "./memberFinancialStatus.service.js";
import { mapPaystackPaymentMethod } from "./paymentService.js";

/**
 * Completes a combined payment.
 *
 * A combined payment has:
 * - One Payment document.
 * - One Paystack transaction.
 * - Multiple allocations, each linked to an ObligationAssignment.
 *
 * The existing single-payment completion service is not used or modified.
 */
export const completeSuccessfulCombinedPayment = async (
    paymentId,
    transaction,
    {
        actor = null,
        req = null,
        source = "verification",
        recoveryReason = null,
    } = {}
) => {
    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            const payment = await Payment.findById(paymentId).session(session);

            if (!payment) {
                throw new Error("Combined payment record was not found.");
            }

            // Idempotency: never apply the same payment twice.
            if (payment.status === "successful") {
                result = {
                    payment,
                    assignments: [],
                    alreadyProcessed: true,
                };
                return;
            }

            if (payment.metadata?.paymentType !== "combined") {
                throw new Error("This is not a combined payment.");
            }

            if (
                !Array.isArray(payment.allocations) ||
                payment.allocations.length === 0
            ) {
                throw new Error("Combined payment has no allocations.");
            }

            // Reject duplicate assignment IDs.
            const allocationIds = payment.allocations.map((allocation) =>
                String(allocation.obligationAssignment)
            );

            if (new Set(allocationIds).size !== allocationIds.length) {
                throw new Error("Combined payment contains duplicate obligations.");
            }

            // The saved allocations must equal the payment total.
            const allocationTotal = payment.allocations.reduce(
                (total, allocation) =>
                    total + Number(allocation.amount || 0),
                0
            );

            if (
                !Number.isFinite(allocationTotal) ||
                Math.abs(allocationTotal - Number(payment.amount)) > 0.01
            ) {
                throw new Error(
                    "Combined payment allocation total does not match the payment amount."
                );
            }

            const completedAssignments = [];
            const individualYears = new Set();

            for (const allocation of payment.allocations) {
                const assignment = await ObligationAssignment.findById(
                    allocation.obligationAssignment
                ).session(session);

                if (!assignment) {
                    throw new Error(
                        `Obligation assignment ${allocation.obligationAssignment} was not found.`
                    );
                }

                const obligation = await Obligation.findById(
                    assignment.obligation
                ).session(session);

                if (!obligation) {
                    throw new Error(
                        "An obligation linked to this payment was not found."
                    );
                }

                const amount = Number(allocation.amount);
                const currentPaid = Number(assignment.amountPaid || 0);
                const amountDue = Number(assignment.amountDue || 0);
                const outstanding = Math.max(0, amountDue - currentPaid);

                if (!Number.isFinite(amount) || amount <= 0) {
                    throw new Error(
                        "A combined payment allocation has an invalid amount."
                    );
                }

                if (amount > outstanding + 0.01) {
                    throw new Error(
                        `The outstanding amount for "${obligation.title || "an obligation"}" has changed.`
                    );
                }

                const newAmountPaid = currentPaid + amount;
                const isFullyPaid = newAmountPaid >= amountDue - 0.01;

                const newStatus = isFullyPaid
                    ? "paid"
                    : assignment.status === "overdue"
                        ? "overdue"
                        : "partial";

                // Optimistic condition prevents overwriting a concurrent payment.
                const updateResult = await ObligationAssignment.updateOne(
                    {
                        _id: assignment._id,
                        amountPaid: currentPaid,
                        amountDue,
                    },
                    {
                        $inc: { amountPaid: amount },
                        $set: { status: newStatus },
                    },
                    { session }
                );

                if (updateResult.modifiedCount !== 1) {
                    throw new Error(
                        "An obligation changed while this payment was being processed. Please investigate the transaction."
                    );
                }

                // Keep the original year value/type used by the existing service.
                if (obligation.category === "individual" && obligation.year) {
                    individualYears.add(obligation.year);
                }

                completedAssignments.push({
                    assignmentId: assignment._id,
                    obligationId: obligation._id,
                    obligationTitle:
                        obligation.title || obligation.name || "Obligation",
                    amount,
                    amountPaid: newAmountPaid,
                    amountDue,
                    status: newStatus,
                });
            }

            // Update the member's financial status for affected individual years.
            for (const year of individualYears) {
                await updateMemberFinancialStatus(
                    payment.user,
                    year,
                    session,
                    {
                        source: "combined_payment",
                        paymentId: payment._id,
                    }
                );
            }

            payment.status = "successful";
            payment.paidAt = new Date();

            // Reuse the existing payment-method mapper.
            payment.paymentMethod = mapPaystackPaymentMethod(
                transaction?.channel
            );

            payment.metadata = {
                ...(payment.metadata?.toObject?.() ||
                    payment.metadata ||
                    {}),
                paystackTransactionId: transaction?.id || null,
                paystackStatus: transaction?.status || "success",
                completionSource: source,
                completedAt: new Date(),
            };

            await payment.save({ session });

            await createAuditLog({
                actor,
                action: "payment.successful",
                resource: "Payment",
                resourceId: payment._id,
                targetUser: payment.user,
                req,
                session,
                details: {
                    reference: payment.gatewayReference,
                    recoveryReason:
                        source === "superadmin_recovery"
                            ? recoveryReason
                            : null,
                    transactionId: transaction?.id ?? null,
                    amount: payment.amount,
                    currency: transaction?.currency ?? payment.currency,
                    channel: transaction?.channel ?? null,
                    paymentMethod: payment.paymentMethod,
                    paymentType: "combined",

                    allocations: completedAssignments.map((item) => ({
                        obligationAssignment: item.assignmentId,
                        obligation: item.obligationId,
                        obligationTitle: item.obligationTitle,
                        amount: item.amount,
                        amountPaid: item.amountPaid,
                        amountDue: item.amountDue,
                        status: item.status,
                    })),

                    source,
                },
            });

            result = {
                payment,
                assignments: completedAssignments,
                alreadyProcessed: false,
            };
        });

        // Send the success email only after the transaction commits.
        if (result && !result.alreadyProcessed) {
            try {
                const user = await User.findById(result.payment.user)
                    .select("email firstName lastName")
                    .lean();

                // Some members do not have email addresses.
                // Skip email delivery without affecting payment completion.
                if (user?.email) {
                    const allocationRows = result.assignments
                        .map(
                            (item) => `
                                <tr>
                                    <td style="
                                        padding: 12px 14px;
                                        border-bottom: 1px solid #e3e8ef;
                                        font-size: 13px;
                                        color: #555555;
                                    ">
                                        ${item.obligationTitle}
                                    </td>
                                    <td style="
                                        padding: 12px 14px;
                                        border-bottom: 1px solid #e3e8ef;
                                        font-size: 13px;
                                        color: #555555;
                                        text-align: right;
                                        white-space: nowrap;
                                    ">
                                        ₦${item.amount.toLocaleString("en-NG")}
                                    </td>
                                </tr>
                            `
                        )
                        .join("");

                    await sendEmail({
                        to: user.email,
                        subject: "Payment Successful – OlivetNOSA",

                        html: `
                            <div style="
                                margin: 0;
                                padding: 40px 16px;
                                background-color: #f4f7fb;
                                font-family: Arial, Helvetica, sans-serif;
                                color: #333333;
                            ">
                                <div style="
                                    max-width: 620px;
                                    margin: 0 auto;
                                    background: #ffffff;
                                    border-radius: 12px;
                                    overflow: hidden;
                                    border: 1px solid #e3e8ef;
                                    box-shadow: 0 4px 16px rgba(18, 59, 109, 0.08);
                                ">
                                    <!-- HEADER -->
                                    <div style="
                                        background: #123B6D;
                                        padding: 28px 30px;
                                        text-align: center;
                                    ">
                                        <div style="
                                            display: inline-block;
                                            width: 64px;
                                            height: 64px;
                                            background: #ffffff;
                                            border-radius: 50%;
                                            padding: 6px;
                                            box-sizing: border-box;
                                        ">
                                            <img
                                                src="https://res.cloudinary.com/bx4pnrek/image/upload/v1792582571/onw-gosa/website-content/ob1t3jspsuqz8wvxnkba.png"
                                                alt="Olivet Baptist High School Crest"
                                                width="52"
                                                height="52"
                                                style="
                                                    display: block;
                                                    width: 52px;
                                                    height: 52px;
                                                    object-fit: contain;
                                                    margin: 0 auto;
                                                "
                                            />
                                        </div>

                                        <h1 style="
                                            margin: 14px 0 4px;
                                            color: #ffffff;
                                            font-size: 24px;
                                            line-height: 1.3;
                                            font-weight: 700;
                                        ">
                                            OlivetNOSA
                                        </h1>

                                        <p style="
                                            margin: 0;
                                            color: #dbe8f5;
                                            font-size: 13px;
                                        ">
                                            National Old Students' Association
                                        </p>
                                    </div>

                                    <!-- CONTENT -->
                                    <div style="padding: 38px 36px;">
                                        <!-- SUCCESS ICON -->
                                        <div style="text-align: center; margin-bottom: 20px;">
                                            <div style="
                                                display: inline-block;
                                                width: 54px;
                                                height: 54px;
                                                line-height: 54px;
                                                border-radius: 50%;
                                                background: #eaf7ef;
                                                color: #218739;
                                                font-size: 28px;
                                                font-weight: bold;
                                            ">
                                                ✓
                                            </div>
                                        </div>

                                        <h2 style="
                                            margin: 0 0 12px;
                                            text-align: center;
                                            color: #123B6D;
                                            font-size: 22px;
                                        ">
                                            Payment Successful
                                        </h2>

                                        <p style="
                                            margin: 0 0 24px;
                                            text-align: center;
                                            font-size: 14px;
                                            line-height: 1.7;
                                            color: #666666;
                                        ">
                                            Your combined payment has been successfully received
                                            and recorded by OlivetNOSA.
                                        </p>

                                        <!-- PAYMENT AMOUNT -->
                                        <div style="
                                            margin: 24px 0;
                                            padding: 22px;
                                            background: #f4f7fb;
                                            border-left: 4px solid #C9A227;
                                            border-radius: 6px;
                                            text-align: center;
                                        ">
                                            <p style="
                                                margin: 0 0 7px;
                                                font-size: 12px;
                                                font-weight: 700;
                                                color: #6b7280;
                                                text-transform: uppercase;
                                                letter-spacing: 0.5px;
                                            ">
                                                Total Amount Paid
                                            </p>

                                            <p style="
                                                margin: 0;
                                                font-size: 28px;
                                                font-weight: 700;
                                                color: #123B6D;
                                            ">
                                                ₦${Number(result.payment.amount).toLocaleString("en-NG")}
                                            </p>
                                        </div>

                                        <!-- PAYMENT BREAKDOWN -->
                                        <div style="
                                            margin: 28px 0;
                                            border: 1px solid #e3e8ef;
                                            border-radius: 8px;
                                            overflow: hidden;
                                        ">
                                            <div style="
                                                padding: 14px 18px;
                                                background: #f8fafc;
                                                border-bottom: 1px solid #e3e8ef;
                                            ">
                                                <strong style="color: #123B6D; font-size: 14px;">
                                                    Payment Breakdown
                                                </strong>
                                            </div>

                                            <table style="
                                                width: 100%;
                                                border-collapse: collapse;
                                            ">
                                                <thead>
                                                    <tr style="background: #f8fafc;">
                                                        <th style="
                                                            padding: 12px 14px;
                                                            text-align: left;
                                                            font-size: 12px;
                                                            color: #123B6D;
                                                        ">
                                                            Obligation
                                                        </th>
                                                        <th style="
                                                            padding: 12px 14px;
                                                            text-align: right;
                                                            font-size: 12px;
                                                            color: #123B6D;
                                                        ">
                                                            Amount
                                                        </th>
                                                    </tr>
                                                </thead>

                                                <tbody>
                                                    ${allocationRows}
                                                </tbody>
                                            </table>
                                        </div>

                                        <!-- PAYMENT DETAILS -->
                                        <div style="
                                            margin: 28px 0;
                                            border: 1px solid #e3e8ef;
                                            border-radius: 8px;
                                            overflow: hidden;
                                        ">
                                            <div style="
                                                padding: 14px 18px;
                                                background: #f8fafc;
                                                border-bottom: 1px solid #e3e8ef;
                                            ">
                                                <strong style="color: #123B6D; font-size: 14px;">
                                                    Payment Details
                                                </strong>
                                            </div>

                                            <div style="padding: 16px 18px;">
                                                <p style="
                                                    margin: 0 0 12px;
                                                    font-size: 13px;
                                                    line-height: 1.6;
                                                ">
                                                    <strong>Reference:</strong><br />
                                                    <span style="color: #555555;">
                                                        ${result.payment.gatewayReference}
                                                    </span>
                                                </p>

                                                <p style="
                                                    margin: 0;
                                                    font-size: 13px;
                                                    line-height: 1.6;
                                                ">
                                                    <strong>Payment Method:</strong><br />
                                                    <span style="color: #555555;">
                                                        ${result.payment.paymentMethod || "Paystack"}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>

                                        <p style="
                                            margin: 24px 0 0;
                                            font-size: 14px;
                                            line-height: 1.7;
                                            color: #555555;
                                        ">
                                            Hello <strong>${user.firstName || "Member"}</strong>,
                                            thank you for fulfilling your payment obligations and
                                            supporting the OlivetNOSA community.
                                        </p>

                                        <p style="
                                            margin: 24px 0 0;
                                            font-size: 13px;
                                            line-height: 1.7;
                                            color: #777777;
                                        ">
                                            Please keep this email and your payment reference
                                            for your records.
                                        </p>

                                        <p style="
                                            margin: 30px 0 0;
                                            font-size: 14px;
                                            line-height: 1.6;
                                            color: #555555;
                                        ">
                                            Warm regards,<br />
                                            <strong style="color: #123B6D;">
                                                OlivetNOSA Administration
                                            </strong>
                                        </p>
                                    </div>

                                    <!-- FOOTER -->
                                    <div style="
                                        background: #0B294D;
                                        padding: 22px 30px;
                                        text-align: center;
                                    ">
                                        <p style="
                                            margin: 0 0 6px;
                                            color: #ffffff;
                                            font-size: 13px;
                                            font-weight: 700;
                                        ">
                                            OlivetNOSA
                                        </p>

                                        <p style="
                                            margin: 0;
                                            color: #b9c9da;
                                            font-size: 12px;
                                            line-height: 1.6;
                                        ">
                                            National Old Students' Association
                                        </p>

                                        <p style="
                                            margin: 10px 0 0;
                                            color: #8fa7bf;
                                            font-size: 11px;
                                        ">
                                            This is an automated payment notification.
                                            Please do not reply directly to this email.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        `,
                    });
                }
            } catch (emailError) {
                console.error(
                    "Combined payment success email error:",
                    emailError.message
                );
            }
        }

        return result;
    } finally {
        await session.endSession();
    }
};
