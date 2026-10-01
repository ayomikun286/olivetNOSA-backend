import ObligationAssignment from "../models/ObligationAssignment.js";
import Obligation from "../models/Obligation.js";
import { createNotification } from "./notificationService.js";
import { sendEmail } from "./email.service.js";

import { buildObligationReminderEmail } from "../utils/Mail-template/obligationReminder.template.js";

// ========================================
// HELPERS
// ========================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const startOfDay = (date) => {
  const value = new Date(date);

  value.setHours(0, 0, 0, 0);

  return value;
};

const daysBetween = (from, to) => {
  const fromDay = startOfDay(from);
  const toDay = startOfDay(to);

  return Math.round((toDay - fromDay) / MS_PER_DAY);
};

const formatCurrency = (amount) => {
  return `₦${Number(amount || 0).toLocaleString("en-NG")}`;
};

// ========================================
// REMINDER DETAILS
// ========================================

const getReminderType = ({
  daysUntilDue,
  daysOverdue,
  reminders,
}) => {
  // 30 days before
  if (
    daysUntilDue === 30 &&
    !reminders?.thirtyDay?.sent
  ) {
    return "thirtyDay";
  }

  // 7 days before
  if (
    daysUntilDue === 7 &&
    !reminders?.sevenDay?.sent
  ) {
    return "sevenDay";
  }

  // 1 day before
  if (
    daysUntilDue === 1 &&
    !reminders?.oneDay?.sent
  ) {
    return "oneDay";
  }

  // Due today
  if (
    daysUntilDue === 0 &&
    !reminders?.due?.sent
  ) {
    return "due";
  }

  // Overdue
  if (daysOverdue > 0) {
    const lastSentAt =
      reminders?.overdue?.lastSentAt;

    // Never sent before
    if (!lastSentAt) {
      return "overdue";
    }

    // Send overdue reminder again every 7 days
    const daysSinceLastReminder = daysBetween(
      lastSentAt,
      new Date()
    );

    if (daysSinceLastReminder >= 7) {
      return "overdue";
    }
  }

  return null;
};

// ========================================
// MARK REMINDER AS SENT
// ========================================

const markReminderAsSent = (
  assignment,
  reminderType
) => {
  if (reminderType === "overdue") {
    assignment.reminders.overdue.lastSentAt =
      new Date();

    return;
  }

  if (!assignment.reminders?.[reminderType]) {
    assignment.reminders[reminderType] = {
      sent: false,
      sentAt: null,
    };
  }

  assignment.reminders[reminderType].sent = true;
  assignment.reminders[reminderType].sentAt =
    new Date();
};

// ========================================
// SEND ONE REMINDER
// ========================================

const sendObligationReminder = async ({
  assignment,
  reminderType,
}) => {
  const user = assignment.user;
  const obligation = assignment.obligation;

  if (!user || !obligation) {
    return false;
  }

  const amountDue = Number(
    assignment.amountDue ??
      obligation.amount ??
      0
  );

  const amountPaid = Number(
    assignment.amountPaid ?? 0
  );

  const outstanding = Math.max(
    amountDue - amountPaid,
    0
  );

  if (outstanding <= 0) {
    return false;
  }

  const dueDate =
    assignment.dueDate ??
    obligation.dueDate ??
    null;

  if (!dueDate) {
    return false;
  }

  const firstName =
    user.firstName || "Member";

  const email = user.email;

  if (!email) {
    console.warn(
      `Reminder skipped: ${user._id} has no email.`
    );

    return false;
  }

  // ========================================
  // NOTIFICATION CONTENT
  // ========================================

  let title = "";
  let message = "";

  switch (reminderType) {
    case "thirtyDay":
      title = "Payment Due in 30 Days";

      message = `${obligation.name} of ${formatCurrency(
        outstanding
      )} is due in 30 days.`;

      break;

    case "sevenDay":
      title = "Payment Due in 7 Days";

      message = `${obligation.name} of ${formatCurrency(
        outstanding
      )} is due in 7 days.`;

      break;

    case "oneDay":
      title = "Payment Due Tomorrow";

      message = `${obligation.name} of ${formatCurrency(
        outstanding
      )} is due tomorrow.`;

      break;

    case "due":
      title = "Payment Due Today";

      message = `${obligation.name} of ${formatCurrency(
        outstanding
      )} is due today.`;

      break;

    case "overdue":
      title = "Payment Obligation Overdue";

      message = `${obligation.name} has an outstanding balance of ${formatCurrency(
        outstanding
      )} and is overdue.`;

      break;

    default:
      return false;
  }

  // ========================================
  // DASHBOARD NOTIFICATION
  // ========================================

  await createNotification({
    userId: user._id,
    type: "obligation",
    title,
    message,
    link: "/portal/member/dashboard/my-obligation",
  });

  // ========================================
  // EMAIL TEMPLATE
  // ========================================

  const emailHtml = buildObligationReminderEmail({
    firstName,
    obligationName: obligation.name,

    amountDue,
    amountPaid,
    outstanding,

    dueDate,

    reminderType,

    paymentUrl: `${
      process.env.FRONTEND_URL || ""
    }/portal/member/dashboard/my-obligation`,
  });

  // ========================================
  // SEND EMAIL
  // ========================================

  try {
    await sendEmail({
      to: email,

      subject: `OlivetGOSA - ${title}`,

      html: emailHtml,
    });
  } catch (emailError) {
    console.error(
      `Failed to send reminder email to ${email}:`,
      emailError
    );

    // Do not mark as sent.
    // Scheduler can retry later.
    return false;
  }

  // ========================================
  // MARK AS SENT
  // ========================================

  markReminderAsSent(
    assignment,
    reminderType
  );

  await assignment.save();

  return true;
};

// ========================================
// PROCESS ALL OBLIGATION REMINDERS
// ========================================

export const processObligationReminders = async () => {
  try {
    /*
     * IMPORTANT:
     *
     * Do NOT filter with:
     *
     * amountPaid: { $lt: 1 }
     *
     * because that would exclude partially paid obligations.
     *
     * We fetch the assignments and calculate the
     * outstanding balance ourselves.
     */

    const assignments =
      await ObligationAssignment.find({})
        .populate(
          "user",
          "firstName lastName email status"
        )
        .populate(
          "obligation",
          "name category amount year dueDate isActive isOptional"
        );

    let processed = 0;
    let skipped = 0;

    const today = startOfDay(new Date());

    

    for (const assignment of assignments) {
      const user = assignment.user;
      const obligation = assignment.obligation;

      // ========================================
      // MISSING REFERENCES
      // ========================================

//       console.log("REMINDER DEBUG:", {
//   assignmentId: assignment._id,
//   user: assignment.user?._id,
//   userStatus: assignment.user?.status,

//   obligationId: assignment.obligation?._id,
//   obligationName: assignment.obligation?.name,
//   category: assignment.obligation?.category,
//   isActive: assignment.obligation?.isActive,
//   isOptional: assignment.obligation?.isOptional,

//   amountDue: assignment.amountDue,
//   amountPaid: assignment.amountPaid,

//   assignmentDueDate: assignment.dueDate,
//   obligationDueDate: assignment.obligation?.dueDate,

//   now: new Date(),
// });

      if (!user || !obligation) {
        skipped++;
        continue;
      }

      // ========================================
      // MEMBER CHECK
      // ========================================

      if (user.status !== "active") {
        skipped++;
        continue;
      }

      // ========================================
      // OPTIONAL OBLIGATION
      // ========================================

      /*
       * Optional obligations such as the
       * ₦10,000 insurance premium do NOT receive:
       *
       * - 30-day reminders
       * - 7-day reminders
       * - 1-day reminders
       * - due-date reminders
       * - overdue reminders
       */

      if (obligation.isOptional === true) {
        skipped++;
        continue;
      }

      // ========================================
      // INACTIVE OBLIGATION
      // ========================================

      /*
       * Inactive obligations remain in history,
       * but they must not generate reminders.
       */

      if (obligation.isActive === false) {
        skipped++;
        continue;
      }

      // ========================================
      // ONLY INDIVIDUAL OBLIGATIONS
      // ========================================

      if (obligation.category !== "individual") {
        skipped++;
        continue;
      }

      // ========================================
      // OUTSTANDING BALANCE
      // ========================================

      const amountDue = Number(
        assignment.amountDue ??
          obligation.amount ??
          0
      );

      const amountPaid = Number(
        assignment.amountPaid ?? 0
      );

      const outstanding = Math.max(
        amountDue - amountPaid,
        0
      );

      // Fully paid
      if (outstanding <= 0) {
        skipped++;
        continue;
      }

      // ========================================
      // DUE DATE
      // ========================================

      const dueDate = obligation.dueDate ?? assignment.dueDate ?? null;

      if (!dueDate) {
        skipped++;
        continue;
      }

      // ========================================
      // CALCULATE DAYS
      // ========================================

      const daysUntilDue = daysBetween(
        today,
        dueDate
      );

      const daysOverdue =
        daysUntilDue < 0
          ? Math.abs(daysUntilDue)
          : 0;

      // ========================================
      // DETERMINE REMINDER
      // ========================================

      const reminderType =
        getReminderType({
          daysUntilDue,
          daysOverdue,
          reminders: assignment.reminders,
        });

      if (!reminderType) {
        skipped++;
        continue;
      }

      // ========================================
      // SEND REMINDER
      // ========================================

      const sent =
        await sendObligationReminder({
          assignment,
          reminderType,
        });

      if (sent) {
        processed++;
      } else {
        skipped++;
      }
    }

    return {
      success: true,
      processed,
      skipped,
      checked: assignments.length,
    };
  } catch (error) {
    console.error(
      "Process obligation reminders error:",
      error
    );

    throw error;
  }
};