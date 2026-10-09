import { createAuditLog } from "../../services/auditLog.service.js";

import FinancialReport from "../../models/FinancialReport.js";
import AuditLog from "../../models/AuditLog.js";

import {
  generateFinancialReportSnapshot,
} from "../../services/financialReportService.js";


// ======================================================
// CREATE FINANCIAL REPORT
// ======================================================

export const createFinancialReport = async (
  req,
  res
) => {
  try {
    const { month, year } = req.body;

    const reportMonth = Number(month);
    const reportYear = Number(year);

    if (
      !Number.isInteger(reportMonth) ||
      reportMonth < 1 ||
      reportMonth > 12
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid report month is required.",
      });
    }

    if (
      !Number.isInteger(reportYear) ||
      reportYear < 1900
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid report year is required.",
      });
    }


    // --------------------------------------------------
    // Prevent duplicate monthly reports
    // --------------------------------------------------

    const existingReport =
      await FinancialReport.findOne({
        month: reportMonth,
        year: reportYear,
      });

    if (existingReport) {
      return res.status(409).json({
        success: false,
        message:
          "A financial report already exists for this month.",
      });
    }


    // --------------------------------------------------
    // Generate financial snapshot
    // --------------------------------------------------

    const snapshot =
      await generateFinancialReportSnapshot({
        month: reportMonth,
        year: reportYear,
      });


    const monthName = new Date(
      Date.UTC(
        reportYear,
        reportMonth - 1,
        1
      )
    ).toLocaleString("en-US", {
      month: "long",
      timeZone: "UTC",
    });


    // --------------------------------------------------
    // Create draft report
    // --------------------------------------------------

    const report =
      await FinancialReport.create({
        title: `${monthName} ${reportYear} Financial Report`,

        month: reportMonth,

        year: reportYear,

        status: "draft",

        summary: snapshot.summary,

        categoryBreakdown:
          snapshot.categoryBreakdown,

        obligationBreakdown:
          snapshot.obligationBreakdown,

        paymentSummary:
          snapshot.paymentSummary,

        createdBy: req.user._id,
      });


    // --------------------------------------------------
    // Audit
    // --------------------------------------------------

    await createAuditLog({
      actor: req.user._id,
      action: "financial_report.updated",
      resource: "FinancialReport",
      resourceId: report._id,
      req,
      details: {
        month: report.month,
        year: report.year,
        status: report.status,
        change: "Regenerated financial snapshot",
      },
    });


    return res.status(201).json({
      success: true,

      message:
        "Financial report created successfully.",

      data: report,
    });
  } catch (error) {
    console.error(
      "Create financial report error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to create financial report.",
    });
  }
};


// ======================================================
// GET ALL FINANCIAL REPORTS
// ======================================================

export const getFinancialReports = async (
  req,
  res
) => {
  try {
    const {
      year,
      status,
    } = req.query;


    const filter = {};


    if (year) {
      const parsedYear = Number(year);

      if (
        Number.isInteger(parsedYear)
      ) {
        filter.year = parsedYear;
      }
    }


    if (
      status === "draft" ||
      status === "published"
    ) {
      filter.status = status;
    }


    const reports =
      await FinancialReport.find(filter)
        .populate({
          path: "createdBy",
          select:
            "firstName middleName lastName alumniId",
        })
        .populate({
          path: "publishedBy",
          select:
            "firstName middleName lastName alumniId",
        })
        .sort({
          year: -1,
          month: -1,
        })
        .lean();


    return res.status(200).json({
      success: true,

      data: reports,
    });
  } catch (error) {
    console.error(
      "Get financial reports error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch financial reports.",
    });
  }
};


// ======================================================
// GET SINGLE FINANCIAL REPORT
// ======================================================

export const getFinancialReportById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;


    const report =
      await FinancialReport.findById(id)
        .populate({
          path: "createdBy",
          select:
            "firstName middleName lastName alumniId",
        })
        .populate({
          path: "publishedBy",
          select:
            "firstName middleName lastName alumniId",
        })
        .lean();


    if (!report) {
      return res.status(404).json({
        success: false,

        message:
          "Financial report not found.",
      });
    }


    return res.status(200).json({
      success: true,

      data: report,
    });
  } catch (error) {
    console.error(
      "Get financial report by ID error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch financial report.",
    });
  }
};


// ======================================================
// UPDATE / REGENERATE DRAFT
// ======================================================
//
// We only allow recalculating a DRAFT.
//
// A published report is an official historical
// snapshot and must not silently change.
//

export const updateFinancialReport = async (
  req,
  res
) => {
  try {
    const { id } = req.params;


    const report =
      await FinancialReport.findById(id);


    if (!report) {
      return res.status(404).json({
        success: false,

        message:
          "Financial report not found.",
      });
    }


    if (
      report.status !== "draft"
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Published reports cannot be modified.",
      });
    }


    const snapshot =
      await generateFinancialReportSnapshot({
        month: report.month,
        year: report.year,
      });


    report.summary =
      snapshot.summary;

    report.categoryBreakdown =
      snapshot.categoryBreakdown;

    report.obligationBreakdown =
      snapshot.obligationBreakdown;

    report.paymentSummary =
      snapshot.paymentSummary;


    await report.save();


    await AuditLog.create({
      actor: req.user._id,

      action:
        "FINANCIAL_REPORT_UPDATED",

      resource:
        "FinancialReport",

      resourceId: report._id,

      details: {
        month: report.month,

        year: report.year,

        status: report.status,

        action:
          "Regenerated financial snapshot",
      },

      ipAddress: req.ip,

      userAgent:
        req.get("user-agent"),
    });


    return res.status(200).json({
      success: true,

      message:
        "Financial report updated successfully.",

      data: report,
    });
  } catch (error) {
    console.error(
      "Update financial report error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to update financial report.",
    });
  }
};


// ======================================================
// PUBLISH FINANCIAL REPORT
// ======================================================

export const publishFinancialReport = async (
  req,
  res
) => {
  try {
    const { id } = req.params;


    const report =
      await FinancialReport.findById(id);


    if (!report) {
      return res.status(404).json({
        success: false,

        message:
          "Financial report not found.",
      });
    }


    if (
      report.status === "published"
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Financial report is already published.",
      });
    }


    report.status = "published";

    report.publishedBy =
      req.user._id;

    report.publishedAt =
      new Date();


    await report.save();


    // --------------------------------------------------
    // Audit publication
    // --------------------------------------------------

    await AuditLog.create({
      actor: req.user._id,

      action:
        "FINANCIAL_REPORT_PUBLISHED",

      resource:
        "FinancialReport",

      resourceId: report._id,

      details: {
        month: report.month,

        year: report.year,

        title: report.title,

        publishedAt:
          report.publishedAt,
      },

      ipAddress: req.ip,

      userAgent:
        req.get("user-agent"),
    });


    return res.status(200).json({
      success: true,

      message:
        "Financial report published successfully.",

      data: report,
    });
  } catch (error) {
    console.error(
      "Publish financial report error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to publish financial report.",
    });
  }
};


// ======================================================
// UNPUBLISH FINANCIAL REPORT
// ======================================================

export const unpublishFinancialReport = async (
  req,
  res
) => {
  try {
    const { id } = req.params;


    const report =
      await FinancialReport.findById(id);


    if (!report) {
      return res.status(404).json({
        success: false,

        message:
          "Financial report not found.",
      });
    }


    if (
      report.status !== "published"
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Financial report is not published.",
      });
    }


    report.status = "draft";

    report.publishedBy = null;

    report.publishedAt = null;


    await report.save();


    await createAuditLog({
  actor: req.user._id,
  action: "financial_report.unpublished",
  resource: "FinancialReport",
  resourceId: report._id,
  req,
  details: {
    month: report.month,
    year: report.year,
    title: report.title,
    reason: "Report returned to draft.",
  },
});


    return res.status(200).json({
      success: true,

      message:
        "Financial report unpublished successfully.",

      data: report,
    });
  } catch (error) {
    console.error(
      "Unpublish financial report error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to unpublish financial report.",
    });
  }
};