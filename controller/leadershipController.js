import {
  assignYearSetLeader,
  assignChapterLeader,
} from "../services/leadership.service.js";

import { createAuditLog } from "../services/auditLog.service.js";
import { createNotification } from "../services/notificationService.js";

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

    // ========================================
    // NOTIFY USER
    // ========================================

    try {
      const yearSetName =
        result.yearSet?.name || "your year set";

      await createNotification({
        userId,
        type: "system",
        title: "Year Set Leadership Assigned",
        message: `You have been assigned as the leader of ${yearSetName}. Please review your Year Set dashboard and leadership responsibilities.`,
        link: "/portal/member/dashboard/year-set",
      });
    } catch (notificationError) {
      console.error(
        "Year set leader notification error:",
        notificationError
      );
    }

    // ========================================
    // AUDIT LOG
    // ========================================

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

    // ========================================
    // NOTIFY USER
    // ========================================

    try {
      const chapterName =
        result.chapter?.name || "your chapter";

      await createNotification({
        userId,
        type: "system",
        title: "Chapter Leadership Assigned",
        message: `You have been assigned as the leader of ${chapterName}. Please review your Chapter dashboard and leadership responsibilities.`,
        link: "/portal/member/dashboard/chapter",
      });
    } catch (notificationError) {
      console.error(
        "Chapter leader notification error:",
        notificationError
      );
    }

    // ========================================
    // AUDIT LOG
    // ========================================

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