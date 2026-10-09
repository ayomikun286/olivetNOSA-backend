import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import { createNotification } from "../services/notificationService.js";
import { sendEmail } from "../services/email.service.js";
import Obligation from "../models/Obligation.js";
import {
  updateMemberFinancialStatus,
} from "../services/memberFinancialStatus.service.js";
import User from "../models/User.js";
import { createAuditLog } from "./auditLog.service.js"; 
export const completeSuccessfulPayment = async (
  paymentId,
  transaction,
  {
    actor = null,
    req = null,
    source = "system",
  } = {}
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

    const obligation = await Obligation.findById(
      assignment.obligation
    )
      .select("year")
      .session(session);

    if (!obligation) {
      throw new Error(
        "Obligation not found."
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

    await updateMemberFinancialStatus(
  payment.user,
  obligation.year,
  session,
  {
    actor,
    req,
    source: "payment",
    paymentId: payment._id,
    reference: payment.gatewayReference,
  }
);
    // ========================================
    // COMMIT DATABASE TRANSACTION
    // ========================================

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
    transactionId: transaction?.id ?? null,
    amount: payment.amount,
    currency: transaction?.currency ?? payment.currency,
    channel: transaction?.channel ?? null,
    paymentMethod: payment.paymentMethod,
    obligationAssignment: payment.obligationAssignment,
    assignmentStatus: assignment.status,
    source,
  },
});



    await session.commitTransaction();



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

          subject: "Payment Successful – OlivetGOSA",

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
              src="https://olivetbhsnosa.org/images/olivet-crest.png"
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
            OlivetGOSA
          </h1>

          <p style="
            margin: 0;
            color: #dbe8f5;
            font-size: 13px;
          ">
            Global Old Students' Association
          </p>

        </div>


        <!-- CONTENT -->
        <div style="
          padding: 38px 36px;
        ">

          <!-- SUCCESS ICON -->
          <div style="
            text-align: center;
            margin-bottom: 20px;
          ">
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
            Your payment has been successfully received and recorded
            by OlivetGOSA.
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
              Amount Paid
            </p>

            <p style="
              margin: 0;
              font-size: 28px;
              font-weight: 700;
              color: #123B6D;
            ">
              ₦${payment.amount.toLocaleString()}
            </p>

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
              <strong style="
                color: #123B6D;
                font-size: 14px;
              ">
                Payment Details
              </strong>
            </div>

            <div style="
              padding: 16px 18px;
            ">

              <p style="
                margin: 0 0 12px;
                font-size: 13px;
                line-height: 1.6;
              ">
                <strong>Reference:</strong><br />
                <span style="color: #555555;">
                  ${payment.gatewayReference}
                </span>
              </p>

              <p style="
                margin: 0;
                font-size: 13px;
                line-height: 1.6;
              ">
                <strong>Payment Method:</strong><br />
                <span style="color: #555555;">
                  ${payment.paymentMethod}
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
            thank you for fulfilling your payment obligation and
            supporting the OlivetGOSA community.
          </p>

          <p style="
            margin: 24px 0 0;
            font-size: 13px;
            line-height: 1.7;
            color: #777777;
          ">
            Please keep this email and your payment reference for
            your records.
          </p>

          <p style="
            margin: 30px 0 0;
            font-size: 14px;
            line-height: 1.6;
            color: #555555;
          ">
            Warm regards,<br />
            <strong style="color: #123B6D;">
              OlivetGOSA Administration
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
            OlivetGOSA
          </p>

          <p style="
            margin: 0;
            color: #b9c9da;
            font-size: 12px;
            line-height: 1.6;
          ">
            Global Old Students' Association
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
  alreadyProcessed: false,
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
  status = "failed",
  {
    actor = null,
    req = null,
    source = "system",
  } = {}
) => {
  // Prevent duplicate processing of the same failure status.
  if (payment.status === status) {
    return payment;
  }

  const previousStatus = payment.status;

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

  await createAuditLog({
  actor,
  action: "payment.status_changed",
  resource: "Payment",
  resourceId: payment._id,
  targetUser: payment.user,
  req,
  details: {
    previousStatus,
    newStatus: status,
    reference: payment.gatewayReference,
    amount: payment.amount,
    transactionId: transaction?.id ?? null,
    gatewayStatus: transaction?.status ?? null,
    gatewayResponse:
      transaction?.gateway_response ??
      "Payment was not successful.",
    source,
  },
});

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

        subject: "Payment Failed – OlivetGOSA",

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
              src="https://olivetbhsnosa.org/images/olivet-crest.png"
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
            OlivetGOSA
          </h1>

          <p style="
            margin: 0;
            color: #dbe8f5;
            font-size: 13px;
          ">
            Global Old Students' Association
          </p>

        </div>


        <!-- CONTENT -->
        <div style="
          padding: 38px 36px;
        ">

          <!-- STATUS ICON -->
          <div style="
            text-align: center;
            margin-bottom: 20px;
          ">
            <div style="
              display: inline-block;
              width: 54px;
              height: 54px;
              line-height: 54px;
              border-radius: 50%;
              background: #fff1f1;
              color: #c0392b;
              font-size: 28px;
              font-weight: bold;
            ">
              ×
            </div>
          </div>


          <h2 style="
            margin: 0 0 12px;
            text-align: center;
            color: #123B6D;
            font-size: 22px;
          ">
            Payment Unsuccessful
          </h2>

          <p style="
            margin: 0 0 24px;
            text-align: center;
            font-size: 14px;
            line-height: 1.7;
            color: #666666;
          ">
            Unfortunately, your payment could not be completed.
            No successful payment has been recorded for this transaction.
          </p>


          <!-- AMOUNT -->
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
              Payment Amount
            </p>

            <p style="
              margin: 0;
              font-size: 28px;
              font-weight: 700;
              color: #123B6D;
            ">
              ₦${payment.amount.toLocaleString()}
            </p>

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
              <strong style="
                color: #123B6D;
                font-size: 14px;
              ">
                Payment Details
              </strong>
            </div>

            <div style="
              padding: 16px 18px;
            ">

              <p style="
                margin: 0 0 12px;
                font-size: 13px;
                line-height: 1.6;
              ">
                <strong>Reference:</strong><br />
                <span style="color: #555555;">
                  ${payment.gatewayReference}
                </span>
              </p>

              <p style="
                margin: 0;
                font-size: 13px;
                line-height: 1.6;
              ">
                <strong>Reason:</strong><br />
                <span style="color: #555555;">
                  ${transaction?.gateway_response ||
          "Payment was not successful."
          }
                </span>
              </p>

            </div>

          </div>


          <!-- NEXT STEP -->
          <div style="
            margin: 26px 0;
            padding: 16px 18px;
            background: #f4f7fb;
            border-radius: 7px;
          ">

            <p style="
              margin: 0;
              font-size: 14px;
              line-height: 1.7;
              color: #555555;
            ">
              <strong style="color: #123B6D;">
                What to do next
              </strong><br />

              Please return to your payment history and try the
              payment again. If the problem continues, contact the
              OlivetGOSA administration for assistance.
            </p>

          </div>


          <p style="
            margin: 24px 0 0;
            font-size: 14px;
            line-height: 1.7;
            color: #555555;
          ">
            Hello <strong>${user.firstName || "Member"}</strong>,
            we were unable to complete this payment.
          </p>

          <p style="
            margin: 30px 0 0;
            font-size: 14px;
            line-height: 1.6;
            color: #555555;
          ">
            Warm regards,<br />
            <strong style="color: #123B6D;">
              OlivetGOSA Administration
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
            OlivetGOSA
          </p>

          <p style="
            margin: 0;
            color: #b9c9da;
            font-size: 12px;
            line-height: 1.6;
          ">
            Global Old Students' Association
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
      "Payment failure email error:",
      emailError.message
    );
  }

  return payment;
};


export const handlePaymentVerificationMismatch = async (
  payment,
  transaction,
  {
    req = null,
    actor = null,
    source = "system",
    reason,
  } = {}
) => {
  // Never downgrade a payment already confirmed as successful.
  if (payment.status === "successful") {
    return payment;
  }

  const previousStatus = payment.status;

  payment.status = "failed";
  payment.metadata = {
    ...payment.metadata,
    verificationError: reason,
    paystackStatus: transaction?.status ?? null,
    paystackTransactionId: transaction?.id ?? null,
    paystackAmount: transaction?.amount ?? null,
    paystackCurrency: transaction?.currency ?? null,
    verifiedAt: new Date(),
  };

  await payment.save();

  await createAuditLog({
    actor,
    action: "payment.verification_mismatch",
    resource: "Payment",
    resourceId: payment._id,
    targetUser: payment.user,
    req,
    details: {
      previousStatus,
      newStatus: "failed",
      reference: payment.gatewayReference,
      expectedAmount: Number(payment.amount) * 100,
      receivedAmount: transaction?.amount ?? null,
      expectedCurrency: payment.currency ?? "NGN",
      receivedCurrency: transaction?.currency ?? null,
      reason,
      source,
    },
  });

  return payment;
};

export const mapPaystackPaymentMethod = (
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