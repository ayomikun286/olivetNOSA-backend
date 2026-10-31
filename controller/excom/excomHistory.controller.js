import mongoose from "mongoose";
import PDFDocument from "pdfkit";

import { createAuditLog } from "../../services/auditLog.service.js";

import PresidentialTenure from "../../models/PresidentialTenure.js";
import ExcomMembership from "../../models/ExcomMembership.js";
import ExcomConversation from "../../models/ExcomConversation.js";
import ExcomReply from "../../models/ExcomReply.js";


// ========================================
// GET ALL PRESIDENTIAL TENURES
// SUPER ADMIN ONLY
// ========================================

export const getAllPresidentialTenures = async (req, res) => {
    try {
        const tenures = await PresidentialTenure.find()
            .populate("president", "firstName lastName email")
            .sort({ startDate: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: tenures.length,
            tenures,
        });

    } catch (error) {
        console.error("Get presidential tenures error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch presidential tenures.",
        });
    }
};


// ========================================
// GET TENURE DETAILS + EXCOM TEAM + DISCUSSIONS
// SUPER ADMIN ONLY
// ========================================

export const getPresidentialTenureDetails = async (req, res) => {
    try {
        const { tenureId } = req.params;

        if (!mongoose.isValidObjectId(tenureId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid presidential tenure ID.",
            });
        }

        const tenure = await PresidentialTenure.findById(tenureId)
            .populate("president", "firstName lastName email")
            .lean();

        if (!tenure) {
            return res.status(404).json({
                success: false,
                message: "Presidential tenure not found.",
            });
        }

        const [members, conversations] = await Promise.all([
            ExcomMembership.find({
                tenure: tenure._id,
            })
                .populate("user", "firstName lastName email")
                .sort({ appointedAt: 1 })
                .lean(),

            ExcomConversation.find({
                tenure: tenure._id,
            })
                .populate("createdBy", "firstName lastName")
                .sort({ createdAt: 1 })
                .lean(),
        ]);

        const conversationIds = conversations.map(
            (conversation) => conversation._id
        );

        const replies = await ExcomReply.find({
            conversation: { $in: conversationIds },
        })
            .populate("sender", "firstName lastName role")
            .sort({ createdAt: 1 })
            .lean();

        const discussionsWithReplies = conversations.map((conversation) => ({
            ...conversation,
            replies: replies.filter(
                (reply) =>
                    String(reply.conversation) === String(conversation._id)
            ),
        }));

        return res.status(200).json({
            success: true,
            tenure,
            members,
            discussions: discussionsWithReplies,
        });

    } catch (error) {
        console.error("Get presidential tenure details error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch presidential tenure records.",
        });
    }
};




// ========================================
// EXPORT PRESIDENTIAL TENURE COMMUNICATIONS
// SUPER ADMIN ONLY
// ========================================

export const exportPresidentialTenurePDF = async (req, res) => {
    try {
        const { tenureId } = req.params;

        if (!mongoose.isValidObjectId(tenureId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid presidential tenure ID.",
            });
        }

        const tenure = await PresidentialTenure.findById(tenureId)
            .populate("president", "firstName lastName email")
            .lean();

        if (!tenure) {
            return res.status(404).json({
                success: false,
                message: "Presidential tenure not found.",
            });
        }

        const [members, conversations] = await Promise.all([
            ExcomMembership.find({ tenure: tenure._id })
                .populate("user", "firstName lastName email")
                .sort({ appointedAt: 1 })
                .lean(),

            ExcomConversation.find({ tenure: tenure._id })
                .populate("createdBy", "firstName lastName")
                .sort({ createdAt: 1 })
                .lean(),
        ]);

        const conversationIds = conversations.map(
            (conversation) => conversation._id
        );

        const replies = await ExcomReply.find({
            conversation: { $in: conversationIds },
        })
            .populate("sender", "firstName lastName")
            .sort({ createdAt: 1 })
            .lean();

        const repliesByConversation = new Map();

        for (const reply of replies) {
            const key = String(reply.conversation);

            if (!repliesByConversation.has(key)) {
                repliesByConversation.set(key, []);
            }

            repliesByConversation.get(key).push(reply);
        }

        const formatDate = (date) =>
            date ? new Date(date).toLocaleString("en-NG") : "Present";

        const safeName = (value) =>
            String(value || "Unknown").replace(/[^\w-]/g, "_");

        const filename = `EXCOM_Archive_${safeName(
            tenure.president?.lastName
        )}_${tenure._id}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
        );

        const doc = new PDFDocument({
            size: "A4",
            margins: {
                top: 50,
                bottom: 50,
                left: 50,
                right: 50,
            },
            bufferPages: true,
        });

        doc.pipe(res);

        // HEADER
        doc
            .fontSize(20)
            .font("Helvetica-Bold")
            .text("EXCOM COMMUNICATION ARCHIVE", {
                align: "center",
            });

        doc.moveDown(0.5);

        doc
            .fontSize(10)
            .font("Helvetica")
            .text("Presidential Tenure Records", {
                align: "center",
            });

        doc.moveDown(2);

        // TENURE INFORMATION
        doc.fontSize(14).font("Helvetica-Bold").text("TENURE INFORMATION");
        doc.moveDown(0.5);

        doc.fontSize(10).font("Helvetica");

        doc.text(
            `President: ${tenure.president?.firstName || ""} ${tenure.president?.lastName || ""}`
        );
        doc.text(`Email: ${tenure.president?.email || "N/A"}`);
        doc.text(`Start Date: ${formatDate(tenure.startDate)}`);
        doc.text(`End Date: ${formatDate(tenure.endDate)}`);
        doc.text(`Status: ${tenure.status.toUpperCase()}`);

        doc.moveDown(1.5);

        // EXCOM MEMBERS
        doc.fontSize(14).font("Helvetica-Bold").text("EXCOM MEMBERS");
        doc.moveDown(0.5);

        if (!members.length) {
            doc.fontSize(10).font("Helvetica").text("No EXCOM appointments recorded.");
        } else {
            members.forEach((membership, index) => {
                const member = membership.user;

                doc
                    .fontSize(10)
                    .font("Helvetica-Bold")
                    .text(`${index + 1}. ${member?.firstName || ""} ${member?.lastName || ""}`);

                doc
                    .font("Helvetica")
                    .text(`Position: ${membership.position}`)
                    .text(`Email: ${member?.email || "N/A"}`)
                    .text(`Appointment Status: ${membership.status}`)
                    .text(`Appointed: ${formatDate(membership.appointedAt)}`);

                if (membership.removedAt) {
                    doc.text(`Removed: ${formatDate(membership.removedAt)}`);
                }

                doc.moveDown(0.7);
            });
        }

        doc.moveDown(1);

        // DISCUSSIONS AND REPLIES
        doc.fontSize(14).font("Helvetica-Bold").text("DISCUSSIONS & REPLIES");
        doc.moveDown(0.7);

        if (!conversations.length) {
            doc.fontSize(10).font("Helvetica").text("No discussions recorded.");
        } else {
            conversations.forEach((conversation, index) => {
                if (doc.y > 680) {
                    doc.addPage();
                }

                const creator = conversation.createdBy;

                doc
                    .fontSize(12)
                    .font("Helvetica-Bold")
                    .text(`${index + 1}. ${conversation.subject}`);

                doc
                    .fontSize(9)
                    .font("Helvetica")
                    .text(
                        `Created by: ${creator?.firstName || ""} ${creator?.lastName || ""}`
                    )
                    .text(`Date: ${formatDate(conversation.createdAt)}`)
                    .text(`Status: ${conversation.status}`);

                doc.moveDown(0.4);

                doc.fontSize(10).font("Helvetica").text(conversation.message, {
                    paragraphGap: 5,
                });

                doc.moveDown(0.6);

                const conversationReplies =
                    repliesByConversation.get(String(conversation._id)) || [];

                doc.fontSize(10).font("Helvetica-Bold").text("Replies");

                if (!conversationReplies.length) {
                    doc.fontSize(9).font("Helvetica").text("No replies.");
                } else {
                    conversationReplies.forEach((reply) => {
                        const sender = reply.sender;

                        doc
                            .fontSize(9)
                            .font("Helvetica-Bold")
                            .text(
                                `${sender?.firstName || ""} ${sender?.lastName || ""} — ${formatDate(reply.createdAt)}`
                            );

                        doc
                            .font("Helvetica")
                            .text(reply.message, {
                                paragraphGap: 4,
                            });

                        doc.moveDown(0.3);
                    });
                }

                doc.moveDown(1.2);
            });
        }

        // PAGE NUMBERS
        const range = doc.bufferedPageRange();

        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);

            doc
                .fontSize(8)
                .font("Helvetica")
                .text(
                    `EXCOM Archive | Page ${i + 1} of ${range.count}`,
                    50,
                    760,
                    {
                        width: 495,
                        align: "center",
                    }
                );
        }

        await createAuditLog({
            actor: req.user._id,
            action: "EXCOM_ARCHIVE_EXPORTED",
            resource: "PresidentialTenure",
            resourceId: tenure._id,
            req,
            details: {
                president: tenure.president?._id,
                discussionsExported: conversations.length,
                repliesExported: replies.length,
            },
        });

        doc.end();

    } catch (error) {
        console.error("Export EXCOM archive error:", error);

        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: "Failed to export EXCOM archive.",
            });
        }

        res.destroy(error);
    }
};