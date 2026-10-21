
import User from "../models/User.js";
import FinancialReport from "../models/FinancialReport.js";
import FinancialReportNotificationJob from "../models/FinancialReportNotificationJob.js";
import FinancialReportNotificationDelivery from "../models/FinancialReportNotificationDelivery.js";
import { createNotification } from "./notificationService.js";
import { sendEmail } from "./email.service.js";
import { randomUUID } from "crypto";
// Number of members to prepare in one batch.
const RECIPIENT_BATCH_SIZE = 200;

// Delivery worker limits.
const DELIVERY_BATCH_SIZE = 50;
const MAX_DELIVERY_ATTEMPTS = 4;
const CLAIM_DURATION_MS = 5 * 60 * 1000;

// Retry delays: 1 minute, 5 minutes, then 15 minutes.
const RETRY_DELAYS_MS = [
  60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
];

const getRetryTime = (attempts) => {
  const delay =
    RETRY_DELAYS_MS[
    Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)
    ];

  return new Date(Date.now() + delay);
};


const JOB_LOCK_DURATION_MS = 4 * 60 * 1000;

const claimFinancialReportJob = async () => {
  const now = new Date();
  const lockToken = randomUUID();

  const job = await FinancialReportNotificationJob.findOneAndUpdate(
    {
      status: { $in: ["pending", "processing"] },
      nextRunAt: { $lte: now },
      $or: [
        { lockToken: null },
        { lockToken: { $exists: false } },
        { lockExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        lockToken,
        lockExpiresAt: new Date(
          now.getTime() + JOB_LOCK_DURATION_MS
        ),
        startedAt: now,
      },
    },
    {
      new: true,
      sort: { createdAt: 1 },
    }
  );

  return job ? { job, lockToken } : null;
};

const claimDelivery = async (deliveryId, channel) => {
  const now = new Date();
  const path =
    channel === "notification" ? "notification" : "emailDelivery";

  return FinancialReportNotificationDelivery.findOneAndUpdate(
    {
      _id: deliveryId,
      $or: [
        {
          [`${path}.status`]: "pending",
          [`${path}.nextAttemptAt`]: { $lte: now },
          [`${path}.attempts`]: { $lt: MAX_DELIVERY_ATTEMPTS },
        },
        {
          [`${path}.status`]: "failed",
          [`${path}.nextAttemptAt`]: { $lte: now },
          [`${path}.attempts`]: { $lt: MAX_DELIVERY_ATTEMPTS },
        },
        {
          [`${path}.status`]: "processing",
          [`${path}.claimExpiresAt`]: { $lte: now },
          [`${path}.attempts`]: { $lt: MAX_DELIVERY_ATTEMPTS },
        },
      ],
    },
    {
      $set: {
        [`${path}.status`]: "processing",
        [`${path}.claimExpiresAt`]: new Date(
          now.getTime() + CLAIM_DURATION_MS
        ),
        [`${path}.lastError`]: null,
      },
      $inc: {
        [`${path}.attempts`]: 1,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );
};



const processDeliveryChannel = async (delivery, channel, report) => {
  const claimed = await claimDelivery(delivery._id, channel);

  // Another worker may have claimed it, or it may not be due yet.
  if (!claimed) {
    return "skipped";
  }

  const path =
    channel === "notification" ? "notification" : "emailDelivery";

  try {
    if (channel === "notification") {
      await createNotification({
        userId: claimed.user,
        type: "financial_report",
        title: "New Financial Report Published",
        message: `${report.title} is now available in the member portal.`,
        link: "/portal/member/dashboard/financial-reports",
        deduplicationKey: `financial-report:${report._id}:user:${claimed.user}`,
        throwOnError: true,
      });
    } else {
      const portalUrl = process.env.FRONTEND_URL;

      if (!portalUrl) {
        throw new Error("FRONTEND_URL is not configured.");
      }

      const reportUrl =
        `${portalUrl.replace(/\/+$/, "")}/portal/member/dashboard/financial-reports`;

      const escapeHtml = (value = "") =>
        String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");

      const content = {
        eyebrow: "Financial Report Announcement",
        title: "A New Financial Report Is Available",
        message: `A new financial report, <strong>${escapeHtml(
          report.title
        )}</strong>, has been published and is now available in your member portal. Please sign in to review the report and stay informed about the association's finances.`,
      };

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(content.title)}</title>
</head>

<body style="margin:0;padding:0;background:#EAF1F8;font-family:Arial,Helvetica,sans-serif;color:#4B6075;">
  <div style="width:100%;padding:35px 15px;box-sizing:border-box;background:#EAF1F8;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">

      <!-- HEADER -->
      <div style="background:#0B294D;padding:30px 35px;text-align:center;">
        <img
          src="https://res.cloudinary.com/bx4pnrek/image/upload/v1792582571/onw-gosa/website-content/ob1t3jspsuqz8wvxnkba.png"
          alt="OlivetGOSA Crest"
          width="70"
          style="width:70px;height:auto;display:block;margin:0 auto 15px;"
        />

        <div style="color:#ffffff;font-size:25px;font-weight:700;line-height:1.2;">
          OlivetGOSA
        </div>

        <div style="margin-top:7px;color:#C9A227;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
          Global Old Students' Association
        </div>
      </div>

      <!-- GOLD DIVIDER -->
      <div style="height:4px;background:#C9A227;"></div>

      <!-- CONTENT -->
      <div style="padding:40px 35px;">
        <div style="color:#C9A227;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">
          ${content.eyebrow}
        </div>

        <h1 style="margin:0 0 18px;color:#0B294D;font-size:28px;line-height:1.25;font-weight:700;">
          ${escapeHtml(content.title)}
        </h1>

        <p style="margin:0 0 20px;color:#4B6075;font-size:15px;line-height:1.7;">
          Dear ${escapeHtml(claimed.firstName || "Member")},
        </p>

        <p style="margin:0 0 25px;color:#4B6075;font-size:15px;line-height:1.7;">
          ${content.message}
        </p>

        <!-- REPORT INFORMATION -->
        <div style="background:#EAF1F8;border-left:4px solid #C9A227;padding:20px;margin:0 0 25px;">
          <div style="color:#0B294D;font-size:16px;font-weight:700;margin-bottom:12px;">
            Published Report
          </div>

          <p style="margin:0;color:#4B6075;font-size:14px;line-height:1.7;">
            <strong style="color:#0B294D;">${escapeHtml(report.title)}</strong>
          </p>

          <p style="margin:8px 0 0;color:#4B6075;font-size:13px;line-height:1.7;">
            Log in to your member account to access the published report.
          </p>
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin:30px 0;">
          <a
            href="${reportUrl}"
            style="display:inline-block;background:#123B6D;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:7px;font-size:14px;font-weight:700;"
          >
            View Financial Report
          </a>
        </div>

        <p style="margin:0;color:#4B6075;font-size:13px;line-height:1.7;">
          You can also log in to your OlivetGOSA member portal to access
          available financial reports and other membership information.
        </p>
      </div>

      <!-- FOOTER -->
      <div style="background:#0B294D;padding:25px 35px;text-align:center;">
        <div style="color:#ffffff;font-size:15px;font-weight:700;margin-bottom:8px;">
          OlivetGOSA
        </div>

        <div style="color:rgba(255,255,255,0.72);font-size:12px;line-height:1.6;">
          Global Old Students' Association
        </div>

        <div style="margin-top:10px;color:#C9A227;font-size:11px;font-weight:700;letter-spacing:1.5px;">
          CUM CHRISTO PROGREDERE
        </div>

        <div style="margin-top:18px;color:rgba(255,255,255,0.55);font-size:11px;line-height:1.6;">
          This is an automated email from OlivetGOSA.
          <br />
          Please do not reply to this email.
        </div>
      </div>

    </div>
  </div>
</body>
</html>
`;

      await sendEmail({
        to: claimed.email,
        subject: "A New Financial Report Is Available",
        html,
      });
    }

    await FinancialReportNotificationDelivery.updateOne(
      {
        _id: claimed._id,
        [`${path}.status`]: "processing",
        [`${path}.claimExpiresAt`]: claimed[path].claimExpiresAt,
      },
      {
        $set: {
          [`${path}.status`]: "sent",
          [`${path}.sentAt`]: new Date(),
          [`${path}.lastError`]: null,
          [`${path}.claimExpiresAt`]: null,
        },
      }
    );

    return "sent";
  } catch (error) {
    const attempts = claimed[path].attempts;
    const terminal = attempts >= MAX_DELIVERY_ATTEMPTS;

    await FinancialReportNotificationDelivery.updateOne(
      {
        _id: claimed._id,
        [`${path}.status`]: "processing",
        [`${path}.claimExpiresAt`]: claimed[path].claimExpiresAt,
      },
      {
        $set: {
          [`${path}.status`]: "failed",
          [`${path}.lastError`]: String(error.message || error).slice(0, 1000),
          [`${path}.nextAttemptAt`]: terminal
            ? new Date("9999-12-31T23:59:59.999Z")
            : getRetryTime(attempts),
          [`${path}.claimExpiresAt`]: null,
        },
      }
    );

    console.error(
      `Financial report ${channel} delivery failed for ${claimed.user}:`,
      error.message
    );

    return "failed";
  }
};
/**
 * Prepare delivery records for eligible members.
 * Call this after a report has been published.
 */

export const prepareFinancialReportNotificationJob = async (
  reportId
) => {
  const report = await FinancialReport.findOne({
    _id: reportId,
    status: "published",
  }).select("_id title month year");

  if (!report) {
    throw new Error("Published financial report not found.");
  }

  const job = await FinancialReportNotificationJob.findOneAndUpdate(
    { report: report._id },
    {
      $setOnInsert: {
        status: "pending",
        nextRunAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  if (job.preparationComplete) {
    return {
      success: true,
      prepared: 0,
      preparationComplete: true,
      message: "Recipient preparation is already complete.",
    };
  }

  const userFilter = {
    role: "member",
    status: "active",
    financialStatus: "financial",
    email: { $exists: true, $ne: "" },
  };

  if (job.preparationCursor) {
    userFilter._id = { $gt: job.preparationCursor };
  }

  // Fetch one batch only.
  const users = await User.find(userFilter)
    .select("_id email firstName")
    .sort({ _id: 1 })
    .limit(RECIPIENT_BATCH_SIZE)
    .lean();

  if (users.length === 0) {
    await FinancialReportNotificationJob.updateOne(
      {
        _id: job._id,
        preparationComplete: false,
      },
      {
        $set: {
          preparationComplete: true,
          preparationCompletedAt: new Date(),
          status: "processing",
          lastError: null,
        },
        $unset: {
          preparationCursor: 1,
        },
      }
    );

    return {
      success: true,
      prepared: 0,
      preparationComplete: true,
      message: "Recipient preparation is complete.",
    };
  }

  const operations = users.map((user) => ({
    updateOne: {
      filter: {
        report: report._id,
        user: user._id,
      },
      update: {
        $setOnInsert: {
          report: report._id,
          user: user._id,
          email: user.email,
          firstName: user.firstName || "Member",
          notification: {
            status: "pending",
            attempts: 0,
            nextAttemptAt: new Date(),
          },
          emailDelivery: {
            status: "pending",
            attempts: 0,
            nextAttemptAt: new Date(),
          },
        },
      },
      upsert: true,
    },
  }));

  // unordered bulk write lets MongoDB process independent records.
  await FinancialReportNotificationDelivery.bulkWrite(
    operations,
    { ordered: false }
  );

  const lastUserId = users[users.length - 1]._id;

  // Count actual records, not attempted inserts.
  const totalRecipients =
    await FinancialReportNotificationDelivery.countDocuments({
      report: report._id,
    });

  const updateResult =
    await FinancialReportNotificationJob.updateOne(
      {
        _id: job._id,
        preparationComplete: false,
        preparationCursor: job.preparationCursor ?? null,
      },
      {
        $set: {
          preparationCursor: lastUserId,
          totalRecipients,
          status: "processing",
          lastError: null,
        },
        $inc: {
          preparationAttempts: 1,
        },
      }
    );

  if (updateResult.modifiedCount !== 1) {
    throw new Error(
      "Recipient preparation state changed concurrently. Retry on the next cron run."
    );
  }

  return {
    success: true,
    reportId: report._id,
    prepared: users.length,
    totalRecipients,
    preparationComplete: false,
    message: "One recipient batch prepared.",
  };
};

export const processFinancialReportNotificationBatch = async () => {
  const claim = await claimFinancialReportJob();

  if (!claim) {
    return {
      success: true,
      processed: 0,
      message: "No available financial report notification jobs are due.",
    };
  }

  let { job, lockToken } = claim;
  const now = new Date();
  try {
    const report = await FinancialReport.findOne({
      _id: job.report,
      status: "published",
    }).select("_id title month year");

    if (!report) {
      if (!report) {
        await FinancialReportNotificationJob.updateOne(
          {
            _id: job._id,
            lockToken,
          },
          {
            $set: {
              lastError: "Report is not published or could not be found.",
              nextRunAt: new Date(Date.now() + 5 * 60 * 1000),
              lockToken: null,
              lockExpiresAt: null,
            },
            $inc: { attempts: 1 },
          }
        );

        return {
          success: false,
          processed: 0,
          message: "Report is not published; processing postponed.",
        };
      }

      return {
        success: false,
        processed: 0,
        message: "Report is not published; processing postponed.",
      };
    }

    // Prepare one recipient batch when preparation is incomplete.
    if (!job.preparationComplete) {
      await prepareFinancialReportNotificationJob(report._id);

      job = await FinancialReportNotificationJob.findById(job._id);

      if (!job) {
        throw new Error("Financial report notification job disappeared.");
      }
    }

    // Recover expired final-attempt claims that cannot be retried.
    const exhaustedClaimDate = new Date("9999-12-31T23:59:59.999Z");

    for (const path of ["notification", "emailDelivery"]) {
      await FinancialReportNotificationDelivery.updateMany(
        {
          report: report._id,
          [`${path}.status`]: "processing",
          [`${path}.attempts`]: { $gte: MAX_DELIVERY_ATTEMPTS },
          [`${path}.claimExpiresAt`]: { $lte: new Date() },
        },
        {
          $set: {
            [`${path}.status`]: "failed",
            [`${path}.lastError`]:
              "Delivery claim expired after the final attempt.",
            [`${path}.claimExpiresAt`]: null,
            [`${path}.nextAttemptAt`]: exhaustedClaimDate,
          },
        }
      );
    }

    const dueChannelFilter = (path) => [
      {
        [`${path}.status`]: { $in: ["pending", "failed"] },
        [`${path}.nextAttemptAt`]: { $lte: now },
        [`${path}.attempts`]: { $lt: MAX_DELIVERY_ATTEMPTS },
      },
      {
        [`${path}.status`]: "processing",
        [`${path}.claimExpiresAt`]: { $lte: now },
        [`${path}.attempts`]: { $lt: MAX_DELIVERY_ATTEMPTS },
      },
    ];

    // Fetch at most one delivery batch.
    const deliveries =
      await FinancialReportNotificationDelivery.find({
        report: report._id,
        $or: [
          ...dueChannelFilter("notification"),
          ...dueChannelFilter("emailDelivery"),
        ],
      })
        .sort({ _id: 1 })
        .limit(DELIVERY_BATCH_SIZE)
        .select("_id")
        .lean();

    let processed = 0;

    for (const delivery of deliveries) {
      // Each channel claims and records its own result.
      await processDeliveryChannel(
        delivery,
        "notification",
        report
      );

      await processDeliveryChannel(
        delivery,
        "email",
        report
      );

      processed += 1;
    }

    const unfinishedFilter = {
      report: report._id,
      $or: [
        {
          "notification.status": "pending",
        },
        {
          "notification.status": "processing",
        },
        {
          "notification.status": "failed",
          "notification.attempts": {
            $lt: MAX_DELIVERY_ATTEMPTS,
          },
        },
        {
          "emailDelivery.status": "pending",
        },
        {
          "emailDelivery.status": "processing",
        },
        {
          "emailDelivery.status": "failed",
          "emailDelivery.attempts": {
            $lt: MAX_DELIVERY_ATTEMPTS,
          },
        },
      ],
    };

    const unfinished =
      await FinancialReportNotificationDelivery.countDocuments(
        unfinishedFilter
      );

    const [notificationFailures, emailFailures, processedRecipients] =
      await Promise.all([
        FinancialReportNotificationDelivery.countDocuments({
          report: report._id,
          "notification.status": "failed",
          "notification.attempts": { $gte: MAX_DELIVERY_ATTEMPTS },
        }),

        FinancialReportNotificationDelivery.countDocuments({
          report: report._id,
          "emailDelivery.status": "failed",
          "emailDelivery.attempts": { $gte: MAX_DELIVERY_ATTEMPTS },
        }),

        FinancialReportNotificationDelivery.countDocuments({
          report: report._id,
          $and: [
            {
              $or: [
                { "notification.status": "sent" },
                {
                  "notification.status": "failed",
                  "notification.attempts": {
                    $gte: MAX_DELIVERY_ATTEMPTS,
                  },
                },
              ],
            },
            {
              $or: [
                { "emailDelivery.status": "sent" },
                {
                  "emailDelivery.status": "failed",
                  "emailDelivery.attempts": {
                    $gte: MAX_DELIVERY_ATTEMPTS,
                  },
                },
              ],
            },
          ],
        }),
      ]);

    const allDone = job.preparationComplete && unfinished === 0;

    await FinancialReportNotificationJob.updateOne(
      {
        _id: job._id,
        lockToken,
      },
      {
        $set: {
          status: allDone
            ? notificationFailures > 0 || emailFailures > 0
              ? "failed"
              : "completed"
            : "processing",

          processedRecipients,
          notificationFailures,
          emailFailures,
          completedAt: allDone ? new Date() : null,
          nextRunAt: allDone
            ? new Date("9999-12-31T23:59:59.999Z")
            : new Date(Date.now() + 60 * 1000),
          lastError: null,
          lockToken: null,
          lockExpiresAt: null,
        },
      }
    );

    return {
      success: true,
      reportId: report._id,
      batchProcessed: processed,
      processedRecipients,
      totalRecipients: job.totalRecipients,
      unfinished,
      notificationFailures,
      emailFailures,
      completed: allDone,
    };
  } catch (error) {
    await FinancialReportNotificationJob.updateOne(
      {
        _id: job._id,
        lockToken,
      },
      {
        $set: {
          lastError: String(error.message || error).slice(0, 1000),
          nextRunAt: new Date(Date.now() + 60 * 1000),
          lockToken: null,
          lockExpiresAt: null,
        },
        $inc: { attempts: 1 },
      }
    );

    throw error;
  }
};


export const queueFinancialReportNotificationJob = async (
  reportId
) => {
  const report = await FinancialReport.findOne({
    _id: reportId,
    status: "published",
  }).select("_id");

  if (!report) {
    throw new Error(
      "Cannot queue notifications: published report not found."
    );
  }

  const job =
    await FinancialReportNotificationJob.findOneAndUpdate(
      { report: report._id },
      {
        $setOnInsert: {
          status: "pending",
          nextRunAt: new Date(),
          preparationComplete: false,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

  return job;
};