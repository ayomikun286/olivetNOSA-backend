


import { sendEmail } from "../services/email.service.js";
import {contactEmailTemplate} from "../utils/contact-email.template.js";
export const contactForm = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // Validate required fields
        if (
            !name?.trim() ||
            !email?.trim() ||
            !subject?.trim() ||
            !message?.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required.",
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim();
        const cleanSubject = subject.trim();
        const cleanMessage = message.trim();

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(cleanEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address.",
            });
        }

        // Validate input lengths
        if (
            cleanName.length > 100 ||
            cleanEmail.length > 254 ||
            cleanSubject.length > 150 ||
            cleanMessage.length > 5000
        ) {
            return res.status(400).json({
                success: false,
                message: "One or more fields exceed the allowed length.",
            });
        }

        // Prevent newlines in the email subject
        if (/[\r\n]/.test(cleanSubject)) {
            return res.status(400).json({
                success: false,
                message: "The subject contains invalid characters.",
            });
        }

        if (!process.env.CONTACT_FORM_EMAIL) {
            throw new Error("CONTACT_FORM_EMAIL is not configured.");
        }

        await sendEmail({
    to: process.env.CONTACT_FORM_EMAIL,
    replyTo: cleanEmail,
    subject: `New OlivetNOSA Enquiry: ${cleanSubject}`,
    text: `Name: ${cleanName}\nEmail: ${cleanEmail}\nSubject: ${cleanSubject}\n\nMessage:\n${cleanMessage}`,
    html: contactEmailTemplate({
        name: cleanName,
        email: cleanEmail,
        subject: cleanSubject,
        message: cleanMessage,
    }),
});

        return res.status(200).json({
            success: true,
            message: "Your message has been sent successfully.",
        });
    } catch (err) {
        console.error("Contact form submission failed:", err.message);

        return res.status(500).json({
            success: false,
            message:
                "An error occurred while processing the contact form. Please try again later.",
        });
    }
};