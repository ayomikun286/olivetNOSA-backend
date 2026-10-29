import Obligation from "../models/Obligation.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import User from "../models/User.js";
import { createAuditLog } from "./auditLog.service.js";
import YearSet from "../models/YearSet.js";
import Chapter from "../models/Chapter.js";

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
    .select("_id amount dueDate name year isOptional")
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

  const hasMandatoryAssignment = obligations.some(
    (obligation) =>
      !obligation.isOptional &&
      !existingObligationIds.has(obligation._id.toString())
  );

  if (hasMandatoryAssignment) {
    await User.updateOne(
      { _id: userId, role: "member" },
      {
        $set: {
          financialStatus: "non_financial",
        },
      },
      { session }
    );
  }


  await createAuditLog({
    actor: assignedBy,
    action: "obligation.assignments_created",
    resource: "ObligationAssignment",
    targetUser: userId,
    req: null,
    session,
    details: {
      assignmentType: "individual_obligations_assigned_to_user",
      assignmentsCreated: createdAssignments.length,
      obligationIds: createdAssignments.map((assignment) =>
        assignment.obligation.toString()
      ),
      year: currentYear,
    },
  });

  return {
    assigned: createdAssignments.length,
    assignments: createdAssignments,
  };
};


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
    .select("_id amount dueDate name year isOptional")
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
    .select("_id role status isEmailVerified")
    .lean()
    .session(session);

  console.log("Eligible members:", members.length);
  console.log(members);

  if (!members.length) {
    return {
      assigned: 0,
      assignments: [],
    };
  }


  console.log("Eligible members for obligation:", members.length);

  console.log(
    members.map((member) => ({
      id: member._id,
      role: member.role,
      status: member.status,
      isEmailVerified: member.isEmailVerified,
    }))
  );

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


  console.log("Obligation ID:", obligation._id.toString());
  console.log("Eligible member IDs:", memberIds.map(String));
  console.log("Existing assignments found:", existingAssignments.length);
  console.log(
    "Existing assignment user IDs:",
    existingAssignments.map((a) => a.user?.toString())
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


  console.log("New assignments prepared:", assignments.length);
  console.log(
    "Assignment preview:",
    assignments.slice(0, 3).map((a) => ({
      obligation: a.obligation.toString(),
      user: a.user.toString(),
      amountDue: a.amountDue,
    }))
  );

  // ----------------------------------------------------------
  // INSERT
  // ----------------------------------------------------------

  let createdAssignments;

  try {
    createdAssignments = await ObligationAssignment.insertMany(
      assignments,
      {
        ordered: false,
        ...(session ? { session } : {}),
      }
    );

   console.log("Model name:", ObligationAssignment.modelName);
console.log("Collection name:", ObligationAssignment.collection.name);
console.log("Database name:", ObligationAssignment.db.name);
console.log("Prepared documents:", assignments.length);
console.log(
  "First document validation:",
  await new ObligationAssignment(assignments[0]).validate().then(
    () => "valid",
    (error) => error.message
  )
);
  } catch (error) {
    console.error("INSERT ERROR:", error.message);
    console.error("WRITE ERRORS:", error.writeErrors);
    console.error("RESULT:", error.result);
    throw error;
  }

  console.log(
  "Collection count after insert:",
  await ObligationAssignment.countDocuments({
    obligation: obligation._id,
  })
);
  await createAuditLog({
    actor: assignedBy,
    action: "obligation.assignments_created",
    resource: "ObligationAssignment",
    resourceId: obligation._id,
    session,
    details: {
      assignmentType: "individual_obligation_assigned_to_members",
      obligationName: obligation.name,
      year: obligation.year,
      isOptional: obligation.isOptional,
      assignmentsCreated: createdAssignments.length,
      userIds: createdAssignments.map((assignment) =>
        assignment.user.toString()
      ),
    },
  });





  return {
    assigned: createdAssignments.length,
    assignments: createdAssignments,
  };
};




export const assignCollectiveObligationToGroups = async (
  obligationId,
  assignedBy = null,
  session = null
) => {
  const obligation = await Obligation.findOne({
    _id: obligationId,
    category: { $in: ["yearSet", "chapter"] },
    isActive: true,
  })
    .select("_id category amount dueDate year")
    .session(session);

  if (!obligation) {
    throw new Error("Active collective obligation not found.");
  }

  const isYearSet = obligation.category === "yearSet";
  const ownerField = isYearSet ? "yearSet" : "chapter";
  const GroupModel = isYearSet ? YearSet : Chapter;

  const groups = await GroupModel.find({ isActive: true })
    .select("_id")
    .session(session)
    .lean();

  if (!groups.length) {
    return { assigned: 0, assignments: [] };
  }

  const groupIds = groups.map((group) => group._id);

  const existing = await ObligationAssignment.find({
    obligation: obligation._id,
    [ownerField]: { $in: groupIds },
  })
    .select(ownerField)
    .session(session)
    .lean();

  const existingIds = new Set(
    existing
      .map((assignment) => assignment[ownerField]?.toString())
      .filter(Boolean)
  );

  const assignments = groups
    .filter((group) => !existingIds.has(group._id.toString()))
    .map((group) => ({
      obligation: obligation._id,
      [ownerField]: group._id,
      amountDue: obligation.amount,
      amountPaid: 0,
      status: "pending",
      dueDate: obligation.dueDate || null,
      assignedBy,
    }));

  if (!assignments.length) {
    return { assigned: 0, assignments: [] };
  }

  const created = await ObligationAssignment.insertMany(assignments, {
    session,
    ordered: true,
  });

  await createAuditLog({
    actor: assignedBy,
    action: "obligation.assignments_created",
    resource: "ObligationAssignment",
    session,
    details: {
      assignmentType: isYearSet
        ? "year_set_obligations_assigned_to_groups"
        : "chapter_obligations_assigned_to_groups",
      obligationId: obligation._id,
      category: obligation.category,
      year: obligation.year,
      assignmentsCreated: created.length,
    },
  });

  return {
    assigned: created.length,
    assignments: created,
  };
};