import mongoose from "mongoose";
import User from "../models/User.js";
import { createAuditLog } from "../services/auditLog.service.js";
import PresidentialTenure from "../models/PresidentialTenure.js";

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
      role: { $in: ["admin", "treasurer", "secretary", "president"] },
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




export const assignPresident = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const { userId } = req.body;

        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "A valid member ID is required.",
            });
        }

        const newPresident = await User.findById(userId).session(session);

        if (!newPresident) {
            return res.status(404).json({
                success: false,
                message: "Member not found.",
            });
        }

        if (newPresident.role !== "member") {
            return res.status(400).json({
                success: false,
                message: "Only regular members can be appointed President.",
            });
        }

        if (newPresident.status !== "active") {
            return res.status(400).json({
                success: false,
                message: "Only active members can be appointed President.",
            });
        }

        let previousPresident = null;
        let alreadyPresident = false;

        const startDate = new Date();

        await session.withTransaction(async () => {
            previousPresident = await User.findOne({
                role: "president",
            }).session(session);

            if (previousPresident?._id.equals(newPresident._id)) {
                alreadyPresident = true;
                return;
            }

            // Complete the previous President's tenure.
            if (previousPresident) {
                await PresidentialTenure.findOneAndUpdate(
                    {
                        president: previousPresident._id,
                        status: "active",
                    },
                    {
                        $set: {
                            status: "completed",
                            endDate: startDate,
                        },
                    },
                    { session }
                );

                previousPresident.role = "member";
                previousPresident.isPresident = false;

                await previousPresident.save({ session });
            }

            // Assign the new President.
            newPresident.role = "president";
            newPresident.isPresident = true;

            await newPresident.save({ session });

            // Create the new presidential tenure.
            await PresidentialTenure.create(
                [
                    {
                        president: newPresident._id,
                        startDate,
                        status: "active",
                        createdBy: req.user._id,
                    },
                ],
                { session }
            );
        });

        if (alreadyPresident) {
            return res.status(200).json({
                success: true,
                message: "This member is already the President.",
            });
        }

        await createAuditLog({
            actor: req.user._id,
            action: "PRESIDENT_ASSIGNED",
            resource: "User",
            resourceId: newPresident._id,
            targetUser: newPresident._id,
            req,
            details: {
                newPresident: newPresident.email,
                previousPresident: previousPresident?.email || null,
            },
        });

        return res.status(200).json({
            success: true,
            message: `${newPresident.firstName} has been appointed President.`,
        });

    } catch (error) {
        console.error("Assign President error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to appoint President.",
        });

    } finally {
        await session.endSession();
    }
};
