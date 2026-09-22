import User from "../models/User.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import Chapter from "../models/Chapter.js";
import Payment from "../models/Payment.js";
import {
  successResponse,
  errorResponse,
} from "../utils/response.js";


// =====================================================
// GET ALL CHAPTERS
// =====================================================

export const getChapters = async (req, res) => {
  try {
    const chapters = await Chapter.find({ isActive: true })
      .select("_id name code country")
      .sort({ name: 1 });

    return successResponse(
      res,
      "all chapters",
      {
        chapters,
      }
    );
  } catch (error) {
    console.error("Get chapters error:", error);

    return errorResponse(
      res,
      500,
      "Failed to fetch chapters"
    );
  }
};


// =====================================================
// GET MY CHAPTER obligation and members
// =====================================================

export const getMyChapter = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate(
        "chapter",
        "_id name code country leader"
      )
      .lean();

    if (!user) {
      return errorResponse(
        res,
        404,
        "Member not found."
      );
    }

    if (!user.chapter) {
      return errorResponse(
        res,
        404,
        "No chapter assigned to this member."
      );
    }

    const chapter = user.chapter;


    // =====================================================
    // VERIFY CHAPTER LEADERSHIP
    // =====================================================

    if (
      !chapter.leader ||
      chapter.leader.toString() !== user._id.toString()
    ) {
      return errorResponse(
        res,
        403,
        "You are not the leader of this chapter."
      );
    }


    // =====================================================
    // GET CHAPTER MEMBERS
    // =====================================================

    const members = await User.find({
      chapter: chapter._id,
      status: "active",
    })
      .select(
        "_id firstName middleName lastName alumniId email graduationYear yearSet"
      )
      .populate(
        "yearSet",
        "name year"
      )
      .sort({
        lastName: 1,
        firstName: 1,
      })
      .lean();


    // =====================================================
    // GET CHAPTER OBLIGATIONS
    // =====================================================

    const assignments = await ObligationAssignment.find({
      user: user._id,
    })
      .populate({
        path: "obligation",
        select:
          "name description category amount year dueDate",
        match: {
          category: "chapter",
        },
      })
      .lean();


    // Remove assignments that didn't match category
    const validAssignments = assignments.filter(
      (assignment) => assignment.obligation
    );


    // =====================================================
// GET RECENT CHAPTER PAYMENT ACTIVITY
// =====================================================

const assignmentIds = validAssignments.map(
  (assignment) => assignment._id
);

const recentActivity = await Payment.find({
  obligationAssignment: {
    $in: assignmentIds,
  },
  status: "successful",
})
  .populate({
    path: "obligationAssignment",
    select: "obligation",
    populate: {
      path: "obligation",
      select: "name category",
    },
  })
  .select(
    "_id amount status paidAt obligationAssignment createdAt"
  )
  .sort({
    paidAt: -1,
    createdAt: -1,
  })
  .limit(10)
  .lean();


    // =====================================================
    // CALCULATE FINANCIAL SUMMARY
    // =====================================================

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



    // =====================================================
    // RESPONSE
    // =====================================================

    return successResponse(
      res,
      "Chapter information fetched successfully.",
      {
        chapter: {
          id: chapter._id,
          name: chapter.name,
          code: chapter.code,
          country: chapter.country,
        },

        summary: {
          totalDue,
          amountPaid,
          outstanding,
          memberCount: members.length,
        },

        obligations: validAssignments.map((assignment) => ({
          _id: assignment._id,
          amountDue: assignment.amountDue,
          amountPaid: assignment.amountPaid,
          dueDate: assignment.obligation?.dueDate,
          obligation: assignment.obligation,
        })),

        members,

        recentActivity: recentActivity,
      }
    );

  } catch (error) {
    console.error(
      "Get my chapter error:",
      error
    );

    return errorResponse(
      res,
      500,
      "Failed to fetch your chapter information."
    );
  }
};