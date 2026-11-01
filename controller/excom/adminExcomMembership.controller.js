
import mongoose from "mongoose";
import User from "../../models/User.js";
import PresidentialTenure from "../../models/PresidentialTenure.js";
import ExcomMembership from "../../models/ExcomMembership.js";
import { createAuditLog } from "../../services/auditLog.service.js";

export const assignExcomMember = async (req, res) => {
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

        const normalizedPosition = position.trim();

        if (normalizedPosition.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Position cannot exceed 100 characters.",
            });
        }

        const [member, activeTenure] = await Promise.all([
            User.findById(userId),
            PresidentialTenure.findOne({ status: "active" }),
        ]);

        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found.",
            });
        }

        if (member.role === "president" || member.isPresident) {
            return res.status(400).json({
                success: false,
                message: "The President cannot be assigned as an EXCOM member.",
            });
        }

        if (member.status !== "active") {
            return res.status(400).json({
                success: false,
                message: "Only active members can be appointed.",
            });
        }

        if (!activeTenure) {
            return res.status(400).json({
                success: false,
                message: "There is no active presidential tenure.",
            });
        }

        const appointment = await ExcomMembership.create({
            tenure: activeTenure._id,
            user: member._id,
            position: normalizedPosition,
            appointedBy: req.user._id,
        });

        await createAuditLog({
            actor: req.user._id,
            action: "EXCOM_MEMBER_APPOINTED",
            resource: "ExcomMembership",
            resourceId: appointment._id,
            targetUser: member._id,
            req,
            details: {
                memberName: `${member.firstName} ${member.lastName}`,
                memberEmail: member.email,
                position: normalizedPosition,
                tenureId: activeTenure._id,
            },
        });

        return res.status(201).json({
            success: true,
            message: `${member.firstName} has been appointed as ${normalizedPosition}.`,
            appointment,
        });
    } catch (error) {
        console.error("Admin EXCOM appointment error:", error);

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



export const getExcomMembers = async (req, res) => {
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

        const members = await ExcomMembership.find({
            tenure: tenureId,
        })
            .populate("user", "firstName middleName lastName email")
            .populate("appointedBy", "firstName lastName")
            .sort({ appointedAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            tenure,
            count: members.length,
            activeMembers: members.filter(
                (member) => member.status === "active"
            ),
            formerMembers: members.filter(
                (member) => member.status === "inactive"
            ),
        });
    } catch (error) {
        console.error("Get EXCOM members error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch EXCOM members.",
        });
    }
};



export const updateExcomMember = async (req, res) => {
    try {
        const { membershipId } = req.params;
        const { position } = req.body;

        if (!mongoose.isValidObjectId(membershipId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid EXCOM membership ID.",
            });
        }

        if (!position?.trim()) {
            return res.status(400).json({
                success: false,
                message: "New position is required.",
            });
        }

        const normalizedPosition = position.trim();

        if (normalizedPosition.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Position cannot exceed 100 characters.",
            });
        }

        const appointment = await ExcomMembership.findById(membershipId)
            .populate("user", "firstName lastName email");


  
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: "EXCOM appointment not found.",
            });
        }

        if (appointment.status !== "active") {
            return res.status(400).json({
                success: false,
                message: "Only active appointments can be changed.",
            });
        }

    

        const tenure = await PresidentialTenure.findOne({
            _id: appointment.tenure,
            status: "active",
        });

        if (!tenure) {
            return res.status(400).json({
                success: false,
                message: "Appointments can only be changed within an active presidential tenure.",
            });
        }

        const previousPosition = appointment.position;

        appointment.position = normalizedPosition;
        await appointment.save();

        await createAuditLog({
            actor: req.user._id,
            action: "EXCOM_MEMBER_POSITION_UPDATED",
            resource: "ExcomMembership",
            resourceId: appointment._id,
            targetUser: appointment.user._id,
            req,
            details: {
                memberName: `${appointment.user.firstName} ${appointment.user.lastName}`,
                previousPosition,
                newPosition: normalizedPosition,
                tenureId: appointment.tenure,
            },
        });

        return res.status(200).json({
            success: true,
            message: "EXCOM position updated successfully.",
            appointment,
        });
    } catch (error) {
        console.error("Update EXCOM position error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Another active member already holds this position.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to update EXCOM position.",
        });
    }
};



export const removeExcomMember = async (req, res) => {
    try {
        const { membershipId } = req.params;

        if (!mongoose.isValidObjectId(membershipId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid EXCOM membership ID.",
            });
        }

        const appointment = await ExcomMembership.findById(membershipId)
            .populate("user", "firstName lastName email");

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: "EXCOM appointment not found.",
            });
        }

        if (appointment.status !== "active") {
            return res.status(400).json({
                success: false,
                message: "This appointment is already inactive.",
            });
        }

        const tenure = await PresidentialTenure.findOne({
            _id: appointment.tenure,
            status: "active",
        });

        if (!tenure) {
            return res.status(400).json({
                success: false,
                message: "Only appointments in an active presidential tenure can be removed.",
            });
        }

        appointment.status = "inactive";
        appointment.removedAt = new Date();

        await appointment.save();

        await createAuditLog({
            actor: req.user._id,
            action: "EXCOM_MEMBER_REMOVED",
            resource: "ExcomMembership",
            resourceId: appointment._id,
            targetUser: appointment.user._id,
            req,
            details: {
                memberName: `${appointment.user.firstName} ${appointment.user.lastName}`,
                position: appointment.position,
                tenureId: appointment.tenure,
                removedAt: appointment.removedAt,
            },
        });

        return res.status(200).json({
            success: true,
            message: `${appointment.user.firstName}'s EXCOM appointment has been removed.`,
        });
    } catch (error) {
        console.error("Remove EXCOM member error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to remove EXCOM appointment.",
        });
    }
};


