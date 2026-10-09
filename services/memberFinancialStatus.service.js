import Obligation from "../models/Obligation.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import User from "../models/User.js";
import { createAuditLog } from "./auditLog.service.js";

export const updateMemberFinancialStatus = async (
  userId,
  year = new Date().getFullYear(),
  session = null,
  {
    actor = null,
    req = null,
    source = "system",
    paymentId = null,
    reference = null,
  } = {}
) => {
  // Get the member's existing financial status.
  const userQuery = User.findById(userId)
    .select("financialStatus")
    .lean();

  if (session) {
    userQuery.session(session);
  }

  const existingUser = await userQuery;

  if (!existingUser) {
    throw new Error("Member not found while updating financial status.");
  }

  const previousStatus = existingUser.financialStatus ?? null;

  // Get active, mandatory individual obligations for the year.
  const obligationQuery = Obligation.find({
    category: "individual",
    year,
    isActive: true,
    isOptional: { $ne: true },
  })
    .select("_id")
    .lean();

  if (session) {
    obligationQuery.session(session);
  }

  const obligations = await obligationQuery;
  const obligationIds = obligations.map(
    (obligation) => obligation._id
  );

  // If there are no mandatory obligations, the member is non-financial.
  if (!obligationIds.length) {
    const newStatus = "non_financial";

    const updateQuery = User.updateOne(
      { _id: userId },
      { $set: { financialStatus: newStatus } }
    );

    if (session) {
      updateQuery.session(session);
    }

    await updateQuery;

    // Log only when the status actually changes.
    if (previousStatus !== newStatus) {
      await createAuditLog({
        actor,
        action: "member.financial_status_changed",
        resource: "User",
        resourceId: userId,
        targetUser: userId,
        req,
        session,
        details: {
          previousStatus,
          newStatus,
          year,
          source,
          paymentId,
          reference,
        },
      });
    }

    return newStatus;
  }

  // Get the member's assignments for the mandatory obligations.
  const assignmentQuery = ObligationAssignment.find({
    user: userId,
    obligation: { $in: obligationIds },
  })
    .select("obligation amountPaid amountDue")
    .lean();

  if (session) {
    assignmentQuery.session(session);
  }

  const assignments = await assignmentQuery;

  // Check whether every mandatory obligation has an assignment.
  const assignedObligationIds = new Set(
    assignments.map((assignment) =>
      assignment.obligation.toString()
    )
  );

  const hasMissingAssignment = obligationIds.some(
    (obligationId) =>
      !assignedObligationIds.has(obligationId.toString())
  );

  // Check whether any assigned mandatory obligation remains unpaid.
  const hasUnpaidAssignment = assignments.some(
    (assignment) =>
      Number(assignment.amountPaid || 0) <
      Number(assignment.amountDue || 0)
  );

  const newStatus =
    !hasMissingAssignment && !hasUnpaidAssignment
      ? "financial"
      : "non_financial";

  // Update the member's financial status.
  const updateQuery = User.updateOne(
    { _id: userId },
    { $set: { financialStatus: newStatus } }
  );

  if (session) {
    updateQuery.session(session);
  }

  await updateQuery;

  // Audit only actual status changes.
  if (previousStatus !== newStatus) {
    await createAuditLog({
      actor,
      action: "member.financial_status_changed",
      resource: "User",
      resourceId: userId,
      targetUser: userId,
      req,
      session,
      details: {
        previousStatus,
        newStatus,
        year,
        source,
        paymentId,
        reference,
      },
    });
  }

  return newStatus;
};

// ----------------------------------------------------------
// BULK MARK MEMBERS NON-FINANCIAL
// ----------------------------------------------------------

export const markMembersNonFinancial = async (
  userIds,
  session = null
) => {
  if (!userIds?.length) {
    return { modifiedCount: 0 };
  }

  const uniqueUserIds = [
    ...new Set(userIds.map((id) => id.toString())),
  ];

  const updateQuery = User.updateMany(
    {
      _id: { $in: uniqueUserIds },
      role: "member",
    },
    {
      $set: { financialStatus: "non_financial" },
    }
  );

  if (session) {
    updateQuery.session(session);
  }

  return updateQuery;
};