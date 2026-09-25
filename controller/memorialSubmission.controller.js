import mongoose from "mongoose";

import Memorial from "../models/Memorial.js";
import MemorialSubmission from "../models/MemorialSubmission.js";

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

export const getMyMemorialSubmissions =
  async (req, res) => {
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

export const getAdminMemorialSubmissions =
  async (req, res) => {
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

export const getAdminMemorialSubmissionById =
  async (req, res) => {
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

export const reviewMemorialSubmission =
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        status,
        adminNotes,
      } = req.body;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid submission ID.",
        });
      }

      if (
        !["approved", "rejected"].includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Status must be approved or rejected.",
        });
      }

      const submission =
        await MemorialSubmission.findById(
          id
        );

      if (!submission) {
        return res.status(404).json({
          success: false,
          message:
            "Memorial submission not found.",
        });
      }

      if (
        submission.status !== "pending"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This submission has already been reviewed.",
        });
      }

      submission.status = status;

      submission.reviewedBy =
        req.user.id;

      submission.reviewedAt =
        new Date();

      submission.adminNotes =
        adminNotes?.trim() || "";

      await submission.save();

      return res.status(200).json({
        success: true,
        message:
          status === "approved"
            ? "Memorial submission approved successfully."
            : "Memorial submission rejected successfully.",
        data: submission,
      });
    } catch (error) {
      console.error(
        "Review memorial submission error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Something went wrong while reviewing the submission.",
      });
    }
  };