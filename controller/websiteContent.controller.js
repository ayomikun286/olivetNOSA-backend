
import WebsiteContent from "../models/WebsiteContent.js";
import { WEBSITE_CONTENT_PAGES } from "../config/websiteContent.config.js";

const isAllowedPage = (pageKey) =>
  Object.prototype.hasOwnProperty.call(WEBSITE_CONTENT_PAGES, pageKey);

// GET /api/content/:pageKey
export const getPublicWebsiteContent = async (req, res) => {
  try {
    const { pageKey } = req.params;

    if (!isAllowedPage(pageKey)) {
      return res.status(404).json({
        success: false,
        message: "Unsupported website page.",
      });
    }

    const page = await WebsiteContent.findOne({
      pageKey,
      publishedContent: { $ne: null },
    }).select("pageKey publishedContent publishedAt");

    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Published page content not found.",
      });
    }

    return res.status(200).json({
      success: true,
      page: {
        pageKey: page.pageKey,
        content: page.publishedContent,
        publishedAt: page.publishedAt,
      },
    });
  } catch (error) {
    console.error("Get public website content error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load page content.",
    });
  }
};
