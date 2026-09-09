import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { sendEmail } from "../services/email.service.js"

import User from "../models/User.js";
import YearSet from "../models/YearSet.js";
import Chapter from "../models/Chapter.js";
import { validateEmail } from "../utils/validator.js";

import {
  successResponse,
  errorResponse,
} from "../utils/response.js";


// COOKIE CONFIGURATION
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};






// REGISTER
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



    // VERIFICATION LINK
    // ==========================================
    const frontendBase = (process.env.FRONTEND_URL || "http://localhost:5173")
      .replace(/\/+$/, "")
      .replace(/\/portal\/signup\/?$/, "");

    const verificationLink = `${frontendBase}/portal/verify-email?token=${verificationToken}`;


    // Send email to user (or fallback to testing email if needed)
    try {
      await sendEmail({
        to: "edegbaiayomikun@gmail.com",
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

    // DEVELOPMENT CONSOLE LOG (Always available for local testing)
    // console.log(`
    //   =========================================
    //           EMAIL VERIFICATION LINK
    //   =========================================
    //   Email: ${user.email}
    //   Verification Link: ${verificationLink}
    //   Expires: ${verificationExpires}
    //   =========================================
    // `);





    // RESPONSE
    // ==========================================
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



// VERIFY EMAIL
// VERIFY EMAIL

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

    console.log("====================================");
    console.log("EMAIL VERIFICATION");
    console.log("RAW TOKEN:", token);
    console.log("HASHED TOKEN:", hashedToken);
    console.log("CURRENT TIME:", new Date());

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

    console.log("USER FOUND:", !!user);

    if (user) {
      console.log("DB TOKEN:", user.emailVerificationToken);
      console.log("DB EXPIRY:", user.emailVerificationExpires);
    }

    console.log("====================================");

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

    // ------------------------------------------
    // CREATE JWT
    // ------------------------------------------

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



// LOGIN
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
    .select("-password");

  if (!user) {
    return errorResponse(res, "User not found.", 404);
  }

  return successResponse(res, "Current user retrieved.", {
    id: user._id,
    firstName: user.firstName,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
  });
};


// LOGOUT
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


// user details 
