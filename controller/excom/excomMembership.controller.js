import mongoose from "mongoose";

import User from "../../models/User.js";
import PresidentialTenure from "../../models/PresidentialTenure.js";
import ExcomMembership from "../../models/ExcomMembership.js";

import { createAuditLog } from "../../services/auditLog.service.js";


// ========================================
// HELPER: GET CURRENT PRESIDENTIAL TENURE
// ========================================

const getCurrentTenure = async (presidentId) => {
    return PresidentialTenure.findOne({
        president: presidentId,
        status: "active",
    });
};


// ========================================
// GET ELIGIBLE MEMBERS
// ========================================

export const getEligibleExcomMembers = async (req, res) => {
    try {
        const tenure = await getCurrentTenure(req.user._id);

        if (!tenure) {
            return res.status(404).json({
                success: false,
                message: "No active presidential tenure found.",
            });
        }

        const existingMemberships = await ExcomMembership.find({
            tenure: tenure._id,
            status: "active",
        }).select("user");

        const assignedUserIds = existingMemberships.map(
            (membership) => membership.user
        );

        const members = await User.find({
            role: "member",
            status: "active",
            _id: {
                $nin: [...assignedUserIds, req.user._id],
            },
        })
            .select("firstName lastName email alumniId")
            .sort({ firstName: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: members.length,
            members,
        });

    } catch (error) {
        console.error("Get eligible EXCOM members error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch eligible EXCOM members.",
        });
    }
};


// ========================================
// APPOINT EXCOM MEMBER
// ========================================

export const appointExcomMember = async (req, res) => {
    try {
        const { userId, position } = req.body;

        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "A valid member ID is required.",
            });
        }

        if (!position?.trim()) {
            return res.status(400).json({
                success: false,
                message: "EXCOM position is required.",
            });
        }

        const normalizedPosition = position.trim().toLowerCase();

        if (normalizedPosition.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Position cannot exceed 100 characters.",
            });
        }

        const tenure = await getCurrentTenure(req.user._id);

        if (!tenure) {
            return res.status(404).json({
                success: false,
                message: "No active presidential tenure found.",
            });
        }

        const member = await User.findById(userId);

        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found.",
            });
        }

        if (member.role !== "member" || member.status !== "active") {
            return res.status(400).json({
                success: false,
                message: "Only active regular members can be appointed to EXCOM.",
            });
        }

        if (String(member._id) === String(req.user._id)) {
            return res.status(400).json({
                success: false,
                message: "The President cannot appoint themselves as an EXCOM member.",
            });
        }

        const existingMembership = await ExcomMembership.findOne({
            tenure: tenure._id,
            user: member._id,
            status: "active",
        });

        if (existingMembership) {
            return res.status(409).json({
                success: false,
                message: "This member is already part of your EXCOM team.",
            });
        }

        const existingPosition = await ExcomMembership.findOne({
            tenure: tenure._id,
            position: normalizedPosition,
            status: "active",
        });

        if (existingPosition) {
            return res.status(409).json({
                success: false,
                message: "This EXCOM position is already occupied.",
            });
        }

        const membership = await ExcomMembership.create({
            tenure: tenure._id,
            user: member._id,
            position: normalizedPosition,
            appointedBy: req.user._id,
            status: "active",
        });

        await createAuditLog({
            actor: req.user._id,
            action: "EXCOM_MEMBER_APPOINTED",
            resource: "ExcomMembership",
            resourceId: membership._id,
            targetUser: member._id,
            req,
            details: {
                memberName: `${member.firstName} ${member.lastName}`,
                memberEmail: member.email,
                position: normalizedPosition,
                tenure: tenure._id,
            },
        });

        return res.status(201).json({
            success: true,
            message: `${member.firstName} has been appointed as ${normalizedPosition}.`,
            membership,
        });

    } catch (error) {
        console.error("Appoint EXCOM member error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "This member or position already has an active appointment in this tenure.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to appoint EXCOM member.",
        });
    }
};


// ========================================
// GET CURRENT EXCOM TEAM
// ========================================

export const getExcomMembers = async (req, res) => {
    try {
        const tenure = await getCurrentTenure(req.user._id);

        if (!tenure) {
            return res.status(404).json({
                success: false,
                message: "No active presidential tenure found.",
            });
        }

        const members = await ExcomMembership.find({
            tenure: tenure._id,
            status: "active",
        })
            .populate("user", "firstName lastName email alumniId profile.profilePhoto")
            .sort({ position: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: members.length,
            members,
        });

    } catch (error) {
        console.error("Get EXCOM members error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch EXCOM members.",
        });
    }
};


// ========================================
// REMOVE EXCOM MEMBER
// ========================================

export const removeExcomMember = async (req, res) => {
    try {
        const { membershipId } = req.params;

        if (!mongoose.isValidObjectId(membershipId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid EXCOM membership ID.",
            });
        }

        const tenure = await getCurrentTenure(req.user._id);

        if (!tenure) {
            return res.status(404).json({
                success: false,
                message: "No active presidential tenure found.",
            });
        }

        const membership = await ExcomMembership.findOne({
            _id: membershipId,
            tenure: tenure._id,
            status: "active",
        }).populate("user", "firstName lastName email");

        if (!membership) {
            return res.status(404).json({
                success: false,
                message: "Active EXCOM membership not found.",
            });
        }

        membership.status = "inactive";
        membership.removedAt = new Date();

        await membership.save();

        await createAuditLog({
            actor: req.user._id,
            action: "EXCOM_MEMBER_REMOVED",
            resource: "ExcomMembership",
            resourceId: membership._id,
            targetUser: membership.user._id,
            req,
            details: {
                memberName: `${membership.user.firstName} ${membership.user.lastName}`,
                memberEmail: membership.user.email,
                position: membership.position,
                tenure: tenure._id,
            },
        });

        return res.status(200).json({
            success: true,
            message: `${membership.user.firstName} has been removed from your EXCOM team.`,
        });

    } catch (error) {
        console.error("Remove EXCOM member error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to remove EXCOM member.",
        });
    }
};