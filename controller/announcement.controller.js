
import Announcement from "../models/Announcement.js";
import { createAuditLog } from "../services/auditLog.service.js";
import User from "../models/User.js";
import StewardshipReport from "../models/StewardshipReport.js";
import { queueAnnouncementEmails } from "../services/announcementEmail.service.js";

// ============================================================
// HELPERS
// ============================================================

const isApprovedUser = (req) => req.user?.status === "active";

const canManageAnnouncements = (req) => ["treasurer", "superAdmin"].includes(req.user?.role);

const isSuperAdmin = (req) => req.user?.role === "superAdmin";

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
// CREATE ANNOUNCEMENT — Treasurer & Super Admin
// ============================================================

export const createAnnouncement = async (req, res) => {
    try {
        if (!canManageAnnouncements(req)) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to create announcements.",
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

        let emailQueue = null;

        if (announcement.status === "published") {
            try {
                emailQueue = await queueAnnouncementEmails(announcement);
            } catch (error) {
                console.error("Announcement email queue error:", error.message);
            }
        }

        return res.status(201).json({
            success: true,
            message:
                status === "published"
                    ? "Announcement published successfully."
                    : "Announcement saved as draft successfully.",
            announcement,
             emailQueue,
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

        if (!isApprovedUser(req)) {
            return res.status(403).json({
                success: false,
                message: "Your account is not approved to access announcements.",
            });
        }

        const [announcements, stewardshipReports, user] =
            await Promise.all([
                Announcement.find({ status: "published" })
                    .populate("createdBy", "firstName lastName")
                    .sort({ publishedAt: -1 })
                    .lean(),

                StewardshipReport.find({ status: "published" })
                    .populate("createdBy", "firstName lastName")
                    .sort({ publishedAt: -1 })
                    .lean(),

                User.findById(req.user._id)
                    .select("lastViewedAnnouncementAt")
                    .lean(),
            ]);

        const lastViewedAt = user?.lastViewedAnnouncementAt;

        const allPublishedContent = [
            ...announcements.map((item) => ({
                ...item,
                sourceType: "announcement",
            })),

            ...stewardshipReports.map((item) => ({
                ...item,
                sourceType: "stewardship",
            })),
        ].sort(
            (a, b) =>
                new Date(b.publishedAt) - new Date(a.publishedAt)
        );

        const newAnnouncement = allPublishedContent.find(
            (item) =>
                item.publishedAt &&
                (
                    !lastViewedAt ||
                    new Date(item.publishedAt) >
                    new Date(lastViewedAt)
                )
        ) || null;

        return res.status(200).json({
            success: true,
            count: announcements.length,
            announcements,
            hasNewAnnouncement: Boolean(newAnnouncement),
            newAnnouncement,
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
// MARK ANNOUNCEMENT AS VIEWED — Authenticated member
// ============================================================

export const markAnnouncementAsViewed = async (req, res) => {
    try {
        const { type = "announcement" } = req.body;

        if (!isApprovedUser(req)) {
            return res.status(403).json({
                success: false,
                message: "Your account is not approved to access announcements.",
            });
        }


        let content;

        if (type === "announcement") {
            content = await Announcement.findOne({
                _id: req.params.id,
                status: "published",
            }).select("publishedAt");
        } else if (type === "stewardship") {
            content = await StewardshipReport.findOne({
                _id: req.params.id,
                status: "published",
            }).select("publishedAt");
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid content type.",
            });
        }

        if (!content) {
            return res.status(404).json({
                success: false,
                message: "Published content not found.",
            });
        }

        await User.findByIdAndUpdate(req.user._id, {
            $max: {
                lastViewedAnnouncementAt: content.publishedAt,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Content marked as viewed.",
        });
    } catch (error) {
        console.error("Mark content viewed error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update content view.",
        });
    }
};




// ============================================================
// GET ALL ANNOUNCEMENTS — Treasurer & Super Admin
// ============================================================

export const getAllAnnouncements = async (req, res) => {
    try {
        if (!canManageAnnouncements(req)) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to manage announcements.",
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
// UPDATE ANNOUNCEMENT — Treasurer & Super Admin
// ============================================================

export const updateAnnouncement = async (req, res) => {
    try {
        if (!canManageAnnouncements(req)) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to update announcements.",
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
// PUBLISH ANNOUNCEMENT — Treasurer & Super Admin
// ============================================================

export const publishAnnouncement = async (req, res) => {
    try {
        if (!canManageAnnouncements(req)) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to publish announcements.",
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

        const previousStatus = announcement.status;

        announcement.status = "published";
        announcement.publishedAt = new Date();

        await announcement.save();

        await logAnnouncementAction({
            req,
            action: "announcement.published",
            announcement,
            details: {
                previousStatus,
                newStatus: "published",
                title: announcement.title,
            },
        });

        let emailQueue = null;

        try {
            emailQueue = await queueAnnouncementEmails(announcement);
        } catch (error) {
            console.error("Announcement email queue error:", error.message);
        }

        return res.status(200).json({
            success: true,
            message: "Announcement published successfully.",
            announcement,
             emailQueue,
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
// ARCHIVE ANNOUNCEMENT — Treasurer & Super Admin
// ============================================================

export const archiveAnnouncement = async (req, res) => {
    try {
        if (!canManageAnnouncements(req)) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to archive announcements.",
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
// RESTORE ANNOUNCEMENT — Treasurer & Super Admin
// ============================================================

export const restoreAnnouncement = async (req, res) => {
    try {
        if (!canManageAnnouncements(req)) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to restore announcements.",
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
// DELETE ANNOUNCEMENT — Super Admin only
// ============================================================

export const deleteAnnouncement = async (req, res) => {
    try {
        if (!isSuperAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: "Only the Super Admin can delete announcements.",
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
