import mongoose from "mongoose";

import User from "../models/User.js";
import YearSet from "../models/YearSet.js";
import Chapter from "../models/Chapter.js";
import Obligation from "../models/Obligation.js";
import ObligationAssignment from "../models/ObligationAssignment.js";

import { createAuditLog } from "./auditLog.service.js";

// ========================================
// ENSURE COLLECTIVE OBLIGATIONS EXIST FOR GROUP
// ========================================

// const reassignCollectiveAssignments = async ({
//   category,
//   assignedBy,
//   session,
// }) => {
//   const currentYear = new Date().getFullYear();

//   const obligations = await Obligation.find({
//     category,
//     isActive: true,
//     year: currentYear,
//   })
//     .select("_id amount dueDate")
//     .session(session);

//   let assigned = 0;

//   for (const obligation of obligations) {
//     const result = await ObligationAssignment.updateOne(
//       category === "yearSet"
//         ? {
//           obligation: obligation._id,
//           yearSet: {
//             $exists: true,
//             $ne: null,
//           },
//         }
//         : {
//           obligation: obligation._id,
//           chapter: {
//             $exists: true,
//             $ne: null,
//           },
//         },
//       {
//         $setOnInsert: {
//           obligation: obligation._id,
//           amountDue: obligation.amount,
//           amountPaid: 0,
//           status: "pending",
//           dueDate: obligation.dueDate || null,
//           assignedBy: assignedBy || null,
//         },
//       },
//       {
//         upsert: false,
//         session,
//       }
//     );

//     assigned += result.upsertedCount || 0;
//   }

//   return {
//     transferred: 0,
//     assigned,
//   };
// };
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

    // const reassignment = await reassignCollectiveAssignments({
    //   category: "yearSet",
    //   previousLeaderId: previousLeader,
    //   newLeaderId: user._id,
    //   assignedBy,
    //   session,
    // });

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
        obligationsAssigned: 0,
        collectiveAssignmentsTransferred: 0,
      },
    });

    await session.commitTransaction();

    return {
      yearSet,
      previousLeader,
      newLeader: user._id,
      isReassignment,
     obligationsAssigned: 0,
collectiveAssignmentsTransferred: 0,
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

    // const reassignment = await reassignCollectiveAssignments({
    //   category: "chapter",
    //   previousLeaderId: previousLeader,
    //   newLeaderId: user._id,
    //   assignedBy,
    //   session,
    // });

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
        obligationsAssigned: 0,
        collectiveAssignmentsTransferred: 0,
      },
    });

    await session.commitTransaction();

    return {
      chapter,
      previousLeader,
      newLeader: user._id,
      isReassignment,
      obligationsAssigned: 0,
collectiveAssignmentsTransferred: 0,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};