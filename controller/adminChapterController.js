import User from "../models/User.js";
import Chapter from "../models/Chapter.js";
import Obligation from "../models/Obligation.js";
import Payment from "../models/Payment.js";
import ObligationAssignment from "../models/ObligationAssignment.js";

// ========================================
// GET ADMIN CHAPTERS
// ========================================

export const getAdminChapters = async (req, res) => {
  try {
    const chapters = await Chapter.find()
      .populate({
        path: "leader",
        select:
          "firstName middleName lastName alumniId email status",
      })
      .sort({
        name: 1,
      })
      .lean();

    const chapterIds = chapters.map(
      (chapter) => chapter._id
    );

    const memberCounts = await User.aggregate([
      {
        $match: {
          chapter: { $in: chapterIds },
        },
      },
      {
        $group: {
          _id: "$chapter",
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

    const data = chapters.map((chapter) => ({
      ...chapter,
      memberCount:
        memberCountMap.get(chapter._id.toString()) || 0,
    }));

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get admin chapters error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch chapters.",
    });
  }
};


// ========================================
// GET ADMIN CHAPTER BY ID
// ========================================
export const getAdminChapterById = async (req, res) => {
  try {
    const { id } = req.params;
    const currentYear = new Date().getFullYear();

    // ========================================
    // CHAPTER
    // ========================================

    const chapter = await Chapter.findById(id)
      .populate({
        path: "leader",
        select:
          "firstName middleName lastName alumniId email phone status",
      })
      .lean();

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: "Chapter not found.",
      });
    }

    // ========================================
    // MEMBERS
    // ========================================

    const memberCount = await User.countDocuments({
      chapter: id,
    });

    const members = await User.find({
      chapter: id,
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
      category: "chapter",
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
          chapter,
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
    // GET CHAPTER LEADER ASSIGNMENTS ONLY
    //
    // Chapter obligations belong to the
    // Chapter leader, not individual members.
    // ========================================

    const leaderId = chapter.leader?._id || null;

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
    // Chapter leader's assignments are counted.
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
        chapter,
        memberCount,
        members,
        obligations: obligationsWithFinancials,
        financialSummary,
      },
    });
  } catch (error) {
    console.error(
      "Get admin chapter by ID error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch chapter.",
    });
  }
};