import mongoose from "mongoose";
import User from "../models/User.js";
import { createAuditLog } from "../services/auditLog.service.js";

const ALLOWED_TEAM_ROLES = [
    "admin",
    "treasurer",
    "secretary",
];

export const createTeam = async (req, res) => {
    try {
        const { email, role } = req.body;

        if (!email?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Email is required.",
            });
        }

        if (!role) {
            return res.status(400).json({
                success: false,
                message: "Role is required.",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedRole = role.trim().toLowerCase();

        if (!ALLOWED_TEAM_ROLES.includes(normalizedRole)) {
            return res.status(400).json({
                success: false,
                message: "Invalid team role.",
            });
        }

        const user = await User.findOne({
            email: normalizedEmail,
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found. The user must register first.",
            });
        }

        const previousRole = user.role;
        const previousStatus = user.status;

        user.role = normalizedRole;
        user.status = "active";
        user.isEmailVerified = true;

        await user.save();

        await createAuditLog({
            actor: req.user._id,
            action: "TEAM_ROLE_ASSIGNED",
            resource: "Team",
            resourceId: user._id,
            targetUser: user._id,
            req,
            details: {
                name: [
                    user.firstName,
                    user.lastName,
                ].filter(Boolean).join(" "),
                email: user.email,
                previousRole,
                newRole: normalizedRole,
                previousStatus,
                newStatus: user.status,
            },
        });

        return res.status(200).json({
            success: true,
            message: `Role assigned to ${user.firstName}.`,
        });
    } catch (error) {
        console.error("Assign team role error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to assign team role.",
        });
    }
};

export const getTeamMembers = async (req, res) => {
  try {
    const teamMembers = await User.find({
      role: { $in: ["admin", "treasurer", "secretary"] },
    })
      .select("firstName lastName email role status createdAt")
      .sort({ role: 1, firstName: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: teamMembers.length,
      teamMembers,
    });
  } catch (error) {
    console.error("Get team members error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch team members.",
    });
  }
};




export const suspendTeamRole = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid member ID.",
            });
        }

        const actor = req.user;

        const member = await User.findById(id);

        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found.",
            });
        }

        const teamRoles = ["admin", "treasurer", "secretary"];

        if (!teamRoles.includes(member.role)) {
            return res.status(400).json({
                success: false,
                message: "This member does not have a suspendable team role.",
            });
        }

        // Prevent an administrator from removing their own role.
        if (String(actor._id) === String(member._id)) {
            return res.status(403).json({
                success: false,
                message: "You cannot suspend your own team role.",
            });
        }

        // Only a superAdmin may suspend another superAdmin.
        // This endpoint does not suspend superAdmin roles.
        if (member.role === "superAdmin") {
            return res.status(403).json({
                success: false,
                message: "SuperAdmin roles cannot be suspended here.",
            });
        }

        const previousRole = member.role;

        // Remove team permissions without suspending the account.
        member.role = "member";
        await member.save();

        await createAuditLog({
            actor: actor._id,
            action: "TEAM_ROLE_SUSPENDED",
            resource: "Team",
            resourceId: member._id,
            targetUser: member._id,
            details: {
                memberName: `${member.firstName} ${member.lastName}`,
                memberEmail: member.email,
                previousRole,
                newRole: "member",
                accountStatusUnchanged: true,
            },
            req,
        });

        return res.status(200).json({
            success: true,
            message: `${member.firstName}'s team role has been suspended.`,
        });
    } catch (error) {
        console.error("Suspend team role error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to suspend team role.",
        });
    }
};