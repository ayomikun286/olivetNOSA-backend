
import mongoose from "mongoose";

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

        uploadedPdf = await uploadPdfToCloudinary(req.file);

        const report = await StewardshipReport.create({
            title: title.trim(),
            reportingMonth: month,
            reportingYear: year,
            content: content.trim(),
            pdfUrl: uploadedPdf.secure_url,
            pdfPublicId: uploadedPdf.public_id,
            createdBy: req.user._id,
            status,
            publishedAt: status === "published" ? new Date() : null,
        });

        // Confirm that the database record was successfully created.
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
                status: report.status,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Stewardship report created successfully.",
            data: report,
        });

    } catch (error) {
        // Delete the uploaded PDF only if database creation failed.
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
                message: "A report already exists for this month and year.",
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
            createdBy: req.user._id,
        })
            .sort({ reportingYear: -1, reportingMonth: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: reports.length,
            data: reports,
        });
    } catch (error) {
        console.error("Get president stewardship reports error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch stewardship reports.",
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
