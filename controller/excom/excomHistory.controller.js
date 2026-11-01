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
        const [
            tenures,
            totalAppointments,
            totalDiscussions,
            totalReplies,
        ] = await Promise.all([
            PresidentialTenure.find()
                .populate("president", "firstName lastName email")
                .sort({ startDate: -1 })
                .lean(),

            ExcomMembership.countDocuments(),

            ExcomConversation.countDocuments(),

            ExcomReply.countDocuments(),
        ]);

        const activeTenures = tenures.filter(
            (tenure) => tenure.status === "active"
        ).length;

        return res.status(200).json({
            success: true,

            count: tenures.length,

            stats: {
                totalTenures: tenures.length,
                activeTenures,
                totalAppointments,
                totalDiscussions,
                totalReplies,
            },

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

        const repliesByConversation = new Map();

        for (const reply of replies) {
            const key = String(reply.conversation);

            if (!repliesByConversation.has(key)) {
                repliesByConversation.set(key, []);
            }

            repliesByConversation.get(key).push(reply);
        }

        const discussionsWithReplies = conversations.map((conversation) => ({
            ...conversation,
            replies: repliesByConversation.get(String(conversation._id)) || [],
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

        const replies = conversationIds.length
            ? await ExcomReply.find({
                conversation: { $in: conversationIds },
            })
                .populate("sender", "firstName lastName")
                .sort({ createdAt: 1 })
                .lean()
            : [];

        const repliesByConversation = new Map();

        for (const reply of replies) {
            const key = String(reply.conversation);

            if (!repliesByConversation.has(key)) {
                repliesByConversation.set(key, []);
            }

            repliesByConversation.get(key).push(reply);
        }

        // Resolve a participant's position within this presidential tenure.
        const getParticipantPosition = (user) => {
            if (!user?._id) return "Participant";

            // The president is separate from EXCOM membership appointments.
            if (
                tenure.president?._id &&
                String(user._id) === String(tenure.president._id)
            ) {
                return "President";
            }

            const appointments = members
                .filter(
                    (membership) =>
                        String(membership.user?._id) === String(user._id)
                )
                .sort((a, b) => {
                    if (
                        a.status === "active" &&
                        b.status !== "active"
                    ) {
                        return -1;
                    }

                    if (
                        b.status === "active" &&
                        a.status !== "active"
                    ) {
                        return 1;
                    }

                    return (
                        new Date(b.appointedAt) -
                        new Date(a.appointedAt)
                    );
                });

            return appointments[0]?.position || "Member";
        };

        const formatDate = (date) =>
            date ? new Date(date).toLocaleString("en-NG") : "Present";

        const safeName = (value) =>
            String(value || "Unknown").replace(/[^\w-]/g, "_");

        const filename = `EXCOM_Archive_${safeName(
            tenure.president?.lastName
        )}_${tenure._id}.pdf`;

        // Record the export before starting the PDF response.
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

        const doc = new PDFDocument({
            size: "A4",
            margins: {
                top: 50,
                bottom: 65,
                left: 50,
                right: 50,
            },
            bufferPages: true,
            autoFirstPage: true,
        });

        const PAGE_BOTTOM = 720;
        const FOOTER_Y = 760;
        const CONTENT_WIDTH = 495;

        // Add a page when the remaining content area is insufficient.
        const ensurePageSpace = (requiredHeight = 50) => {
            if (doc.y + requiredHeight > PAGE_BOTTOM) {
                doc.addPage();
            }
        };

        // Keep a heading with the content that follows it.
        const addSectionHeading = (heading) => {
            ensurePageSpace(45);

            doc
                .fontSize(14)
                .font("Helvetica-Bold")
                .text(heading);

            doc.moveDown(0.5);
        };

        // Prepare response headers only after database work and audit logging.
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
        );

        doc.on("error", (error) => {
            console.error("PDF document stream error:", error);

            if (!res.destroyed) {
                res.destroy(error);
            }
        });

        res.on("error", (error) => {
            console.error("PDF response stream error:", error);
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
        addSectionHeading("TENURE INFORMATION");

        doc.fontSize(10).font("Helvetica");

        doc.text(
            `President: ${tenure.president?.firstName || ""} ${tenure.president?.lastName || ""}`
        );
        doc.text("Position: President");
        doc.text(`Email: ${tenure.president?.email || "N/A"}`);
        doc.text(`Start Date: ${formatDate(tenure.startDate)}`);
        doc.text(`End Date: ${formatDate(tenure.endDate)}`);
        doc.text(`Status: ${tenure.status.toUpperCase()}`);

        doc.moveDown(1.5);

        // EXCOM MEMBERS
        addSectionHeading("EXCOM MEMBERS");

        if (!members.length) {
            ensurePageSpace(25);

            doc
                .fontSize(10)
                .font("Helvetica")
                .text("No EXCOM appointments recorded.");
        } else {
            members.forEach((membership, index) => {
                ensurePageSpace(100);

                const member = membership.user;

                doc
                    .fontSize(10)
                    .font("Helvetica-Bold")
                    .text(
                        `${index + 1}. ${member?.firstName || ""} ${member?.lastName || ""}`
                    );

                doc
                    .fontSize(10)
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
        addSectionHeading("DISCUSSIONS & REPLIES");

        if (!conversations.length) {
            ensurePageSpace(25);

            doc
                .fontSize(10)
                .font("Helvetica")
                .text("No discussions recorded.");
        } else {
            conversations.forEach((conversation, index) => {
                // Reserve room for the discussion heading and metadata.
                ensurePageSpace(100);

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
                    .text(
                        `Position: ${getParticipantPosition(creator)}`
                    )
                    .text(`Date: ${formatDate(conversation.createdAt)}`)
                    .text(`Status: ${conversation.status}`);

                doc.moveDown(0.4);

                // PDFKit automatically continues long text onto new pages.
                doc
                    .fontSize(10)
                    .font("Helvetica")
                    .text(conversation.message || "", {
                        width: CONTENT_WIDTH,
                        paragraphGap: 5,
                    });

                doc.moveDown(0.6);

                const conversationReplies =
                    repliesByConversation.get(String(conversation._id)) || [];

                ensurePageSpace(30);

                doc
                    .fontSize(10)
                    .font("Helvetica-Bold")
                    .text("Replies");

                if (!conversationReplies.length) {
                    ensurePageSpace(20);

                    doc
                        .fontSize(9)
                        .font("Helvetica")
                        .text("No replies.");
                } else {
                    conversationReplies.forEach((reply) => {
                        // Keep reply heading and at least some content together.
                        ensurePageSpace(45);

                        const sender = reply.sender;

                        doc
                            .fontSize(9)
                            .font("Helvetica-Bold")
                            .text(
                                `${sender?.firstName || ""} ${sender?.lastName || ""}`
                            );

                        doc
                            .fontSize(9)
                            .font("Helvetica")
                            .text(
                                `Position: ${getParticipantPosition(sender)}`
                            )
                            .text(`Date: ${formatDate(reply.createdAt)}`)
                            .text(reply.message || "", {
                                width: CONTENT_WIDTH,
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

        for (
            let i = range.start;
            i < range.start + range.count;
            i++
        ) {
            doc.switchToPage(i);

            doc
                .fontSize(8)
                .font("Helvetica")
                .text(
                    `EXCOM Archive | Page ${i + 1} of ${range.count}`,
                    50,
                    FOOTER_Y,
                    {
                        width: CONTENT_WIDTH,
                        align: "center",
                        lineBreak: false,
                    }
                );
        }

        doc.end();

    } catch (error) {
        console.error("Export EXCOM archive error:", error);

        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: "Failed to export EXCOM archive.",
            });
        }

        if (!res.destroyed) {
            res.destroy(error);
        }
    }
};