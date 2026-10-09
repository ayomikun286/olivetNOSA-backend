import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { sendEmail } from "../services/email.service.js"
import { verifyAccountSetupToken } from "../services/accountActivation.service.js";
import User from "../models/User.js";
import YearSet from "../models/YearSet.js";
import Chapter from "../models/Chapter.js";
import { validateEmail } from "../utils/validator.js";
import cloudinary from "../config/cloudinary.js";
import { createAuditLog } from "../services/auditLog.service.js";

import {
  successResponse,
  errorResponse,
} from "../utils/response.js";


import { createNotification } from "../services/notificationService.js";
import { NOTIFICATION_MESSAGES } from "../constants/notificationMessages.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};







export const Signup = async (req, res) => {
  console.log("working")

  try {
    const {
      firstName,
      middleName,
      lastName,
      email,
      phone,
      enrollmentYear,
      graduationYear,
      chapter,
      password,
      subscribe_newsletter,
      formLoadTime,
    } = req.body;

    const currentTime = Date.now();

    if (
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !enrollmentYear ||
      !graduationYear ||
      !chapter ||
      !password
    ) {
      return errorResponse(
        res,
        400,
        "All required fields must be provided."
      );
    }





    // ANTI-BOT: HONEYPOT
    // ==========================================
    if (subscribe_newsletter && subscribe_newsletter.trim() !== "") {
      console.warn(
        `[SPAM DETECTED] Honeypot triggered. IP: ${req.ip}`
      );

      return res.status(200).json({
        success: true,
        message: "Registration successful.",
      });
    }

    // ANTI-BOT: FORM TIMING
    // ==========================================
    if (formLoadTime) {
      const timeTaken =
        currentTime - Number(formLoadTime);

      if (timeTaken < 3000) {
        console.warn(
          `[SPAM DETECTED] Form submitted too quickly. IP: ${req.ip}`
        );

        return res.status(200).json({
          success: true,
          message: "Registration successful.",
        });
      }
    }







    const firstNameValue = firstName.trim();
    const middleNameValue = middleName?.trim() || "";
    const lastNameValue = lastName.trim();
    const emailValue = email.trim().toLowerCase();
    const phoneValue = phone.trim();
    const passwordValue = password.trim();

    const enrollmentYearValue = Number(enrollmentYear);
    const graduationYearValue = Number(graduationYear);


    // VALIDATE EMAIL
    // ==========================================

    if (!validateEmail(emailValue)) {
      return errorResponse(
        res,
        400,
        "Invalid email address."
      );
    }



    // VALIDATE NAMES
    // ==========================================

    if (firstNameValue.length < 2) {
      return errorResponse(
        res,
        400,
        "First name must be at least 2 characters."
      );
    }

    if (lastNameValue.length < 2) {
      return errorResponse(
        res,
        400,
        "Last name must be at least 2 characters."
      );
    }



    // VALIDATE PASSWORD
    // ==========================================
    if (passwordValue.length < 8) {
      return errorResponse(
        res,
        400,
        "Password must be at least 8 characters."
      );
    }





    // VALIDATE YEARS
    // ==========================================
    if (
      !Number.isInteger(enrollmentYearValue) ||
      !Number.isInteger(graduationYearValue)
    ) {
      return errorResponse(
        res,
        400,
        "Enrollment year and graduation year must be valid years."
      );
    }

    if (graduationYearValue < enrollmentYearValue) {
      return errorResponse(
        res,
        400,
        "Graduation year cannot be before enrollment year."
      );
    }




    // CHECK EXISTING USER
    // ==========================================
    const existingUser = await User.findOne({
      email: emailValue,
    });

    if (existingUser) {
      return errorResponse(
        res,
        409,
        "An account with this email already exists."
      );
    }



    // FIND YEAR SET
    // ==========================================
    const selectedYearSet = await YearSet.findOne({
      year: graduationYearValue,
      isActive: true,
    });

    if (!selectedYearSet) {
      return errorResponse(
        res,
        400,
        "No Year Set exists for this graduation year."
      );
    }



    // FIND CHAPTER
    // ==========================================
    const selectedChapter = await Chapter.findOne({
      _id: chapter,
      isActive: true,
    });

    if (!selectedChapter) {
      return errorResponse(
        res,
        400,
        "Invalid or inactive chapter."
      );
    }


    // HASH PASSWORD
    // ==========================================
    const hashedPassword = await bcrypt.hash(passwordValue, 12);


    // EMAIL VERIFICATION TOKEN
    // ==========================================
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const hashedVerificationToken = crypto.createHash("sha256").update(verificationToken).digest("hex");
    const verificationExpires = new Date(Date.now() + 30 * 60 * 1000);



    // CREATE USER
    // ==========================================
    const user = await User.create({

      firstName: firstNameValue,

      middleName: middleNameValue,

      lastName: lastNameValue,

      email: emailValue,

      phone: phoneValue,

      enrollmentYear: enrollmentYearValue,

      graduationYear: graduationYearValue,

      yearSet: selectedYearSet._id,

      chapter: selectedChapter._id,

      password: hashedPassword,

      role: "member",

      isEmailVerified: false,

      status: "pending",

      emailVerificationToken: hashedVerificationToken,

      emailVerificationExpires: verificationExpires,
    });


    await createAuditLog({
  actor: user._id,
  action: "auth.registration_created",
  resource: "User",
  resourceId: user._id,
  targetUser: user._id,
  req,
  details: {
    email: user.email,
    graduationYear: user.graduationYear,
    yearSet: user.yearSet,
    chapter: user.chapter,
    status: user.status,
  },
});


    // notification//
    const notification = NOTIFICATION_MESSAGES.account.welcome;

    await createNotification({
      userId: user._id,
      type: "account",
      title: notification.title,
      message: notification.message,
      link: notification.link,
    });




    // VERIFICATION LINK
    // ==========================================
    const frontendBase = (process.env.FRONTEND_URL || "http://localhost:5173")
      .replace(/\/+$/, "")
      .replace(/\/portal\/signup\/?$/, "");

    const verificationLink = `${frontendBase}/portal/verify-email?token=${verificationToken}`;

    //  const letter = verifyEmailTemplate({ firstNameValue ,verificationLink}

    // Send email to user (or fallback to testing email if needed)
    try {
      await sendEmail({
        to: emailValue,
        subject: "Verify Your OlivetGOSA Account",
        html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
            />
            <title>Verify Your OlivetGOSA Account</title>
        </head>

        <body
            style="
                margin: 0;
                padding: 0;
                background-color: #EAF1F8;
                font-family: Arial, Helvetica, sans-serif;
                color: #0B294D;
            "
        >

            <!-- Main Wrapper -->
            <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="background-color: #EAF1F8; padding: 40px 15px;"
            >
                <tr>
                    <td align="center">

                        <!-- Email Container -->
                        <table
                            width="100%"
                            cellpadding="0"
                            cellspacing="0"
                            border="0"
                            style="
                                max-width: 620px;
                                background-color: #ffffff;
                                border-radius: 12px;
                                overflow: hidden;
                            "
                        >

                            <!-- Header -->
                            <tr>
                                <td
                                    style="
                                        background-color: #0B294D;
                                        padding: 30px 35px;
                                        text-align: center;
                                    "
                                >
                                    <!-- Logo / Crest -->
                                    <img
                                        src="https://olivetbhsnosa.org/images/olivet-crest.png"
                                        alt="OlivetGOSA"
                                        width="70"
                                        style="
                                            display: block;
                                            margin: 0 auto 15px;
                                            max-width: 70px;
                                        "
                                    />

                                    <div
                                        style="
                                            color: #ffffff;
                                            font-size: 22px;
                                            font-weight: bold;
                                            letter-spacing: 0.5px;
                                        "
                                    >
                                        OlivetGOSA
                                    </div>

                                    <div
                                        style="
                                            color: #C9A227;
                                            font-size: 11px;
                                            font-weight: bold;
                                            letter-spacing: 2px;
                                            margin-top: 7px;
                                            text-transform: uppercase;
                                        "
                                    >
                                        Global Old Students' Association
                                    </div>
                                </td>
                            </tr>

                            <!-- Gold Divider -->
                            <tr>
                                <td
                                    style="
                                        height: 4px;
                                        background-color: #C9A227;
                                        font-size: 0;
                                        line-height: 0;
                                    "
                                >
                                    &nbsp;
                                </td>
                            </tr>

                            <!-- Content -->
                            <tr>
                                <td
                                    style="
                                        padding: 40px 35px;
                                    "
                                >

                                    <p
                                        style="
                                            margin: 0 0 8px;
                                            color: #C9A227;
                                            font-size: 12px;
                                            font-weight: bold;
                                            letter-spacing: 1.5px;
                                            text-transform: uppercase;
                                        "
                                    >
                                        Welcome to OlivetGOSA
                                    </p>

                                    <h1
                                        style="
                                            margin: 0 0 20px;
                                            color: #0B294D;
                                            font-size: 28px;
                                            line-height: 1.25;
                                        "
                                    >
                                        Verify your email address
                                    </h1>

                                    <p
                                        style="
                                            margin: 0 0 18px;
                                            color: #4B6075;
                                            font-size: 15px;
                                            line-height: 1.7;
                                        "
                                    >
                                        Hello ${user.firstName},
                                    </p>

                                    <p
                                        style="
                                            margin: 0 0 18px;
                                            color: #4B6075;
                                            font-size: 15px;
                                            line-height: 1.7;
                                        "
                                    >
                                        Thank you for creating your
                                        <strong style="color: #123B6D;">
                                            OlivetGOSA
                                        </strong>
                                        alumni account.
                                    </p>

                                    <p
                                        style="
                                            margin: 0 0 28px;
                                            color: #4B6075;
                                            font-size: 15px;
                                            line-height: 1.7;
                                        "
                                    >
                                        Please verify your email address to
                                        confirm your account and continue with
                                        your membership registration.
                                    </p>

                                    <!-- CTA -->
                                    <table
                                        width="100%"
                                        cellpadding="0"
                                        cellspacing="0"
                                        border="0"
                                    >
                                        <tr>
                                            <td align="center">

                                                <a
                                                    href="${verificationLink}"
                                                    style="
                                                        display: inline-block;
                                                        background-color: #123B6D;
                                                        color: #ffffff;
                                                        text-decoration: none;
                                                        font-size: 14px;
                                                        font-weight: bold;
                                                        padding: 15px 30px;
                                                        border-radius: 7px;
                                                    "
                                                >
                                                    Verify My Email
                                                </a>

                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Expiry Notice -->
                                    <div
                                        style="
                                            margin-top: 30px;
                                            padding: 15px 18px;
                                            background-color: #EAF1F8;
                                            border-left: 3px solid #C9A227;
                                            border-radius: 4px;
                                        "
                                    >
                                        <p
                                            style="
                                                margin: 0;
                                                color: #4B6075;
                                                font-size: 13px;
                                                line-height: 1.6;
                                            "
                                        >
                                            <strong style="color: #0B294D;">
                                                Important:
                                            </strong>
                                            This verification link will expire
                                            in 30 minutes.
                                        </p>
                                    </div>

                                    <!-- Fallback Link -->
                                    <p
                                        style="
                                            margin: 30px 0 8px;
                                            color: #4B6075;
                                            font-size: 13px;
                                            line-height: 1.6;
                                        "
                                    >
                                        If the button above does not work,
                                        copy and paste the following link into
                                        your browser:
                                    </p>

                                    <p
                                        style="
                                            margin: 0;
                                            word-break: break-all;
                                            font-size: 12px;
                                            line-height: 1.6;
                                        "
                                    >
                                        <a
                                            href="${verificationLink}"
                                            style="
                                                color: #123B6D;
                                                text-decoration: underline;
                                            "
                                        >
                                            ${verificationLink}
                                        </a>
                                    </p>

                                    <!-- Security -->
                                    <p
                                        style="
                                            margin: 30px 0 0;
                                            padding-top: 25px;
                                            border-top: 1px solid #E5EAF0;
                                            color: #6B7C8F;
                                            font-size: 12px;
                                            line-height: 1.6;
                                        "
                                    >
                                        If you did not create an OlivetGOSA
                                        account, you can safely ignore this
                                        email. No further action is required.
                                    </p>

                                </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                                <td
                                    style="
                                        background-color: #0B294D;
                                        padding: 25px 35px;
                                        text-align: center;
                                    "
                                >
                                    <p
                                        style="
                                            margin: 0;
                                            color: #ffffff;
                                            font-size: 13px;
                                            font-weight: bold;
                                        "
                                    >
                                        OlivetGOSA
                                    </p>

                                    <p
                                        style="
                                            margin: 7px 0 0;
                                            color: rgba(255,255,255,0.65);
                                            font-size: 11px;
                                            line-height: 1.6;
                                        "
                                    >
                                        Global Old Students' Association
                                        <br />
                                        Olivet Baptist High School
                                    </p>

                                    <p
                                        style="
                                            margin: 15px 0 0;
                                            color: #C9A227;
                                            font-size: 10px;
                                            letter-spacing: 1px;
                                        "
                                    >
                                        CUM CHRISTO PROGREDERE
                                    </p>
                                </td>
                            </tr>

                        </table>

                        <!-- Bottom Text -->
                        <p
                            style="
                                margin: 20px 0 0;
                                color: #7A8A9A;
                                font-size: 10px;
                                text-align: center;
                            "
                        >
                            This is an automated email from OlivetGOSA.
                            Please do not reply directly to this message.
                        </p>

                    </td>
                </tr>
            </table>

        </body>
        </html>
        `,
      });
    } catch (emailErr) {
      console.error(
        "Failed to deliver verification email via provider:",
        emailErr
      );
    }







    return successResponse(
      res,
      "Account created successfully. Please check your email to verify your account.",
      {
        id: user._id,
        email: user.email,
      }
    );

  } catch (err) {

    console.error("Signup error:", err);

    return errorResponse(
      res,
      500,
      "Something went wrong during registration."
    );
  }
};





export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    // ------------------------------------------
    // TOKEN REQUIRED
    // ------------------------------------------

    if (!token) {
      return errorResponse(
        res,
        400,
        "Verification token is required."
      );
    }

    // ------------------------------------------
    // HASH TOKEN
    // ------------------------------------------

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");



    // ------------------------------------------
    // FIND USER
    // ------------------------------------------

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: {
        $gt: new Date(),
      },
    }).select(
      "+emailVerificationToken +emailVerificationExpires"
    );






    // ------------------------------------------
    // INVALID / EXPIRED TOKEN
    // ------------------------------------------

    if (!user) {
      return errorResponse(
        res,
        400,
        "Invalid or expired verification link."
      );
    }

    // ------------------------------------------
    // ALREADY VERIFIED
    // ------------------------------------------

    if (user.isEmailVerified) {
      return errorResponse(
        res,
        400,
        "Email is already verified."
      );
    }

    // ------------------------------------------
    // VERIFY EMAIL
    // ------------------------------------------

    user.isEmailVerified = true;

    // Remove verification token
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;

    await user.save();


    await createAuditLog({
  actor: user._id,
  action: "auth.email_verified",
  resource: "User",
  resourceId: user._id,
  targetUser: user._id,
  req,
  details: {
    email: user.email,
    status: user.status,
  },
});

    // ------------------------------------------
// STAFF REGISTRATION NOTIFICATION
// ------------------------------------------

try {
  const staffRecipients = await User.find({
    role: {
      $in: ["secretary", "superAdmin"],
    },
    status: "active",
  }).select("email firstName lastName role");

  const recipientEmails = staffRecipients
    .map((staff) => staff.email)
    .filter(Boolean);

  const devEmail = process.env.REGISTRATION_NOTIFICATION_EMAIL;

  if (devEmail) {
    recipientEmails.push(devEmail);
  }

  const yearSet = await YearSet.findById(user.yearSet)
    .populate("leader", "email firstName lastName")
    .lean();

  if (yearSet?.leader?.email) {
    recipientEmails.push(yearSet.leader.email);
  }

  const uniqueRecipientEmails = [
    ...new Set(recipientEmails.map((email) => email.toLowerCase())),
  ];

  if (uniqueRecipientEmails.length > 0) {
    const applicantName = [
      user.firstName,
      user.middleName,
      user.lastName,
    ]
      .filter(Boolean)
      .join(" ");

    await sendEmail({
      to: recipientEmails,
      subject: "New Alumni Registration",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>New Alumni Registration</h2>

          <p>
            A new alumni applicant has successfully verified their email
            address and is awaiting membership approval.
          </p>

          <h3>Applicant Details</h3>

          <ul>
            <li><strong>Name:</strong> ${applicantName}</li>
            <li><strong>Email:</strong> ${user.email}</li>
            <li><strong>Phone:</strong> ${user.phone || "Not provided"}</li>
            <li><strong>Enrollment Year:</strong> ${user.enrollmentYear}</li>
            <li><strong>Graduation Year:</strong> ${user.graduationYear}</li>
            <li><strong>Status:</strong> Pending membership approval</li>
          </ul>

          <p>
            Please review the applicant from the admin dashboard.
          </p>
        </div>
      `,
    });
  }
} catch (notificationError) {
  console.error(
    "Staff registration notification error:",
    notificationError
  );
}



    // notification//
    await createNotification({
      userId: user._id,
      type: "account",
      title: "Email Verified",
      message:
        "Your email address has been verified successfully. Please complete the remaining information required for your member directory profile.",
      link: "/portal/member/dashboard/profile",
    });




    const authToken = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // ------------------------------------------
    // STORE JWT IN HTTPONLY COOKIE
    // ------------------------------------------

    res.cookie(
      "token",
      authToken,
      cookieOptions
    );

    // ------------------------------------------
    // RESPONSE
    // ------------------------------------------

    return successResponse(
      res,
      "Email verified successfully. Your account is now awaiting membership approval.",
      {
        emailVerified: true,
        status: user.status,
      }
    );

  } catch (err) {
    console.error(
      "Email verification error:",
      err
    );

    return errorResponse(
      res,
      500,
      "Something went wrong while verifying your email."
    );
  }
};


export const resendVerifyEmailLink = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return errorResponse(res, 400, "Email is required.");
    }
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select(
      "+emailVerificationToken +emailVerificationExpires"
    );

    if (!user) {
      return errorResponse(res, 404, "User not found.");
    }


    if (user.isEmailVerified) {
      return errorResponse(
        res,
        400,
        "Your email is already verified. Please login."
      );
    }


    // GENERATE NEW TOKEN
    const verificationToken = crypto
      .randomBytes(32)
      .toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");


    // SAVE TOKEN + EXPIRY
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await user.save();

    await createAuditLog({
  actor: user._id,
  action: "auth.email_verified",
  resource: "User",
  resourceId: user._id,
  targetUser: user._id,
  req,
  details: {
    email: user.email,
    status: user.status,
  },
});


    // SEND EMAIL
    const verificationUrl =
      `${process.env.FRONTEND_URL}/portal/verify-email?token=${verificationToken}`;

    await sendEmail({
      to: normalizedEmail,
      subject: "Verify Your OlivetGOSA Account",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
            />
            <title>Verify Your OlivetGOSA Account</title>
        </head>

        <body
            style="
                margin: 0;
                padding: 0;
                background-color: #EAF1F8;
                font-family: Arial, Helvetica, sans-serif;
                color: #0B294D;
            "
        >

            <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="background-color: #EAF1F8; padding: 40px 15px;"
            >
                <tr>
                    <td align="center">

                        <!-- EMAIL CONTAINER -->
                        <table
                            width="100%"
                            cellpadding="0"
                            cellspacing="0"
                            border="0"
                            style="
                                max-width: 620px;
                                background-color: #ffffff;
                                border-radius: 12px;
                                overflow: hidden;
                            "
                        >

                            <!-- HEADER -->
                            <tr>
                                <td
                                    style="
                                        background-color: #0B294D;
                                        padding: 30px 35px;
                                        text-align: center;
                                    "
                                >
                                    <div
                                        style="
                                            color: #ffffff;
                                            font-size: 24px;
                                            font-weight: bold;
                                            letter-spacing: 0.5px;
                                        "
                                    >
                                        OlivetGOSA
                                    </div>

                                    <div
                                        style="
                                            color: #C9A227;
                                            font-size: 11px;
                                            font-weight: bold;
                                            letter-spacing: 2px;
                                            margin-top: 7px;
                                            text-transform: uppercase;
                                        "
                                    >
                                        Global Old Students' Association
                                    </div>
                                </td>
                            </tr>

                            <!-- GOLD DIVIDER -->
                            <tr>
                                <td
                                    style="
                                        height: 4px;
                                        background-color: #C9A227;
                                        font-size: 0;
                                        line-height: 0;
                                    "
                                >
                                    &nbsp;
                                </td>
                            </tr>

                            <!-- CONTENT -->
                            <tr>
                                <td style="padding: 40px 35px;">

                                    <p
                                        style="
                                            margin: 0 0 8px;
                                            color: #C9A227;
                                            font-size: 12px;
                                            font-weight: bold;
                                            letter-spacing: 1.5px;
                                            text-transform: uppercase;
                                        "
                                    >
                                        Email Verification
                                    </p>

                                    <h1
                                        style="
                                            margin: 0 0 20px;
                                            color: #0B294D;
                                            font-size: 28px;
                                            line-height: 1.25;
                                        "
                                    >
                                        Verify your email address
                                    </h1>

                                    <p
                                        style="
                                            margin: 0 0 18px;
                                            color: #4B6075;
                                            font-size: 15px;
                                            line-height: 1.7;
                                        "
                                    >
                                        Thank you for creating your
                                        <strong style="color: #123B6D;">
                                            OlivetGOSA
                                        </strong>
                                        account.
                                    </p>

                                    <p
                                        style="
                                            margin: 0 0 28px;
                                            color: #4B6075;
                                            font-size: 15px;
                                            line-height: 1.7;
                                        "
                                    >
                                        Please verify your email address to
                                        confirm your account and continue with
                                        your membership registration.
                                    </p>

                                    <!-- BUTTON -->
                                    <table
                                        width="100%"
                                        cellpadding="0"
                                        cellspacing="0"
                                        border="0"
                                    >
                                        <tr>
                                            <td align="center">

                                                <a
                                                    href="${verificationUrl}"
                                                    style="
                                                        display: inline-block;
                                                        background-color: #123B6D;
                                                        color: #ffffff;
                                                        text-decoration: none;
                                                        font-size: 14px;
                                                        font-weight: bold;
                                                        padding: 15px 30px;
                                                        border-radius: 7px;
                                                    "
                                                >
                                                    Verify My Email
                                                </a>

                                            </td>
                                        </tr>
                                    </table>

                                    <!-- EXPIRY -->
                                    <div
                                        style="
                                            margin-top: 30px;
                                            padding: 15px 18px;
                                            background-color: #EAF1F8;
                                            border-left: 3px solid #C9A227;
                                            border-radius: 4px;
                                        "
                                    >
                                        <p
                                            style="
                                                margin: 0;
                                                color: #4B6075;
                                                font-size: 13px;
                                                line-height: 1.6;
                                            "
                                        >
                                            <strong style="color: #0B294D;">
                                                Important:
                                            </strong>
                                            This verification link will expire
                                            in 30 minutes.
                                        </p>
                                    </div>

                                    <!-- FALLBACK LINK -->
                                    <p
                                        style="
                                            margin: 30px 0 8px;
                                            color: #4B6075;
                                            font-size: 13px;
                                            line-height: 1.6;
                                        "
                                    >
                                        If the button does not work, copy and
                                        paste the following link into your
                                        browser:
                                    </p>

                                    <p
                                        style="
                                            margin: 0;
                                            word-break: break-all;
                                            font-size: 12px;
                                            line-height: 1.6;
                                        "
                                    >
                                        <a
                                            href="${verificationUrl}"
                                            style="
                                                color: #123B6D;
                                                text-decoration: underline;
                                            "
                                        >
                                            ${verificationUrl}
                                        </a>
                                    </p>

                                    <!-- SECURITY -->
                                    <p
                                        style="
                                            margin: 30px 0 0;
                                            padding-top: 25px;
                                            border-top: 1px solid #E5EAF0;
                                            color: #6B7C8F;
                                            font-size: 12px;
                                            line-height: 1.6;
                                        "
                                    >
                                        If you did not create an OlivetGOSA
                                        account, you can safely ignore this
                                        email. No further action is required.
                                    </p>

                                </td>
                            </tr>

                            <!-- FOOTER -->
                            <tr>
                                <td
                                    style="
                                        background-color: #0B294D;
                                        padding: 25px 35px;
                                        text-align: center;
                                    "
                                >
                                    <p
                                        style="
                                            margin: 0;
                                            color: #ffffff;
                                            font-size: 13px;
                                            font-weight: bold;
                                        "
                                    >
                                        OlivetGOSA
                                    </p>

                                    <p
                                        style="
                                            margin: 7px 0 0;
                                            color: rgba(255,255,255,0.65);
                                            font-size: 11px;
                                            line-height: 1.6;
                                        "
                                    >
                                        Global Old Students' Association
                                        <br />
                                        Olivet Baptist High School
                                    </p>

                                    <p
                                        style="
                                            margin: 15px 0 0;
                                            color: #C9A227;
                                            font-size: 10px;
                                            letter-spacing: 1px;
                                        "
                                    >
                                        CUM CHRISTO PROGREDERE
                                    </p>
                                </td>
                            </tr>

                        </table>

                        <!-- AUTOMATED EMAIL NOTICE -->
                        <p
                            style="
                                margin: 20px 0 0;
                                color: #7A8A9A;
                                font-size: 10px;
                                text-align: center;
                            "
                        >
                            This is an automated email from OlivetGOSA.
                            Please do not reply directly to this message.
                        </p>

                    </td>
                </tr>
            </table>

        </body>
        </html>
    `,
    });


    return successResponse(
      res,
      "A new verification link has been sent to your email.",
      {
        email: user.email,
      }
    );

  } catch (err) {
    console.error(
      "Resend verification error:",
      err
    );

    return errorResponse(
      res,
      500,
      "Something went wrong while resending the verification email."
    );
  }
};





export const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // ------------------------------------------
    // EMAIL REQUIRED
    // ------------------------------------------

    if (!email) {
      return errorResponse(
        res,
        400,
        "Email is required."
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ------------------------------------------
    // FIND USER
    // ------------------------------------------

    const user = await User.findOne({
      email: normalizedEmail,
    });



    if (!user) {
      return successResponse(
        res,
        "If an account exists with this email address, a password reset link has been sent."
      );
    }


    // GENERATE RESET TOKEN
    const resetToken = crypto
      .randomBytes(32)
      .toString("hex");




    // HASH RESET TOKEN
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");





    // SAVE TOKEN + EXPIRY
    user.passwordResetToken = hashedToken;

    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();


    await createAuditLog({
  actor: user._id,
  action: "auth.password_reset_requested",
  resource: "User",
  resourceId: user._id,
  targetUser: user._id,
  req,
  details: {
    email: user.email,
  },
});

    // RESET URL
    const resetUrl = `${process.env.FRONTEND_URL}/portal/reset-password?token=${resetToken}`;
    await sendEmail({
      to: normalizedEmail,
      subject: "Reset Your OlivetGOSA Password",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
            />
            <title>Reset Your OlivetGOSA Password</title>
        </head>

        <body
            style="
                margin: 0;
                padding: 0;
                background-color: #EAF1F8;
                font-family: Arial, Helvetica, sans-serif;
                color: #0B294D;
            "
        >

            <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                    background-color: #EAF1F8;
                    padding: 40px 15px;
                "
            >
                <tr>
                    <td align="center">

                        <!-- EMAIL CONTAINER -->
                        <table
                            width="100%"
                            cellpadding="0"
                            cellspacing="0"
                            border="0"
                            style="
                                max-width: 620px;
                                background-color: #ffffff;
                                border-radius: 12px;
                                overflow: hidden;
                            "
                        >

                            <!-- HEADER -->
                            <tr>
                                <td
                                    style="
                                        background-color: #0B294D;
                                        padding: 30px 35px;
                                        text-align: center;
                                    "
                                >
                                    <div
                                        style="
                                            color: #ffffff;
                                            font-size: 24px;
                                            font-weight: bold;
                                            letter-spacing: 0.5px;
                                        "
                                    >
                                        OlivetGOSA
                                    </div>

                                    <div
                                        style="
                                            color: #C9A227;
                                            font-size: 11px;
                                            font-weight: bold;
                                            letter-spacing: 2px;
                                            margin-top: 7px;
                                            text-transform: uppercase;
                                        "
                                    >
                                        Global Old Students' Association
                                    </div>
                                </td>
                            </tr>

                            <!-- GOLD DIVIDER -->
                            <tr>
                                <td
                                    style="
                                        height: 4px;
                                        background-color: #C9A227;
                                        font-size: 0;
                                        line-height: 0;
                                    "
                                >
                                    &nbsp;
                                </td>
                            </tr>

                            <!-- CONTENT -->
                            <tr>
                                <td style="padding: 40px 35px;">

                                    <p
                                        style="
                                            margin: 0 0 8px;
                                            color: #C9A227;
                                            font-size: 12px;
                                            font-weight: bold;
                                            letter-spacing: 1.5px;
                                            text-transform: uppercase;
                                        "
                                    >
                                        Account Security
                                    </p>

                                    <h1
                                        style="
                                            margin: 0 0 20px;
                                            color: #0B294D;
                                            font-size: 28px;
                                            line-height: 1.25;
                                        "
                                    >
                                        Reset your password
                                    </h1>

                                    <p
                                        style="
                                            margin: 0 0 18px;
                                            color: #4B6075;
                                            font-size: 15px;
                                            line-height: 1.7;
                                        "
                                    >
                                        We received a request to reset the
                                        password for your
                                        <strong style="color: #123B6D;">
                                            OlivetGOSA
                                        </strong>
                                        account.
                                    </p>

                                    <p
                                        style="
                                            margin: 0 0 28px;
                                            color: #4B6075;
                                            font-size: 15px;
                                            line-height: 1.7;
                                        "
                                    >
                                        If you made this request, click the
                                        button below to create a new password
                                        and regain access to your account.
                                    </p>

                                    <!-- BUTTON -->
                                    <table
                                        width="100%"
                                        cellpadding="0"
                                        cellspacing="0"
                                        border="0"
                                    >
                                        <tr>
                                            <td align="center">

                                                <a
                                                    href="${resetUrl}"
                                                    style="
                                                        display: inline-block;
                                                        background-color: #123B6D;
                                                        color: #ffffff;
                                                        text-decoration: none;
                                                        font-size: 14px;
                                                        font-weight: bold;
                                                        padding: 15px 30px;
                                                        border-radius: 7px;
                                                    "
                                                >
                                                    Reset My Password
                                                </a>

                                            </td>
                                        </tr>
                                    </table>

                                    <!-- EXPIRY -->
                                    <div
                                        style="
                                            margin-top: 30px;
                                            padding: 15px 18px;
                                            background-color: #EAF1F8;
                                            border-left: 3px solid #C9A227;
                                            border-radius: 4px;
                                        "
                                    >
                                        <p
                                            style="
                                                margin: 0;
                                                color: #4B6075;
                                                font-size: 13px;
                                                line-height: 1.6;
                                            "
                                        >
                                            <strong style="color: #0B294D;">
                                                Important:
                                            </strong>
                                            This password reset link will
                                            expire in 30 minutes.
                                        </p>
                                    </div>

                                    <!-- FALLBACK LINK -->
                                    <p
                                        style="
                                            margin: 30px 0 8px;
                                            color: #4B6075;
                                            font-size: 13px;
                                            line-height: 1.6;
                                        "
                                    >
                                        If the button does not work, copy and
                                        paste the following link into your
                                        browser:
                                    </p>

                                    <p
                                        style="
                                            margin: 0;
                                            word-break: break-all;
                                            font-size: 12px;
                                            line-height: 1.6;
                                        "
                                    >
                                        <a
                                            href="${resetUrl}"
                                            style="
                                                color: #123B6D;
                                                text-decoration: underline;
                                            "
                                        >
                                            ${resetUrl}
                                        </a>
                                    </p>

                                    <!-- SECURITY NOTICE -->
                                    <p
                                        style="
                                            margin: 30px 0 0;
                                            padding-top: 25px;
                                            border-top: 1px solid #E5EAF0;
                                            color: #6B7C8F;
                                            font-size: 12px;
                                            line-height: 1.6;
                                        "
                                    >
                                        If you did not request a password
                                        reset, you can safely ignore this
                                        email. Your password will remain
                                        unchanged.
                                    </p>

                                </td>
                            </tr>

                            <!-- FOOTER -->
                            <tr>
                                <td
                                    style="
                                        background-color: #0B294D;
                                        padding: 25px 35px;
                                        text-align: center;
                                    "
                                >
                                    <p
                                        style="
                                            margin: 0;
                                            color: #ffffff;
                                            font-size: 13px;
                                            font-weight: bold;
                                        "
                                    >
                                        OlivetGOSA
                                    </p>

                                    <p
                                        style="
                                            margin: 7px 0 0;
                                            color: rgba(255,255,255,0.65);
                                            font-size: 11px;
                                            line-height: 1.6;
                                        "
                                    >
                                        Global Old Students' Association
                                        <br />
                                        Olivet Baptist High School
                                    </p>

                                    <p
                                        style="
                                            margin: 15px 0 0;
                                            color: #C9A227;
                                            font-size: 10px;
                                            letter-spacing: 1px;
                                        "
                                    >
                                        CUM CHRISTO PROGREDERE
                                    </p>
                                </td>
                            </tr>

                        </table>

                        <!-- AUTOMATED EMAIL NOTICE -->
                        <p
                            style="
                                margin: 20px 0 0;
                                color: #7A8A9A;
                                font-size: 10px;
                                text-align: center;
                            "
                        >
                            This is an automated email from OlivetGOSA.
                            Please do not reply directly to this message.
                        </p>

                    </td>
                </tr>
            </table>

        </body>
        </html>
    `,
    });

    // ------------------------------------------
    // RESPONSE
    // ------------------------------------------

    return successResponse(
      res,
      "If an account exists with this email address, a password reset link has been sent."
    );

  } catch (err) {

    console.error(
      "Forgot password error:",
      err
    );

    return errorResponse(
      res,
      500,
      "Something went wrong while processing your request."
    );
  }
};


export const resetPassword = async (req, res) => {
  try {
    const {
      token,
      password,
      confirmPassword,
    } = req.body;

    // ========================================
    // VALIDATION
    // ========================================

    if (!token) {
      return errorResponse(
        res,
        400,
        "Password reset token is required."
      );
    }

    if (!password || !confirmPassword) {
      return errorResponse(
        res,
        400,
        "New password and confirmation are required."
      );
    }

    if (password.length < 8) {
      return errorResponse(
        res,
        400,
        "Password must be at least 8 characters."
      );
    }

    if (password !== confirmPassword) {
      return errorResponse(
        res,
        400,
        "Passwords do not match."
      );
    }

    // ========================================
    // HASH RESET TOKEN
    // ========================================

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // ========================================
    // FIND USER WITH VALID TOKEN
    // ========================================

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: {
        $gt: new Date(),
      },
    }).select(
      "+passwordResetToken +passwordResetExpires +password"
    );


    


    // ========================================
    // TOKEN INVALID / EXPIRED
    // ========================================

    if (!user) {
      return errorResponse(
        res,
        400,
        "This password reset link is invalid or has expired."
      );
    }


    // HASH NEW PASSWORD
    const hashedPassword = await bcrypt.hash(
      password,
      12
    );

    user.password = hashedPassword;


    // CLEAR RESET TOKEN
    user.passwordResetToken = null;
    user.passwordResetExpires = null;

    await user.save();


    await createAuditLog({
  actor: user._id,
  action: "auth.password_reset_completed",
  resource: "User",
  resourceId: user._id,
  targetUser: user._id,
  req,
  details: {
    email: user.email,
  },
});

    return successResponse(
      res,
      "Password reset successfully."
    );

  } catch (err) {
    console.error(
      "Reset password error:",
      err
    );

    return errorResponse(
      res,
      500,
      "Something went wrong while resetting your password."
    );
  }
};



// CHECK VERIFICATION STATUS (FOR LIVE POLLING)
export const checkVerificationStatus = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return errorResponse(res, 400, "Email parameter is required.");
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!user) {
      return errorResponse(res, 404, "User not found.");
    }

    return successResponse(res, "Verification status retrieved.", {
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      firstName: user.firstName,

    });
  } catch (err) {
    console.error("Check verification status error:", err);
    return errorResponse(res, 500, "Error checking verification status.");
  }
};



export const Login = async (req, res) => {
  try {
    const {
      login,
      password,
      website,
      formLoadTime,
    } = req.body;

    const currentTime = Date.now();

    // ------------------------------------------
    // REQUIRED FIELDS
    // ------------------------------------------

    if (!login || !password) {
      return errorResponse(
        res,
        400,
        "Alumni ID/email and password are required."
      );
    }

    // ------------------------------------------
    // ANTI-BOT: HONEYPOT
    // ------------------------------------------

    if (website && website.trim() !== "") {
      console.warn(
        `[SPAM DETECTED] Login honeypot triggered. IP: ${req.ip}`
      );

      return res.status(200).json({
        success: true,
        message: "Login successful.",
      });
    }

    // ------------------------------------------
    // ANTI-BOT: FORM TIMING
    // ------------------------------------------

    if (formLoadTime) {
      const timeTaken =
        currentTime - Number(formLoadTime);

      if (timeTaken < 3000) {
        console.warn(
          `[SPAM DETECTED] Login submitted too quickly. IP: ${req.ip}`
        );

        return res.status(200).json({
          success: true,
          message: "Login successful.",
        });
      }
    }

    // ------------------------------------------
    // CLEAN INPUT
    // ------------------------------------------

    const loginValue = login.trim();
    const passwordValue = password.trim();

    // ------------------------------------------
    // DETERMINE LOGIN TYPE
    // ------------------------------------------

    const isEmail = loginValue.includes("@");

    // ------------------------------------------
    // FIND USER
    // ------------------------------------------

    const user = await User.findOne(
      isEmail
        ? {
          email: loginValue.toLowerCase(),
        }
        : {
          alumniId: loginValue.toUpperCase(),
        }
    ).select("+password");

    // ------------------------------------------
    // GENERIC LOGIN ERROR
    // ------------------------------------------

    if (!user || !user.password) {
  await createAuditLog({
    action: "auth.login_failed",
    resource: "Auth",
    req,
    details: {
      loginType: loginValue.includes("@") ? "email" : "alumniId",
      reason: "invalid_credentials",
    },
  });

  return errorResponse(
    res,
    401,
    "Invalid Alumni ID/email or password."
  );
}

    // ------------------------------------------
    // CHECK PASSWORD
    // ------------------------------------------

    const isMatch = await bcrypt.compare(
      passwordValue,
      user.password
    );

    if (!isMatch) {
  await createAuditLog({
    actor: user._id,
    action: "auth.login_failed",
    resource: "User",
    resourceId: user._id,
    targetUser: user._id,
    req,
    details: {
      loginType: isEmail ? "email" : "alumniId",
      reason: "incorrect_password",
    },
  });

  return errorResponse(
    res,
    401,
    "Invalid Alumni ID/email or password."
  );
}

    // ------------------------------------------
    // EMAIL VERIFICATION CHECK
    // ------------------------------------------

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message:
          "Please verify your email before logging in.",
        verifyRequired: true,
        email: user.email,
      });
    }

    // ------------------------------------------
    // ACCOUNT STATUS CHECK
    // ------------------------------------------

    if (user.status === "suspended") {
      return errorResponse(
        res,
        403,
        "Your account has been suspended."
      );
    }

    if (user.status === "inactive") {
      return errorResponse(
        res,
        403,
        "Your account is inactive."
      );
    }

    if (user.status === "deactivated") {
      return errorResponse(
        res,
        403,
        "Your account has been deactivated."
      );
    }

    // ------------------------------------------
    // CREATE JWT
    // ------------------------------------------

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // ------------------------------------------
    // STORE JWT IN HTTPONLY COOKIE
    // ------------------------------------------

    res.cookie(
      "token",
      token,
      cookieOptions
    );


    await createAuditLog({
  actor: user._id,
  action: "auth.login_successful",
  resource: "User",
  resourceId: user._id,
  targetUser: user._id,
  req,
  details: {
    loginType: isEmail ? "email" : "alumniId",
    role: user.role,
  },
});
    // ------------------------------------------
    // RESPONSE
    // ------------------------------------------

    return successResponse(
      res,
      "Login successful.",
      {
        id: user._id,
        alumniId: user.alumniId,
        email: user.email,
        role: user.role,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
      }
    );

  } catch (err) {
    console.error("Login error:", err);

    return errorResponse(
      res,
      500,
      "Something went wrong during login."
    );
  }
};



export const getCurrentUser = async (req, res) => {
  const user = await User.findById(req.user.id)
    .select("-password")
    .populate("chapter", "_id name code country leader")
    .populate("yearSet", "_id year name leader");



  if (!user) {
    return errorResponse(res, "User not found.", 404);
  }

  return successResponse(res, "Current user retrieved.", {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    graduationYear: user.graduationYear,
    isEmailVerified: user.isEmailVerified,
    memberStatus: user.status,
    role: user.role,
    phone: user.phone,
    alumniId: user.alumniId,
    chapter: user.chapter,
    yearSet: user.yearSet,
    financialStatus:user.financialStatus,

    createdAt: user.createdAt



  });
};




export const getMemberProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("chapter", "_id name code country")
      .populate("yearSet", "_id year name");

    if (!user) {
      return errorResponse(res, 404, "User not found.");
    }

    return successResponse(
      res,
      "Member profile retrieved successfully.",
      {
        id: user._id,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        enrollmentYear: user.enrollmentYear,
        graduationYear: user.graduationYear,
        financialStatus: user.financialStatus,

        alumniId: user.alumniId,
        yearSet: user.yearSet,
        chapter: user.chapter,

        profile: user.profile,

        status: user.status,
        isEmailVerified: user.isEmailVerified,
      }
    );
  } catch (err) {
    console.error("Get member profile error:", err);

    return errorResponse(
      res,
      500,
      "Something went wrong while retrieving your profile."
    );
  }
};




export const updateMemberProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return errorResponse(res, 404, "User not found.");
    }

    const {
      firstName,
      middleName,
      lastName,
      phone,
      profile,
    } = req.body;

    const changedFields = [];

    // BASIC NAME / PHONE

    if (firstName !== undefined) {
      if (typeof firstName !== "string" || !firstName.trim()) {
        return errorResponse(res, 400, "First name is required.");
      }

      const value = firstName.trim();

      if (value !== user.firstName) {
        changedFields.push("firstName");
      }

      user.firstName = value;
    }

    if (middleName !== undefined) {
      if (typeof middleName !== "string") {
        return errorResponse(res, 400, "Invalid middle name.");
      }

      const value = middleName.trim();

      if (value !== (user.middleName || "")) {
        changedFields.push("middleName");
      }

      user.middleName = value;
    }

    if (lastName !== undefined) {
      if (typeof lastName !== "string" || !lastName.trim()) {
        return errorResponse(res, 400, "Last name is required.");
      }

      const value = lastName.trim();

      if (value !== user.lastName) {
        changedFields.push("lastName");
      }

      user.lastName = value;
    }

    if (phone !== undefined) {
      if (typeof phone !== "string") {
        return errorResponse(res, 400, "Invalid phone number.");
      }

      const value = phone.trim();

      if (value !== (user.phone || "")) {
        changedFields.push("phone");
      }

      user.phone = value;
    }

    // PROFILE

    if (profile !== undefined) {
      if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
        return errorResponse(res, 400, "Invalid profile data.");
      }

      const existingProfile =
        user.profile?.toObject?.() || user.profile || {};

      const profileChanges = Object.keys(profile).filter(
        (key) =>
          JSON.stringify(existingProfile[key]) !==
          JSON.stringify(profile[key])
      );

      if (profileChanges.length > 0) {
        changedFields.push("profile");
      }

      user.profile = {
        ...existingProfile,
        ...profile,
      };
    }

    await user.save();

    // AUDIT LOG

    if (changedFields.length > 0) {
      await createAuditLog({
        actor: user._id,
        action: "member.profile_updated",
        resource: "User",
        resourceId: user._id,
        targetUser: user._id,
        req,
        details: {
          changedFields: [...new Set(changedFields)],
        },
      });
    }

    return successResponse(
      res,
      "Profile updated successfully.",
      {
        id: user._id,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        enrollmentYear: user.enrollmentYear,
        graduationYear: user.graduationYear,
        alumniId: user.alumniId,
        profile: user.profile,
      }
    );
  } catch (err) {
    console.error("Update member profile error:", err);

    return errorResponse(
      res,
      500,
      "Something went wrong while updating your profile."
    );
  }
};



export const logout = async (req, res) => {
  try {



    res.cookie("token", "", {
      ...cookieOptions,
      maxAge: 0,
      expires: new Date(0),
    });


    if (req.user?._id || req.user?.id) {
  const userId = req.user._id || req.user.id;

  await createAuditLog({
    actor: userId,
    action: "auth.logout",
    resource: "User",
    resourceId: userId,
    targetUser: userId,
    req,
  });
}

    return successResponse(
      res,
      "Logged out successfully."
    );

  } catch (err) {

    console.error("Logout error:", err);

    return errorResponse(
      res,
      500,
      "Something went wrong during logout."
    );
  }
};




export const verifyAccountSetupController = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Activation token is required.",
      });
    }

    const user = await verifyAccountSetupToken(token);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This activation link is invalid or has expired.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Activation link is valid.",
    });
  } catch (error) {
    console.error("Verify account setup error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify activation link.",
    });
  }
};






export const setPasswordController = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Activation token is required.",
      });
    }

    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password and confirmation are required.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const user = await verifyAccountSetupToken(token);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This activation link is invalid or has expired.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    user.password = hashedPassword;
    user.isEmailVerified = true;
    user.status = "active";

    user.accountSetupToken = undefined;
    user.accountSetupExpires = undefined;

    await user.save();


    await createAuditLog({
  actor: user._id,
  action: "auth.account_setup_completed",
  resource: "User",
  resourceId: user._id,
  targetUser: user._id,
  req,
  details: {
    status: user.status,
    emailVerified: user.isEmailVerified,
  },
});
    

    return res.status(200).json({
      success: true,
      message: "Password set successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Set password error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to set password.",
    });
  }
};



export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, "Please select an image.");
    }

    if (!req.file.mimetype.startsWith("image/")) {
      return errorResponse(res, 400, "Profile photo must be an image.");
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return errorResponse(res, 404, "User not found.");
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "olivetgosa/profile-photos",
          resource_type: "image",
          transformation: [
            {
              width: 500,
              height: 500,
              crop: "fill",
              gravity: "face",
            },
            {
              quality: "auto",
              fetch_format: "auto",
            },
          ],
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      stream.end(req.file.buffer);
    });

    user.profile.profilePhoto = uploadResult.secure_url;

    await user.save();

    await createAuditLog({
  actor: user._id,
  action: "member.profile_photo_uploaded",
  resource: "User",
  resourceId: user._id,
  targetUser: user._id,
  req,
  details: {
    provider: "cloudinary",
  },
});

    return successResponse(
      res,
      "Profile photo uploaded successfully.",
      {
        profilePhoto: uploadResult.secure_url,
      }
    );
  } catch (err) {
    console.error("Upload profile photo error:", err);

    return errorResponse(
      res,
      500,
      "Something went wrong while uploading your profile photo."
    );
  }
};
