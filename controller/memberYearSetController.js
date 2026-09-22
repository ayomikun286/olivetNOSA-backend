import User from "../models/User.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import Payment from "../models/Payment.js";
import {
  successResponse,
  errorResponse,
} from "../utils/response.js";

export const getMyYearSet = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("yearSet", "_id name year leader")
      .lean();

    if (!user) {
      return errorResponse(res, 404, "Member not found.");
    }

    if (!user.yearSet) {
      return errorResponse(
        res,
        404,
        "You are not assigned to a year set."
      );
    }

    const yearSet = user.yearSet;

    // Only the assigned year set leader can access this section
    if (
      !yearSet.leader ||
      yearSet.leader.toString() !== user._id.toString()
    ) {
      return errorResponse(
        res,
        403,
        "You are not the leader of this year set."
      );
    }

    // ========================================
    // YEAR SET MEMBERS
    // ========================================

    const members = await User.find({
      yearSet: yearSet._id,
      status: "active",
    })
      .select(
        "_id firstName middleName lastName alumniId email graduationYear chapter"
      )
      .populate("chapter", "name code")
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    // ========================================
    // YEAR SET OBLIGATIONS
    // ========================================

    const assignments = await ObligationAssignment.find({
      user: user._id,
    })
      .populate({
        path: "obligation",
        select: "name description category amount year dueDate",
        match: {
          category: "yearSet",
        },
      })
      .lean();

    const validAssignments = assignments.filter(
      (assignment) => assignment.obligation
    );

    const assignmentIds = validAssignments.map(
      (assignment) => assignment._id
    );

    const recentPayments = await Payment.find({
      obligationAssignment: { $in: assignmentIds },
      status: "successful",
    })
      .populate(
        "user",
        "_id firstName middleName lastName alumniId"
      )
      .populate({
        path: "obligationAssignment",
        select: "obligation",
        populate: {
          path: "obligation",
          select: "name category",
        },
      })
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(10)
      .lean();

    const totalDue = validAssignments.reduce(
      (total, assignment) =>
        total + Number(assignment.amountDue || 0),
      0
    );

    const amountPaid = validAssignments.reduce(
      (total, assignment) =>
        total + Number(assignment.amountPaid || 0),
      0
    );

    const outstanding = Math.max(
      totalDue - amountPaid,
      0
    );

    // ========================================
    // RESPONSE
    // ========================================

    return successResponse(
      res,
      "Year set information fetched successfully.",
      {
        yearSet: {
          id: yearSet._id,
          name: yearSet.name,
          year: yearSet.year,
        },

        summary: {
          totalDue,
          amountPaid,
          outstanding,
          memberCount: members.length,
        },

        obligations: validAssignments,

        members,

        // Will be connected when Payment/Transaction
        // module is created.
        recentActivity: recentPayments,
      }
    );
  } catch (error) {
    console.error("Get my year set error:", error);

    return errorResponse(
      res,
      500,
      "Failed to fetch your year set information."
    );
  }
};