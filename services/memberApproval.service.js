import mongoose from "mongoose";
import User from "../models/User.js";
import Counter from "../models/Counter.js";
import { assignIndividualObligationsToUser } from "./obligationAssignmentService.js";
import generateAlumniId from "../utils/generateAlumniId.js";
export const approveMember = async (userId) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const user = await User.findById(userId)
      .populate("chapter", "_id code name")
      .populate("yearSet", "_id year name")
      .session(session);

    if (!user) {
      throw new Error("Member not found.");
    }

    if (!user.isEmailVerified) {
      throw new Error("Member must verify their email before approval.");
    }

    if (user.status === "active" && user.alumniId) {
      throw new Error("Member has already been approved.");
    }

    if (!user.chapter) {
      throw new Error("Member must have a chapter before approval.");
    }

    if (!user.yearSet) {
      throw new Error("Member must have a year set before approval.");
    }

    if (!user.graduationYear) {
      throw new Error("Member must have a graduation year before approval.");
    }

    // ========================================
    // GENERATE ALUMNI ID SEQUENCE
    // ========================================

    const counter = await Counter.findOneAndUpdate(
      {
        yearSet: user.yearSet._id,
        chapter: user.chapter._id,
      },
      {
        $inc: { sequence: 1 },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        session,
      }
    );


    const alumniId = await generateAlumniId(user.graduationYear, user.chapter.code)    

    // ========================================
    // APPROVE MEMBER
    // ========================================

    user.status = "active";
    user.alumniId = alumniId;

    await user.save({ session });

    // ========================================
    // ASSIGN INDIVIDUAL OBLIGATIONS
    // ========================================

    const obligationResult =
      await assignIndividualObligationsToUser(user._id, session);

    await session.commitTransaction();

    return {
      user,
      alumniId,
      obligationsAssigned: obligationResult.assigned,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};