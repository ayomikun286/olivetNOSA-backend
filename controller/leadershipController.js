import {
  assignYearSetLeader,
  assignChapterLeader,
} from "../services/leadership.service.js";

import { createAuditLog } from "../services/auditLog.service.js";

// ========================================
// ASSIGN YEAR SET LEADER
// ========================================

export const assignYearSetLeaderController = async (req, res) => {
  try {
    const { userId, yearSetId } = req.body;

    if (!userId || !yearSetId) {
      return res.status(400).json({
        success: false,
        message: "userId and yearSetId are required.",
      });
    }

    const result = await assignYearSetLeader(
      userId,
      yearSetId,
      req.user._id
    );

    await createAuditLog({
      actor: req.user._id,
      action: "yearSet.leader.assigned",
      resource: "YearSet",
      resourceId: yearSetId,
      targetUser: userId,
      details: {
        yearSet: result.yearSet?._id || yearSetId,
        obligationsAssigned: result.obligationsAssigned,
      },
      req,
    });

    return res.status(200).json({
      success: true,
      message: "Year set leader assigned successfully.",
      data: {
        yearSet: result.yearSet,
        obligationsAssigned: result.obligationsAssigned,
      },
    });
  } catch (error) {
    console.error("Assign year set leader error:", error);

    return res.status(400).json({
      success: false,
      message:
        error.message || "Failed to assign year set leader.",
    });
  }
};

// ========================================
// ASSIGN CHAPTER LEADER
// ========================================

export const assignChapterLeaderController = async (req, res) => {
  try {
    const { userId, chapterId } = req.body;

    if (!userId || !chapterId) {
      return res.status(400).json({
        success: false,
        message: "userId and chapterId are required.",
      });
    }

    const result = await assignChapterLeader(
      userId,
      chapterId,
      req.user._id
    );

    await createAuditLog({
      actor: req.user._id,
      action: "chapter.leader.assigned",
      resource: "Chapter",
      resourceId: chapterId,
      targetUser: userId,
      details: {
        chapter: result.chapter?._id || chapterId,
        obligationsAssigned: result.obligationsAssigned,
      },
      req,
    });

    return res.status(200).json({
      success: true,
      message: "Chapter leader assigned successfully.",
      data: {
        chapter: result.chapter,
        obligationsAssigned: result.obligationsAssigned,
      },
    });
  } catch (error) {
    console.error("Assign chapter leader error:", error);

    return res.status(400).json({
      success: false,
      message:
        error.message || "Failed to assign chapter leader.",
    });
  }
};