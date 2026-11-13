
const escapeHtml = (value = "") =>
    String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[char]);

export const buildObligationEmail = ({
    firstName,
    obligation,
    frontendUrl,
    groupName,
}) => {
    const obligationLink = `${frontendUrl}/portal/member/dashboard/my-obligation`;

    const amount = Number(obligation.amount).toLocaleString("en-NG");

    const dueDate = obligation.dueDate
        ? new Date(obligation.dueDate).toLocaleDateString("en-NG", {
            day: "numeric",
            month: "long",
            year: "numeric",
        })
        : "Not specified";

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Payment Obligation - OlivetNOSA</title>
</head>

<body style="margin:0;padding:0;background-color:#EAF1F8;font-family:Arial,Helvetica,sans-serif;color:#0B294D;">

<table width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#EAF1F8;padding:40px 15px;">
    <tr>
        <td align="center">

            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                style="max-width:620px;background-color:#ffffff;border-radius:12px;overflow:hidden;">

                <!-- HEADER -->
                <tr>
                    <td style="background-color:#0B294D;padding:30px 35px;text-align:center;">

                        <img
                            src="https://res.cloudinary.com/bx4pnrek/image/upload/v1792582571/onw-gosa/website-content/ob1t3jspsuqz8wvxnkba.png"
                            alt="OlivetNOSA"
                            width="70"
                            style="display:block;margin:0 auto 15px;max-width:70px;"
                        />

                        <div style="color:#ffffff;font-size:22px;font-weight:bold;">
                            OlivetNOSA
                        </div>

                        <div style="color:#C9A227;font-size:11px;font-weight:bold;letter-spacing:2px;margin-top:7px;text-transform:uppercase;">
                            National Old Students' Association
                        </div>

                    </td>
                </tr>

                <!-- GOLD DIVIDER -->
                <tr>
                    <td style="height:4px;background-color:#C9A227;font-size:0;line-height:0;">
                        &nbsp;
                    </td>
                </tr>

                <!-- CONTENT -->
                <tr>
                    <td style="padding:40px 35px;">

                        <p style="margin:0 0 8px;color:#C9A227;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">
                            Payment Notification
                        </p>

                        <h1 style="margin:0 0 20px;color:#0B294D;font-size:28px;line-height:1.25;">
                            New payment obligation
                        </h1>

                        <p style="margin:0 0 18px;color:#4B6075;font-size:15px;line-height:1.7;">
                            Hello ${escapeHtml(firstName)},
                        </p>

                        <p style="margin:0 0 25px;color:#4B6075;font-size:15px;line-height:1.7;">
                            A new payment obligation has been added to your OlivetNOSA account.
                            Please review the details below.
                        </p>

                        <!-- OBLIGATION DETAILS -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0"
                            style="background-color:#EAF1F8;border-radius:8px;padding:20px;">

                            <tr>
                                <td colspan="2" style="padding-bottom:15px;">
                                    <h2 style="margin:0;color:#123B6D;font-size:19px;">
                                        ${escapeHtml(obligation.name)}
                                    </h2>
                                </td>
                            </tr>

                            ${groupName ? `
                            <tr>
                                <td style="padding:8px 0;color:#4B6075;font-size:14px;">Group</td>
                                <td align="right" style="padding:8px 0;color:#0B294D;font-size:14px;font-weight:bold;">
                                    ${escapeHtml(groupName)}
                                </td>
                            </tr>
                            ` : ""}

                            <tr>
                                <td style="padding:8px 0;color:#4B6075;font-size:14px;">Amount</td>
                                <td align="right" style="padding:8px 0;color:#123B6D;font-size:17px;font-weight:bold;">
                                    ₦${amount}
                                </td>
                            </tr>

                            <tr>
                                <td style="padding:8px 0;color:#4B6075;font-size:14px;">Obligation Year</td>
                                <td align="right" style="padding:8px 0;color:#0B294D;font-size:14px;font-weight:bold;">
                                    ${escapeHtml(obligation.year)}
                                </td>
                            </tr>

                            <tr>
                                <td style="padding:8px 0;color:#4B6075;font-size:14px;">Due Date</td>
                                <td align="right" style="padding:8px 0;color:#0B294D;font-size:14px;font-weight:bold;">
                                    ${dueDate}
                                </td>
                            </tr>

                            ${obligation.description ? `
                            <tr>
                                <td colspan="2" style="padding-top:15px;border-top:1px solid #D5E0EA;color:#4B6075;font-size:13px;line-height:1.7;">
                                    ${escapeHtml(obligation.description)}
                                </td>
                            </tr>
                            ` : ""}

                        </table>

                        <p style="margin:28px 0;color:#4B6075;font-size:15px;line-height:1.7;">
                            Please log in to your member portal to review the obligation and check your payment status.
                        </p>

                        <!-- CTA -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td align="center">
                                    <a href="${obligationLink}"
                                        style="display:inline-block;background-color:#123B6D;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:15px 30px;border-radius:7px;">
                                        View My Obligation
                                    </a>
                                </td>
                            </tr>
                        </table>

                        <!-- FALLBACK LINK -->
                        <p style="margin:30px 0 8px;color:#4B6075;font-size:13px;line-height:1.6;">
                            If the button above does not work, copy and paste this link into your browser:
                        </p>

                        <p style="margin:0;word-break:break-all;font-size:12px;line-height:1.6;">
                            <a href="${obligationLink}" style="color:#123B6D;text-decoration:underline;">
                                ${obligationLink}
                            </a>
                        </p>

                        <p style="margin:30px 0 0;padding-top:25px;border-top:1px solid #E5EAF0;color:#6B7C8F;font-size:12px;line-height:1.6;">
                            If you have already fulfilled this obligation, please check your payment history or contact the association's administration for assistance.
                        </p>

                    </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                    <td style="background-color:#0B294D;padding:25px 35px;text-align:center;">

                        <p style="margin:0;color:#ffffff;font-size:13px;font-weight:bold;">
                            OlivetNOSA
                        </p>

                        <p style="margin:7px 0 0;color:rgba(255,255,255,0.65);font-size:11px;line-height:1.6;">
                            National Old Students' Association
                            <br />
                            Olivet Baptist High School
                        </p>

                        <p style="margin:15px 0 0;color:#C9A227;font-size:10px;letter-spacing:1px;">
                            CUM CHRISTO PROGREDERE
                        </p>

                    </td>
                </tr>

            </table>

            <p style="margin:20px 0 0;color:#7A8A9A;font-size:10px;text-align:center;">
                This is an automated email from OlivetNOSA. Please do not reply directly to this message.
            </p>

        </td>
    </tr>
</table>

</body>
</html>
`;
};
