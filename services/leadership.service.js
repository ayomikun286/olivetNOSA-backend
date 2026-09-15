import mongoose from "mongoose";
import User from "../models/User.js";
import YearSet from "../models/YearSet.js";
import Chapter from "../models/Chapter.js";
import Obligation from "../models/Obligation.js";
import ObligationAssignment from "../models/ObligationAssignment.js";

export const assignYearSetLeader = async (
  userId,
  yearSetId,
  assignedBy
) => {
  
  
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const user = await User.findById(userId).session(session);

    if (!user) {
      throw new Error("Member not found.");
    }

    if (user.status !== "active") {
      throw new Error("Only active members can be assigned as leaders.");
    }

    const yearSet = await YearSet.findById(yearSetId).session(session);

    if (!yearSet) {
      throw new Error("Year set not found.");
    }

    if (yearSet.leader && yearSet.leader.toString() !== userId) {
      throw new Error("This year set already has a leader.");
    }

    yearSet.leader = user._id;
    yearSet.leaderAssignedAt = new Date();

    await yearSet.save({ session });

    const obligations = await Obligation.find({
      category: "yearSet",
      isActive: true,
      year: new Date().getFullYear(),
    })
      .select("_id amount dueDate")
      .lean()
      .session(session);

    let assigned = 0;

    for (const obligation of obligations) {
      const existing = await ObligationAssignment.findOne({
        obligation: obligation._id,
        user: user._id,
      }).session(session);

      if (existing) continue;

      await ObligationAssignment.create(
        [
          {
            obligation: obligation._id,
            user: user._id,
            amountDue: obligation.amount,
            amountPaid: 0,
            status: "pending",
            dueDate: obligation.dueDate || null,
            assignedBy,
          },
        ],
        { session }
      );

      assigned++;
    }

    await session.commitTransaction();

    return {
      yearSet,
      obligationsAssigned: assigned,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};


export const assignChapterLeader = async (
  userId,
  chapterId,
  assignedBy
) => {
  
  
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const user = await User.findById(userId).session(session);

    if (!user) {
      throw new Error("Member not found.");
    }

    if (user.status !== "active") {
      throw new Error("Only active members can be assigned as leaders.");
    }

    const chapter = await Chapter.findById(chapterId).session(session);

    if (!chapter) {
      throw new Error("Chapter not found.");
    }

    if (chapter.leader && chapter.leader.toString() !== userId) {
      throw new Error("This chapter already has a leader.");
    }

    chapter.leader = user._id;
    chapter.leaderAssignedAt = new Date();

    await chapter.save({ session });

    const obligations = await Obligation.find({
      category: "chapter",
      isActive: true,
      year: new Date().getFullYear(),
    })
      .select("_id amount dueDate")
      .lean()
      .session(session);

    let assigned = 0;

    for (const obligation of obligations) {
      const existing = await ObligationAssignment.findOne({
        obligation: obligation._id,
        user: user._id,
      }).session(session);

      if (existing) continue;

      await ObligationAssignment.create(
        [
          {
            obligation: obligation._id,
            user: user._id,
            amountDue: obligation.amount,
            amountPaid: 0,
            status: "pending",
            dueDate: obligation.dueDate || null,
            assignedBy,
          },
        ],
        { session }
      );

      assigned++;
    }

    await session.commitTransaction();

    return {
      chapter,
      obligationsAssigned: assigned,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};