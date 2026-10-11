import mongoose from "mongoose";

import User from "../models/User.js";
import YearSet from "../models/YearSet.js";
import Chapter from "../models/Chapter.js";
import Obligation from "../models/Obligation.js";
import ObligationAssignment from "../models/ObligationAssignment.js";

import { createAuditLog } from "./auditLog.service.js";

// ========================================
// REASSIGN COLLECTIVE OBLIGATIONS
// ========================================

const reassignCollectiveAssignments = async ({
  category,
  previousLeaderId,
  newLeaderId,
  assignedBy,
  session,
}) => {
  let transferred = 0;
  let assigned = 0;

  const previousId = previousLeaderId
    ? previousLeaderId.toString()
    : null;

  const nextId = newLeaderId.toString();

  // ========================================
  // 1. TRANSFER EXISTING COLLECTIVE ASSIGNMENTS
  // ========================================

  if (previousId && previousId !== nextId) {
    const previousAssignments = await ObligationAssignment.find({
      user: previousId,
    })
      .populate({
        path: "obligation",
        select: "category year",
      })
      .session(session);

    for (const assignment of previousAssignments) {
      const obligation = assignment.obligation;

      // Only transfer the requested collective category.
      // Individual obligations remain with their original users.
      if (!obligation || obligation.category !== category) {
        continue;
      }

      // The unique index is { obligation, user }.
      // Never merge two assignments blindly: the current schema
      // cannot prove that they belong to the same collective group.
      const conflictingAssignment = await ObligationAssignment.findOne({
        obligation: obligation._id,
        user: nextId,
        _id: { $ne: assignment._id },
      }).session(session);

      if (conflictingAssignment) {
        throw new Error(
          `Cannot safely transfer "${obligation.category}" obligation ` +
            `"${obligation._id}" because the incoming leader already has ` +
            `an assignment for it. No balances have been merged. ` +
            `This requires manual review.`
        );
      }

      // Change the assignment owner, not the financial values.
      // amountDue, amountPaid, status, dueDate, reminders and
      // existing Payment references remain unchanged.
      assignment.user = newLeaderId;
      assignment.assignedBy = assignedBy || assignment.assignedBy;

      await assignment.save({ session });

      transferred++;
    }
  }

  // ========================================
  // 2. ENSURE CURRENT-YEAR OBLIGATIONS EXIST
  // ========================================

  const currentYear = new Date().getFullYear();

  const obligations = await Obligation.find({
    category,
    isActive: true,
    year: currentYear,
  })
    .select("_id amount dueDate")
    .session(session);

  for (const obligation of obligations) {
    const existing = await ObligationAssignment.findOne({
      obligation: obligation._id,
      user: nextId,
    }).session(session);

    // An existing assignment may be a transferred assignment.
    // Do not reset its balance or create a duplicate.
    if (existing) {
      continue;
    }

    await ObligationAssignment.create(
      [
        {
          obligation: obligation._id,
          user: newLeaderId,
          amountDue: obligation.amount,
          amountPaid: 0,
          status: "pending",
          dueDate: obligation.dueDate || null,
          assignedBy: assignedBy || null,
        },
      ],
      { session }
    );

    assigned++;
  }

  return {
    transferred,
    assigned,
  };
};

// ========================================
// ASSIGN / REASSIGN YEAR SET LEADER
// ========================================

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

    const nextLeader = user._id.toString();

    const isReassignment =
      Boolean(previousLeader) && previousLeader !== nextLeader;

    if (previousLeader === nextLeader) {
      throw new Error(
        "This member is already the leader of this year set."
      );
    }

    // ========================================
    // UPDATE LEADERSHIP
    // ========================================

    yearSet.leader = user._id;
    yearSet.leaderAssignedAt = new Date();

    await yearSet.save({ session });

    // ========================================
    // REASSIGN COLLECTIVE OBLIGATIONS
    // ========================================

    const reassignment = await reassignCollectiveAssignments({
      category: "yearSet",
      previousLeaderId: previousLeader,
      newLeaderId: user._id,
      assignedBy,
      session,
    });

    // ========================================
    // AUDIT LOG
    // ========================================

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
        newLeader: nextLeader,
        isReassignment,
        obligationsAssigned: reassignment.assigned,
        collectiveAssignmentsTransferred: reassignment.transferred,
      },
    });

    await session.commitTransaction();

    return {
      yearSet,
      previousLeader,
      newLeader: user._id,
      isReassignment,
      obligationsAssigned: reassignment.assigned,
      collectiveAssignmentsTransferred: reassignment.transferred,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

// ========================================
// ASSIGN / REASSIGN CHAPTER LEADER
// ========================================

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

    const nextLeader = user._id.toString();

    const isReassignment =
      Boolean(previousLeader) && previousLeader !== nextLeader;

    if (previousLeader === nextLeader) {
      throw new Error(
        "This member is already the leader of this chapter."
      );
    }

    // ========================================
    // UPDATE LEADERSHIP
    // ========================================

    chapter.leader = user._id;
    chapter.leaderAssignedAt = new Date();

    await chapter.save({ session });

    // ========================================
    // REASSIGN COLLECTIVE OBLIGATIONS
    // ========================================

    const reassignment = await reassignCollectiveAssignments({
      category: "chapter",
      previousLeaderId: previousLeader,
      newLeaderId: user._id,
      assignedBy,
      session,
    });

    // ========================================
    // AUDIT LOG
    // ========================================

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
        newLeader: nextLeader,
        isReassignment,
        obligationsAssigned: reassignment.assigned,
        collectiveAssignmentsTransferred: reassignment.transferred,
      },
    });

    await session.commitTransaction();

    return {
      chapter,
      previousLeader,
      newLeader: user._id,
      isReassignment,
      obligationsAssigned: reassignment.assigned,
      collectiveAssignmentsTransferred: reassignment.transferred,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};