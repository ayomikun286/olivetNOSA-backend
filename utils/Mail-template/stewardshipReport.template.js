const escapeHtml = (value = "") =>
    String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[char]);

    const getMonthName = (month) => {
    const monthNumber = Number(month);

    if (monthNumber < 1 || monthNumber > 12) {
        return String(month);
    }

    return new Date(2000, monthNumber - 1).toLocaleString("en-US", {
        month: "long",
    });
};

export const buildStewardshipReportEmail = ({
    title,
    reportingMonth,
    reportingYear,
    content,
    pdfUrl,
    firstName,
}) => {
    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/+$/, "");

    if (!frontendUrl) {
        throw new Error("FRONTEND_URL is not configured.");
    }

    const announcementUrl =
        `${frontendUrl}/portal/member/dashboard/announcements`;

    const safeContent = escapeHtml(content || "").replace(/\n/g, "<br />");

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
</head>

<body style="margin:0;padding:0;background:#EAF1F8;font-family:Arial,Helvetica,sans-serif;color:#4B6075;">
    <div style="width:100%;padding:35px 15px;box-sizing:border-box;background:#EAF1F8;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">

            <div style="background:#0B294D;padding:30px 35px;text-align:center;">
                <img
                    src="https://res.cloudinary.com/bx4pnrek/image/upload/v1792582571/onw-gosa/website-content/ob1t3jspsuqz8wvxnkba.png"
                    alt="OlivetNOSA Crest"
                    width="70"
                    style="width:70px;height:auto;display:block;margin:0 auto 15px;"
                />

                <div style="color:#ffffff;font-size:25px;font-weight:700;">
                    OlivetNOSA
                </div>

                <div style="margin-top:7px;color:#C9A227;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
                    National Old Students' Association
                </div>
            </div>

            <div style="height:4px;background:#C9A227;"></div>

            <div style="padding:40px 35px;">
                <div style="color:#C9A227;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">
                    STEWARDSHIP REPORT
                </div>

                <h1 style="margin:0 0 15px;color:#0B294D;font-size:25px;line-height:1.3;">
                    ${escapeHtml(title)}
                </h1>

                <p style="color:#4B6075;font-size:14px;line-height:1.7;">
                    Dear ${escapeHtml(firstName || "Member")},
                </p>

                <p style="color:#4B6075;font-size:14px;line-height:1.7;">
                    A new stewardship report has been published for
                    <strong>${escapeHtml(getMonthName(reportingMonth))} ${escapeHtml(reportingYear)}</strong>.
                </p>

                <div style="color:#4B6075;font-size:15px;line-height:1.8;">
                    ${safeContent}
                </div>

                ${pdfUrl ? `
                <div style="text-align:center;margin:30px 0 15px;">
                    <a
                        href="${escapeHtml(pdfUrl)}"
                        style="display:inline-block;background:#123B6D;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:7px;font-size:14px;font-weight:700;"
                    >
                        View Stewardship Report PDF
                    </a>
                </div>
                ` : ""}

                <div style="text-align:center;margin:20px 0;">
                    <a
                        href="${escapeHtml(announcementUrl)}"
                        style="color:#123B6D;font-size:13px;font-weight:700;text-decoration:underline;"
                    >
                        Visit Member Portal
                    </a>
                </div>
            </div>

            <div style="background:#0B294D;padding:25px 35px;text-align:center;">
                <div style="color:#ffffff;font-size:15px;font-weight:700;margin-bottom:8px;">
                    OlivetNOSA
                </div>

                <div style="color:rgba(255,255,255,0.72);font-size:12px;line-height:1.6;">
                    National Old Students' Association
                </div>

                <div style="margin-top:10px;color:#C9A227;font-size:11px;font-weight:700;letter-spacing:1.5px;">
                    CUM CHRISTO PROGREDERE
                </div>

                <div style="margin-top:18px;color:rgba(255,255,255,0.55);font-size:11px;line-height:1.6;">
                    This is an automated email from OlivetNOSA.<br />
                    Please do not reply to this email.
                </div>
            </div>

        </div>
    </div>
</body>
</html>
`;
};