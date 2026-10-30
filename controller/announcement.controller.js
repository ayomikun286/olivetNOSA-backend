
import Announcement from "../models/Announcement.js";
import { createAuditLog } from "../services/auditLog.service.js";

// If your audit helper is in a different location,
// adjust the import path above.

// ============================================================
// HELPERS
// ============================================================

const isPresident = (req) => Boolean(req.user?.isPresident);

const logAnnouncementAction = async ({
  req,
  action,
  announcement,
  details = {},
}) => {
  await createAuditLog({
    actor: req.user._id,
    action,
    resource: "announcement",
    resourceId: announcement._id,
    details,
    req,
  });
};

// ============================================================
// CREATE ANNOUNCEMENT — President only
// ============================================================

export const createAnnouncement = async (req, res) => {
  try {
    if (!isPresident(req)) {
      return res.status(403).json({
        success: false,
        message: "Only the President can create announcements.",
      });
    }

    const { title, content, status = "draft" } = req.body;

    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title and content are required.",
      });
    }

    if (!["draft", "published"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement status.",
      });
    }

    const announcement = await Announcement.create({
      title: title.trim(),
      content: content.trim(),
      createdBy: req.user._id,
      status,
      publishedAt: status === "published" ? new Date() : null,
    });

    await logAnnouncementAction({
      req,
      action:
        status === "published"
          ? "announcement.published"
          : "announcement.created",
      announcement,
      details: {
        title: announcement.title,
        status: announcement.status,
      },
    });

    return res.status(201).json({
      success: true,
      message:
        status === "published"
          ? "Announcement published successfully."
          : "Announcement saved as draft successfully.",
      announcement,
    });
  } catch (error) {
    console.error("Create announcement error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create announcement.",
    });
  }
};

// ============================================================
// GET PUBLISHED ANNOUNCEMENTS — All authenticated members
// ============================================================

export const getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({
      status: "published",
    })
      .populate("createdBy", "firstName lastName")
      .sort({ publishedAt: -1 });

    return res.status(200).json({
      success: true,
      count: announcements.length,
      announcements,
    });
  } catch (error) {
    console.error("Get announcements error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch announcements.",
    });
  }
};

// ============================================================
// GET ALL ANNOUNCEMENTS — President only
// ============================================================

export const getAllAnnouncements = async (req, res) => {
  try {
    if (!isPresident(req)) {
      return res.status(403).json({
        success: false,
        message: "Only the President can manage announcements.",
      });
    }

    const announcements = await Announcement.find()
      .populate("createdBy", "firstName lastName")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: announcements.length,
      announcements,
    });
  } catch (error) {
    console.error("Get all announcements error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch announcements.",
    });
  }
};

// ============================================================
// UPDATE ANNOUNCEMENT — President only
// ============================================================

export const updateAnnouncement = async (req, res) => {
  try {
    if (!isPresident(req)) {
      return res.status(403).json({
        success: false,
        message: "Only the President can update announcements.",
      });
    }

    const { title, content } = req.body;

    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title and content are required.",
      });
    }

    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found.",
      });
    }

    const previousValues = {
      title: announcement.title,
      content: announcement.content,
    };

    announcement.title = title.trim();
    announcement.content = content.trim();

    await announcement.save();

    await logAnnouncementAction({
      req,
      action: "announcement.updated",
      announcement,
      details: {
        previousValues,
        newValues: {
          title: announcement.title,
          content: announcement.content,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Announcement updated successfully.",
      announcement,
    });
  } catch (error) {
    console.error("Update announcement error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update announcement.",
    });
  }
};

// ============================================================
// PUBLISH ANNOUNCEMENT — President only
// ============================================================

export const publishAnnouncement = async (req, res) => {
  try {
    if (!isPresident(req)) {
      return res.status(403).json({
        success: false,
        message: "Only the President can publish announcements.",
      });
    }

    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found.",
      });
    }

    if (announcement.status === "published") {
      return res.status(400).json({
        success: false,
        message: "This announcement is already published.",
      });
    }

    announcement.status = "published";
    announcement.publishedAt = new Date();

    await announcement.save();

    await logAnnouncementAction({
      req,
      action: "announcement.published",
      announcement,
      details: {
        previousStatus: "draft",
        newStatus: "published",
        title: announcement.title,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Announcement published successfully.",
      announcement,
    });
  } catch (error) {
    console.error("Publish announcement error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to publish announcement.",
    });
  }
};

// ============================================================
// ARCHIVE ANNOUNCEMENT — President only
// ============================================================

export const archiveAnnouncement = async (req, res) => {
  try {
    if (!isPresident(req)) {
      return res.status(403).json({
        success: false,
        message: "Only the President can archive announcements.",
      });
    }

    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found.",
      });
    }

    if (announcement.status === "archived") {
      return res.status(400).json({
        success: false,
        message: "This announcement is already archived.",
      });
    }

    const previousStatus = announcement.status;

    announcement.status = "archived";

    await announcement.save();

    await logAnnouncementAction({
      req,
      action: "announcement.archived",
      announcement,
      details: {
        previousStatus,
        newStatus: "archived",
        title: announcement.title,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Announcement archived successfully.",
      announcement,
    });
  } catch (error) {
    console.error("Archive announcement error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to archive announcement.",
    });
  }
};

// ============================================================
// RESTORE ANNOUNCEMENT — President only
// ============================================================

export const restoreAnnouncement = async (req, res) => {
  try {
    if (!isPresident(req)) {
      return res.status(403).json({
        success: false,
        message: "Only the President can restore announcements.",
      });
    }

    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found.",
      });
    }

    if (announcement.status !== "archived") {
      return res.status(400).json({
        success: false,
        message: "Only archived announcements can be restored.",
      });
    }

    announcement.status = "draft";
    announcement.publishedAt = null;

    await announcement.save();

    await logAnnouncementAction({
      req,
      action: "announcement.restored",
      announcement,
      details: {
        previousStatus: "archived",
        newStatus: "draft",
        title: announcement.title,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Announcement restored as draft successfully.",
      announcement,
    });
  } catch (error) {
    console.error("Restore announcement error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to restore announcement.",
    });
  }
};

// ============================================================
// DELETE ANNOUNCEMENT — President only
// ============================================================

export const deleteAnnouncement = async (req, res) => {
  try {
    if (!isPresident(req)) {
      return res.status(403).json({
        success: false,
        message: "Only the President can delete announcements.",
      });
    }

    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found.",
      });
    }

    const deletedDetails = {
      title: announcement.title,
      status: announcement.status,
      content: announcement.content,
    };

    // Record the audit before permanent deletion.
    await logAnnouncementAction({
      req,
      action: "announcement.deleted",
      announcement,
      details: deletedDetails,
    });

    await announcement.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Announcement deleted successfully.",
    });
  } catch (error) {
    console.error("Delete announcement error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete announcement.",
    });
  }
};
