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

    // Only the assigned leader can access this dashboard.
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
        "_id firstName middleName lastName alumniId email phone graduationYear chapter financialStatus"
      )
      .populate("chapter", "name code")
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    // ========================================
    // MEMBER FINANCIAL SUMMARIES
    // No individual payment history is fetched.
    // ========================================

    const memberIds = members.map((member) => member._id);

    const memberAssignments = await ObligationAssignment.find({
      user: { $in: memberIds },
    })
      .populate({
        path: "obligation",
        select: "name category amount year isActive isOptional dueDate",
        match: { category: "individual" },
      })
      .lean();

    // Group individual assignments by member.
    const financialSummaryByMember = new Map();

    for (const member of members) {
      financialSummaryByMember.set(member._id.toString(), {
        totalDue: 0,
        amountPaid: 0,
        outstanding: 0,
        optionalDue: 0,
        optionalPaid: 0,
        optionalOutstanding: 0,
      });
    }

    for (const assignment of memberAssignments) {
      const obligation = assignment.obligation;

      // Ignore assignments that aren't individual obligations.
      if (!obligation) continue;

      // Inactive obligations are historical and must not
      // inflate the member's current outstanding balance.
      if (obligation.isActive !== true) continue;

      const memberSummary = financialSummaryByMember.get(
        assignment.user.toString()
      );

      if (!memberSummary) continue;

      const due = Math.max(Number(assignment.amountDue || 0), 0);
      const paid = Math.max(Number(assignment.amountPaid || 0), 0);
      const outstanding = Math.max(due - paid, 0);

      if (obligation.isOptional === true) {
        memberSummary.optionalDue += due;
        memberSummary.optionalPaid += paid;
        memberSummary.optionalOutstanding += outstanding;
      } else {
        memberSummary.totalDue += due;
        memberSummary.amountPaid += paid;
        memberSummary.outstanding += outstanding;
      }
    }

    // Attach the summary to each member.
    const membersWithFinancials = members.map((member) => ({
      ...member,
      financialSummary:
        financialSummaryByMember.get(member._id.toString()) || {
          totalDue: 0,
          amountPaid: 0,
          outstanding: 0,
          optionalDue: 0,
          optionalPaid: 0,
          optionalOutstanding: 0,
        },
    }));

    // ========================================
    // YEAR SET OBLIGATIONS
    // These remain separate from members'
    // individual financial obligations.
    // ========================================

    const assignments = await ObligationAssignment.find({
      user: user._id,
    })
      .populate({
        path: "obligation",
        select: "name description category amount year dueDate isActive isOptional",
        match: { category: "yearSet" },
      })
      .lean();

    const validAssignments = assignments.filter(
      (assignment) => assignment.obligation
    );

    const assignmentIds = validAssignments.map(
      (assignment) => assignment._id
    );

    // Keep the existing recent activity for Year Set obligations.
    // This does not fetch each member's individual payment history.
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

    const activeAssignments = validAssignments.filter(
      (assignment) => assignment.obligation?.isActive === true
    );

    const totalDue = activeAssignments.reduce(
      (total, assignment) =>
        total + Number(assignment.amountDue || 0),
      0
    );

    const amountPaid = validAssignments.reduce(
      (total, assignment) =>
        total + Number(assignment.amountPaid || 0),
      0
    );

    const activeAmountPaid = activeAssignments.reduce(
      (total, assignment) =>
        total + Number(assignment.amountPaid || 0),
      0
    );

    const outstanding = Math.max(
      totalDue - activeAmountPaid,
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
          memberCount: membersWithFinancials.length,
        },

        obligations: validAssignments,

        members: membersWithFinancials,

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