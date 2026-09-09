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