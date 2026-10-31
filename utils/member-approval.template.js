
const escapeHtml = (value = "") =>
    String(value).replace(/[&<>"']/g, (char) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };

        return entities[char];
    });

export const memberApprovalTemplate = ({
    name,
    alumniId,
    loginUrl,
}) => {
    const safeName = escapeHtml(name || "OlivetNOSA Member");
    const safeAlumniId = escapeHtml(alumniId || "See your member portal");
    const safeLoginUrl = escapeHtml(
        loginUrl || "https://res.cloudinary.com/bx4pnrek/image/upload/v1792582571/onw-gosa/website-content/ob1t3jspsuqz8wvxnkba.png"
    );

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your OlivetNOSA Account Has Been Approved</title>
</head>

<body style="margin:0;padding:0;background-color:#EAF1F8;font-family:Arial,Helvetica,sans-serif;color:#0B294D;">

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background-color:#EAF1F8;padding:35px 12px;">
        <tr>
            <td align="center">

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                    style="max-width:620px;background-color:#FFFFFF;border:1px solid #DCE5EF;border-radius:12px;overflow:hidden;">

                    <!-- HEADER -->
                    <tr>
                        <td align="center" style="background-color:#0B294D;padding:32px 24px 26px;">

                            <img
                                src="https://res.cloudinary.com/bx4pnrek/image/upload/v1792582571/onw-gosa/website-content/ob1t3jspsuqz8wvxnkba.png"
                                alt="OlivetNOSA Crest"
                                width="76"
                                style="display:block;width:76px;max-width:76px;height:auto;margin:0 auto 16px;"
                            />

                            <h1 style="margin:0;color:#FFFFFF;font-size:25px;line-height:1.3;letter-spacing:0.5px;">
                                OlivetNOSA
                            </h1>

                            <p style="margin:7px 0 0;color:#EAF1F8;font-size:12px;line-height:1.6;letter-spacing:1.5px;text-transform:uppercase;">
                                National Old Students' Association
                            </p>

                            <p style="margin:8px 0 0;color:#D9E3EF;font-size:13px;">
                                Olivet Baptist High School
                            </p>

                        </td>
                    </tr>

                    <!-- GOLD DIVIDER -->
                    <tr>
                        <td style="height:4px;background-color:#C9A227;font-size:0;line-height:0;">
                            &nbsp;
                        </td>
                    </tr>

                    <!-- MAIN CONTENT -->
                    <tr>
                        <td style="padding:36px 30px 32px;">

                            <p style="margin:0 0 12px;color:#A17B10;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">
                                Membership Update
                            </p>

                            <h2 style="margin:0 0 16px;color:#0B294D;font-size:27px;line-height:1.35;">
                                Congratulations, ${safeName}!
                            </h2>

                            <p style="margin:0 0 18px;color:#536579;font-size:15px;line-height:1.9;">
                                We are pleased to inform you that your OlivetNOSA
                                membership application has been reviewed and
                                <strong style="color:#0B294D;">approved</strong>
                                by the administration.
                            </p>

                            <p style="margin:0 0 25px;color:#536579;font-size:15px;line-height:1.9;">
                                Welcome to the OlivetNOSA online community. Your
                                account is now approved, and you can sign in to
                                access your member portal and the services
                                available to you.
                            </p>

                            <!-- APPROVAL STATUS -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                                style="background-color:#F5F8FC;border:1px solid #DCE5EF;border-radius:8px;">
                                <tr>
                                    <td style="padding:20px 22px;">

                                        <p style="margin:0 0 7px;color:#718096;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
                                            Account Status
                                        </p>

                                        <p style="margin:0 0 20px;color:#176B45;font-size:15px;font-weight:700;">
                                            ✓ Approved
                                        </p>

                                        <p style="margin:0 0 7px;color:#718096;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
                                            Alumni ID
                                        </p>

                                        <p style="margin:0;color:#0B294D;font-size:17px;font-weight:700;line-height:1.6;overflow-wrap:anywhere;">
                                            ${safeAlumniId}
                                        </p>

                                    </td>
                                </tr>
                            </table>

                            <!-- NEXT STEPS -->
                            <h3 style="margin:28px 0 12px;color:#0B294D;font-size:17px;">
                                What happens next?
                            </h3>

                            <p style="margin:0 0 22px;color:#536579;font-size:14px;line-height:1.9;">
                                Sign in to your account to explore your dashboard,
                                update your profile, connect with fellow alumni,
                                and view the membership features available to you.
                            </p>

                            <!-- CTA -->
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                                <tr>
                                    <td align="center" bgcolor="#0B294D" style="border-radius:6px;">
                                        <a
                                            href="${safeLoginUrl}"
                                            target="_blank"
                                            style="display:inline-block;padding:15px 28px;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;border-radius:6px;"
                                        >
                                            Sign In to Your Account
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:0 0 14px;color:#718096;font-size:12px;line-height:1.8;">
                                If the button does not work, copy and paste this
                                link into your browser:
                            </p>

                            <p style="margin:0 0 24px;font-size:12px;line-height:1.8;overflow-wrap:anywhere;">
                                <a href="${safeLoginUrl}" target="_blank"
                                    style="color:#2563A6;text-decoration:underline;">
                                    ${safeLoginUrl}
                                </a>
                            </p>

                            <p style="margin:0;color:#536579;font-size:13px;line-height:1.9;">
                                We are delighted to welcome you. Thank you for
                                being part of the OlivetNOSA family as we
                                strengthen our bonds and continue to support
                                the Olivet Baptist High School community.
                            </p>

                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td align="center" style="padding:25px;background-color:#F5F8FC;border-top:1px solid #DCE5EF;">

                            <p style="margin:0 0 7px;color:#0B294D;font-size:14px;font-weight:700;">
                                OlivetNOSA
                            </p>

                            <p style="margin:0 0 10px;color:#718096;font-size:12px;line-height:1.8;">
                                National Old Students' Association<br />
                                Olivet Baptist High School
                            </p>

                            <p style="margin:0 0 12px;color:#A17B10;font-size:11px;font-weight:700;letter-spacing:1px;">
                                CUM CHRISTO PROGREDERE
                            </p>

                            <p style="margin:0;color:#94A3B8;font-size:11px;line-height:1.7;">
                                This is an official account notification from OlivetNOSA.
                                Please keep your login credentials secure.
                            </p>

                            <p style="margin:12px 0 0;color:#94A3B8;font-size:11px;">
                                &copy; ${new Date().getFullYear()} OlivetNOSA. All rights reserved.
                            </p>

                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>

</body>
</html>
`;
};
