import Obligation from "../models/Obligation.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import User from "../models/User.js";


export const assignIndividualObligationsToUser = async (
  userId,
  assignedBy = null,
  session = null
) => {
  const currentYear = new Date().getFullYear();

  // Get current year's active individual obligations
  const obligations = await Obligation.find({
    category: "individual",
    year: currentYear,
    isActive: true,
  })
    .select("_id amount dueDate name")
    .lean()
    .session(session);

  if (!obligations.length) {
    return {
      assigned: 0,
      assignments: [],
    };
  }

  // Check which of these obligations the user already has
  const existingAssignments = await ObligationAssignment.find({
    user: userId,
    obligation: {
      $in: obligations.map((obligation) => obligation._id),
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

  // Only create missing assignments
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

      // Admin who triggered the assignment
      assignedBy,
    }));

  if (!assignments.length) {
    return {
      assigned: 0,
      assignments: [],
    };
  }

  const createdAssignments =
    await ObligationAssignment.insertMany(assignments, {
      session,
    });

  return {
    assigned: createdAssignments.length,
    assignments: createdAssignments,
  };
};


export const assignIndividualObligationToMembers = async (
  obligationId,
  assignedBy
) => {
  const currentYear = new Date().getFullYear();

  // Get the obligation
  const obligation = await Obligation.findOne({
    _id: obligationId,
    category: "individual",
    year: currentYear,
    isActive: true,
  })
    .select("_id amount dueDate name year")
    .lean();

  if (!obligation) {
    throw new Error(
      "Individual obligation not found or does not belong to the current year."
    );
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
      assignments: [],
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

    // Admin who created the obligation
    assignedBy,
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
    assignments: result,
  };
};