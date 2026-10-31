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

export const contactEmailTemplate = ({
    name,
    email,
    subject,
    message,
}) => {
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    const replyUrl = escapeHtml(
        `mailto:${email}?subject=${encodeURIComponent(
            `Re: ${subject}`
        )}`
    );

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New OlivetNOSA Enquiry</title>
</head>

<body style="
    margin: 0;
    padding: 0;
    background-color: #EAF1F8;
    font-family: Arial, Helvetica, sans-serif;
    color: #0B294D;
">

    <table
        role="presentation"
        width="100%"
        cellpadding="0"
        cellspacing="0"
        border="0"
        style="background-color: #EAF1F8; padding: 35px 12px;"
    >
        <tr>
            <td align="center">

                <table
                    role="presentation"
                    width="100%"
                    cellpadding="0"
                    cellspacing="0"
                    border="0"
                    style="
                        max-width: 620px;
                        background-color: #ffffff;
                        border-radius: 12px;
                        overflow: hidden;
                        border: 1px solid #DCE5EF;
                    "
                >

                    <!-- HEADER -->
                    <tr>
                        <td
                            align="center"
                            style="
                                background-color: #0B294D;
                                padding: 32px 24px 26px;
                            "
                        >
                            <img
                                src="https://res.cloudinary.com/bx4pnrek/image/upload/v1792582571/onw-gosa/website-content/ob1t3jspsuqz8wvxnkba.png"
                                alt="OlivetNOSA Crest"
                                width="76"
                                style="
                                    display: block;
                                    width: 76px;
                                    max-width: 76px;
                                    height: auto;
                                    margin: 0 auto 16px;
                                "
                            />

                            <h1 style="
                                margin: 0;
                                color: #ffffff;
                                font-size: 25px;
                                line-height: 1.3;
                                font-weight: 700;
                                letter-spacing: 0.5px;
                            ">
                                OlivetNOSA
                            </h1>

                            <p style="
                                margin: 7px 0 0;
                                color: #EAF1F8;
                                font-size: 12px;
                                line-height: 1.6;
                                letter-spacing: 1.5px;
                                text-transform: uppercase;
                            ">
                                National Old Students' Association
                            </p>

                            <p style="
                                margin: 8px 0 0;
                                color: #D9E3EF;
                                font-size: 13px;
                            ">
                                Olivet Baptist High School
                            </p>
                        </td>
                    </tr>

                    <!-- GOLD DIVIDER -->
                    <tr>
                        <td style="
                            height: 4px;
                            background-color: #C9A227;
                            font-size: 0;
                            line-height: 0;
                        ">
                            &nbsp;
                        </td>
                    </tr>

                    <!-- MAIN CONTENT -->
                    <tr>
                        <td style="padding: 34px 30px 30px;">

                            <p style="
                                margin: 0 0 12px;
                                color: #A17B10;
                                font-size: 11px;
                                font-weight: 700;
                                letter-spacing: 1.5px;
                                text-transform: uppercase;
                            ">
                                Website Contact Notification
                            </p>

                            <h2 style="
                                margin: 0 0 15px;
                                color: #0B294D;
                                font-size: 25px;
                                line-height: 1.35;
                                font-weight: 700;
                            ">
                                A new enquiry has arrived
                            </h2>

                            <p style="
                                margin: 0 0 25px;
                                color: #536579;
                                font-size: 15px;
                                line-height: 1.8;
                            ">
                                Someone has contacted OlivetNOSA through the
                                website contact form. The details and message
                                are provided below for your attention.
                            </p>

                            <!-- SENDER DETAILS -->
                            <table
                                role="presentation"
                                width="100%"
                                cellpadding="0"
                                cellspacing="0"
                                border="0"
                                style="
                                    background-color: #F5F8FC;
                                    border: 1px solid #DCE5EF;
                                    border-radius: 8px;
                                "
                            >
                                <tr>
                                    <td style="padding: 20px 22px;">

                                        <p style="
                                            margin: 0 0 5px;
                                            color: #718096;
                                            font-size: 11px;
                                            font-weight: 700;
                                            letter-spacing: 1px;
                                            text-transform: uppercase;
                                        ">
                                            Sender's Name
                                        </p>

                                        <p style="
                                            margin: 0 0 18px;
                                            color: #0B294D;
                                            font-size: 15px;
                                            line-height: 1.6;
                                            font-weight: 700;
                                            overflow-wrap: anywhere;
                                        ">
                                            ${safeName}
                                        </p>

                                        <p style="
                                            margin: 0 0 5px;
                                            color: #718096;
                                            font-size: 11px;
                                            font-weight: 700;
                                            letter-spacing: 1px;
                                            text-transform: uppercase;
                                        ">
                                            Email Address
                                        </p>

                                        <p style="
                                            margin: 0 0 18px;
                                            font-size: 15px;
                                            line-height: 1.6;
                                            overflow-wrap: anywhere;
                                        ">
                                            <a
                                                href="mailto:${safeEmail}"
                                                style="
                                                    color: #2563A6;
                                                    text-decoration: none;
                                                "
                                            >
                                                ${safeEmail}
                                            </a>
                                        </p>

                                        <p style="
                                            margin: 0 0 5px;
                                            color: #718096;
                                            font-size: 11px;
                                            font-weight: 700;
                                            letter-spacing: 1px;
                                            text-transform: uppercase;
                                        ">
                                            Enquiry Subject
                                        </p>

                                        <p style="
                                            margin: 0;
                                            color: #0B294D;
                                            font-size: 15px;
                                            line-height: 1.6;
                                            font-weight: 700;
                                            overflow-wrap: anywhere;
                                        ">
                                            ${safeSubject}
                                        </p>

                                    </td>
                                </tr>
                            </table>

                            <!-- MESSAGE -->
                            <h3 style="
                                margin: 28px 0 12px;
                                color: #0B294D;
                                font-size: 16px;
                                font-weight: 700;
                            ">
                                Message
                            </h3>

                            <table
                                role="presentation"
                                width="100%"
                                cellpadding="0"
                                cellspacing="0"
                                border="0"
                            >
                                <tr>
                                    <td style="
                                        padding: 18px;
                                        border-left: 3px solid #C9A227;
                                        background-color: #FAFBFD;
                                        color: #46566A;
                                        font-size: 14px;
                                        line-height: 1.9;
                                        overflow-wrap: anywhere;
                                        white-space: pre-wrap;
                                    ">${safeMessage}</td>
                                </tr>
                            </table>

                            <!-- CTA -->
                            <table
                                role="presentation"
                                cellpadding="0"
                                cellspacing="0"
                                border="0"
                                style="margin: 28px 0 22px;"
                            >
                                <tr>
                                    <td
                                        align="center"
                                        bgcolor="#0B294D"
                                        style="border-radius: 6px;"
                                    >
                                        <a
                                            href="${replyUrl}"
                                            style="
                                                display: inline-block;
                                                padding: 14px 25px;
                                                color: #ffffff;
                                                font-size: 14px;
                                                font-weight: 700;
                                                text-decoration: none;
                                                border-radius: 6px;
                                            "
                                        >
                                            Reply to Enquiry
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="
                                margin: 0;
                                color: #718096;
                                font-size: 12px;
                                line-height: 1.8;
                            ">
                                This notification was generated by the
                                OlivetNOSA website contact form. Please review
                                the enquiry and respond as appropriate.
                            </p>

                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td style="
                            padding: 24px 25px;
                            background-color: #F5F8FC;
                            border-top: 1px solid #DCE5EF;
                            text-align: center;
                        ">

                            <p style="
                                margin: 0 0 7px;
                                color: #0B294D;
                                font-size: 14px;
                                font-weight: 700;
                            ">
                                OlivetNOSA
                            </p>

                            <p style="
                                margin: 0 0 10px;
                                color: #718096;
                                font-size: 12px;
                                line-height: 1.7;
                            ">
                                National Old Students' Association<br />
                                Olivet Baptist High School
                            </p>

                            <p style="
                                margin: 0 0 12px;
                                color: #A17B10;
                                font-size: 11px;
                                font-weight: 700;
                                letter-spacing: 1px;
                            ">
                                CUM CHRISTO PROGREDERE
                            </p>

                            <p style="
                                margin: 0;
                                color: #94A3B8;
                                font-size: 11px;
                                line-height: 1.6;
                            ">
                                © ${new Date().getFullYear()} OlivetNOSA.
                                All rights reserved.
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