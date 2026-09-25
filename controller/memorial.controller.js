import mongoose from "mongoose";
import Memorial from "../models/Memorial.js";
import cloudinary from "../config/cloudinary.js";

// ========================================
// HELPER: UPLOAD IMAGE TO CLOUDINARY
// ========================================

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "olivetnosa/memorials",
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

// ========================================
// HELPER: DELETE CLOUDINARY IMAGE
// ========================================

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

// ========================================
// HELPER: CLEANUP MULTIPLE CLOUDINARY IMAGES
// ========================================

const cleanupUploadedImages = async (publicIds = []) => {
  const validIds = publicIds.filter(Boolean);

  if (!validIds.length) return;

  await Promise.all(
    validIds.map((publicId) =>
      deleteFromCloudinary(publicId)
    )
  );
};

// ========================================
// PUBLIC MEMORIAL LIST
// Limited information only
// ========================================

export const getPublishedMemorials = async (req, res) => {
  try {
    const {
      search,
      schoolSet,
      yearsAttended,
      graduationYear,
    } = req.query;

    const filter = {
      isPublished: true,
    };

    // ----------------------------------------
    // SEARCH BY NAME
    // ----------------------------------------

    if (search?.trim()) {
      filter.fullName = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    // ----------------------------------------
    // SCHOOL / GRADUATING SET
    // ----------------------------------------

    if (schoolSet?.trim()) {
      filter.schoolSet = {
        $regex: `^${schoolSet.trim()}$`,
        $options: "i",
      };
    }

    // ----------------------------------------
    // YEARS ATTENDED
    // ----------------------------------------

    if (yearsAttended?.trim()) {
      filter.yearsAttended = {
        $regex: yearsAttended.trim(),
        $options: "i",
      };
    }

    // ----------------------------------------
    // GRADUATION YEAR
    // ----------------------------------------

    if (graduationYear) {
      const parsedYear = Number(graduationYear);

      if (!Number.isNaN(parsedYear)) {
        filter.graduationYear = parsedYear;
      }
    }

    // ----------------------------------------
    // GET MEMORIALS
    // ----------------------------------------

    const memorials = await Memorial.find(filter)
      .select(
        "fullName photograph schoolSet yearsAttended graduationYear shortRemembrance"
      )
      .sort({
        fullName: 1,
      });

    return res.status(200).json({
      success: true,
      message: "Memorials retrieved successfully.",
      data: memorials,
    });
  } catch (error) {
    console.error(
      "Get published memorials error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while retrieving memorials.",
    });
  }
};

// ========================================
// AUTHENTICATED FULL MEMORIAL
// ========================================

export const getMemorialById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid memorial ID.",
      });
    }

    const memorial = await Memorial.findOne({
      _id: id,
      isPublished: true,
    }).populate(
      "createdBy",
      "firstName lastName"
    );

    if (!memorial) {
      return res.status(404).json({
        success: false,
        message: "Memorial not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Memorial retrieved successfully.",
      data: memorial,
    });
  } catch (error) {
    console.error(
      "Get memorial error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while retrieving the memorial.",
    });
  }
};

// ========================================
// ADMIN: GET ALL MEMORIALS
// ========================================

export const getAdminMemorials = async (req, res) => {
  try {
    const {
      search,
      status,
    } = req.query;

    const filter = {};

    // Search by name
    if (search?.trim()) {
      filter.fullName = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    // Publication status
    if (status === "published") {
      filter.isPublished = true;
    }

    if (status === "draft") {
      filter.isPublished = false;
    }

    const memorials = await Memorial.find(filter)
      .sort({
        createdAt: -1,
      })
      .populate(
        "createdBy",
        "firstName lastName"
      );

    return res.status(200).json({
      success: true,
      message: "Memorials retrieved successfully.",
      data: memorials,
    });
  } catch (error) {
    console.error(
      "Get admin memorials error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while retrieving memorials.",
    });
  }
};

// ========================================
// ADMIN: GET MEMORIAL BY ID
// ========================================

export const getAdminMemorialById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid memorial ID.",
      });
    }

    const memorial = await Memorial.findById(id)
      .populate(
        "createdBy",
        "firstName lastName"
      );

    if (!memorial) {
      return res.status(404).json({
        success: false,
        message: "Memorial not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Memorial retrieved successfully.",
      data: memorial,
    });
  } catch (error) {
    console.error(
      "Get admin memorial error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while retrieving the memorial.",
    });
  }
};

// ========================================
// ADMIN: CREATE MEMORIAL
// ========================================

export const createMemorial = async (req, res) => {
  const uploadedPublicIds = [];

  try {
    const {
      fullName,
      schoolSet,
      yearsAttended,
      graduationYear,
      shortRemembrance,
      biography,
      contributions,
      memories,
      memorialService,
      isPublished,
    } = req.body;

    // ----------------------------------------
    // REQUIRED FIELDS
    // ----------------------------------------

    if (!fullName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Full name is required.",
      });
    }

    // ----------------------------------------
    // GRADUATION YEAR VALIDATION
    // ----------------------------------------

    let parsedGraduationYear = null;

    if (
      graduationYear !== undefined &&
      graduationYear !== null &&
      graduationYear !== ""
    ) {
      parsedGraduationYear = Number(
        graduationYear
      );

      if (Number.isNaN(parsedGraduationYear)) {
        return res.status(400).json({
          success: false,
          message:
            "Graduation year must be a valid number.",
        });
      }
    }

    // ----------------------------------------
    // MAIN PHOTOGRAPH
    // ----------------------------------------

    let photograph = "";
    let photographPublicId = "";

    if (req.files?.photograph?.[0]) {
      const uploadResult =
        await uploadToCloudinary(
          req.files.photograph[0].buffer
        );

      photograph = uploadResult.secure_url;
      photographPublicId =
        uploadResult.public_id;

      uploadedPublicIds.push(
        uploadResult.public_id
      );
    }

    // ----------------------------------------
    // ADDITIONAL PHOTOS
    // ----------------------------------------

    const additionalPhotos = [];

    if (req.files?.additionalPhotos?.length) {
      for (const file of req.files.additionalPhotos) {
        const uploadResult =
          await uploadToCloudinary(file.buffer);

        additionalPhotos.push({
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        });

        uploadedPublicIds.push(
          uploadResult.public_id
        );
      }
    }

    // ----------------------------------------
    // PUBLICATION
    // ----------------------------------------

    const published =
      isPublished === true ||
      isPublished === "true";

    // ----------------------------------------
    // CREATE
    // ----------------------------------------

    const memorial =
      await Memorial.create({
        fullName: fullName.trim(),

        photograph,
        photographPublicId,

        schoolSet:
          schoolSet?.trim() || "",

        yearsAttended:
          yearsAttended?.trim() || "",

        graduationYear:
          parsedGraduationYear,

        shortRemembrance:
          shortRemembrance?.trim() || "",

        biography:
          biography?.trim() || "",

        contributions:
          contributions?.trim() || "",

        memories:
          memories?.trim() || "",

        memorialService:
          memorialService?.trim() || "",

        additionalPhotos,

        isPublished: published,

        publishedAt: published
          ? new Date()
          : null,

        createdBy: req.user.id,
      });

    return res.status(201).json({
      success: true,
      message:
        "Memorial created successfully.",
      data: memorial,
    });
  } catch (error) {
    console.error(
      "Create memorial error:",
      error
    );

    // ----------------------------------------
    // CLEANUP CLOUDINARY IF DB CREATION FAILS
    // ----------------------------------------

    await cleanupUploadedImages(
      uploadedPublicIds
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while creating the memorial.",
    });
  }
};

// ========================================
// ADMIN: UPDATE MEMORIAL
// ========================================

export const updateMemorial = async (req, res) => {
  const newlyUploadedPublicIds = [];

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid memorial ID.",
      });
    }

    const memorial =
      await Memorial.findById(id);

    if (!memorial) {
      return res.status(404).json({
        success: false,
        message: "Memorial not found.",
      });
    }

    const {
      fullName,
      schoolSet,
      yearsAttended,
      graduationYear,
      shortRemembrance,
      biography,
      contributions,
      memories,
      memorialService,
      isPublished,
      removePhotograph,
      removeAdditionalPhotoIds,
    } = req.body;

    // ----------------------------------------
    // BASIC FIELDS
    // ----------------------------------------

    if (fullName !== undefined) {
      if (!fullName.trim()) {
        return res.status(400).json({
          success: false,
          message: "Full name cannot be empty.",
        });
      }

      memorial.fullName =
        fullName.trim();
    }

    if (schoolSet !== undefined) {
      memorial.schoolSet =
        schoolSet.trim();
    }

    if (yearsAttended !== undefined) {
      memorial.yearsAttended =
        yearsAttended.trim();
    }

    if (shortRemembrance !== undefined) {
      memorial.shortRemembrance =
        shortRemembrance.trim();
    }

    if (biography !== undefined) {
      memorial.biography =
        biography.trim();
    }

    if (contributions !== undefined) {
      memorial.contributions =
        contributions.trim();
    }

    if (memories !== undefined) {
      memorial.memories =
        memories.trim();
    }

    if (memorialService !== undefined) {
      memorial.memorialService =
        memorialService.trim();
    }

    // ----------------------------------------
    // GRADUATION YEAR
    // ----------------------------------------

    if (graduationYear !== undefined) {
      if (
        graduationYear === null ||
        graduationYear === ""
      ) {
        memorial.graduationYear = null;
      } else {
        const parsedYear =
          Number(graduationYear);

        if (Number.isNaN(parsedYear)) {
          return res.status(400).json({
            success: false,
            message:
              "Graduation year must be a valid number.",
          });
        }

        memorial.graduationYear =
          parsedYear;
      }
    }

    // ----------------------------------------
    // REMOVE MAIN PHOTOGRAPH
    // ----------------------------------------

    if (
      removePhotograph === true ||
      removePhotograph === "true"
    ) {
      if (memorial.photographPublicId) {
        await deleteFromCloudinary(
          memorial.photographPublicId
        );
      }

      memorial.photograph = "";
      memorial.photographPublicId = "";
    }

    // ----------------------------------------
    // REPLACE MAIN PHOTOGRAPH
    // ----------------------------------------

    if (req.files?.photograph?.[0]) {
      const uploadResult =
        await uploadToCloudinary(
          req.files.photograph[0].buffer
        );

      newlyUploadedPublicIds.push(
        uploadResult.public_id
      );

      const oldPublicId =
        memorial.photographPublicId;

      memorial.photograph =
        uploadResult.secure_url;

      memorial.photographPublicId =
        uploadResult.public_id;

      if (oldPublicId) {
        await deleteFromCloudinary(
          oldPublicId
        );
      }
    }

    // ----------------------------------------
    // REMOVE ADDITIONAL PHOTOS
    // ----------------------------------------

    let idsToRemove = [];

    if (removeAdditionalPhotoIds) {
      try {
        idsToRemove =
          Array.isArray(
            removeAdditionalPhotoIds
          )
            ? removeAdditionalPhotoIds
            : JSON.parse(
                removeAdditionalPhotoIds
              );
      } catch {
        return res.status(400).json({
          success: false,
          message:
            "Invalid additional photo removal data.",
        });
      }
    }

    if (idsToRemove.length) {
      const photosToRemove =
        memorial.additionalPhotos.filter(
          (photo) =>
            idsToRemove.includes(
              photo.publicId
            )
        );

      await Promise.all(
        photosToRemove.map((photo) =>
          deleteFromCloudinary(
            photo.publicId
          )
        )
      );

      memorial.additionalPhotos =
        memorial.additionalPhotos.filter(
          (photo) =>
            !idsToRemove.includes(
              photo.publicId
            )
        );
    }

    // ----------------------------------------
    // ADD NEW ADDITIONAL PHOTOS
    // ----------------------------------------

    if (
      req.files?.additionalPhotos?.length
    ) {
      for (const file of
        req.files.additionalPhotos) {
        const uploadResult =
          await uploadToCloudinary(
            file.buffer
          );

        newlyUploadedPublicIds.push(
          uploadResult.public_id
        );

        memorial.additionalPhotos.push({
          url: uploadResult.secure_url,
          publicId:
            uploadResult.public_id,
        });
      }
    }

    // ----------------------------------------
    // PUBLICATION
    // ----------------------------------------

    if (isPublished !== undefined) {
      const published =
        isPublished === true ||
        isPublished === "true";

      if (
        published &&
        !memorial.isPublished
      ) {
        memorial.publishedAt =
          new Date();
      }

      if (!published) {
        memorial.publishedAt = null;
      }

      memorial.isPublished =
        published;
    }

    // ----------------------------------------
    // SAVE
    // ----------------------------------------

    await memorial.save();

    return res.status(200).json({
      success: true,
      message:
        "Memorial updated successfully.",
      data: memorial,
    });
  } catch (error) {
    console.error(
      "Update memorial error:",
      error
    );

    // ----------------------------------------
    // CLEANUP NEWLY UPLOADED FILES
    // ----------------------------------------

    await cleanupUploadedImages(
      newlyUploadedPublicIds
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while updating the memorial.",
    });
  }
};

// ========================================
// ADMIN: DELETE MEMORIAL
// ========================================

export const deleteMemorial = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid memorial ID.",
      });
    }

    const memorial =
      await Memorial.findById(id);

    if (!memorial) {
      return res.status(404).json({
        success: false,
        message: "Memorial not found.",
      });
    }

    // ----------------------------------------
    // DELETE MAIN PHOTOGRAPH
    // ----------------------------------------

    if (memorial.photographPublicId) {
      await deleteFromCloudinary(
        memorial.photographPublicId
      );
    }

    // ----------------------------------------
    // DELETE ADDITIONAL PHOTOS
    // ----------------------------------------

    const additionalPublicIds =
      memorial.additionalPhotos.map(
        (photo) => photo.publicId
      );

    await cleanupUploadedImages(
      additionalPublicIds
    );

    // ----------------------------------------
    // DELETE DATABASE RECORD
    // ----------------------------------------

    await Memorial.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message:
        "Memorial deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Delete memorial error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while deleting the memorial.",
    });
  }
};