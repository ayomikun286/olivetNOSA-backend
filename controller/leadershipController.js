import {
  assignYearSetLeader,
  assignChapterLeader,
} from "../services/leadership.service.js";

export const assignYearSetLeaderController = async (req, res) => {
  try {
    const { userId, yearSetId } = req.body;

    if (!userId || !yearSetId) {
      return res.status(400).json({
        success: false,
        message: "userId and yearSetId are required.",
      });
    }

    const result = await assignYearSetLeader(userId, yearSetId);

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
      message: error.message || "Failed to assign year set leader.",
    });
  }
};


export const assignChapterLeaderController = async (req, res) => {
  try {
    const { userId, chapterId } = req.body;

    if (!userId || !chapterId) {
      return res.status(400).json({
        success: false,
        message: "userId and chapterId are required.",
      });
    }

    const result = await assignChapterLeader(userId, chapterId);

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
      message: error.message || "Failed to assign chapter leader.",
    });
  }
};