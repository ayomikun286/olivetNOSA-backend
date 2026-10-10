
import mongoose from "mongoose";
import NewsEvent from "../models/NewsEvent.js";
import cloudinary from "../config/cloudinary.js";
import { createAuditLog } from "../services/auditLog.service.js";

const CONTENT_TYPES = ["news", "event", "article"];
const VISIBILITIES = ["public", "members"];

const parseBoolean = (value) =>
  value === true || value === "true";

const uploadImage = async (file) => {
  if (!file) return null;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "olivetnosa/news-events",
        resource_type: "image",
        transformation: [
          { width: 1600, height: 900, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(file.buffer);
  });
};

const validateType = (type) =>
  CONTENT_TYPES.includes(type);

const validateVisibility = (visibility) =>
  VISIBILITIES.includes(visibility);

// ============================================================
// PUBLIC: GET PUBLISHED PUBLIC NEWS, EVENTS AND ARTICLES
// ============================================================

export const getPublishedNewsEvents = async (req, res) => {
  try {
    const { type } = req.query;

    const filter = {
      isPublished: true,
      visibility: "public",
    };

    if (type) {
      if (!validateType(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid content type.",
        });
      }

      filter.type = type;
    }

    const newsEvents = await NewsEvent.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .populate("createdBy", "firstName lastName")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Published content retrieved successfully.",
      data: newsEvents,
    });
  } catch (error) {
    console.error("Get published content error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving published content.",
    });
  }
};

// ============================================================
// PUBLIC: GET PUBLISHED PUBLIC CONTENT BY SLUG
// ============================================================

export const getPublishedNewsEventBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const newsEvent = await NewsEvent.findOne({
      slug: slug.toLowerCase(),
      isPublished: true,
      visibility: "public",
    })
      .populate("createdBy", "firstName lastName")
      .lean();

    if (!newsEvent) {
      return res.status(404).json({
        success: false,
        message: "Content not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Content retrieved successfully.",
      data: newsEvent,
    });
  } catch (error) {
    console.error("Get published content by slug error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving the content.",
    });
  }
};

// ============================================================
// MEMBER: GET PUBLISHED PUBLIC AND MEMBERS-ONLY ARTICLES
// Apply protect middleware to this route.
// ============================================================

export const getMemberArticles = async (req, res) => {
  try {
    const articles = await NewsEvent.find({
      type: "article",
      isPublished: true,
      visibility: { $in: ["public", "members"] },
    })
      .sort({ publishedAt: -1, createdAt: -1 })
      .populate("createdBy", "firstName lastName")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Articles retrieved successfully.",
      data: articles,
    });
  } catch (error) {
    console.error("Get member articles error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving articles.",
    });
  }
};

// ============================================================
// MEMBER: GET ARTICLE BY SLUG
// Apply protect middleware to this route.
// ============================================================

export const getMemberArticleBySlug = async (req, res) => {
  try {
    const article = await NewsEvent.findOne({
      slug: req.params.slug.toLowerCase(),
      type: "article",
      isPublished: true,
      visibility: { $in: ["public", "members"] },
    })
      .populate("createdBy", "firstName lastName")
      .lean();

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Article retrieved successfully.",
      data: article,
    });
  } catch (error) {
    console.error("Get member article error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving the article.",
    });
  }
};

// ============================================================
// ADMIN: CREATE NEWS, EVENT OR ARTICLE
// ============================================================

export const createNewsEvent = async (req, res) => {
  let uploadedPublicId = null;

  try {
    const {
      title,
      slug,
      type,
      category,
      excerpt,
      content,
      visibility,
      eventDate,
      startTime,
      endTime,
      location,
      registrationUrl,
      isPublished,
      isFeatured,
    } = req.body;

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title is required.",
      });
    }

    if (!validateType(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be news, event or article.",
      });
    }

    if (typeof slug !== "string" || !slug.trim()) {
      return res.status(400).json({
        success: false,
        message: "Slug is required.",
      });
    }

    if (
      visibility !== undefined &&
      !validateVisibility(visibility)
    ) {
      return res.status(400).json({
        success: false,
        message: "Visibility must be public or members.",
      });
    }

    if (type === "event" && !eventDate) {
      return res.status(400).json({
        success: false,
        message: "Event date is required for events.",
      });
    }

    if (
      type === "event" &&
      (!Number.isFinite(new Date(eventDate).getTime()))
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid event date.",
      });
    }

    const cleanSlug = slug.trim().toLowerCase();

    const existing = await NewsEvent.findOne({ slug: cleanSlug });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A news item, event or article with this slug already exists.",
      });
    }

    const uploadResult = await uploadImage(req.file);

    if (uploadResult) {
      uploadedPublicId = uploadResult.public_id;
    }

    const published = parseBoolean(isPublished);
    const featured = parseBoolean(isFeatured);

    const newsEvent = await NewsEvent.create({
      title: title.trim(),
      slug: cleanSlug,
      type,
      category:
        typeof category === "string" ? category.trim() : "",
      excerpt:
        typeof excerpt === "string" ? excerpt.trim() : "",
      content:
        typeof content === "string" ? content.trim() : "",
      visibility: visibility || "public",
      image: uploadResult?.secure_url || "",
      imagePublicId: uploadResult?.public_id || "",
      eventDate: type === "event" ? new Date(eventDate) : null,
      startTime:
        typeof startTime === "string" ? startTime.trim() : "",
      endTime:
        typeof endTime === "string" ? endTime.trim() : "",
      location:
        typeof location === "string" ? location.trim() : "",
      registrationUrl:
        typeof registrationUrl === "string"
          ? registrationUrl.trim()
          : "",
      isPublished: published,
      isFeatured: featured,
      publishedAt: published ? new Date() : null,
      createdBy: req.user.id,
    });

    await createAuditLog({
      actor: req.user.id,
      action: "news_event.created",
      resource: "NewsEvent",
      resourceId: newsEvent._id,
      req,
      details: {
        title: newsEvent.title,
        slug: newsEvent.slug,
        type: newsEvent.type,
        visibility: newsEvent.visibility,
        isPublished: newsEvent.isPublished,
        isFeatured: newsEvent.isFeatured,
        hasImage: Boolean(newsEvent.image),
      },
    });

    return res.status(201).json({
      success: true,
      message: "Content created successfully.",
      data: newsEvent,
    });
  } catch (error) {
    // Avoid leaving an uploaded image behind if creation fails.
    if (uploadedPublicId) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId, {
          resource_type: "image",
        });
      } catch (cleanupError) {
        console.error("Cloudinary cleanup error:", cleanupError);
      }
    }

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "That slug is already in use.",
      });
    }

    console.error("Create content error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while creating the content.",
    });
  }
};

// ============================================================
// ADMIN: GET ALL CONTENT
// ============================================================

export const getAdminNewsEvents = async (req, res) => {
  try {
    const { type, status, visibility } = req.query;
    const filter = {};

    if (type) {
      if (!validateType(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid content type.",
        });
      }

      filter.type = type;
    }

    if (status === "published") filter.isPublished = true;
    if (status === "draft") filter.isPublished = false;

    if (visibility) {
      if (!validateVisibility(visibility)) {
        return res.status(400).json({
          success: false,
          message: "Invalid visibility.",
        });
      }

      filter.visibility = visibility;
    }

    const newsEvents = await NewsEvent.find(filter)
      .sort({ createdAt: -1 })
      .populate("createdBy", "firstName lastName")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Content retrieved successfully.",
      data: newsEvents,
    });
  } catch (error) {
    console.error("Get admin content error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving content.",
    });
  }
};

// ============================================================
// ADMIN: UPDATE NEWS, EVENT OR ARTICLE
// ============================================================

export const updateNewsEvent = async (req, res) => {
  let uploadedPublicId = null;

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid content ID.",
      });
    }

    const newsEvent = await NewsEvent.findById(id);

    if (!newsEvent) {
      return res.status(404).json({
        success: false,
        message: "Content not found.",
      });
    }

    const {
      title,
      slug,
      type,
      category,
      excerpt,
      content,
      visibility,
      eventDate,
      startTime,
      endTime,
      location,
      registrationUrl,
      isPublished,
      isFeatured,
    } = req.body;

    if (type !== undefined && !validateType(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be news, event or article.",
      });
    }

    if (
      visibility !== undefined &&
      !validateVisibility(visibility)
    ) {
      return res.status(400).json({
        success: false,
        message: "Visibility must be public or members.",
      });
    }

    if (slug !== undefined) {
      if (typeof slug !== "string" || !slug.trim()) {
        return res.status(400).json({
          success: false,
          message: "Slug cannot be empty.",
        });
      }

      const cleanSlug = slug.trim().toLowerCase();

      const existing = await NewsEvent.findOne({
        slug: cleanSlug,
        _id: { $ne: id },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "That slug is already in use.",
        });
      }

      newsEvent.slug = cleanSlug;
    }

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Title cannot be empty.",
        });
      }

      newsEvent.title = title.trim();
    }

    if (type !== undefined) newsEvent.type = type;
    if (visibility !== undefined) newsEvent.visibility = visibility;

    if (category !== undefined) {
      newsEvent.category =
        typeof category === "string" ? category.trim() : "";
    }

    if (excerpt !== undefined) {
      newsEvent.excerpt =
        typeof excerpt === "string" ? excerpt.trim() : "";
    }

    if (content !== undefined) {
      newsEvent.content =
        typeof content === "string" ? content.trim() : "";
    }

    if (eventDate !== undefined) {
      if (eventDate && !Number.isFinite(new Date(eventDate).getTime())) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid event date.",
        });
      }

      newsEvent.eventDate = eventDate ? new Date(eventDate) : null;
    }

    if (newsEvent.type === "event" && !newsEvent.eventDate) {
      return res.status(400).json({
        success: false,
        message: "Event date is required for events.",
      });
    }

    if (startTime !== undefined) {
      newsEvent.startTime =
        typeof startTime === "string" ? startTime.trim() : "";
    }

    if (endTime !== undefined) {
      newsEvent.endTime =
        typeof endTime === "string" ? endTime.trim() : "";
    }

    if (location !== undefined) {
      newsEvent.location =
        typeof location === "string" ? location.trim() : "";
    }

    if (registrationUrl !== undefined) {
      newsEvent.registrationUrl =
        typeof registrationUrl === "string"
          ? registrationUrl.trim()
          : "";
    }

    if (req.file) {
      const uploadResult = await uploadImage(req.file);
      uploadedPublicId = uploadResult.public_id;

      const previousPublicId = newsEvent.imagePublicId;

      newsEvent.image = uploadResult.secure_url;
      newsEvent.imagePublicId = uploadResult.public_id;

      // Delete the old image only after the new one has uploaded.
      if (
        previousPublicId &&
        previousPublicId !== uploadResult.public_id
      ) {
        try {
          await cloudinary.uploader.destroy(previousPublicId, {
            resource_type: "image",
          });
        } catch (cleanupError) {
          console.error("Old image cleanup error:", cleanupError);
        }
      }

      uploadedPublicId = null;
    }

    if (isPublished !== undefined) {
      const published = parseBoolean(isPublished);

      if (published && !newsEvent.isPublished) {
        newsEvent.publishedAt = new Date();
      } else if (!published) {
        newsEvent.publishedAt = null;
      }

      newsEvent.isPublished = published;
    }

    if (isFeatured !== undefined) {
      newsEvent.isFeatured = parseBoolean(isFeatured);
    }

    const changedFields = newsEvent.modifiedPaths();

    await newsEvent.save();

    if (changedFields.length > 0) {
      await createAuditLog({
        actor: req.user.id,
        action: "news_event.updated",
        resource: "NewsEvent",
        resourceId: newsEvent._id,
        req,
        details: {
          title: newsEvent.title,
          slug: newsEvent.slug,
          type: newsEvent.type,
          visibility: newsEvent.visibility,
          changedFields,
          isPublished: newsEvent.isPublished,
          isFeatured: newsEvent.isFeatured,
          hasImage: Boolean(newsEvent.image),
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Content updated successfully.",
      data: newsEvent,
    });
  } catch (error) {
    if (uploadedPublicId) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId, {
          resource_type: "image",
        });
      } catch (cleanupError) {
        console.error("Cloudinary cleanup error:", cleanupError);
      }
    }

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "That slug is already in use.",
      });
    }

    console.error("Update content error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while updating the content.",
    });
  }
};

// ============================================================
// ADMIN: DELETE NEWS, EVENT OR ARTICLE
// ============================================================

export const deleteNewsEvent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid content ID.",
      });
    }

    const newsEvent = await NewsEvent.findById(id);

    if (!newsEvent) {
      return res.status(404).json({
        success: false,
        message: "Content not found.",
      });
    }

    const deletedDetails = {
      title: newsEvent.title,
      slug: newsEvent.slug,
      type: newsEvent.type,
      visibility: newsEvent.visibility,
      wasPublished: newsEvent.isPublished,
      wasFeatured: newsEvent.isFeatured,
      hadImage: Boolean(newsEvent.image),
    };

    // Delete the record first; image cleanup should not block deletion.
    await NewsEvent.findByIdAndDelete(id);

    if (newsEvent.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(newsEvent.imagePublicId, {
          resource_type: "image",
        });
      } catch (imageError) {
        console.error("Cloudinary image deletion error:", imageError);
      }
    }

    await createAuditLog({
      actor: req.user.id,
      action: "news_event.deleted",
      resource: "NewsEvent",
      resourceId: newsEvent._id,
      req,
      details: deletedDetails,
    });

    return res.status(200).json({
      success: true,
      message: "Content deleted successfully.",
    });
  } catch (error) {
    console.error("Delete content error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while deleting the content.",
    });
  }
};
