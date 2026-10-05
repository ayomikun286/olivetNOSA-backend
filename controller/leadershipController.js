import {
  assignYearSetLeader,
  assignChapterLeader,
} from "../services/leadership.service.js";

import { createAuditLog } from "../services/auditLog.service.js";
import { createNotification } from "../services/notificationService.js";


// ASSIGN YEAR SET LEADER
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
        result.yearSet?.name ||
        `Year Set ${result.yearSet?.year || ""}`;

      await createNotification({
        userId,
        type: "system",
        title: result.isReassignment
          ? "Year Set Leadership Reassigned"
          : "Year Set Leadership Assigned",
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
      action: result.isReassignment
        ? "yearSet.leader.reassigned"
        : "yearSet.leader.assigned",
      resource: "YearSet",
      resourceId: yearSetId,
      targetUser: userId,
      details: {
        yearSet: result.yearSet?._id || yearSetId,
        previousLeader: result.previousLeader,
        newLeader: result.newLeader,
        obligationsAssigned: result.obligationsAssigned,
      },
      req,
    });

    return res.status(200).json({
      success: true,
      message: result.isReassignment
        ? "Year set leader reassigned successfully."
        : "Year set leader assigned successfully.",
      data: {
        yearSet: result.yearSet,
        previousLeader: result.previousLeader,
        newLeader: result.newLeader,
        obligationsAssigned: result.obligationsAssigned,
      },
    });
  } catch (error) {
    console.error("Assign year set leader error:", error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to assign year set leader.",
    });
  }
};


// ASSIGN CHAPTER LEADER
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
        title: result.isReassignment
          ? "Chapter Leadership Reassigned"
          : "Chapter Leadership Assigned",
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
      action: result.isReassignment
        ? "chapter.leader.reassigned"
        : "chapter.leader.assigned",
      resource: "Chapter",
      resourceId: chapterId,
      targetUser: userId,
      details: {
        chapter: result.chapter?._id || chapterId,
        previousLeader: result.previousLeader,
        newLeader: result.newLeader,
        obligationsAssigned: result.obligationsAssigned,
      },
      req,
    });

    return res.status(200).json({
      success: true,
      message: result.isReassignment
        ? "Chapter leader reassigned successfully."
        : "Chapter leader assigned successfully.",
      data: {
        chapter: result.chapter,
        previousLeader: result.previousLeader,
        newLeader: result.newLeader,
        obligationsAssigned: result.obligationsAssigned,
      },
    });
  } catch (error) {
    console.error("Assign chapter leader error:", error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to assign chapter leader.",
    });
  }
};