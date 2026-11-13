import User from "../models/User.js";
import { queueEmail } from "./emailQueue.service.js";
import {
    buildStewardshipReportEmail,
} from "../utils/Mail-template/stewardshipReport.template.js";

export const queueStewardshipReportEmails = async (report) => {
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
            const html = buildStewardshipReportEmail({
                title: report.title,
                reportingMonth: report.reportingMonth,
                reportingYear: report.reportingYear,
                content: report.content,
                pdfUrl: report.pdfUrl,
                firstName: member.firstName,
            });

            const result = await queueEmail({
                recipientEmail: member.email,
                recipientUser: member._id,
                subject: `OlivetNOSA - New Stewardship Report: ${report.title}`,
                html,
                category: "stewardship",
                dedupeKey: `stewardship:${report._id}:${member._id}`,
            });

            if (result.duplicate) {
                duplicates++;
            } else if (result.queued) {
                queued++;
            }
        } catch (error) {
            failed++;
            console.error(
                `Stewardship email queue failed for ${member.email}:`,
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