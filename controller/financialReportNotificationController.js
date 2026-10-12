import {
  processFinancialReportNotificationBatch,
} from "../services/financialReportNotificationService.js";

export const runFinancialReportNotificationJob = async (
  req,
  res
) => {
  try {
    const secret = req.headers["x-internal-secret"];

    if (
      !secret ||
      !process.env.INTERNAL_PAYMENT_SECRET ||
      secret !== process.env.INTERNAL_PAYMENT_SECRET
    ) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const result =
      await processFinancialReportNotificationBatch();

    return res.status(200).json({
      success: true,
      message: "Financial report notification job processed.",
      result,
    });
  } catch (error) {
    console.error(
      "Financial report notification cron error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Financial report notification job failed.",
    });
  }
};