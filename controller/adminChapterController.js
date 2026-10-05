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

    const obligations = await Obligation.find({
      category: "chapter",
      isActive: true,
      year: new Date().getFullYear(),
    })
      .select(
        "_id name amount dueDate year description isActive isOptional paymentPlans"
      )
      .sort({ dueDate: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        chapter,
        memberCount,
        members,
        obligations,
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