import ObligationAssignment from "../models/ObligationAssignment.js";

export const getMyObligations = async (req, res) => {
  try {
    const assignments = await ObligationAssignment.find({
      user: req.user._id,
    })
      .populate(
        "obligation",
        "name description category amount year dueDate"
      )
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    console.error("Get my obligations error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your obligations.",
    });
  }
};