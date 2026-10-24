import YearSet from "../models/YearSet.js";
import {
  successResponse,
  errorResponse,
} from "../utils/response.js";
import { createAuditLog } from "../services/auditLog.service.js";



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
    console.error("Get Year Sets error:", error);
     return errorResponse(
            res,
            500,
           "Failed to fetch Year Sets"
          );
  }
};





export const createYearSet = async (req, res) => {
  try {
    const { year, name } = req.body;

    // Validate graduation year
    const graduationYear = Number(year);

    if (
      year === undefined ||
      year === null ||
      String(year).trim() === "" ||
      !Number.isInteger(graduationYear) ||
      graduationYear < 1900
    ) {
      return errorResponse(
        res,
        400,
        "Please provide a valid graduation year."
      );
    }

    // Validate optional name
    if (
      name !== undefined &&
      (typeof name !== "string" || name.trim() === "")
    ) {
      return errorResponse(
        res,
        400,
        "Year Set name must be a non-empty string."
      );
    }

    if (typeof name === "string" && name.trim().length > 100) {
      return errorResponse(
        res,
        400,
        "Year Set name cannot exceed 100 characters."
      );
    }

    // Prevent duplicate graduation years
    const existingYearSet = await YearSet.findOne({
      year: graduationYear,
    });

    if (existingYearSet) {
      return errorResponse(
        res,
        409,
        "A Year Set already exists for this graduation year."
      );
    }

    // Create Year Set
    const yearSet = await YearSet.create({
      year: graduationYear,
      name: name?.trim() || `${graduationYear} Set`,
    });

    // Record audit log
    await createAuditLog({
      actor: req.user?._id,
      action: "CREATE",
      resource: "YearSet",
      resourceId: yearSet._id,
      details: {
        year: yearSet.year,
        name: yearSet.name,
      },
      req,
    });

    return successResponse(
  res,
  "Year Set created successfully.",
  { yearSet },
  201
);
  } catch (error) {
    console.error("Create Year Set error:", error);

    // Handle duplicate-key errors, including concurrent requests
    if (error.code === 11000) {
      return errorResponse(
        res,
        409,
        "A Year Set already exists for this graduation year."
      );
    }

    return errorResponse(
      res,
      500,
      "Failed to create Year Set."
    );
  }
};