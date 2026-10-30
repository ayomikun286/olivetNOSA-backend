
import WebsiteContent from "../../models/WebsiteContent.js";
import { createAuditLog } from "../../services/auditLog.service.js";
import { validateWebsiteContent } from "../../utils/websiteContentValidation.js";
import { WEBSITE_CONTENT_PAGES } from "../../config/websiteContent.config.js";
import cloudinary from "../../config/cloudinary.js";


const isAllowedPage = (pageKey) =>
  Object.prototype.hasOwnProperty.call(WEBSITE_CONTENT_PAGES, pageKey);

const getOrCreatePage = async (pageKey) => {
  if (!isAllowedPage(pageKey)) return null;

  let page = await WebsiteContent.findOne({ pageKey });

  if (!page) {
    page = await WebsiteContent.create({ pageKey });
  }

  return page;
};

const serializePage = (page) => ({
  pageKey: page.pageKey,
  draftContent: page.draftContent,
  publishedContent: page.publishedContent,
  isPublished: page.publishedContent !== null,
  publishedAt: page.publishedAt,
  updatedAt: page.updatedAt,
  updatedBy: page.updatedBy,
  publishedBy: page.publishedBy,
});

// GET /api/admin/website-content/:pageKey
export const getAdminWebsiteContent = async (req, res) => {
  try {
    const page = await getOrCreatePage(req.params.pageKey);

    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Unsupported website page.",
      });
    }

    return res.status(200).json({
      success: true,
      page: serializePage(page),
    });
  } catch (error) {
    console.error("Get website content error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load website content.",
    });
  }
};

// PUT /api/admin/website-content/:pageKey/draft
export const saveWebsiteContentDraft = async (req, res) => {
  try {
    const { pageKey } = req.params;
    const { content } = req.body || {};

    if (!isAllowedPage(pageKey)) {
      return res.status(404).json({
        success: false,
        message: "Unsupported website page.",
      });
    }

    const validationError = validateWebsiteContent(pageKey, content);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const page = await getOrCreatePage(pageKey);
    const previousDraft = JSON.stringify(page.draftContent || {});

    page.draftContent = content;
    page.updatedBy = req.user._id;

    await page.save();

    if (previousDraft !== JSON.stringify(content)) {
      await createAuditLog({
        actor: req.user._id,
        action: "WEBSITE_CONTENT_DRAFT_UPDATED",
        resource: "WebsiteContent",
        resourceId: page._id,
        details: { pageKey: page.pageKey },
        req,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Website content draft saved.",
      page: serializePage(page),
    });
  } catch (error) {
    console.error("Save website content draft error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save website content draft.",
    });
  }
};

// POST /api/admin/website-content/:pageKey/publish
export const publishWebsiteContent = async (req, res) => {
  try {
    const { pageKey } = req.params;

    if (!isAllowedPage(pageKey)) {
      return res.status(404).json({
        success: false,
        message: "Unsupported website page.",
      });
    }

    const page = await WebsiteContent.findOne({ pageKey });

    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Website content draft not found.",
      });
    }

    const validationError = validateWebsiteContent(
      pageKey,
      page.draftContent
    );

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    page.publishedContent = JSON.parse(
      JSON.stringify(page.draftContent)
    );
    page.publishedAt = new Date();
    page.publishedBy = req.user._id;

    await page.save();

    await createAuditLog({
      actor: req.user._id,
      action: "WEBSITE_CONTENT_PUBLISHED",
      resource: "WebsiteContent",
      resourceId: page._id,
      details: { pageKey: page.pageKey },
      req,
    });

    return res.status(200).json({
      success: true,
      message: "Website content published successfully.",
      page: serializePage(page),
    });
  } catch (error) {
    console.error("Publish website content error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to publish website content.",
    });
  }
};


// POST /api/admin/website-content/upload-image
export const uploadWebsiteContentImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select an image to upload.",
      });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "onw-nosa/website-content",
          resource_type: "image",
        },
        (error, uploadedImage) => {
          if (error) return reject(error);
          resolve(uploadedImage);
        }
      );

      stream.end(req.file.buffer);
    });

    await createAuditLog({
      actor: req.user._id,
      action: "WEBSITE_CONTENT_IMAGE_UPLOADED",
      resource: "WebsiteContent",
      details: {
        imageUrl: result.secure_url,
        publicId: result.public_id,
      },
      req,
    });

    return res.status(200).json({
      success: true,
      message: "Image uploaded successfully.",
      imageUrl: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error("Upload website content image error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload image.",
    });
  }
};