import mongoose from "mongoose";
import Announcement from "../models/Announcement.js";
import { createAuditLog } from "../services/auditLog.service.js";
import User from "../models/User.js";
import StewardshipReport from "../models/StewardshipReport.js";
import { queueAnnouncementEmails } from "../services/announcementEmail.service.js";
import {
    uploadPdfToCloudinary,
    deleteCloudinaryPdf,
} from "../services/cloudinaryUpload.service.js";

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
    let uploadedPdf = null;
    let databaseCreated = false;

    try {
        if (!canManageAnnouncements(req)) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to create announcements.",
            });
        }

        const { title, content, status = "draft" } = req.body;

        if (
            typeof title !== "string" ||
            !title.trim() ||
            typeof content !== "string" ||
            !content.trim()
        ) {
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

        if (req.file) {
            uploadedPdf = await uploadPdfToCloudinary(
                req.file,
                "nosa/announcements",
                "announcement"
            );
        }

        const announcement = await Announcement.create({
            title: title.trim(),
            content: content.trim(),
            createdBy: req.user._id,
            attachment: uploadedPdf
                ? {
                    url: uploadedPdf.secure_url,
                    publicId: uploadedPdf.public_id,
                    fileName: req.file.originalname,
                }
                : undefined,
            status,
            publishedAt: status === "published" ? new Date() : null,
        });

        databaseCreated = true;

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
                attachment: announcement.attachment,
            },
        });

        let emailQueue = null;

        if (announcement.status === "published") {
            try {
                emailQueue = await queueAnnouncementEmails(announcement);
            } catch (error) {
                console.error(
                    "Announcement email queue error:",
                    error.message
                );
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
        if (uploadedPdf?.public_id && !databaseCreated) {
            try {
                await deleteCloudinaryPdf(uploadedPdf.public_id);
            } catch (cleanupError) {
                console.error("Announcement PDF cleanup error:", cleanupError);
            }
        }

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
// GET SINGLE PUBLISHED ANNOUNCEMENT — Approved Members
// ============================================================

export const getPublishedAnnouncementById = async (req, res) => {
    try {
        if (!isApprovedUser(req)) {
            return res.status(403).json({
                success: false,
                message: "Your account is not approved to access announcements.",
            });
        }

        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid announcement ID.",
            });
        }

        const announcement = await Announcement.findOne({
            _id: id,
            status: "published",
        })
            .populate("createdBy", "firstName lastName")
            .lean();

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: "Published announcement not found.",
            });
        }

        return res.status(200).json({
            success: true,
            announcement,
        });
    } catch (error) {
        console.error("Get published announcement error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch announcement.",
        });
    }
};

// ============================================================
// UPDATE ANNOUNCEMENT — Treasurer & Super Admin
// ============================================================

export const updateAnnouncement = async (req, res) => {
    let uploadedPdf = null;
    let databaseUpdated = false;

    try {
        if (!canManageAnnouncements(req)) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to update announcements.",
            });
        }

        const { title, content } = req.body;

        if (
            typeof title !== "string" ||
            !title.trim() ||
            typeof content !== "string" ||
            !content.trim()
        ) {
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
            attachment: announcement.attachment
                ? { ...announcement.attachment.toObject?.() ?? announcement.attachment }
                : null,
        };

        const oldPublicId = announcement.attachment?.publicId;

        // Upload replacement PDF before changing the database.
        if (req.file) {
            uploadedPdf = await uploadPdfToCloudinary(
                req.file,
                "nosa/announcements",
                "announcement"
            );

            announcement.attachment = {
                url: uploadedPdf.secure_url,
                publicId: uploadedPdf.public_id,
                fileName: req.file.originalname,
            };
        } else if (
            req.body.removeAttachment === "true" ||
            req.body.removeAttachment === true
        ) {
            announcement.attachment = null;
        }

        announcement.title = title.trim();
        announcement.content = content.trim();

        await announcement.save();
        databaseUpdated = true;

        await logAnnouncementAction({
            req,
            action: "announcement.updated",
            announcement,
            details: {
                previousValues,
                newValues: {
                    title: announcement.title,
                    content: announcement.content,
                    attachment: announcement.attachment,
                },
            },
        });

        // Delete the old PDF only after the database update succeeds.
        const shouldDeleteOldPdf =
            oldPublicId &&
            oldPublicId !== announcement.attachment?.publicId;

        if (shouldDeleteOldPdf) {
            try {
                await deleteCloudinaryPdf(oldPublicId);
            } catch (cleanupError) {
                console.error(
                    "Failed to delete previous announcement PDF:",
                    cleanupError
                );
            }
        }

        return res.status(200).json({
            success: true,
            message: "Announcement updated successfully.",
            announcement,
        });
    } catch (error) {
        // Clean up a new upload only if the database did not save it.
        if (uploadedPdf?.public_id && !databaseUpdated) {
            try {
                await deleteCloudinaryPdf(uploadedPdf.public_id);
            } catch (cleanupError) {
                console.error(
                    "Failed to clean up replacement announcement PDF:",
                    cleanupError
                );
            }
        }

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

        const attachmentPublicId = announcement.attachment?.publicId;

        const deletedDetails = {
            title: announcement.title,
            status: announcement.status,
            content: announcement.content,
            attachment: announcement.attachment,
        };

        await logAnnouncementAction({
            req,
            action: "announcement.deleted",
            announcement,
            details: deletedDetails,
        });

        await announcement.deleteOne();

        if (attachmentPublicId) {
            try {
                await deleteCloudinaryPdf(attachmentPublicId);
            } catch (cleanupError) {
                console.error(
                    "Failed to delete announcement PDF from Cloudinary:",
                    cleanupError
                );
            }
        }

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
