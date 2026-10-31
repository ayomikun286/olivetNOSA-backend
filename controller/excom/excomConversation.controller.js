import mongoose from "mongoose";

import PresidentialTenure from "../../models/PresidentialTenure.js";
import ExcomMembership from "../../models/ExcomMembership.js";
import ExcomConversation from "../../models/ExcomConversation.js";
import ExcomReply from "../../models/ExcomReply.js";

import { createAuditLog } from "../../services/auditLog.service.js";


// ========================================
// HELPER: GET ACTIVE EXCOM ACCESS
// ========================================

const getExcomAccess = async (userId, role) => {
    if (role === "president") {
        return PresidentialTenure.findOne({
            president: userId,
            status: "active",
        });
    }

    const membership = await ExcomMembership.findOne({
        user: userId,
        status: "active",
    }).populate({
        path: "tenure",
        match: { status: "active" },
    });

    return membership?.tenure || null;
};


// ========================================
// HELPER: GET DISCUSSION REPLY COUNTS
// ========================================

const getDiscussionReplyStats = async (conversationIds, tenureId) => {
    if (!conversationIds.length) return {};

    const stats = await ExcomReply.aggregate([
        {
            $match: {
                conversation: { $in: conversationIds },
            },
        },
        {
            $lookup: {
                from: ExcomMembership.collection.name,
                let: { senderId: "$sender" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$user", "$$senderId"] },
                                    { $eq: ["$tenure", tenureId] },
                                    { $eq: ["$status", "active"] },
                                ],
                            },
                        },
                    },
                    { $limit: 1 },
                ],
                as: "activeMembership",
            },
        },
        {
            $group: {
                _id: "$conversation",
                replyCount: { $sum: 1 },
                memberSenders: {
                    $addToSet: {
                        $cond: [
                            { $gt: [{ $size: "$activeMembership" }, 0] },
                            "$sender",
                            null,
                        ],
                    },
                },
            },
        },
        {
            $project: {
                replyCount: 1,
                memberReplyCount: {
                    $size: {
                        $setDifference: ["$memberSenders", [null]],
                    },
                },
            },
        },
    ]);

    return stats.reduce((result, item) => {
        result[item._id.toString()] = {
            replyCount: item.replyCount,
            memberReplyCount: item.memberReplyCount,
        };

        return result;
    }, {});
};


// ========================================
// CREATE DISCUSSION
// PRESIDENT ONLY
// ========================================

export const createExcomConversation = async (req, res) => {
    try {
        const { subject, message } = req.body;

        if (!subject?.trim() || !message?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Subject and message are required.",
            });
        }

        if (subject.trim().length > 200) {
            return res.status(400).json({
                success: false,
                message: "Subject cannot exceed 200 characters.",
            });
        }

        const tenure = await PresidentialTenure.findOne({
            president: req.user._id,
            status: "active",
        });

        if (!tenure) {
            return res.status(404).json({
                success: false,
                message: "No active presidential tenure found.",
            });
        }

        const conversation = await ExcomConversation.create({
            tenure: tenure._id,
            createdBy: req.user._id,
            subject: subject.trim(),
            message: message.trim(),
            status: "published",
            publishedAt: new Date(),
            lastActivityAt: new Date(),
        });

        await createAuditLog({
            actor: req.user._id,
            action: "EXCOM_DISCUSSION_CREATED",
            resource: "ExcomConversation",
            resourceId: conversation._id,
            req,
            details: {
                subject: conversation.subject,
                tenure: tenure._id,
            },
        });

        return res.status(201).json({
            success: true,
            message: "EXCOM discussion created successfully.",
            conversation,
        });

    } catch (error) {
        console.error("Create EXCOM conversation error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create EXCOM discussion.",
        });
    }
};


// ========================================
// GET DISCUSSIONS
// PRESIDENT + ACTIVE EXCOM MEMBERS
// ========================================

export const getExcomConversations = async (req, res) => {
    try {
        const tenure = await getExcomAccess(
            req.user._id,
            req.user.role
        );

        if (!tenure) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to an active EXCOM team.",
            });
        }

        const filter = {
            tenure: tenure._id,
        };

        // Members can only see published discussions.
        // Presidents can see all discussion statuses.

        if (req.user.role !== "president") {
            filter.status = "published";
        }

        const conversations = await ExcomConversation.find(filter)
            .populate("createdBy", "firstName lastName")
            .sort({ lastActivityAt: -1 })
            .lean();

        const stats = await getDiscussionReplyStats(
            conversations.map((item) => item._id),
            tenure._id
        );

        const conversationsWithStats = conversations.map((item) => ({
            ...item,
            replyCount: stats[item._id.toString()]?.replyCount || 0,
            memberReplyCount: stats[item._id.toString()]?.memberReplyCount || 0,
        }));

        return res.status(200).json({
            success: true,
            count: conversationsWithStats.length,
            conversations: conversationsWithStats,
        });

    } catch (error) {
        console.error("Get EXCOM conversations error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch EXCOM discussions.",
        });
    }
};


// ========================================
// GET DISCUSSION DETAILS + REPLIES
// ========================================

export const getExcomConversationDetails = async (req, res) => {
    try {
        const { conversationId } = req.params;

        if (!mongoose.isValidObjectId(conversationId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid discussion ID.",
            });
        }

        const tenure = await getExcomAccess(
            req.user._id,
            req.user.role
        );

        if (!tenure) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to an active EXCOM team.",
            });
        }

        const filter = {
            _id: conversationId,
            tenure: tenure._id,
        };

        if (req.user.role !== "president") {
            filter.status = "published";
        }

        const conversation = await ExcomConversation.findOne(filter)
            .populate("createdBy", "firstName lastName")
            .lean();

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Discussion not found.",
            });
        }

        const replies = await ExcomReply.find({
            conversation: conversation._id,
        })
            .populate("sender", "firstName lastName role")
            .sort({ createdAt: 1 })
            .lean();

        const stats = await getDiscussionReplyStats(
            [conversation._id],
            tenure._id
        );

        const replyStats = stats[conversation._id.toString()] || {
            replyCount: 0,
            memberReplyCount: 0,
        };

        return res.status(200).json({
            success: true,
            conversation: {
                ...conversation,
                ...replyStats,
            },
            replies,
        });

    } catch (error) {
        console.error("Get EXCOM conversation details error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch discussion details.",
        });
    }
};


// ========================================
// REPLY TO DISCUSSION
// PRESIDENT + ACTIVE EXCOM MEMBERS
// ========================================

export const replyToExcomConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { message } = req.body;

        if (!mongoose.isValidObjectId(conversationId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid discussion ID.",
            });
        }

        if (!message?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Reply message is required.",
            });
        }

        const tenure = await getExcomAccess(
            req.user._id,
            req.user.role
        );

        if (!tenure) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to an active EXCOM team.",
            });
        }

        const conversation = await ExcomConversation.findOne({
            _id: conversationId,
            tenure: tenure._id,
            status: "published",
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Discussion not found.",
            });
        }

        const reply = await ExcomReply.create({
            conversation: conversation._id,
            sender: req.user._id,
            message: message.trim(),
        });

        conversation.lastActivityAt = new Date();
        await conversation.save();

        await createAuditLog({
            actor: req.user._id,
            action: "EXCOM_DISCUSSION_REPLIED",
            resource: "ExcomReply",
            resourceId: reply._id,
            req,
            details: {
                conversation: conversation._id,
                subject: conversation.subject,
                tenure: tenure._id,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Reply sent successfully.",
            reply,
        });

    } catch (error) {
        console.error("Reply to EXCOM conversation error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to send reply.",
        });
    }
};


// ========================================
// UPDATE DISCUSSION STATUS
// PRESIDENT ONLY
// ========================================

export const updateExcomConversationStatus = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { status } = req.body;

        if (!mongoose.isValidObjectId(conversationId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid discussion ID.",
            });
        }

        const allowedStatuses = ["draft", "published", "archived"];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid discussion status.",
            });
        }

        const tenure = await PresidentialTenure.findOne({
            president: req.user._id,
            status: "active",
        });

        if (!tenure) {
            return res.status(403).json({
                success: false,
                message: "No active presidential tenure found.",
            });
        }

        const conversation = await ExcomConversation.findOne({
            _id: conversationId,
            tenure: tenure._id,
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Discussion not found.",
            });
        }

        const previousStatus = conversation.status;

        conversation.status = status;

        if (status === "published" && previousStatus !== "published") {
            conversation.publishedAt = new Date();
        }

        await conversation.save();

        await createAuditLog({
            actor: req.user._id,
            action: "EXCOM_DISCUSSION_STATUS_UPDATED",
            resource: "ExcomConversation",
            resourceId: conversation._id,
            req,
            details: {
                subject: conversation.subject,
                previousStatus,
                newStatus: status,
                tenure: tenure._id,
            },
        });

        return res.status(200).json({
            success: true,
            message: `Discussion ${status === "published" ? "published" : status === "draft" ? "moved to draft" : "archived"} successfully.`,
            conversation,
        });

    } catch (error) {
        console.error("Update EXCOM discussion status error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update discussion status.",
        });
    }
};


// ========================================
// DELETE DISCUSSION
// PRESIDENT ONLY
// ========================================

export const deleteExcomConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;

        if (!mongoose.isValidObjectId(conversationId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid discussion ID.",
            });
        }

        const tenure = await PresidentialTenure.findOne({
            president: req.user._id,
            status: "active",
        });

        if (!tenure) {
            return res.status(403).json({
                success: false,
                message: "No active presidential tenure found.",
            });
        }

        const conversation = await ExcomConversation.findOne({
            _id: conversationId,
            tenure: tenure._id,
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Discussion not found.",
            });
        }

        // Delete replies belonging to this discussion first.
        await ExcomReply.deleteMany({
            conversation: conversation._id,
        });

        await ExcomConversation.deleteOne({
            _id: conversation._id,
        });

        await createAuditLog({
            actor: req.user._id,
            action: "EXCOM_DISCUSSION_DELETED",
            resource: "ExcomConversation",
            resourceId: conversation._id,
            req,
            details: {
                subject: conversation.subject,
                tenure: tenure._id,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Discussion and its replies deleted successfully.",
        });

    } catch (error) {
        console.error("Delete EXCOM discussion error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete discussion.",
        });
    }
};