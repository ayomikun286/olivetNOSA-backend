import YearSet from "../models/YearSet.js";
import {
    successResponse,
    errorResponse,
} from "../utils/response.js"; 

export const getYearSet = async (req, res) => {
  try {
    const yearSet = await YearSet.find({ isActive: true })
      .select("_id name year")
      .sort({ name: 1 });

    return successResponse(
          res,
          "all Year Set",
          {
            yearSet
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