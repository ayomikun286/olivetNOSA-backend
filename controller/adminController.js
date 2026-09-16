import User from "../models/User.js";
import Payment from "../models/Payment.js";
import ObligationAssignment from "../models/ObligationAssignment.js";

import { approveMember } from "../services/memberApproval.service.js";
import { createAuditLog } from "../services/auditLog.service.js";


export const approveMemberController = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await approveMember(
      userId,
      req.user._id
    );

    await createAuditLog({
      actor: req.user._id,
      action: "member.approved",
      resource: "User",
      resourceId: userId,
      targetUser: userId,
      details: {
        alumniId: result.alumniId,
        obligationsAssigned: result.obligationsAssigned,
      },
      req,
    });

    return res.status(200).json({
      success: true,
      message: "Member approved successfully.",
      data: {
        user: result.user,
        alumniId: result.alumniId,
        obligationsAssigned: result.obligationsAssigned,
      },
    });
  } catch (error) {
    console.error("Approve member error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to approve member.",
    });
  }
};


export const getAdminDashboard = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    // ========================================
    // MEMBER STATISTICS
    // ========================================

    const [
      totalMembers,
      activeMembers,
      pendingMembers,
      suspendedMembers,
    ] = await Promise.all([
      User.countDocuments({
        role: "member",
      }),

      User.countDocuments({
        role: "member",
        status: "active",
      }),

      User.countDocuments({
        role: "member",
        status: "pending",
      }),

      User.countDocuments({
        role: "member",
        status: "suspended",
      }),
    ]);


    // ========================================
    // FINANCIAL SUMMARY
    // ========================================

    const financialResult = await ObligationAssignment.aggregate([
      {
        $group: {
          _id: null,

          totalObligations: {
            $sum: "$amountDue",
          },

          totalCollected: {
            $sum: "$amountPaid",
          },

          totalOutstanding: {
            $sum: {
              $subtract: [
                "$amountDue",
                "$amountPaid",
              ],
            },
          },
        },
      },
    ]);

    const financialSummary = financialResult[0] || {};

    const totalObligations =
      financialSummary.totalObligations || 0;

    const totalOutstanding =
      financialSummary.totalOutstanding || 0;


    // ========================================
    // SUCCESSFUL PAYMENTS
    // ========================================

    const successfulPaymentResult =
      await Payment.aggregate([
        {
          $match: {
            status: "successful",
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$amount",
            },
          },
        },
      ]);

    const totalCollected =
      successfulPaymentResult[0]?.total || 0;


    // ========================================
    // CURRENT YEAR COLLECTION
    // ========================================

    const startOfYear = new Date(
      currentYear,
      0,
      1
    );

    const startOfNextYear = new Date(
      currentYear + 1,
      0,
      1
    );

    const monthlyPaymentResult = await Payment.aggregate([
  {
    $match: {
      status: "successful",
      paidAt: {
        $gte: startOfYear,
        $lt: startOfNextYear,
      },
    },
  },
  {
    $group: {
      _id: {
        $month: "$paidAt",
      },
      amount: {
        $sum: "$amount",
      },
    },
  },
  {
    $sort: {
      _id: 1,
    },
  },
]);

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const collectionTrend = monthNames.map((month, index) => {
  const monthNumber = index + 1;

  const found = monthlyPaymentResult.find(
    (item) => item._id === monthNumber
  );

  return {
    month,
    amount: found?.amount || 0,
  };
});

    const yearlyPaymentResult =
      await Payment.aggregate([
        {
          $match: {
            status: "successful",
            paidAt: {
              $gte: startOfYear,
              $lt: startOfNextYear,
            },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$amount",
            },
          },
        },
      ]);

    const yearlyCollected =
      yearlyPaymentResult[0]?.total || 0;


    // ========================================
    // PENDING PAYMENTS
    // ========================================

    const pendingPayments =
      await Payment.countDocuments({
        status: "pending",
      });


    // ========================================
    // RECENT MEMBERS
    // ========================================

    const recentMembers = await User.find({
      role: "member",
    })
      .select(
        "firstName middleName lastName email status yearSet chapter alumniId createdAt"
      )
      .populate(
        "yearSet",
        "year name"
      )
      .populate(
        "chapter",
        "name code"
      )
      .sort({
        createdAt: -1,
      })
      .limit(5)
      .lean();


    // ========================================
    // RECENT PAYMENTS
    // ========================================

    const recentPayments = await Payment.find()
      .populate(
        "user",
        "firstName middleName lastName email"
      )
      .populate({
        path: "obligationAssignment",
        select:
          "amountDue amountPaid status",
        populate: {
          path: "obligation",
          select:
            "name category year",
        },
      })
      .sort({
        createdAt: -1,
      })
      .limit(5)
      .lean();


    // ========================================
    // RESPONSE
    // ========================================

    return res.status(200).json({
      success: true,

      members: {
        total: totalMembers,
        active: activeMembers,
        pending: pendingMembers,
        suspended: suspendedMembers,
      },

      finance: {
        totalObligations,
        totalCollected,
        yearlyCollected,
        totalOutstanding,
        pendingPayments,
      },

      charts: {
        collectionTrend,
        collectionByCategory: [],
      },

      recentMembers,
      recentPayments,
    });

  } catch (error) {
    console.error(
      "Get admin dashboard error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load admin dashboard.",
    });
  }
}


export const getAdminMembersController = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 20, 1),
      100
    );

    const skip = (page - 1) * limit;

    const filter = {
      role: "member",
    };

    const [members, total] = await Promise.all([
      User.find(filter)
        .select(
          "firstName middleName lastName email phone enrollmentYear graduationYear alumniId status isEmailVerified role yearSet chapter createdAt updatedAt"
        )
        .populate("yearSet", "year name")
        .populate("chapter", "name code")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      User.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      members,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get admin members error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load members.",
    });
  }
};