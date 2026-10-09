import mongoose from "mongoose";
import NewsEvent from "../models/NewsEvent.js";
import cloudinary from "../config/cloudinary.js";
import { createAuditLog } from "../services/auditLog.service.js";

// ============================================================
// PUBLIC: GET PUBLISHED NEWS AND EVENTS
// ============================================================

export const getPublishedNewsEvents = async (req, res) => {
  try {
    const { type } = req.query;

    const filter = { isPublished: true };

    if (type && ["news", "event"].includes(type)) {
      filter.type = type;
    }

    const newsEvents = await NewsEvent.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .populate("createdBy", "firstName lastName");

    return res.status(200).json({
      success: true,
      message: "News and events retrieved successfully.",
      data: newsEvents,
    });
  } catch (error) {
    console.error("Get published news/events error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving news and events.",
    });
  }
};

// ============================================================
// PUBLIC: GET PUBLISHED NEWS OR EVENT BY SLUG
// ============================================================

export const getPublishedNewsEventBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const newsEvent = await NewsEvent.findOne({
      slug,
      isPublished: true,
    }).populate("createdBy", "firstName lastName");

    if (!newsEvent) {
      return res.status(404).json({
        success: false,
        message: "News or event not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "News or event retrieved successfully.",
      data: newsEvent,
    });
  } catch (error) {
    console.error("Get published news/event error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving the news or event.",
    });
  }
};

// ============================================================
// ADMIN: CREATE NEWS OR EVENT
// ============================================================

export const createNewsEvent = async (req, res) => {
  try {
    const {
      title,
      slug,
      type,
      category,
      excerpt,
      content,
      eventDate,
      startTime,
      endTime,
      location,
      registrationUrl,
      isPublished,
      isFeatured,
    } = req.body;

    // REQUIRED FIELDS
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title is required.",
      });
    }

    if (!type || !["news", "event"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be either news or event.",
      });
    }

    if (typeof slug !== "string" || !slug.trim()) {
      return res.status(400).json({
        success: false,
        message: "Slug is required.",
      });
    }

    if (type === "event" && !eventDate) {
      return res.status(400).json({
        success: false,
        message: "Event date is required for events.",
      });
    }

    // CHECK DUPLICATE SLUG
    const cleanSlug = slug.trim().toLowerCase();

    const existingNewsEvent = await NewsEvent.findOne({
      slug: cleanSlug,
    });

    if (existingNewsEvent) {
      return res.status(409).json({
        success: false,
        message: "A news or event with this slug already exists.",
      });
    }

    // UPLOAD IMAGE
    let imageUrl = "";
    let imagePublicId = "";

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "olivetnosa/news-events",
            resource_type: "image",
            transformation: [
              {
                width: 1600,
                height: 900,
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

        stream.end(req.file.buffer);
      });

      imageUrl = uploadResult.secure_url;
      imagePublicId = uploadResult.public_id;
    }

    const published =
      isPublished === true || isPublished === "true";

    const featured =
      isFeatured === true || isFeatured === "true";

    // CREATE RECORD
    const newsEvent = await NewsEvent.create({
      title: title.trim(),
      slug: cleanSlug,
      type,
      category: category?.trim() || "",
      excerpt: excerpt?.trim() || "",
      content: content?.trim() || "",
      image: imageUrl,
      imagePublicId,
      eventDate: eventDate || null,
      startTime: startTime?.trim() || "",
      endTime: endTime?.trim() || "",
      location: location?.trim() || "",
      registrationUrl: registrationUrl?.trim() || "",
      isPublished: published,
      isFeatured: featured,
      publishedAt: published ? new Date() : null,
      createdBy: req.user.id,
    });

    // AUDIT LOG
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
        isPublished: newsEvent.isPublished,
        isFeatured: newsEvent.isFeatured,
        hasImage: Boolean(newsEvent.image),
      },
    });

    return res.status(201).json({
      success: true,
      message: "News or event created successfully.",
      data: newsEvent,
    });
  } catch (error) {
    console.error("Create news/event error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while creating the news or event.",
    });
  }
};

// ============================================================
// ADMIN: GET NEWS AND EVENTS
// ============================================================

export const getAdminNewsEvents = async (req, res) => {
  try {
    const { type, status } = req.query;

    const filter = {};

    if (type && ["news", "event"].includes(type)) {
      filter.type = type;
    }

    if (status === "published") {
      filter.isPublished = true;
    }

    if (status === "draft") {
      filter.isPublished = false;
    }

    const newsEvents = await NewsEvent.find(filter)
      .sort({ createdAt: -1 })
      .populate("createdBy", "firstName lastName");

    return res.status(200).json({
      success: true,
      message: "News and events retrieved successfully.",
      data: newsEvents,
    });
  } catch (error) {
    console.error("Get admin news/events error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving news and events.",
    });
  }
};

// ============================================================
// ADMIN: UPDATE NEWS OR EVENT
// ============================================================

export const updateNewsEvent = async (req, res) => {
  try {
    const { id } = req.params;

    // ID VALIDATION
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid news or event ID.",
      });
    }

    const newsEvent = await NewsEvent.findById(id);

    if (!newsEvent) {
      return res.status(404).json({
        success: false,
        message: "News or event not found.",
      });
    }

    const {
      title,
      slug,
      type,
      category,
      excerpt,
      content,
      eventDate,
      startTime,
      endTime,
      location,
      registrationUrl,
      isPublished,
      isFeatured,
    } = req.body;

    // TYPE VALIDATION
    if (type !== undefined && !["news", "event"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be either news or event.",
      });
    }

    // SLUG
    if (slug !== undefined) {
      if (typeof slug !== "string" || !slug.trim()) {
        return res.status(400).json({
          success: false,
          message: "Slug cannot be empty.",
        });
      }

      const cleanSlug = slug.trim().toLowerCase();

      const existingNewsEvent = await NewsEvent.findOne({
        slug: cleanSlug,
        _id: { $ne: id },
      });

      if (existingNewsEvent) {
        return res.status(409).json({
          success: false,
          message: "A news or event with this slug already exists.",
        });
      }

      newsEvent.slug = cleanSlug;
    }

    // TITLE
    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Title cannot be empty.",
        });
      }

      newsEvent.title = title.trim();
    }

    // BASIC CONTENT
    if (type !== undefined) newsEvent.type = type;
    if (category !== undefined) newsEvent.category = category.trim();
    if (excerpt !== undefined) newsEvent.excerpt = excerpt.trim();
    if (content !== undefined) newsEvent.content = content.trim();

    // EVENT DETAILS
    if (eventDate !== undefined) {
      newsEvent.eventDate = eventDate || null;
    }

    if (startTime !== undefined) {
      newsEvent.startTime = startTime.trim();
    }

    if (endTime !== undefined) {
      newsEvent.endTime = endTime.trim();
    }

    if (location !== undefined) {
      newsEvent.location = location.trim();
    }

    if (registrationUrl !== undefined) {
      newsEvent.registrationUrl = registrationUrl.trim();
    }

    // IMAGE UPLOAD
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "olivetnosa/news-events",
            resource_type: "image",
            transformation: [
              {
                width: 1600,
                height: 900,
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

        stream.end(req.file.buffer);
      });

      newsEvent.image = uploadResult.secure_url;
      newsEvent.imagePublicId = uploadResult.public_id;
    }

    // PUBLICATION STATUS
    if (isPublished !== undefined) {
      const published =
        isPublished === true || isPublished === "true";

      if (published && !newsEvent.isPublished) {
        newsEvent.publishedAt = new Date();
      }

      if (!published) {
        newsEvent.publishedAt = null;
      }

      newsEvent.isPublished = published;
    }

    // FEATURED STATUS
    if (isFeatured !== undefined) {
      newsEvent.isFeatured =
        isFeatured === true || isFeatured === "true";
    }

    // CAPTURE CHANGED FIELDS BEFORE SAVING
    const changedFields = newsEvent.modifiedPaths();

    await newsEvent.save();

    // AUDIT LOG
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
          changedFields,
          isPublished: newsEvent.isPublished,
          isFeatured: newsEvent.isFeatured,
          hasImage: Boolean(newsEvent.image),
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "News or event updated successfully.",
      data: newsEvent,
    });
  } catch (error) {
    console.error("Update news/event error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while updating the news or event.",
    });
  }
};

// ============================================================
// ADMIN: DELETE NEWS OR EVENT
// ============================================================

export const deleteNewsEvent = async (req, res) => {
  try {
    const { id } = req.params;

    // ID VALIDATION
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid news or event ID.",
      });
    }

    const newsEvent = await NewsEvent.findById(id);

    if (!newsEvent) {
      return res.status(404).json({
        success: false,
        message: "News or event not found.",
      });
    }

    // KEEP DETAILS FOR THE AUDIT RECORD
    const deletedDetails = {
      title: newsEvent.title,
      slug: newsEvent.slug,
      type: newsEvent.type,
      wasPublished: newsEvent.isPublished,
      wasFeatured: newsEvent.isFeatured,
      hadImage: Boolean(newsEvent.image),
    };

    // DELETE IMAGE FROM CLOUDINARY
    if (newsEvent.imagePublicId) {
      await cloudinary.uploader.destroy(
        newsEvent.imagePublicId,
        { resource_type: "image" }
      );
    }

    // DELETE DATABASE RECORD
    await NewsEvent.findByIdAndDelete(id);

    // AUDIT LOG
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
      message: "News or event deleted successfully.",
    });
  } catch (error) {
    console.error("Delete news/event error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while deleting the news or event.",
    });
  }
};