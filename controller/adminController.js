import mongoose from "mongoose";
import crypto from "crypto";
import User from "../models/User.js";
import Payment from "../models/Payment.js";
import ObligationAssignment from "../models/ObligationAssignment.js";

import { approveMember } from "../services/memberApproval.service.js";
import { createAuditLog } from "../services/auditLog.service.js";
import Chapter from "../models/Chapter.js";
import YearSet from "../models/YearSet.js";

import generateAlumniId from "../utils/generateAlumniId.js";

import {
  assignIndividualObligationsToUser,
} from "../services/obligationAssignmentService.js";

import { sendEmail } from "../services/email.service.js";

const escapeRegex = (value = "") => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

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
    // ========================================
    // PAGINATION
    // ========================================

    const page = Math.max(
      Number(req.query.page) || 1,
      1
    );

    const limit = Math.min(
      Math.max(Number(req.query.limit) || 20, 1),
      100
    );

    const skip = (page - 1) * limit;

    // ========================================
    // QUERY PARAMETERS
    // ========================================

    const search = String(
      req.query.search || ""
    ).trim();

    const status = String(
      req.query.status || ""
    ).trim();

    // ========================================
    // BASE FILTER
    // ========================================

    const filter = {
      role: "member",
    };

    // ========================================
    // STATUS FILTER
    // ========================================

    if (status) {
      const allowedStatuses = [
        "pending",
        "active",
        "suspended",
        "inactive",
        "deactivated",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid member status.",
        });
      }

      filter.status = status;
    }

    // ========================================
    // SEARCH
    // ========================================

    if (search) {
      const regex = new RegExp(
        escapeRegex(search),
        "i"
      );

      // ----------------------------------------
      // SEARCH CHAPTER
      // ----------------------------------------

      const matchingChapters = await Chapter.find({
        $or: [
          { name: regex },
          { code: regex },
        ],
      })
        .select("_id")
        .lean();

      const chapterIds = matchingChapters.map(
        (chapter) => chapter._id
      );

      // ----------------------------------------
      // SEARCH YEAR SET
      // ----------------------------------------

      const yearSetSearch = {
        $or: [
          { name: regex },
        ],
      };

      // If search is a number, also search
      // the numeric YearSet.year field.
      const numericSearch = Number(search);

      if (!Number.isNaN(numericSearch)) {
        yearSetSearch.$or.push({
          year: numericSearch,
        });
      }

      const matchingYearSets = await YearSet.find(
        yearSetSearch
      )
        .select("_id")
        .lean();

      const yearSetIds = matchingYearSets.map(
        (yearSet) => yearSet._id
      );

      // ----------------------------------------
      // MEMBER SEARCH
      // ----------------------------------------

      filter.$or = [
        {
          firstName: regex,
        },
        {
          middleName: regex,
        },
        {
          lastName: regex,
        },
        {
          email: regex,
        },
        {
          alumniId: regex,
        },
      ];

      // Add chapter matches
      if (chapterIds.length > 0) {
        filter.$or.push({
          chapter: {
            $in: chapterIds,
          },
        });
      }

      // Add year set matches
      if (yearSetIds.length > 0) {
        filter.$or.push({
          yearSet: {
            $in: yearSetIds,
          },
        });
      }
    }

    // ========================================
    // FETCH MEMBERS
    // ========================================

    const [members, total] = await Promise.all([
      User.find(filter)
        .select(
          "firstName middleName lastName email phone enrollmentYear graduationYear alumniId status isEmailVerified role yearSet chapter createdAt updatedAt"
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
        .skip(skip)
        .limit(limit)
        .lean(),

      User.countDocuments(filter),
    ]);

    // ========================================
    // PAGINATION
    // ========================================

    const totalPages = Math.ceil(
      total / limit
    );

    // ========================================
    // RESPONSE
    // ========================================

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
    console.error(
      "Get admin members error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load members.",
    });
  }
};





export const createAdminMemberController = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      firstName,
      middleName,
      lastName,
      email,
      phone,
      enrollmentYear,
      graduationYear,
      chapter,
    } = req.body;

  

    if (
      !firstName?.trim() ||
      !lastName?.trim() ||
      !email?.trim() ||
      !enrollmentYear ||
      !graduationYear ||
      !chapter
    ) {
      return res.status(400).json({
        success: false,
        emailSent: false,
        message:
          "First name, last name, email, enrollment year, graduation year and chapter are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const enrollmentYearNumber = Number(enrollmentYear);
    const graduationYearNumber = Number(graduationYear);

    if (
      !Number.isInteger(enrollmentYearNumber) ||
      !Number.isInteger(graduationYearNumber)
    ) {
      return res.status(400).json({
        success: false,
        emailSent: false,
        message:
          "Enrollment year and graduation year must be valid years.",
      });
    }

   

    const existingMember = await User.findOne({
      email: normalizedEmail,
    });

    if (existingMember) {
      return res.status(409).json({
        success: false,
        emailSent: false,
        message:
          "A member with this email address already exists.",
      });
    }

    

    const [chapterDoc, yearSetDoc] = await Promise.all([
      Chapter.findById(chapter).select("_id code name"),

      YearSet.findOne({
        year: graduationYearNumber,
      }).select("_id year name"),
    ]);

    if (!chapterDoc) {
      return res.status(400).json({
        success: false,
        emailSent: false,
        message: "Selected chapter was not found.",
      });
    }

    if (!yearSetDoc) {
      return res.status(400).json({
        success: false,
        emailSent: false,
        message:
          `No year set was found for graduation year ${graduationYearNumber}.`,
      });
    }

    

    session.startTransaction();

    const alumniId = await generateAlumniId(
      yearSetDoc._id,
      chapterDoc._id,
      session
    );

   

    const [member] = await User.create(
      [
        {
          firstName: firstName.trim(),

          middleName:
            middleName?.trim() || undefined,

          lastName: lastName.trim(),

          email: normalizedEmail,

          phone:
            phone?.trim() || undefined,

          enrollmentYear:
            enrollmentYearNumber,

          graduationYear:
            graduationYearNumber,

          yearSet:
            yearSetDoc._id,

          chapter:
            chapterDoc._id,

          alumniId,

         
          password: undefined,

          role: "member",

          // Waiting for account activation.
          status: "pending",

          isEmailVerified: false,
        },
      ],
      {
        session,
      }
    );

   

    const obligationResult =
      await assignIndividualObligationsToUser(
        member._id,
        req.user?._id || null,
        session
      );

    const rawToken = crypto
      .randomBytes(32)
      .toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const setupExpires = new Date(
      Date.now() + 72 * 60 * 60 * 1000
    );

    member.accountSetupToken = hashedToken;
    member.accountSetupExpires = setupExpires;

    await member.save({
      session,
    });

    await session.commitTransaction();

   

    const frontendUrl =
      process.env.FRONTEND_URL ||
      "http://localhost:5173";

    const activationLink =
      `${frontendUrl}/set-password?token=${rawToken}`;

   

      try {
        await sendEmail({
          to: normalizedEmail,

          subject:
            "Welcome to OlivetNOSA – Activate Your Account",

          html: `
            <div
              style="
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: auto;
              "
            >

              <h2 style="color: #123B6D;">
                Welcome to OlivetNOSA
              </h2>

              <p>
                Dear ${firstName},
              </p>

              <p>
                Your OlivetNOSA member account has been
                created successfully.
              </p>

              <p>
                Your Alumni ID is:
                <strong>${alumniId}</strong>
              </p>

              <p>
                To activate your account, please set your
                password using the button below.
              </p>

              <p style="margin: 30px 0;">

                <a
                  href="${activationLink}"
                  style="
                    display: inline-block;
                    background: #123B6D;
                    color: #ffffff;
                    text-decoration: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    font-weight: bold;
                  "
                >
                  Activate My Account
                </a>

              </p>

              <p>
                This activation link will expire in
                <strong>72 hours</strong>.
              </p>

              <p>
                If you did not expect this email, please
                contact OlivetNOSA administration.
              </p>

              <p style="margin-top: 30px;">
                Regards,<br />
                <strong>OlivetNOSA</strong>
              </p>

            </div>
          `,
        });
      } catch (emailError) {
        console.error(
          "Admin member created but welcome email failed:",
          emailError
        );

        return res.status(201).json({
          success: true,
          emailSent: false,

          message:
            "Member was created successfully, but the activation email could not be sent.",

          member: {
            _id: member._id,
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.email,
            alumniId: member.alumniId,
          },

          obligationsAssigned:
            obligationResult.assigned,
        });
      }

  

    return res.status(201).json({
      success: true,
      emailSent: true,

      message:
        "Member created successfully. An activation email has been sent.",

      member: {
        _id: member._id,

        firstName:
          member.firstName,

        middleName:
          member.middleName,

        lastName:
          member.lastName,

        email:
          member.email,

        phone:
          member.phone,

        enrollmentYear:
          member.enrollmentYear,

        graduationYear:
          member.graduationYear,

        alumniId:
          member.alumniId,

        status:
          member.status,

        isEmailVerified:
          member.isEmailVerified,

        yearSet:
          yearSetDoc,

        chapter:
          chapterDoc,
      },

      obligationsAssigned:
        obligationResult.assigned,
    });

  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error(
      "Create admin member error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to create member.",
    });

  } finally {
    await session.endSession();
  }
};

