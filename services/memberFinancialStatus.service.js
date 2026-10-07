import Obligation from "../models/Obligation.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import User from "../models/User.js";

const getMandatoryIndividualObligationIds = async (
  year,
  session = null
) => {
  const query = Obligation.find({
    category: "individual",
    year,
    isActive: true,
    isOptional: { $ne: true },
  })
    .select("_id")
    .lean();

  if (session) {
    query.session(session);
  }

  const obligations = await query;

  return obligations.map((obligation) => obligation._id);
};

export const updateMemberFinancialStatus = async (
  userId,
  year = new Date().getFullYear(),
  session = null
) => {
  // ----------------------------------------------------------
  // GET CURRENT-YEAR MANDATORY INDIVIDUAL OBLIGATIONS
  // ----------------------------------------------------------

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
  console.log(
  "MANDATORY INDIVIDUAL OBLIGATIONS:",
  obligations
);

  const obligationIds = obligations.map(
    (obligation) => obligation._id
  );

  // No mandatory obligations for this year
  if (!obligationIds.length) {
    const updateQuery = User.updateOne(
      { _id: userId },
      {
        $set: {
          financialStatus: "non_financial",
        },
      }
    );

    if (session) {
      updateQuery.session(session);
    }

    await updateQuery;

    return "non_financial";
  }

  // ----------------------------------------------------------
  // FIND MEMBER'S ASSIGNMENTS FOR THESE OBLIGATIONS
  // ----------------------------------------------------------

  const assignmentQuery = ObligationAssignment.find({
    user: userId,
    obligation: {
      $in: obligationIds,
    },
  })
    .select("obligation amountPaid amountDue")
    .lean();

  if (session) {
    assignmentQuery.session(session);
  }

  const assignments = await assignmentQuery;

  console.log(
  "MEMBER ASSIGNMENTS:",
  assignments
);

  // ----------------------------------------------------------
  // CHECK THAT ALL MANDATORY OBLIGATIONS ARE ASSIGNED
  // ----------------------------------------------------------

  const assignedObligationIds = new Set(
    assignments.map((assignment) =>
      assignment.obligation.toString()
    )
  );

  const hasMissingAssignment = obligationIds.some(
    (obligationId) =>
      !assignedObligationIds.has(
        obligationId.toString()
      )
  );

  // ----------------------------------------------------------
  // CHECK THAT ALL ASSIGNED OBLIGATIONS ARE FULLY PAID
  // ----------------------------------------------------------

  const hasUnpaidAssignment = assignments.some(
    (assignment) =>
      Number(assignment.amountPaid || 0) <
      Number(assignment.amountDue || 0)
  );

  const financialStatus =
    !hasMissingAssignment &&
    !hasUnpaidAssignment
      ? "financial"
      : "non_financial";

  // ----------------------------------------------------------
  // UPDATE MEMBER
  // ----------------------------------------------------------

  const updateQuery = User.updateOne(
    { _id: userId },
    {
      $set: {
        financialStatus,
      },
    }
  );

  if (session) {
    updateQuery.session(session);
  }

  await updateQuery;

  return financialStatus;
};


// ----------------------------------------------------------
// BULK MARK MEMBERS NON-FINANCIAL
// ----------------------------------------------------------

export const markMembersNonFinancial = async (
  userIds,
  session = null
) => {
  if (!userIds?.length) {
    return {
      modifiedCount: 0,
    };
  }

  const uniqueUserIds = [
    ...new Set(
      userIds.map((id) => id.toString())
    ),
  ];

  const updateQuery = User.updateMany(
    {
      _id: {
        $in: uniqueUserIds,
      },
      role: "member",
    },
    {
      $set: {
        financialStatus: "non_financial",
      },
    }
  );

  if (session) {
    updateQuery.session(session);
  }

  return updateQuery;
};