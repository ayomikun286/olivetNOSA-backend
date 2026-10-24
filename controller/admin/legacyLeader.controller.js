import mongoose from "mongoose";

import LegacyLeader from "../../models/LegacyLeader.js";
import cloudinary from "../../config/cloudinary.js";
import { createAuditLog } from "../../services/auditLog.service.js";

// ========================================
// HELPERS: CLOUDINARY
// ========================================

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "onw-gosa/legacy-leaders",
        resource_type: "image",
        transformation: [
          {
            width: 1600,
            height: 1600,
            crop: "limit",
          },
          {
            quality: "auto",
            fetch_format: "auto",
          },
        ],
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    stream.end(buffer);
  });
};

const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });
  } catch (error) {
    console.error(
      `Cloudinary delete failed for ${publicId}:`,
      error
    );
  }
};

const cleanupUploadedImages = async (publicIds = []) => {
  await Promise.all(
    publicIds.filter(Boolean).map(deleteFromCloudinary)
  );
};

// ========================================
// HELPERS: VALIDATION
// ========================================

const parseAchievements = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter(Boolean);
      }
    } catch {
      // Accept newline-separated achievements as a fallback.
    }

    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const parseBoolean = (value) =>
  value === true || value === "true";

const parseYear = (value, fieldName, allowEmpty = false) => {
  if (
    allowEmpty &&
    (value === undefined || value === null || value === "")
  ) {
    return { value: null };
  }

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return {
      error: `${fieldName} is required.`,
    };
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1900 ||
    parsed > new Date().getFullYear() + 1
  ) {
    return {
      error: `${fieldName} must be a valid year.`,
    };
  }

  return { value: parsed };
};

const validateLeadershipYears = (startYear, endYear) => {
  if (
    endYear !== null &&
    endYear !== undefined &&
    endYear < startYear
  ) {
    return "End year cannot be earlier than start year.";
  }

  return null;
};

// ========================================
// PUBLIC: GET PUBLISHED LEADERS
// ========================================

export const getPublishedLegacyLeaders = async (req, res) => {
  try {
    const leaders = await LegacyLeader.find({
      isPublished: true,
    })
      .select(
        "name title startYear endYear portrait biography achievements displayOrder"
      )
      .sort({
        displayOrder: 1,
        startYear: 1,
        name: 1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Legacy leaders retrieved successfully.",
      data: leaders,
    });
  } catch (error) {
    console.error("Get published legacy leaders error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving legacy leaders.",
    });
  }
};

// ========================================
// ADMIN: GET ALL LEADERS
// ========================================

export const getAdminLegacyLeaders = async (req, res) => {
  try {
    const { search, status } = req.query;
    const filter = {};

    if (search?.trim()) {
      filter.name = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    if (status === "published") {
      filter.isPublished = true;
    }

    if (status === "draft") {
      filter.isPublished = false;
    }

    const leaders = await LegacyLeader.find(filter)
      .sort({
        displayOrder: 1,
        startYear: 1,
        createdAt: -1,
      })
      .populate("createdBy", "firstName lastName");

    return res.status(200).json({
      success: true,
      message: "Legacy leaders retrieved successfully.",
      data: leaders,
    });
  } catch (error) {
    console.error("Get admin legacy leaders error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving legacy leaders.",
    });
  }
};

// ========================================
// ADMIN: GET LEADER BY ID
// ========================================

export const getAdminLegacyLeaderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid legacy leader ID.",
      });
    }

    const leader = await LegacyLeader.findById(id).populate(
      "createdBy",
      "firstName lastName"
    );

    if (!leader) {
      return res.status(404).json({
        success: false,
        message: "Legacy leader not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Legacy leader retrieved successfully.",
      data: leader,
    });
  } catch (error) {
    console.error("Get admin legacy leader error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving the legacy leader.",
    });
  }
};

// ========================================
// ADMIN: CREATE LEADER
// ========================================

export const createLegacyLeader = async (req, res) => {
  const uploadedPublicIds = [];

  try {
    const {
      name,
      title,
      startYear,
      endYear,
      biography,
      achievements,
      displayOrder,
      isPublished,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Leader name is required.",
      });
    }

    const parsedStartYear = parseYear(startYear, "Start year");

    if (parsedStartYear.error) {
      return res.status(400).json({
        success: false,
        message: parsedStartYear.error,
      });
    }

    const parsedEndYear = parseYear(
      endYear,
      "End year",
      true
    );

    if (parsedEndYear.error) {
      return res.status(400).json({
        success: false,
        message: parsedEndYear.error,
      });
    }

    const yearError = validateLeadershipYears(
      parsedStartYear.value,
      parsedEndYear.value
    );

    if (yearError) {
      return res.status(400).json({
        success: false,
        message: yearError,
      });
    }

    let portrait = "";
    let portraitPublicId = "";

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer);

      portrait = uploadResult.secure_url;
      portraitPublicId = uploadResult.public_id;

      uploadedPublicIds.push(uploadResult.public_id);
    }

    const published = parseBoolean(isPublished);

    const parsedDisplayOrder =
      displayOrder === undefined || displayOrder === ""
        ? 0
        : Number(displayOrder);

    if (
      !Number.isInteger(parsedDisplayOrder) ||
      parsedDisplayOrder < 0
    ) {
      await cleanupUploadedImages(uploadedPublicIds);

      return res.status(400).json({
        success: false,
        message: "Display order must be a non-negative whole number.",
      });
    }

    const leader = await LegacyLeader.create({
      name: name.trim(),
      title: title?.trim() || "President",
      startYear: parsedStartYear.value,
      endYear: parsedEndYear.value,
      portrait,
      portraitPublicId,
      biography: biography?.trim() || "",
      achievements: parseAchievements(achievements),
      displayOrder: parsedDisplayOrder,
      isPublished: published,
      publishedAt: published ? new Date() : null,
      createdBy: req.user.id,
    });

    await createAuditLog({
      actor: req.user.id,
      action: "legacyLeader.created",
      resource: "LegacyLeader",
      resourceId: leader._id,
      req,
      details: {
        name: leader.name,
        startYear: leader.startYear,
        endYear: leader.endYear,
        isPublished: leader.isPublished,
        hasPortrait: Boolean(leader.portrait),
      },
    });

    return res.status(201).json({
      success: true,
      message: "Legacy leader created successfully.",
      data: leader,
    });
  } catch (error) {
    console.error("Create legacy leader error:", error);

    await cleanupUploadedImages(uploadedPublicIds);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while creating the legacy leader.",
    });
  }
};

// ========================================
// ADMIN: UPDATE LEADER
// ========================================

export const updateLegacyLeader = async (req, res) => {
  const newlyUploadedPublicIds = [];

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid legacy leader ID.",
      });
    }

    const leader = await LegacyLeader.findById(id);

    if (!leader) {
      return res.status(404).json({
        success: false,
        message: "Legacy leader not found.",
      });
    }

    const {
      name,
      title,
      startYear,
      endYear,
      biography,
      achievements,
      displayOrder,
      isPublished,
      removePortrait,
    } = req.body;

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Leader name cannot be empty.",
        });
      }

      leader.name = name.trim();
    }

    if (title !== undefined) {
      leader.title = title.trim() || "President";
    }

    if (startYear !== undefined) {
      const parsed = parseYear(startYear, "Start year");

      if (parsed.error) {
        return res.status(400).json({
          success: false,
          message: parsed.error,
        });
      }

      leader.startYear = parsed.value;
    }

    if (endYear !== undefined) {
      const parsed = parseYear(endYear, "End year", true);

      if (parsed.error) {
        return res.status(400).json({
          success: false,
          message: parsed.error,
        });
      }

      leader.endYear = parsed.value;
    }

    const yearError = validateLeadershipYears(
      leader.startYear,
      leader.endYear
    );

    if (yearError) {
      return res.status(400).json({
        success: false,
        message: yearError,
      });
    }

    if (biography !== undefined) {
      leader.biography = biography.trim();
    }

    if (achievements !== undefined) {
      leader.achievements = parseAchievements(achievements);
    }

    if (displayOrder !== undefined) {
      const parsedOrder = Number(displayOrder);

      if (
        !Number.isInteger(parsedOrder) ||
        parsedOrder < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Display order must be a non-negative whole number.",
        });
      }

      leader.displayOrder = parsedOrder;
    }

    if (
      removePortrait === true ||
      removePortrait === "true"
    ) {
      const oldPublicId = leader.portraitPublicId;

      leader.portrait = "";
      leader.portraitPublicId = "";

      if (oldPublicId) {
        await deleteFromCloudinary(oldPublicId);
      }
    }

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer);

      newlyUploadedPublicIds.push(uploadResult.public_id);

      const oldPublicId = leader.portraitPublicId;

      leader.portrait = uploadResult.secure_url;
      leader.portraitPublicId = uploadResult.public_id;

      if (oldPublicId) {
        await deleteFromCloudinary(oldPublicId);
      }
    }

    if (isPublished !== undefined) {
      const published = parseBoolean(isPublished);

      if (published && !leader.isPublished) {
        leader.publishedAt = new Date();
      }

      if (!published) {
        leader.publishedAt = null;
      }

      leader.isPublished = published;
    }

    const changedFields = leader.modifiedPaths();

    await leader.save();

    if (changedFields.length > 0) {
      await createAuditLog({
        actor: req.user.id,
        action: "legacyLeader.updated",
        resource: "LegacyLeader",
        resourceId: leader._id,
        req,
        details: {
          name: leader.name,
          changedFields,
          isPublished: leader.isPublished,
          hasPortrait: Boolean(leader.portrait),
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Legacy leader updated successfully.",
      data: leader,
    });
  } catch (error) {
    console.error("Update legacy leader error:", error);

    await cleanupUploadedImages(newlyUploadedPublicIds);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while updating the legacy leader.",
    });
  }
};

// ========================================
// ADMIN: DELETE LEADER
// ========================================

export const deleteLegacyLeader = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid legacy leader ID.",
      });
    }

    const leader = await LegacyLeader.findById(id);

    if (!leader) {
      return res.status(404).json({
        success: false,
        message: "Legacy leader not found.",
      });
    }

    await LegacyLeader.findByIdAndDelete(id);

    await createAuditLog({
      actor: req.user.id,
      action: "legacyLeader.deleted",
      resource: "LegacyLeader",
      resourceId: leader._id,
      req,
      details: {
        name: leader.name,
        startYear: leader.startYear,
        endYear: leader.endYear,
        wasPublished: leader.isPublished,
        hadPortrait: Boolean(leader.portrait),
      },
    });

    await deleteFromCloudinary(leader.portraitPublicId);

    return res.status(200).json({
      success: true,
      message: "Legacy leader deleted successfully.",
    });
  } catch (error) {
    console.error("Delete legacy leader error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while deleting the legacy leader.",
    });
  }
};