import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async ({ to, subject, html }) => {
    const emailFrom = process.env.EMAIL_FROM;

    if (!emailFrom) {
        throw new Error("EMAIL_FROM is not configured.");
    }
    const response = await resend.emails.send({
        from: emailFrom,
        to,
        subject,
        html,
    });

    // console.log("Resend email response:", response);

    if (response?.error) {
        throw new Error(response.error.message);
    }

    return response;
};