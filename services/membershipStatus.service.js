import User from "../models/User.js";
import ObligationAssignment from "../models/ObligationAssignment.js";

import { createAuditLog } from "./auditLog.service.js";
import { createNotification } from "./notificationService.js";

/**
 * Check whether a member has failed to meet
 * their mandatory dues for two or more years.
 *
 * Rules:
 * - Only individual obligations count.
 * - Optional obligations do NOT count.
 * - Inactive obligations do NOT count.
 * - Fully paid obligations do NOT count.
 * - Partial payment counts as unpaid/outstanding.
 * - Multiple unpaid obligations in the same year count as ONE year.
 */
export const checkMemberSuspensionEligibility = async (userId) => {
    try {
        const assignments = await ObligationAssignment.find({
            user: userId,
        }).populate(
            "obligation",
            "name category amount year dueDate isActive isOptional"
        );

        const unpaidYears = new Set();
        const unpaidObligations = [];

        for (const assignment of assignments) {
            const obligation = assignment.obligation;

            if (!obligation) continue;

            // Only individual member dues count
            if (obligation.category !== "individual") continue;

            // Inactive obligations do not count
            if (obligation.isActive === false) continue;

            // Optional obligations do not count
            if (obligation.isOptional === true) continue;

            const amountDue = Number(
                assignment.amountDue ?? obligation.amount ?? 0
            );

            const amountPaid = Number(
                assignment.amountPaid ?? 0
            );

            const outstanding = Math.max(
                amountDue - amountPaid,
                0
            );

            // Fully paid
            if (outstanding <= 0) continue;

            const dueDate =
                assignment.dueDate ??
                obligation.dueDate ??
                null;

            if (!dueDate) continue;

            if (new Date(dueDate) >= new Date()) {
                continue;
            }

            const year = Number(obligation.year);

            if (!year) continue;

            unpaidYears.add(year);

            unpaidObligations.push({
                assignmentId: assignment._id,
                obligationId: obligation._id,
                name: obligation.name,
                year,
                amountDue,
                amountPaid,
                outstanding,
                dueDate:
                    assignment.dueDate ??
                    obligation.dueDate ??
                    null,
            });
        }

        const unpaidYearList = [...unpaidYears].sort(
            (a, b) => a - b
        );

        return {
            qualifiesForSuspension:
                unpaidYearList.length >= 2,

            unpaidYears: unpaidYearList,

            unpaidYearCount:
                unpaidYearList.length,

            unpaidObligations,
        };
    } catch (error) {
        console.error(
            "Check member suspension eligibility error:",
            error
        );

        throw error;
    }
};


/**
 * Evaluate a member and automatically suspend them
 * if they have failed to meet mandatory dues for two years.
 */
export const evaluateMemberSuspension = async (userId) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            throw new Error("Member not found.");
        }

        // Only regular members should be automatically suspended.
        if (user.role !== "member") {
            return {
                suspended: false,
                reason: "User is not a regular member.",
            };
        }

        // Do not alter manually inactive/deactivated accounts.
        if (
            user.status === "inactive" ||
            user.status === "deactivated"
        ) {
            return {
                suspended: false,
                reason: `Member status is ${user.status}.`,
            };
        }

        const result =
            await checkMemberSuspensionEligibility(userId);

        // Does not meet the two-year threshold.
        if (!result.qualifiesForSuspension) {
            return {
                suspended: false,
                ...result,
            };
        }

        // Already suspended.
        if (user.status === "suspended") {
            return {
                suspended: false,
                alreadySuspended: true,
                ...result,
            };
        }

        // ========================================
        // SUSPEND MEMBER
        // ========================================

        const previousStatus = user.status;

        user.status = "suspended";

        await user.save();

        // ========================================
        // AUDIT LOG
        // ========================================

        await createAuditLog({
            actor: null,
            action: "member.suspended",
            resource: "User",
            resourceId: user._id,
            targetUser: user._id,
            details: {
                reason:
                    "Member failed to meet mandatory dues for two or more years.",

                previousStatus,

                unpaidYears: result.unpaidYears,

                unpaidYearCount:
                    result.unpaidYearCount,

                unpaidObligations:
                    result.unpaidObligations.map(
                        (obligation) => ({
                            name: obligation.name,
                            year: obligation.year,
                            amountDue: obligation.amountDue,
                            amountPaid: obligation.amountPaid,
                            outstanding:
                                obligation.outstanding,
                        })
                    ),
            },
        });

        // ========================================
        // MEMBER NOTIFICATION
        // ========================================

        await createNotification({
            userId: user._id,
            type: "membership",
            title: "Membership Suspended",
            message:
                "Your membership has been suspended because mandatory dues have remained unmet for two or more years. Please contact the association for assistance.",
            link: "/portal/member/dashboard/my-obligation",
        });

        return {
            suspended: true,
            previousStatus,
            ...result,
        };
    } catch (error) {
        console.error(
            "Evaluate member suspension error:",
            error
        );

        throw error;
    }
};


export const processMembershipSuspensions = async () => {
  try {
    const users = await User.find({
      role: "member",
      status: "active",
    }).select("_id");

    let checked = 0;
    let suspended = 0;
    let skipped = 0;

    for (const user of users) {
      checked++;

      try {
        const result =
          await evaluateMemberSuspension(user._id);

        if (result.suspended) {
          suspended++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(
          `Failed to evaluate member ${user._id}:`,
          error
        );

        skipped++;
      }
    }

    return {
      success: true,
      checked,
      suspended,
      skipped,
    };
  } catch (error) {
    console.error(
      "Process membership suspensions error:",
      error
    );

    throw error;
  }
};