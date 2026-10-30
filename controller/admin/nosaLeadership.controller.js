import mongoose from "mongoose";

import NOSALeader from "../../models/NOSALeader.js";
import cloudinary from "../../config/cloudinary.js";
import { createAuditLog } from "../../services/auditLog.service.js";

// ========================================
// HELPERS: CLOUDINARY
// ========================================

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "onw-nosa/nosa-leaders",
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
        if (error) reject(error);
        else resolve(result);
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
    console.error(`Cloudinary delete failed for ${publicId}:`, error);
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

const parseBoolean = (value) =>
  value === true || value === "true";

const parseDisplayOrder = (value) => {
  if (value === undefined || value === "") {
    return { value: 0 };
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return {
      error: "Display order must be a non-negative whole number.",
    };
  }

  return { value: parsed };
};

// ========================================
// PUBLIC: GET PUBLISHED LEADERS
// ========================================

export const getPublishedNOSALeaders = async (req, res) => {
  try {
    const leaders = await NOSALeader.find({
      isPublished: true,
    })
      .select(
        "name position image isPresident displayOrder"
      )
      .sort({
        isPresident: -1,
        displayOrder: 1,
        name: 1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      message: "NOSA leaders retrieved successfully.",
      data: leaders,
    });
  } catch (error) {
    console.error("Get published NOSA leaders error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving NOSA leaders.",
    });
  }
};

// ========================================
// ADMIN: GET ALL LEADERS
// ========================================

export const getAdminNOSALeaders = async (req, res) => {
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

    const leaders = await NOSALeader.find(filter)
      .sort({
        isPresident: -1,
        displayOrder: 1,
        createdAt: -1,
      })
      .populate("createdBy", "firstName lastName");

    return res.status(200).json({
      success: true,
      message: "NOSA leaders retrieved successfully.",
      data: leaders,
    });
  } catch (error) {
    console.error("Get admin NOSA leaders error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving NOSA leaders.",
    });
  }
};

// ========================================
// ADMIN: GET LEADER BY ID
// ========================================

export const getAdminNOSALeaderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid NOSA leader ID.",
      });
    }

    const leader = await NOSALeader.findById(id).populate(
      "createdBy",
      "firstName lastName"
    );

    if (!leader) {
      return res.status(404).json({
        success: false,
        message: "NOSA leader not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "NOSA leader retrieved successfully.",
      data: leader,
    });
  } catch (error) {
    console.error("Get admin NOSA leader error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving the NOSA leader.",
    });
  }
};

// ========================================
// ADMIN: CREATE LEADER
// ========================================

export const createNOSALeader = async (req, res) => {
  const uploadedPublicIds = [];

  try {
    const {
      name,
      position,
      isPresident,
      displayOrder,
      isPublished,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Leader name is required.",
      });
    }

    if (!position?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Leader position is required.",
      });
    }

    const parsedOrder = parseDisplayOrder(displayOrder);

    if (parsedOrder.error) {
      return res.status(400).json({
        success: false,
        message: parsedOrder.error,
      });
    }

    let image = "";
    let imagePublicId = "";

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer);

      image = uploadResult.secure_url;
      imagePublicId = uploadResult.public_id;

      uploadedPublicIds.push(uploadResult.public_id);
    }

    const president = parseBoolean(isPresident);
    const published = parseBoolean(isPublished);

    const leader = await NOSALeader.create({
      name: name.trim(),
      position: position.trim(),
      image,
      imagePublicId,
      isPresident: president,
      displayOrder: parsedOrder.value,
      isPublished: published,
      publishedAt: published ? new Date() : null,
      createdBy: req.user.id,
    });

    // Ensure only one NOSA President exists.
    if (president) {
      await NOSALeader.updateMany(
        { _id: { $ne: leader._id }, isPresident: true },
        { $set: { isPresident: false } }
      );
    }

    await createAuditLog({
      actor: req.user.id,
      action: "nosaLeader.created",
      resource: "NOSALeader",
      resourceId: leader._id,
      req,
      details: {
        name: leader.name,
        position: leader.position,
        isPresident: leader.isPresident,
        isPublished: leader.isPublished,
        hasImage: Boolean(leader.image),
      },
    });

    return res.status(201).json({
      success: true,
      message: "NOSA leader created successfully.",
      data: leader,
    });
  } catch (error) {
    console.error("Create NOSA leader error:", error);

    await cleanupUploadedImages(uploadedPublicIds);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while creating the NOSA leader.",
    });
  }
};

// ========================================
// ADMIN: UPDATE LEADER
// ========================================

export const updateNOSALeader = async (req, res) => {
  const newlyUploadedPublicIds = [];

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid NOSA leader ID.",
      });
    }

    const leader = await NOSALeader.findById(id);

    if (!leader) {
      return res.status(404).json({
        success: false,
        message: "NOSA leader not found.",
      });
    }

    const {
      name,
      position,
      isPresident,
      displayOrder,
      isPublished,
      removeImage,
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

    if (position !== undefined) {
      if (!position.trim()) {
        return res.status(400).json({
          success: false,
          message: "Leader position cannot be empty.",
        });
      }

      leader.position = position.trim();
    }

    if (displayOrder !== undefined) {
      const parsedOrder = parseDisplayOrder(displayOrder);

      if (parsedOrder.error) {
        return res.status(400).json({
          success: false,
          message: parsedOrder.error,
        });
      }

      leader.displayOrder = parsedOrder.value;
    }

    const oldImagePublicId = leader.imagePublicId;
    let shouldDeleteOldImage = false;

    if (parseBoolean(removeImage)) {
      leader.image = "";
      leader.imagePublicId = "";
      shouldDeleteOldImage = Boolean(oldImagePublicId);
    }

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer);

      newlyUploadedPublicIds.push(uploadResult.public_id);

      leader.image = uploadResult.secure_url;
      leader.imagePublicId = uploadResult.public_id;

      shouldDeleteOldImage = Boolean(oldImagePublicId);
    }

    if (isPresident !== undefined) {
      leader.isPresident = parseBoolean(isPresident);
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

    // If this leader is President, clear the designation from others.
    if (leader.isPresident) {
      await NOSALeader.updateMany(
        { _id: { $ne: leader._id }, isPresident: true },
        { $set: { isPresident: false } }
      );
    }

    if (shouldDeleteOldImage) {
      await deleteFromCloudinary(oldImagePublicId);
    }

    if (changedFields.length > 0) {
      await createAuditLog({
        actor: req.user.id,
        action: "nosaLeader.updated",
        resource: "NOSALeader",
        resourceId: leader._id,
        req,
        details: {
          name: leader.name,
          position: leader.position,
          changedFields,
          isPresident: leader.isPresident,
          isPublished: leader.isPublished,
          hasImage: Boolean(leader.image),
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "NOSA leader updated successfully.",
      data: leader,
    });
  } catch (error) {
    console.error("Update NOSA leader error:", error);

    await cleanupUploadedImages(newlyUploadedPublicIds);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while updating the NOSA leader.",
    });
  }
};

// ========================================
// ADMIN: DELETE LEADER
// ========================================

export const deleteNOSALeader = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid NOSA leader ID.",
      });
    }

    const leader = await NOSALeader.findById(id);

    if (!leader) {
      return res.status(404).json({
        success: false,
        message: "NOSA leader not found.",
      });
    }

    await NOSALeader.findByIdAndDelete(id);

    await createAuditLog({
      actor: req.user.id,
      action: "nosaLeader.deleted",
      resource: "NOSALeader",
      resourceId: leader._id,
      req,
      details: {
        name: leader.name,
        position: leader.position,
        wasPresident: leader.isPresident,
        wasPublished: leader.isPublished,
        hadImage: Boolean(leader.image),
      },
    });

    await deleteFromCloudinary(leader.imagePublicId);

    return res.status(200).json({
      success: true,
      message: "NOSA leader deleted successfully.",
    });
  } catch (error) {
    console.error("Delete NOSA leader error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while deleting the NOSA leader.",
    });
  }
};