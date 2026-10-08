import FinancialReport from "../models/FinancialReport.js";


export const getPublishedFinancialReports = async (req, res) => {
  try {
    const reports = await FinancialReport.find({
      status: "published",
    })
      .select(
        "title month year status summary categoryBreakdown paymentSummary publishedAt"
      )
      .sort({ year: -1, month: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: reports,
    });
  } catch (error) {
    console.error("Get published financial reports error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve financial reports.",
    });
  }
};