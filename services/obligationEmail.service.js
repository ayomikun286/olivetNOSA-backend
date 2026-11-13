import User from "../models/User.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import YearSet from "../models/YearSet.js";
import Chapter from "../models/Chapter.js";

import { queueEmail } from "./emailQueue.service.js";
import { buildObligationEmail } from "../utils/Mail-template/obligation.template.js";

export const queueObligationEmails = async (obligation) => {
    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/+$/, "");

    if (!frontendUrl) {
        throw new Error("FRONTEND_URL is not configured");
    }

    let recipients = [];

    // Individual obligation: notify assigned members
    if (obligation.category === "individual") {
        const assignments = await ObligationAssignment.find({
            obligation: obligation._id,
        })
            .populate({
                path: "user",
                select: "_id firstName email",
            })
            .lean();

        const uniqueRecipients = new Map();

        for (const assignment of assignments) {
            const member = assignment.user;

            if (
                member?._id &&
                typeof member.email === "string" &&
                member.email.trim()
            ) {
                uniqueRecipients.set(member._id.toString(), {
                    ...member,
                    groupName: "",
                });
            }
        }

        recipients = [...uniqueRecipients.values()];
    }

    // Year set or chapter obligation: notify group leaders
    else if (
        obligation.category === "yearSet" ||
        obligation.category === "chapter"
    ) {
        const ownerField =
            obligation.category === "yearSet" ? "yearSet" : "chapter";

        const GroupModel =
            obligation.category === "yearSet" ? YearSet : Chapter;

        const assignments = await ObligationAssignment.find({
            obligation: obligation._id,
        })
            .select(ownerField)
            .lean();

        const groupIds = [
            ...new Set(
                assignments
                    .map((assignment) => assignment[ownerField]?.toString())
                    .filter(Boolean)
            ),
        ];

        const groups = await GroupModel.find({
            _id: { $in: groupIds },
            isActive: true,
            leader: { $ne: null },
        })
            .populate({
                path: "leader",
                select: "_id firstName email",
            })
            .select("name year leader")
            .lean();

        const uniqueLeaders = new Map();

        for (const group of groups) {
            const leader = group.leader;

            if (
                leader?._id &&
                typeof leader.email === "string" &&
                leader.email.trim()
            ) {
                uniqueLeaders.set(leader._id.toString(), {
                    ...leader,
                    groupName: group.name || group.year || "",
                });
            }
        }

        recipients = [...uniqueLeaders.values()];
    }

    let queued = 0;
    let duplicates = 0;
    let failed = 0;

    for (const recipient of recipients) {
        try {
            const html = buildObligationEmail({
                firstName: recipient.firstName,
                obligation,
                frontendUrl,
                groupName: recipient.groupName,
            });

            const result = await queueEmail({
                recipientEmail: recipient.email,
                recipientUser: recipient._id,
                subject: `OlivetNOSA - New Payment Obligation: ${obligation.name}`,
                html,
                category: "obligation",
                dedupeKey: `obligation:${obligation._id}:${recipient._id}`,
            });

            if (result.duplicate) {
                duplicates++;
            } else if (result.queued) {
                queued++;
            }
        } catch (error) {
            failed++;

            console.error(
                `Obligation email queue failed for ${recipient.email}:`,
                error.message
            );
        }
    }

    return {
        totalRecipients: recipients.length,
        queued,
        duplicates,
        failed,
    };
};