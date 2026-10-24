import mongoose from "mongoose";

import Memorial from "../models/Memorial.js";
import MemorialSubmission from "../models/MemorialSubmission.js";
import { createAuditLog } from "../services/auditLog.service.js";
import cloudinary from "../config/cloudinary.js";


// ========================================
// HELPER: UPLOAD TO CLOUDINARY
// ========================================

const uploadSubmissionImage = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream =
      cloudinary.uploader.upload_stream(
        {
          folder:
            "olivetnosa/memorial-submissions",

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
// HELPER: DELETE IMAGE
// ========================================

const deleteSubmissionImage = async (
  publicId
) => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(
      publicId,
      {
        resource_type: "image",
      }
    );
  } catch (error) {
    console.error(
      `Failed to delete submission image ${publicId}:`,
      error
    );
  }
};


// ========================================
// MEMBER: CREATE SUBMISSION
// ========================================

export const createMemorialSubmission =
  async (req, res) => {
    const uploadedPublicIds = [];

    try {
      const {
        memorial,
        suggestedFullName,
        suggestedSchoolSet,
        suggestedYearsAttended,
        suggestedGraduationYear,
        submissionType,
        message,
      } = req.body;

      // ----------------------------------------
      // SUBMISSION TYPE
      // ----------------------------------------

      const allowedTypes = [
        "photograph",
        "biography",
        "condolence",
        "correction",
        "new_memorial",
      ];

      if (
        !submissionType ||
        !allowedTypes.includes(submissionType)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A valid submission type is required.",
        });
      }

      // ----------------------------------------
      // MESSAGE
      // ----------------------------------------

      if (!message?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Please provide the information you would like to share.",
        });
      }

      // ----------------------------------------
      // EXISTING MEMORIAL
      // ----------------------------------------

      let memorialId = null;

      if (memorial) {
        if (
          !mongoose.Types.ObjectId.isValid(
            memorial
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid memorial ID.",
          });
        }

        const existingMemorial =
          await Memorial.findOne({
            _id: memorial,
            isPublished: true,
          });

        if (!existingMemorial) {
          return res.status(404).json({
            success: false,
            message:
              "The selected memorial was not found.",
          });
        }

        memorialId = existingMemorial._id;
      }

      // ----------------------------------------
      // NEW MEMORIAL VALIDATION
      // ----------------------------------------

      if (
        submissionType === "new_memorial"
      ) {
        if (!suggestedFullName?.trim()) {
          return res.status(400).json({
            success: false,
            message:
              "The person's full name is required.",
          });
        }
      }

      // ----------------------------------------
      // UPLOAD PHOTOGRAPHS
      // ----------------------------------------

      const photographs = [];

      if (
        req.files?.photographs?.length
      ) {
        for (const file of req.files.photographs) {
          const uploadResult =
            await uploadSubmissionImage(
              file.buffer
            );

          photographs.push({
            url: uploadResult.secure_url,
            publicId:
              uploadResult.public_id,
          });

          uploadedPublicIds.push(
            uploadResult.public_id
          );
        }
      }

      // ----------------------------------------
      // GRADUATION YEAR
      // ----------------------------------------

      let parsedGraduationYear = null;

      if (
        suggestedGraduationYear !==
          undefined &&
        suggestedGraduationYear !== null &&
        suggestedGraduationYear !== ""
      ) {
        parsedGraduationYear = Number(
          suggestedGraduationYear
        );

        if (
          Number.isNaN(
            parsedGraduationYear
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Graduation year must be a valid number.",
          });
        }
      }

      // ----------------------------------------
      // CREATE SUBMISSION
      // ----------------------------------------

      const submission =
        await MemorialSubmission.create({
          memorial: memorialId,

          suggestedFullName:
            suggestedFullName?.trim() || "",

          suggestedSchoolSet:
            suggestedSchoolSet?.trim() || "",

          suggestedYearsAttended:
            suggestedYearsAttended?.trim() ||
            "",

          suggestedGraduationYear:
            parsedGraduationYear,

          submittedBy: req.user.id,

          submissionType,

          message: message.trim(),

          photographs,

          status: "pending",
        });


        // AUDIT LOG
await createAuditLog({
  actor: req.user.id,
  action: "memorial_submission.created",
  resource: "MemorialSubmission",
  resourceId: submission._id,
  targetUser: req.user.id,
  req,
  details: {
    submissionType: submission.submissionType,
    status: submission.status,
    memorialId: submission.memorial || null,
    suggestedFullName:
      submission.suggestedFullName || "",
    photographCount: submission.photographs.length,
  },
});

      return res.status(201).json({
        success: true,
        message:
          "Your remembrance has been submitted and is awaiting review.",
        data: submission,
      });
    } catch (error) {
      console.error(
        "Create memorial submission error:",
        error
      );

      // ----------------------------------------
      // CLEANUP CLOUDINARY
      // ----------------------------------------

      await Promise.all(
        uploadedPublicIds.map((publicId) =>
          deleteSubmissionImage(publicId)
        )
      );

      return res.status(500).json({
        success: false,
        message:
          "Something went wrong while submitting your remembrance.",
      });
    }
  };


// ========================================
// MEMBER: GET MY SUBMISSIONS
// ========================================



export const getMyMemorialSubmissions = async (req, res) => {
    try {
      const submissions =
        await MemorialSubmission.find({
          submittedBy: req.user.id,
        })
          .sort({
            createdAt: -1,
          })
          .populate(
            "memorial",
            "fullName photograph schoolSet"
          );

      return res.status(200).json({
        success: true,
        message:
          "Your memorial submissions were retrieved successfully.",
        data: submissions,
      });
    } catch (error) {
      console.error(
        "Get my memorial submissions error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Something went wrong while retrieving your submissions.",
      });
    }
  };


// ========================================
// ADMIN: GET SUBMISSIONS
// ========================================

export const getAdminMemorialSubmissions = async (req, res) => {
    try {
      const {
        status,
        submissionType,
        search,
      } = req.query;

      const filter = {};

      if (status) {
        filter.status = status;
      }

      if (submissionType) {
        filter.submissionType =
          submissionType;
      }

      if (search?.trim()) {
        filter.$or = [
          {
            suggestedFullName: {
              $regex: search.trim(),
              $options: "i",
            },
          },
        ];
      }

      const submissions =
        await MemorialSubmission.find(
          filter
        )
          .sort({
            createdAt: -1,
          })
          .populate(
            "submittedBy",
            "firstName lastName email"
          )
          .populate(
            "memorial",
            "fullName photograph schoolSet"
          )
          .populate(
            "reviewedBy",
            "firstName lastName"
          );

      return res.status(200).json({
        success: true,
        message:
          "Memorial submissions retrieved successfully.",
        data: submissions,
      });
    } catch (error) {
      console.error(
        "Get admin memorial submissions error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Something went wrong while retrieving submissions.",
      });
    }
  };


// ========================================
// ADMIN: GET SUBMISSION BY ID
// ========================================

export const getAdminMemorialSubmissionById = async (req, res) => {
    try {
      const { id } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid submission ID.",
        });
      }

      const submission =
        await MemorialSubmission.findById(
          id
        )
          .populate(
            "submittedBy",
            "firstName lastName email"
          )
          .populate(
            "memorial",
            "fullName photograph schoolSet yearsAttended graduationYear"
          )
          .populate(
            "reviewedBy",
            "firstName lastName"
          );

      if (!submission) {
        return res.status(404).json({
          success: false,
          message:
            "Memorial submission not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Memorial submission retrieved successfully.",
        data: submission,
      });
    } catch (error) {
      console.error(
        "Get admin memorial submission error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Something went wrong while retrieving the submission.",
      });
    }
  };


// ========================================
// ADMIN: REVIEW SUBMISSION
// ========================================

export const reviewMemorialSubmission = async (req, res) => {
  const { id } = req.params;
  const { status, adminNotes } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid submission ID.",
    });
  }

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be approved or rejected.",
    });
  }

  const session = await mongoose.startSession();

  let approvedMemorialId = null;

  try {
    await session.withTransaction(async () => {
      const submission = await MemorialSubmission.findById(id).session(
        session
      );

      if (!submission) {
        const error = new Error("Memorial submission not found.");
        error.statusCode = 404;
        throw error;
      }

      if (submission.status !== "pending") {
        const error = new Error(
          "This submission has already been reviewed."
        );
        error.statusCode = 400;
        throw error;
      }

      // Rejected submissions retain their uploaded photos and history.
      if (status === "rejected") {
        submission.status = "rejected";
        submission.reviewedBy = req.user.id;
        submission.reviewedAt = new Date();
        submission.adminNotes = adminNotes?.trim() || "";

        await submission.save({ session });
        return;
      }

      const photos = submission.photographs || [];

      // Apply an approved submission to an existing memorial.
      if (
        ["photograph", "biography", "correction"].includes(
          submission.submissionType
        )
      ) {
        if (!submission.memorial) {
          const error = new Error(
            "This submission must be linked to a memorial before approval."
          );
          error.statusCode = 400;
          throw error;
        }

        const memorial = await Memorial.findById(
          submission.memorial
        ).session(session);

        if (!memorial) {
          const error = new Error(
            "The associated memorial could not be found."
          );
          error.statusCode = 404;
          throw error;
        }

        if (submission.submissionType === "photograph") {
          if (photos.length === 0) {
            const error = new Error(
              "This submission contains no photographs."
            );
            error.statusCode = 400;
            throw error;
          }

          const existingPhotos = memorial.additionalPhotos || [];

          const newPhotos = photos.filter(
            (photo) =>
              photo.url &&
              photo.publicId &&
              !existingPhotos.some(
                (existing) => existing.publicId === photo.publicId
              )
          );

          if (existingPhotos.length + newPhotos.length > 10) {
            const error = new Error(
              "Approving these photographs would exceed the 10-photo limit."
            );
            error.statusCode = 400;
            throw error;
          }

          memorial.additionalPhotos.push(...newPhotos);
        }

        if (submission.submissionType === "biography") {
          if (!submission.message?.trim()) {
            const error = new Error(
              "The biography submission has no content."
            );
            error.statusCode = 400;
            throw error;
          }

          memorial.biography = submission.message.trim();
        }

        if (submission.submissionType === "correction") {
          let hasCorrection = false;

          if (submission.suggestedFullName?.trim()) {
            memorial.fullName = submission.suggestedFullName.trim();
            hasCorrection = true;
          }

          if (submission.suggestedSchoolSet?.trim()) {
            memorial.schoolSet = submission.suggestedSchoolSet.trim();
            hasCorrection = true;
          }

          if (submission.suggestedYearsAttended?.trim()) {
            memorial.yearsAttended =
              submission.suggestedYearsAttended.trim();
            hasCorrection = true;
          }

          const suggestedYear = submission.suggestedGraduationYear;

          if (
            suggestedYear !== null &&
            suggestedYear !== undefined &&
            suggestedYear !== ""
          ) {
            const year = Number(suggestedYear);

            if (
              !Number.isInteger(year) ||
              year < 1900 ||
              year > new Date().getFullYear()
            ) {
              const error = new Error(
                "The suggested graduation year is invalid."
              );
              error.statusCode = 400;
              throw error;
            }

            memorial.graduationYear = year;
            hasCorrection = true;
          }

          if (!hasCorrection) {
            const error = new Error(
              "No suggested corrections were provided."
            );
            error.statusCode = 400;
            throw error;
          }
        }

        await memorial.save({ session });
        approvedMemorialId = memorial._id;
      }

      // Create new memorials as unpublished drafts.
      if (submission.submissionType === "new_memorial") {
        if (!submission.suggestedFullName?.trim()) {
          const error = new Error(
            "A full name is required to create a memorial."
          );
          error.statusCode = 400;
          throw error;
        }

        const suggestedYear = submission.suggestedGraduationYear;
        let graduationYear = null;

        if (
          suggestedYear !== null &&
          suggestedYear !== undefined &&
          suggestedYear !== ""
        ) {
          graduationYear = Number(suggestedYear);

          if (
            !Number.isInteger(graduationYear) ||
            graduationYear < 1900 ||
            graduationYear > new Date().getFullYear()
          ) {
            const error = new Error(
              "The suggested graduation year is invalid."
            );
            error.statusCode = 400;
            throw error;
          }
        }

        const [primaryPhoto, ...remainingPhotos] = photos;

        const [newMemorial] = await Memorial.create(
          [
            {
              fullName: submission.suggestedFullName.trim(),
              schoolSet: submission.suggestedSchoolSet?.trim() || "",
              yearsAttended:
                submission.suggestedYearsAttended?.trim() || "",
              graduationYear,
              shortRemembrance: submission.message?.trim() || "",
              photograph: primaryPhoto?.url || "",
              photographPublicId: primaryPhoto?.publicId || "",
              additionalPhotos: remainingPhotos
                .filter((photo) => photo.url && photo.publicId)
                .map((photo) => ({
                  url: photo.url,
                  publicId: photo.publicId,
                })),
              isPublished: false,
              publishedAt: null,
              createdBy: req.user.id,
            },
          ],
          { session }
        );

        approvedMemorialId = newMemorial._id;
      }

      // Condolences are approved as submissions but do not overwrite
      // memorial content. A separate display feature can show them later.
      submission.status = "approved";
      submission.reviewedBy = req.user.id;
      submission.reviewedAt = new Date();
      submission.adminNotes = adminNotes?.trim() || "";

      await submission.save({ session });
    });

    // Audit logging must not undo a successful database approval.
    try {
      await createAuditLog({
        actor: req.user.id,
        action:
          status === "approved"
            ? "APPROVE_MEMORIAL_SUBMISSION"
            : "REJECT_MEMORIAL_SUBMISSION",
        resource: "MemorialSubmission",
        resourceId: id,
        targetUser: undefined,
        details: {
          status,
          submissionType: (
            await MemorialSubmission.findById(id).select("submissionType")
          )?.submissionType,
          memorialId: approvedMemorialId?.toString() || null,
          adminNotes: adminNotes?.trim() || "",
        },
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });
    } catch (auditError) {
      console.error(
        "Memorial submission review audit failed:",
        auditError
      );
    }

    return res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? "Memorial submission approved successfully."
          : "Memorial submission rejected successfully.",
      data: {
        submissionId: id,
        status,
        memorialId: approvedMemorialId,
      },
    });
  } catch (error) {
    console.error("Review memorial submission error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Failed to review memorial submission.",
    });
  } finally {
    await session.endSession();
  }
};


export const getApprovedMemorialCondolences = async (req, res) => {
  try {
    const { memorialId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(memorialId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid memorial ID.",
      });
    }

    const memorialExists = await Memorial.exists({
      _id: memorialId,
      isPublished: true,
    });

    if (!memorialExists) {
      return res.status(404).json({
        success: false,
        message: "Memorial not found.",
      });
    }

    const condolences = await MemorialSubmission.find({
      memorial: memorialId,
      submissionType: "condolence",
      status: "approved",
    })
      .select("message submittedBy createdAt")
      .populate("submittedBy", "firstName middleName lastName")
      .sort({ reviewedAt: -1, createdAt: -1 })
      .lean();

    const data = condolences.map((item) => ({
      _id: item._id,
      message: item.message,
      createdAt: item.createdAt,
      contributorName: item.submittedBy
        ? [
            item.submittedBy.firstName,
            item.submittedBy.middleName,
            item.submittedBy.lastName,
          ]
            .filter(Boolean)
            .join(" ")
        : "Olive­tian",
    }));

    return res.status(200).json({
      success: true,
      message: "Approved condolences retrieved successfully.",
      data,
    });
  } catch (error) {
    console.error("Get approved memorial condolences error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve condolences.",
    });
  }
};