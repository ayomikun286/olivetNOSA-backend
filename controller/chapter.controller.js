import Chapter from "../models/Chapter.js";
import {
    successResponse,
    errorResponse,
} from "../utils/response.js"; 

export const getChapters = async (req, res) => {
  try {
    const chapters = await Chapter.find({ isActive: true })
      .select("_id name code country")
      .sort({ name: 1 });

    return successResponse(
          res,
          "all chapters",
          {
            chapters
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




export const getMyChapter = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("chapter")
      .populate({
        path: "chapter",
        select: "_id name code country",
      });

    if (!user?.chapter) {
      return errorResponse(
        res,
        404,
        "No chapter assigned to this member"
      );
    }

    return successResponse(
      res,
      "Member chapter fetched successfully",
      {
        chapter: user.chapter,
      }
    );

  } catch (error) {
    console.error("Get member chapter error:", error);

    return errorResponse(
      res,
      500,
      "Failed to fetch member chapter"
    );
  }
};