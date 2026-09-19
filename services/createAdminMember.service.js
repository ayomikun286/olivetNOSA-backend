import mongoose from "mongoose";
import crypto from "crypto";

import User from "../models/User.js";
import generateAlumniId from "../utils/generateAlumniId.js";
import {
  assignIndividualObligationsToUser,
} from "./obligationAssignmentService.js";

export const createAdminMember = async ({
  firstName,
  middleName,
  lastName,
  email,
  phone,
  enrollmentYear,
  graduationYear,
  yearSet,
  chapter,
}) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // ========================================
    // CHECK EXISTING EMAIL
    // ========================================

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    }).session(session);

    if (existingUser) {
      throw new Error(
        "A member with this email already exists."
      );
    }

    // ========================================
    // GENERATE ALUMNI ID
    // ========================================

    const alumniId = await generateAlumniId(
      yearSet,
      chapter,
      session
    );

    // ========================================
    // CREATE USER
    // ========================================

    const user = new User({
      firstName: firstName.trim(),
      middleName: middleName?.trim() || undefined,
      lastName: lastName.trim(),

      email: email.toLowerCase().trim(),
      phone: phone?.trim() || undefined,

      enrollmentYear,
      graduationYear,

      yearSet,
      chapter,

      // Admin-created account has no password yet
      password: undefined,

      role: "member",
      status: "pending",

      isEmailVerified: false,

      alumniId,
    });

    await user.save({ session });

    // ========================================
    // ASSIGN INDIVIDUAL OBLIGATIONS
    // ========================================

    const obligationResult =
      await assignIndividualObligationsToUser(
        user._id,
        null,
        session
      );

    // ========================================
    // GENERATE ACCOUNT SETUP TOKEN
    // ========================================

    const rawToken = crypto
      .randomBytes(32)
      .toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expires = new Date(
      Date.now() + 72 * 60 * 60 * 1000
    );

    user.accountSetupToken = hashedToken;
    user.accountSetupExpires = expires;

    await user.save({ session });

    // ========================================
    // COMMIT
    // ========================================

    await session.commitTransaction();

    return {
      user,
      alumniId,
      activationToken: rawToken,
      obligationsAssigned:
        obligationResult.assigned,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};