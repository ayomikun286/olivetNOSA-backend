import mongoose from "mongoose";
import { createAuditLog } from "./auditLog.service.js";import User from "../models/User.js";
import YearSet from "../models/YearSet.js";
import Chapter from "../models/Chapter.js";
import Obligation from "../models/Obligation.js";
import ObligationAssignment from "../models/ObligationAssignment.js";


// ASSIGN / REASSIGN YEAR SET LEADER
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
      throw new Error(
        "Only active members can be assigned as leaders."
      );
    }

    const yearSet = await YearSet.findById(yearSetId).session(session);

    if (!yearSet) {
      throw new Error("Year set not found.");
    }

    if (!yearSet.isActive) {
      throw new Error(
        "Cannot assign a leader to an inactive year set."
      );
    }

    const previousLeader = yearSet.leader
      ? yearSet.leader.toString()
      : null;

    const isReassignment =
      previousLeader && previousLeader !== userId;

    // Already the current leader
    if (previousLeader === userId) {
      throw new Error(
        "This member is already the leader of this year set."
      );
    }

    // ========================================
    // ASSIGN NEW LEADER
    // ========================================

    yearSet.leader = user._id;
    yearSet.leaderAssignedAt = new Date();

    await yearSet.save({ session });

    // ========================================
    // ASSIGN CURRENT YEAR OBLIGATIONS
    // ========================================

    const currentYear = new Date().getFullYear();

    const obligations = await Obligation.find({
      category: "yearSet",
      isActive: true,
      year: currentYear,
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


    await createAuditLog({
  actor: assignedBy,
  action: isReassignment
    ? "year_set.leader_reassigned"
    : "year_set.leader_assigned",
  resource: "YearSet",
  resourceId: yearSet._id,
  targetUser: user._id,
  session,
  details: {
    yearSetName: yearSet.name,
    previousLeader,
    newLeader: user._id.toString(),
    isReassignment: Boolean(isReassignment),
    obligationsAssigned: assigned,
  },
});


    await session.commitTransaction();

    return {
      yearSet,
      previousLeader,
      newLeader: user._id,
      isReassignment,
      obligationsAssigned: assigned,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};


// ASSIGN / REASSIGN CHAPTER LEADER
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
      throw new Error(
        "Only active members can be assigned as leaders."
      );
    }

    const chapter = await Chapter.findById(chapterId).session(session);

    if (!chapter) {
      throw new Error("Chapter not found.");
    }

    if (!chapter.isActive) {
      throw new Error(
        "Cannot assign a leader to an inactive chapter."
      );
    }

    const previousLeader = chapter.leader
      ? chapter.leader.toString()
      : null;

    const isReassignment =
      previousLeader && previousLeader !== userId;

    // Already the current leader
    if (previousLeader === userId) {
      throw new Error(
        "This member is already the leader of this chapter."
      );
    }

    // ========================================
    // ASSIGN NEW LEADER
    // ========================================

    chapter.leader = user._id;
    chapter.leaderAssignedAt = new Date();

    await chapter.save({ session });

    // ========================================
    // ASSIGN CURRENT YEAR OBLIGATIONS
    // ========================================

    const currentYear = new Date().getFullYear();

    const obligations = await Obligation.find({
      category: "chapter",
      isActive: true,
      year: currentYear,
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


    await createAuditLog({
  actor: assignedBy,
  action: isReassignment
    ? "chapter.leader_reassigned"
    : "chapter.leader_assigned",
  resource: "Chapter",
  resourceId: chapter._id,
  targetUser: user._id,
  session,
  details: {
    chapterName: chapter.name,
    previousLeader,
    newLeader: user._id.toString(),
    isReassignment: Boolean(isReassignment),
    obligationsAssigned: assigned,
  },
});

    await session.commitTransaction();

    return {
      chapter,
      previousLeader,
      newLeader: user._id,
      isReassignment,
      obligationsAssigned: assigned,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};