import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";

export const getAdminAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      action,
      resource,
      actor,
      targetUser,
      from,
      to,
      search,
    } = req.query;

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(limit, 10) || 20)
    );

    const filter = {};

    if (action) filter.action = action;
    if (resource) filter.resource = resource;

    if (actor) {
      if (!mongoose.isValidObjectId(actor)) {
        return res.status(400).json({
          success: false,
          message: "Invalid actor ID.",
        });
      }

      filter.actor = actor;
    }

    if (targetUser) {
      if (!mongoose.isValidObjectId(targetUser)) {
        return res.status(400).json({
          success: false,
          message: "Invalid target user ID.",
        });
      }

      filter.targetUser = targetUser;
    }

    if (from || to) {
      filter.createdAt = {};

      if (from) {
        const fromDate = new Date(from);

        if (Number.isNaN(fromDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid start date.",
          });
        }

        filter.createdAt.$gte = fromDate;
      }

      if (to) {
        const toDate = new Date(to);

        if (Number.isNaN(toDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid end date.",
          });
        }

        // Include the entire selected end date for YYYY-MM-DD inputs.
        if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
          toDate.setDate(toDate.getDate() + 1);
        }

        filter.createdAt.$lt = toDate;
      }

      if (
        filter.createdAt.$gte &&
        filter.createdAt.$lt &&
        filter.createdAt.$gte >= filter.createdAt.$lt
      ) {
        return res.status(400).json({
          success: false,
          message: "The start date must be before the end date.",
        });
      }
    }

    if (search?.trim()) {
      const escapedSearch = search.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const searchRegex = new RegExp(escapedSearch, "i");

      filter.$or = [
        { action: searchRegex },
        { resource: searchRegex },
        { ipAddress: searchRegex },
        { userAgent: searchRegex },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate(
          "actor",
          "firstName middleName lastName email alumniId role"
        )
        .populate(
          "targetUser",
          "firstName middleName lastName email alumniId"
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize)
        .lean(),

      AuditLog.countDocuments(filter),
    ]);


    console.log(
  "CHAPTER AUDIT:",
  JSON.stringify(
    logs
      .filter((log) => log.resource === "Chapter")
      .map((log) => ({
        action: log.action,
        resourceId: log.resourceId,
        details: log.details,
      })),
    null,
    2
  )
);

    return res.status(200).json({
      success: true,
      logs,
      pagination: {
        total,
        page: currentPage,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Get admin audit logs error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve audit logs.",
    });
  }
};