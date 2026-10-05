import User from "../models/User.js";
import YearSet from "../models/YearSet.js";
import Obligation from "../models/Obligation.js";
import Payment from "../models/Payment.js";
import ObligationAssignment from "../models/ObligationAssignment.js";

// ========================================
// GET ADMIN YEAR SETS
// ========================================

export const getAdminYearSets = async (req, res) => {
  try {
    const yearSets = await YearSet.find()
      .populate({
        path: "leader",
        select: "firstName middleName lastName alumniId email status",
      })
      .sort({ year: -1 })
      .lean();

    const yearSetIds = yearSets.map((yearSet) => yearSet._id);

    const memberCounts = await User.aggregate([
      {
        $match: {
          yearSet: { $in: yearSetIds },
        },
      },
      {
        $group: {
          _id: "$yearSet",
          count: { $sum: 1 },
        },
      },
    ]);

    const memberCountMap = new Map(
      memberCounts.map((item) => [
        item._id.toString(),
        item.count,
      ])
    );

    const data = yearSets.map((yearSet) => ({
      ...yearSet,
      memberCount:
        memberCountMap.get(yearSet._id.toString()) || 0,
    }));

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get admin year sets error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch year sets.",
    });
  }
};


// ========================================
// GET ADMIN YEAR SET BY ID
// ========================================

export const getAdminYearSetById = async (req, res) => {
  try {
    const { id } = req.params;
    const currentYear = new Date().getFullYear();

    // ========================================
    // YEAR SET
    // ========================================

    const yearSet = await YearSet.findById(id)
      .populate({
        path: "leader",
        select:
          "firstName middleName lastName alumniId email phone status",
      })
      .lean();

    if (!yearSet) {
      return res.status(404).json({
        success: false,
        message: "Year set not found.",
      });
    }

    // ========================================
    // MEMBERS
    // ========================================

    const memberCount = await User.countDocuments({
      yearSet: id,
    });

    const members = await User.find({
      yearSet: id,
    })
      .select(
        "firstName middleName lastName alumniId email status graduationYear"
      )
      .sort({
        lastName: 1,
        firstName: 1,
      })
      .lean();

    // ========================================
    // CURRENT YEAR ACTIVE OBLIGATIONS
    // ========================================

    const obligations = await Obligation.find({
      category: "yearSet",
      isActive: true,
      year: currentYear,
    })
      .select(
        "_id name amount dueDate year description isActive isOptional paymentPlans"
      )
      .sort({ dueDate: 1 })
      .lean();

    // ========================================
    // NO OBLIGATIONS
    // ========================================

    if (!obligations.length) {
      return res.status(200).json({
        success: true,
        data: {
          yearSet,
          memberCount,
          members,
          obligations: [],
          financialSummary: {
            totalObligations: 0,
            totalPaid: 0,
            totalOutstanding: 0,
          },
        },
      });
    }

    // ========================================
    // OBLIGATION IDS
    // ========================================

    const obligationIds = obligations.map(
      (obligation) => obligation._id
    );

    // ========================================
    // GET LEADER ASSIGNMENTS ONLY
    //
    // Year Set obligations belong to the
    // Year Set leader, not individual members.
    // ========================================

    const leaderId = yearSet.leader?._id || null;

    const assignments = leaderId
      ? await ObligationAssignment.find({
          obligation: { $in: obligationIds },
          user: leaderId,
        })
          .select("_id obligation user amountDue amountPaid status")
          .lean()
      : [];

    // ========================================
    // GET SUCCESSFUL PAYMENTS
    //
    // Only payments made against the current
    // Year Set leader's assignments are counted.
    // ========================================

    const assignmentIds = assignments.map(
      (assignment) => assignment._id
    );

    const successfulPayments = assignmentIds.length
      ? await Payment.find({
          obligationAssignment: { $in: assignmentIds },
          status: "successful",
        })
          .select("amount obligationAssignment")
          .lean()
      : [];

    // ========================================
    // CALCULATE PAID PER OBLIGATION
    // ========================================

    const paidByObligation = new Map();

    for (const payment of successfulPayments) {
      const assignment = assignments.find(
        (item) =>
          item._id.toString() ===
          payment.obligationAssignment?.toString()
      );

      if (!assignment) continue;

      const obligationId = assignment.obligation.toString();

      const currentPaid =
        paidByObligation.get(obligationId) || 0;

      paidByObligation.set(
        obligationId,
        currentPaid + Number(payment.amount || 0)
      );
    }

    // ========================================
    // ADD FINANCIAL DATA
    // ========================================

    let totalObligations = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    const obligationsWithFinancials = obligations.map(
      (obligation) => {
        const obligationId = obligation._id.toString();

        const amount = Number(obligation.amount || 0);

        const paid = Math.min(
          paidByObligation.get(obligationId) || 0,
          amount
        );

        const outstanding = Math.max(
          amount - paid,
          0
        );

        let status = "pending";

        if (paid >= amount && amount > 0) {
          status = "paid";
        } else if (paid > 0) {
          status = "partial";
        } else if (
          obligation.dueDate &&
          new Date(obligation.dueDate) < new Date()
        ) {
          status = "overdue";
        }

        // Optional obligations remain visible,
        // but do not contribute to mandatory totals.
        if (!obligation.isOptional) {
          totalObligations += amount;
          totalPaid += paid;
          totalOutstanding += outstanding;
        }

        return {
          ...obligation,
          paid,
          outstanding,
          status,
        };
      }
    );

    // ========================================
    // FINANCIAL SUMMARY
    // ========================================

    const financialSummary = {
      totalObligations,
      totalPaid,
      totalOutstanding,
    };

    // ========================================
    // RESPONSE
    // ========================================

    return res.status(200).json({
      success: true,
      data: {
        yearSet,
        memberCount,
        members,
        obligations: obligationsWithFinancials,
        financialSummary,
      },
    });
  } catch (error) {
    console.error(
      "Get admin year set by ID error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch year set.",
    });
  }
};