import Obligation from "../models/Obligation.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import User from "../models/User.js";

/**
 * Assign all active individual obligations to one user.
 *
 * Used when a new member becomes eligible.
 */
export const assignIndividualObligationsToUser = async (userId) => {
  // Get active individual obligations
  const obligations = await Obligation.find({
    category: "individual",
    isActive: true,
  })
    .select("_id amount dueDate")
    .lean();

  if (!obligations.length) {
    return {
      assigned: 0,
    };
  }

  // Check which obligations this user already has
  const existingAssignments = await ObligationAssignment.find({
    user: userId,
    obligation: {
      $in: obligations.map((obligation) => obligation._id),
    },
  })
    .select("obligation")
    .lean();

  const existingObligationIds = new Set(
    existingAssignments.map((assignment) =>
      assignment.obligation.toString()
    )
  );

  // Only create missing assignments
  const assignments = obligations
    .filter(
      (obligation) =>
        !existingObligationIds.has(obligation._id.toString())
    )
    .map((obligation) => ({
      obligation: obligation._id,
      user: userId,
      amountDue: obligation.amount,
      amountPaid: 0,
      status: "pending",
      dueDate: obligation.dueDate || null,

      // No admin context here yet.
      // This function is triggered by member activation.
      assignedBy: null,
    }));

  if (!assignments.length) {
    return {
      assigned: 0,
    };
  }

  await ObligationAssignment.insertMany(assignments);

  return {
    assigned: assignments.length,
  };
};


/**
 * Assign one individual obligation to all eligible members.
 *
 * Used when an admin creates a new individual obligation.
 */
export const assignIndividualObligationToMembers = async (
  obligationId,
  assignedBy
) => {
  // Get the obligation
  const obligation = await Obligation.findOne({
    _id: obligationId,
    category: "individual",
    isActive: true,
  })
    .select("_id amount dueDate")
    .lean();

  if (!obligation) {
    throw new Error("Individual obligation not found.");
  }

  // Get all eligible members
  const members = await User.find({
    role: "member",
    status: "active",
    isEmailVerified: true,
  })
    .select("_id")
    .lean();

  if (!members.length) {
    return {
      assigned: 0,
    };
  }

  // Build assignments
  const assignments = members.map((member) => ({
    obligation: obligation._id,
    user: member._id,
    amountDue: obligation.amount,
    amountPaid: 0,
    status: "pending",
    dueDate: obligation.dueDate || null,
    assignedBy: null,
  }));

  // Insert in bulk
  const result = await ObligationAssignment.insertMany(
    assignments,
    {
      ordered: false,
    }
  );

  return {
    assigned: result.length,
  };
};