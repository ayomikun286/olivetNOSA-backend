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

import verifyEmailTemplate from "../utils/Mail-template/verifyEmail.template.js"
import {
  successResponse,
  errorResponse,
} from "../utils/response.js";
import { error } from "console";

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
        subject: "Verify your OlivetNOSA Alumni Account",
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px;">

        <h2>Welcome to OlivetNOSA, ${user.firstName}!</h2>

        <p>
          Thank you for creating your OlivetNOSA Alumni account.
        </p>

        <p>
          Please click the button below to verify your email address:
        </p>

        <div style="margin: 30px 0;">
          <a
            href="${verificationLink}"
            style="
              display: inline-block;
              padding: 14px 24px;
              background: #000;
              color: #fff;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
            "
          >
            Verify My Email
          </a>
        </div>

        <p>
          Or copy and paste this link in your browser:<br />
          <a href="${verificationLink}">${verificationLink}</a>
        </p>

        <p>
          This verification link will expire in 30 minutes.
        </p>

        <p>
          If you did not create this account, you can safely ignore this email.
        </p>

        <p>
          Regards,<br />
          <strong>OlivetNOSA Alumni</strong>
        </p>

      </div>
    `,
      });
    } catch (emailErr) {
      console.error("Failed to deliver verification email via provider:", emailErr);
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


    // SEND EMAIL
    const verificationUrl =
      `${process.env.FRONTEND_URL}/portal/verify-email?token=${verificationToken}`;

    await sendEmail({
      to: normalizedEmail,
      subject: "Verify your OlivetNOSA Alumni Account",
      html: `
        <h2>Verify your email address</h2>

        <p>
          Please click the button below to verify your
          OlivetNOSA account.
        </p>

        <p>
          <a href="${verificationUrl}">
            Verify My Email
          </a>
        </p>

        <p>
          This verification link will expire in 30 minutes.
        </p>
      `,
    });

    // ------------------------------------------
    // RESPONSE
    // ------------------------------------------

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



    // RESET URL
    const resetUrl =
      `${process.env.FRONTEND_URL}/portal/reset-password?token=${resetToken}`;
    await sendEmail({
      to: normalizedEmail,
      subject: "Verify your OlivetNOSA Alumni Account",
      html: `
  <h2>Reset Your OlivetNOSA Password</h2>

  <p>
    We received a request to reset the password for your
    OlivetNOSA account.
  </p>

  <p>
    If you made this request, click the button below to
    create a new password and regain access to your account.
  </p>

  <p>
    <a href="${resetUrl}">
      Reset My Password
    </a>
  </p>

  <p>
    For your security, this password reset link will expire
    in 30 minutes.
  </p>

  <p>
    If you did not request a password reset, you can safely
    ignore this email. Your password will remain unchanged.
  </p>

  <p>
    Thank you,<br />
    <strong>OlivetNOSA</strong>
  </p>
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

        enrollmentYear: user.enrollmentYear,
        graduationYear: user.graduationYear,

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

    // ----------------------------------------
    // BASIC NAME / PHONE
    // ----------------------------------------

    if (firstName !== undefined) {
      if (!firstName.trim()) {
        return errorResponse(res, 400, "First name is required.");
      }

      user.firstName = firstName.trim();
    }

    if (middleName !== undefined) {
      user.middleName = middleName.trim();
    }

    if (lastName !== undefined) {
      if (!lastName.trim()) {
        return errorResponse(res, 400, "Last name is required.");
      }

      user.lastName = lastName.trim();
    }

    if (phone !== undefined) {
      user.phone = phone.trim();
    }

    // ----------------------------------------
    // PROFILE
    // ----------------------------------------

    if (profile && typeof profile === "object") {
      user.profile = {
        ...user.profile?.toObject?.() || user.profile || {},
        ...profile,
      };
    }

    await user.save();

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
          folder: "olivetnosa/profile-photos",
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
