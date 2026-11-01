import mongoose from "mongoose";
import User from "../../models/User.js";
import StewardshipReport from "../../models/StewardshipReport.js";
import {
    uploadPdfToCloudinary,
    deleteCloudinaryPdf,
} from "../../services/cloudinaryUpload.service.js";
import { createAuditLog } from "../../services/auditLog.service.js";






export const createStewardshipReport = async (req, res) => {
    let uploadedPdf = null;
    let databaseCreated = false;

    try {
        const {
            title,
            reportingMonth,
            reportingYear,
            content,
            status = "draft",
        } = req.body;

        if (
            !title?.trim() ||
            !reportingMonth ||
            !reportingYear ||
            !content?.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "All report details are required.",
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload the report PDF.",
            });
        }

        if (!["draft", "published"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid report status.",
            });
        }

        const month = Number(reportingMonth);
        const year = Number(reportingYear);

        if (
            !Number.isInteger(month) ||
            month < 1 ||
            month > 12 ||
            !Number.isInteger(year) ||
            year < 2020
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid reporting month or year.",
            });
        }

        // Determine report ownership.
        let presidentId = null;

        if (req.user.role === "president") {
            // President can only upload for themselves.
            presidentId = req.user._id;
        } else if (req.user.role === "superAdmin") {
            // Super Admin can select a President or leave it unassigned.
            presidentId = req.body.president?.trim() || null;

            if (presidentId) {
                if (!mongoose.Types.ObjectId.isValid(presidentId)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid President selected.",
                    });
                }

                const presidentExists = await User.exists({
                    _id: presidentId,
                });

                if (!presidentExists) {
                    return res.status(404).json({
                        success: false,
                        message: "Selected President was not found.",
                    });
                }
            }
        } else {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to upload stewardship reports.",
            });
        }

        uploadedPdf = await uploadPdfToCloudinary(req.file);

        const report = await StewardshipReport.create({
            title: title.trim(),
            reportingMonth: month,
            reportingYear: year,
            content: content.trim(),
            pdfUrl: uploadedPdf.secure_url,
            pdfPublicId: uploadedPdf.public_id,

            // Who the report belongs to.
            president: presidentId,

            // Who actually uploaded it.
            createdBy: req.user._id,

            status,
            publishedAt: status === "published" ? new Date() : null,
        });

        databaseCreated = true;

        await createAuditLog({
            actor: req.user._id,
            action: "STEWARDSHIP_REPORT_CREATED",
            resource: "StewardshipReport",
            resourceId: report._id,
            req,
            details: {
                title: report.title,
                reportingMonth: report.reportingMonth,
                reportingYear: report.reportingYear,
                president: report.president,
                createdBy: report.createdBy,
                status: report.status,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Stewardship report created successfully.",
            data: report,
        });

    } catch (error) {
        if (uploadedPdf?.public_id && !databaseCreated) {
            try {
                await deleteCloudinaryPdf(uploadedPdf.public_id);
            } catch (cleanupError) {
                console.error("PDF cleanup error:", cleanupError);
            }
        }

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A report already exists for this President or reporting period.",
            });
        }

        console.error("Create stewardship report error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create stewardship report.",
        });
    }
};




export const updateStewardshipReport = async (req, res) => {
    let uploadedPdf = null;
    let databaseUpdated = false;

    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid stewardship report ID.",
            });
        }

        const report = await StewardshipReport.findById(id);

        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Stewardship report not found.",
            });
        }

        const {
            title,
            reportingMonth,
            reportingYear,
            content,
            status,
        } = req.body;

        // Validate supplied fields.
        if (title !== undefined) {
            if (typeof title !== "string" || !title.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Title cannot be empty.",
                });
            }
        }

        const month =
            reportingMonth !== undefined
                ? Number(reportingMonth)
                : report.reportingMonth;

        const year =
            reportingYear !== undefined
                ? Number(reportingYear)
                : report.reportingYear;

        if (
            !Number.isInteger(month) ||
            month < 1 ||
            month > 12 ||
            !Number.isInteger(year) ||
            year < 2020
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid reporting month or year.",
            });
        }

        if (content !== undefined) {
            if (typeof content !== "string" || !content.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Report description cannot be empty.",
                });
            }
        }

        if (
            status !== undefined &&
            !["draft", "published", "archived"].includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid report status.",
            });
        }

        const before = {
            title: report.title,
            reportingMonth: report.reportingMonth,
            reportingYear: report.reportingYear,
            content: report.content,
            status: report.status,
            pdfUrl: report.pdfUrl,
            pdfPublicId: report.pdfPublicId,
        };

        // Upload replacement PDF if supplied.
        if (req.file) {
            uploadedPdf = await uploadPdfToCloudinary(req.file);

            report.pdfUrl = uploadedPdf.secure_url;
            report.pdfPublicId = uploadedPdf.public_id;
        }

        if (title !== undefined) {
            report.title = title.trim();
        }

        report.reportingMonth = month;
        report.reportingYear = year;

        if (content !== undefined) {
            report.content = content.trim();
        }

        if (status !== undefined) {
            if (
                status === "published" &&
                report.status !== "published"
            ) {
                report.publishedAt = new Date();
            }

            report.status = status;
        }

        await report.save();
        databaseUpdated = true;

        await createAuditLog({
            actor: req.user._id,
            action: "STEWARDSHIP_REPORT_UPDATED",
            resource: "StewardshipReport",
            resourceId: report._id,
            req,
            details: {
                before,
                after: {
                    title: report.title,
                    reportingMonth: report.reportingMonth,
                    reportingYear: report.reportingYear,
                    status: report.status,
                    pdfUrl: report.pdfUrl,
                },
            },
        });

        // Delete old PDF only after the database saves the replacement.
        if (
            uploadedPdf &&
            before.pdfPublicId &&
            before.pdfPublicId !== uploadedPdf.public_id
        ) {
            try {
                await deleteCloudinaryPdf(before.pdfPublicId);
            } catch (cleanupError) {
                console.error(
                    "Failed to delete previous stewardship PDF:",
                    cleanupError
                );
            }
        }

        return res.status(200).json({
            success: true,
            message: "Stewardship report updated successfully.",
            data: report,
        });
    } catch (error) {
        // Remove new upload only if the database did not save it.
        if (uploadedPdf && !databaseUpdated) {
            try {
                await deleteCloudinaryPdf(uploadedPdf.public_id);
            } catch (cleanupError) {
                console.error(
                    "Failed to clean up replacement PDF:",
                    cleanupError
                );
            }
        }

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A report already exists for this month and year.",
            });
        }

        console.error("Update stewardship report error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update stewardship report.",
        });
    }
};



export const getAdminStewardshipReports = async (req, res) => {
    try {
        const reports = await StewardshipReport.find()
            .populate("createdBy", "firstName lastName email")
            .sort({ reportingYear: -1, reportingMonth: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: reports.length,
            data: reports,
        });
    } catch (error) {
        console.error("Get admin stewardship reports error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch stewardship reports.",
        });
    }
};


export const getPresidentStewardshipReports = async (req, res) => {
    try {
        const reports = await StewardshipReport.find({
            $or: [
                // Reports assigned to this President
                {
                    president: req.user._id,
                },

                // Published general reports from Super Admin
                {
                    president: null,
                    status: "published",
                },
            ],
        })
            .populate(
                "president",
                "firstName middleName lastName"
            )
            .populate(
                "createdBy",
                "firstName middleName lastName"
            )
            .sort({
                reportingYear: -1,
                reportingMonth: -1,
                createdAt: -1,
            });

        return res.status(200).json({
            success: true,
            data: reports,
        });
    } catch (error) {
        console.error("Get President stewardship reports error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve stewardship reports.",
        });
    }
};


export const getPublishedStewardshipReports = async (req, res) => {
    try {
        const reports = await StewardshipReport.find({
            status: "published",
        })
            .populate("createdBy", "firstName lastName")
            .sort({
                reportingYear: -1,
                reportingMonth: -1,
            })
            .lean();

        return res.status(200).json({
            success: true,
            count: reports.length,
            data: reports,
        });
    } catch (error) {
        console.error("Get published stewardship reports error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch published stewardship reports.",
        });
    }
};



export const archivePresidentStewardshipReports = async (req, res) => {
    try {
        const { presidentId } = req.params;

        if (!mongoose.isValidObjectId(presidentId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid President ID.",
            });
        }

        const result = await StewardshipReport.updateMany(
            {
                president: presidentId,
                status: "published",
            },
            {
                $set: { status: "archived" },
            }
        );

        await createAuditLog({
            actor: req.user._id,
            action: "STEWARDSHIP_REPORTS_ARCHIVED",
            resource: "StewardshipReport",
            resourceId: presidentId,
            req,
            details: {
                presidentId,
                archivedCount: result.modifiedCount,
            },
        });

        return res.status(200).json({
            success: true,
            message: `${result.modifiedCount} published stewardship report(s) archived successfully.`,
            archivedCount: result.modifiedCount,
        });
    } catch (error) {
        console.error("Archive President stewardship reports error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to archive stewardship reports.",
        });
    }
};


export const restorePresidentStewardshipReports = async (req, res) => {
    try {
        const { presidentId } = req.params;

        if (!mongoose.isValidObjectId(presidentId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid President ID.",
            });
        }

        const result = await StewardshipReport.updateMany(
            {
                president: presidentId,
                status: "archived",
            },
            {
                $set: { status: "published" },
            }
        );

        await createAuditLog({
            actor: req.user._id,
            action: "STEWARDSHIP_REPORTS_RESTORED",
            resource: "StewardshipReport",
            resourceId: presidentId,
            req,
            details: {
                presidentId,
                restoredCount: result.modifiedCount,
            },
        });

        return res.status(200).json({
            success: true,
            message: `${result.modifiedCount} stewardship report(s) restored successfully.`,
            restoredCount: result.modifiedCount,
        });
    } catch (error) {
        console.error("Restore President stewardship reports error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to restore stewardship reports.",
        });
    }
};




export const getStewardshipPresidents = async (req, res) => {
    try {
        const presidents = await User.find({
            role: "president",
        })
            .select("_id firstName middleName lastName email")
            .sort({ firstName: 1, lastName: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: presidents.length,
            data: presidents,
        });
    } catch (error) {
        console.error("Get stewardship Presidents error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch Presidents.",
        });
    }
};