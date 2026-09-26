import Obligation from "../models/Obligation.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import User from "../models/User.js";

/**
 * ============================================================
 * ASSIGN CURRENT-YEAR INDIVIDUAL OBLIGATIONS TO ONE USER
 * ============================================================
 *
 * Used when:
 * - A new member becomes active
 * - An existing member needs their current-year obligations synced
 *
 * IMPORTANT:
 * Only current-year active individual obligations are assigned.
 * Previous-year obligations are NEVER automatically assigned.
 */
export const assignIndividualObligationsToUser = async (
  userId,
  assignedBy = null,
  session = null
) => {
  const currentYear = new Date().getFullYear();

  // ----------------------------------------------------------
  // GET CURRENT-YEAR ACTIVE INDIVIDUAL OBLIGATIONS
  // ----------------------------------------------------------

  const obligations = await Obligation.find({
    category: "individual",
    year: currentYear,
    isActive: true,
  })
    .select("_id amount dueDate name year")
    .lean()
    .session(session);

  if (!obligations.length) {
    return {
      assigned: 0,
      assignments: [],
    };
  }

  // ----------------------------------------------------------
  // CHECK EXISTING ASSIGNMENTS
  // ----------------------------------------------------------

  const obligationIds = obligations.map(
    (obligation) => obligation._id
  );

  const existingAssignments = await ObligationAssignment.find({
    user: userId,
    obligation: {
      $in: obligationIds,
    },
  })
    .select("obligation")
    .lean()
    .session(session);

  const existingObligationIds = new Set(
    existingAssignments.map((assignment) =>
      assignment.obligation.toString()
    )
  );

  // ----------------------------------------------------------
  // CREATE ONLY MISSING ASSIGNMENTS
  // ----------------------------------------------------------

  const assignments = obligations
    .filter(
      (obligation) =>
        !existingObligationIds.has(
          obligation._id.toString()
        )
    )
    .map((obligation) => ({
      obligation: obligation._id,
      user: userId,
      amountDue: obligation.amount,
      amountPaid: 0,
      status: "pending",
      dueDate: obligation.dueDate || null,
      assignedBy,
    }));

  if (!assignments.length) {
    return {
      assigned: 0,
      assignments: [],
    };
  }

  // ----------------------------------------------------------
  // INSERT
  // ----------------------------------------------------------

  const createdAssignments =
    await ObligationAssignment.insertMany(assignments, {
      session,
      ordered: false,
    });

  return {
    assigned: createdAssignments.length,
    assignments: createdAssignments,
  };
};

/**
 * ============================================================
 * ASSIGN ONE INDIVIDUAL OBLIGATION TO ALL ELIGIBLE MEMBERS
 * ============================================================
 *
 * Used when an admin creates a new individual obligation.
 *
 * IMPORTANT:
 * The obligation MUST:
 * - Be individual
 * - Belong to the current year
 * - Be active
 *
 * Only:
 * - active members
 * - verified members
 *
 * receive the assignment.
 */
export const assignIndividualObligationToMembers = async (
  obligationId,
  assignedBy = null,
  session = null
) => {
  const currentYear = new Date().getFullYear();

  // ----------------------------------------------------------
  // GET CURRENT-YEAR ACTIVE INDIVIDUAL OBLIGATION
  // ----------------------------------------------------------

  const obligation = await Obligation.findOne({
    _id: obligationId,
    category: "individual",
    year: currentYear,
    isActive: true,
  })
    .select("_id amount dueDate name year")
    .lean()
    .session(session);

  if (!obligation) {
    throw new Error(
      "Individual obligation not found or does not belong to the current year."
    );
  }

  // ----------------------------------------------------------
  // GET ELIGIBLE MEMBERS
  // ----------------------------------------------------------

  const members = await User.find({
    role: "member",
    status: "active",
    isEmailVerified: true,
  })
    .select("_id")
    .lean()
    .session(session);

  if (!members.length) {
    return {
      assigned: 0,
      assignments: [],
    };
  }

  const memberIds = members.map(
    (member) => member._id
  );

  // ----------------------------------------------------------
  // CHECK EXISTING ASSIGNMENTS
  // ----------------------------------------------------------

  const existingAssignments =
    await ObligationAssignment.find({
      obligation: obligation._id,
      user: {
        $in: memberIds,
      },
    })
      .select("user")
      .lean()
      .session(session);

  const existingUserIds = new Set(
    existingAssignments.map((assignment) =>
      assignment.user.toString()
    )
  );

  // ----------------------------------------------------------
  // ONLY ASSIGN MEMBERS WHO DON'T ALREADY HAVE IT
  // ----------------------------------------------------------

  const assignments = members
    .filter(
      (member) =>
        !existingUserIds.has(
          member._id.toString()
        )
    )
    .map((member) => ({
      obligation: obligation._id,
      user: member._id,
      amountDue: obligation.amount,
      amountPaid: 0,
      status: "pending",
      dueDate: obligation.dueDate || null,
      assignedBy,
    }));

  if (!assignments.length) {
    return {
      assigned: 0,
      assignments: [],
    };
  }

  // ----------------------------------------------------------
  // INSERT
  // ----------------------------------------------------------

  const createdAssignments =
    await ObligationAssignment.insertMany(assignments, {
      session,
      ordered: false,
    });

  return {
    assigned: createdAssignments.length,
    assignments: createdAssignments,
  };
};