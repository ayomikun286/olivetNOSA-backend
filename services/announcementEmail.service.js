import User from "../models/User.js";
import { queueEmail } from "./emailQueue.service.js";
import { buildAnnouncementEmail } from "../utils/Mail-template/announcement.template.js";

export const queueAnnouncementEmails = async (announcement) => {
    const members = await User.find({
        status: "active",
        role: {
            $nin: [
                "superAdmin",
                "treasurer",
                "secretary",
                "owner",
            ],
        },
        email: {
            $type: "string",
            $ne: "",
        },
    })
        .select("_id firstName email")
        .lean();

    let queued = 0;
    let duplicates = 0;
    let failed = 0;

    for (const member of members) {
        try {
            const html = buildAnnouncementEmail({
                title: announcement.title,
                content: announcement.content,
                firstName: member.firstName,
            });

            const result = await queueEmail({
                recipientEmail: member.email,
                recipientUser: member._id,
                subject: `OlivetNOSA - ${announcement.title}`,
                html,
                category: "announcement",
                dedupeKey: `announcement:${announcement._id}:${member._id}`,
            });

            if (result.duplicate) {
                duplicates++;
            } else if (result.queued) {
                queued++;
            }
        } catch (error) {
            failed++;
            console.error(
                `Announcement email queue failed for ${member.email}:`,
                error.message
            );
        }
    }

    return {
        totalRecipients: members.length,
        queued,
        duplicates,
        failed,
    };
};