
import Obligation from "../models/Obligation.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import YearSet from "../models/YearSet.js";
import Chapter from "../models/Chapter.js";

/*
|--------------------------------------------------------------------------
| Date Helpers
|--------------------------------------------------------------------------
| Report months use Lagos time (WAT, UTC+1, no DST).
|--------------------------------------------------------------------------
*/

const LAGOS_OFFSET_MS = 60 * 60 * 1000;

const getMonthDateRange = (year, month) => ({
  startDate: new Date(
    Date.UTC(year, month - 1, 1) - LAGOS_OFFSET_MS
  ),
  endDate: new Date(
    Date.UTC(year, month, 1) - LAGOS_OFFSET_MS
  ),
});

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const calculateRate = (collected, expected) => {
  if (!expected || expected <= 0) return 0;

  return Math.min(
    100,
    Number(((collected / expected) * 100).toFixed(2))
  );
};

const sum = (items, key) =>
  items.reduce(
    (total, item) => total + Number(item[key] || 0),
    0
  );

const calculateGroupTotals = (items) => {
  const expected = sum(items, "expected");
  const collected = sum(items, "collected");

  return {
    expected,
    collected,
    cashReceived: sum(items, "cashReceived"),
    outstanding: sum(items, "outstanding"),
    overdue: sum(items, "overdue"),
    collectionRate: calculateRate(collected, expected),
  };
};

const EMPTY_GROUP = calculateGroupTotals([]);

const getObjectIdString = (value) => {
  if (!value) return null;

  if (typeof value === "object" && value._id) {
    return value._id.toString();
  }

  return value.toString();
};

const toAmount = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

/*
|--------------------------------------------------------------------------
| Generate Financial Report Snapshot
|--------------------------------------------------------------------------
|
| Expected:
|   Active mandatory assignments with verified direct ownership.
|
| Collected:
|   Successful payment ledger amounts on mandatory assignments,
|   including historical payments requiring ownership review.
|
| Outstanding / overdue:
|   Verified assignments only. Inactive obligations do not create
|   current outstanding or overdue balances.
|
| Monthly collection:
|   Successful payments whose paidAt falls inside the selected month.
|
| Payment activity:
|   Payment records created during the selected month.
|
| Donations are intentionally not included in this service yet.
|--------------------------------------------------------------------------
*/

export const generateFinancialReportSnapshot = async ({
  month,
  year,
}) => {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Invalid report month.");
  }

  if (!Number.isInteger(year) || year < 1900) {
    throw new Error("Invalid report year.");
  }

  const { startDate, endDate } = getMonthDateRange(year, month);

  const overdueCutoff = new Date(
    Math.min(endDate.getTime(), Date.now())
  );

  const obligations = await Obligation.find({ year })
    .select("_id name category amount dueDate isOptional isActive")
    .lean();

  const obligationsById = new Map(
    obligations.map((obligation) => [
      obligation._id.toString(),
      obligation,
    ])
  );

  const obligationIds = obligations.map(
    (obligation) => obligation._id
  );

  const mandatoryObligationIds = new Set(
    obligations
      .filter((obligation) => obligation.isOptional !== true)
      .map((obligation) => obligation._id.toString())
  );

  /*
  |--------------------------------------------------------------------------
  | Load assignments
  |--------------------------------------------------------------------------
  | Only assignments belonging to obligations in the requested year
  | are used for this report.
  |--------------------------------------------------------------------------
  */

  const assignments = obligationIds.length
    ? await ObligationAssignment.find({
        obligation: { $in: obligationIds },
        createdAt: { $lt: endDate },
      })
        .select(
          "_id obligation user yearSet chapter amountDue amountPaid status dueDate createdAt"
        )
        .lean()
    : [];

  const assignmentIds = assignments.map(
    (assignment) => assignment._id
  );

  const mandatoryAssignmentIds = new Set(
    assignments
      .filter((assignment) =>
        mandatoryObligationIds.has(
          getObjectIdString(assignment.obligation)
        )
      )
      .map((assignment) => assignment._id.toString())
  );

  /*
  |--------------------------------------------------------------------------
  | Validate actual owner records
  |--------------------------------------------------------------------------
  | A non-null ObjectId is not enough. The referenced owner must exist.
  | Never infer group ownership from a leader's profile.
  |--------------------------------------------------------------------------
  */

  const userIds = [
    ...new Set(
      assignments
        .map((assignment) =>
          getObjectIdString(assignment.user)
        )
        .filter(Boolean)
    ),
  ];

  const yearSetIds = [
    ...new Set(
      assignments
        .map((assignment) =>
          getObjectIdString(assignment.yearSet)
        )
        .filter(Boolean)
    ),
  ];

  const chapterIds = [
    ...new Set(
      assignments
        .map((assignment) =>
          getObjectIdString(assignment.chapter)
        )
        .filter(Boolean)
    ),
  ];

  const [existingUsers, existingYearSets, existingChapters] =
    await Promise.all([
      userIds.length
        ? User.find({ _id: { $in: userIds } }).distinct("_id")
        : [],

      yearSetIds.length
        ? YearSet.find({ _id: { $in: yearSetIds } }).distinct("_id")
        : [],

      chapterIds.length
        ? Chapter.find({ _id: { $in: chapterIds } }).distinct("_id")
        : [],
    ]);

  const existingUserIds = new Set(
    existingUsers.map(String)
  );

  const existingYearSetIds = new Set(
    existingYearSets.map(String)
  );

  const existingChapterIds = new Set(
    existingChapters.map(String)
  );

  const legacyOwnershipReview = [];
  const verifiedAssignmentIds = new Set();

  for (const assignment of assignments) {
    const assignmentId = assignment._id.toString();
    const obligationId = getObjectIdString(assignment.obligation);
    const obligation = obligationsById.get(obligationId);

    if (!obligation) continue;

    const baseReview = {
      assignmentId,
      obligationId,
      obligationName: obligation.name,
      category: obligation.category,
      amountDue: toAmount(assignment.amountDue),
      amountPaid: 0,
      issue: "",
      note: "",
    };

    const ownerCount = [
      assignment.user,
      assignment.yearSet,
      assignment.chapter,
    ].filter(Boolean).length;

    if (ownerCount !== 1) {
      legacyOwnershipReview.push({
        ...baseReview,
        issue: "invalid_owner_count",
        note:
          "Assignment must have exactly one direct owner. Review before counting expected debt.",
      });

      continue;
    }

    if (obligation.category === "individual") {
      const userId = getObjectIdString(assignment.user);

      if (userId && existingUserIds.has(userId)) {
        verifiedAssignmentIds.add(assignmentId);
      } else {
        legacyOwnershipReview.push({
          ...baseReview,
          issue: "missing_individual_owner",
          note:
            "Individual assignment has no valid direct member owner.",
        });
      }

      continue;
    }

    if (obligation.category === "yearSet") {
      const yearSetId = getObjectIdString(assignment.yearSet);

      if (
        yearSetId &&
        existingYearSetIds.has(yearSetId)
      ) {
        verifiedAssignmentIds.add(assignmentId);
      } else {
        legacyOwnershipReview.push({
          ...baseReview,
          issue: "missing_year_set_owner",
          note: yearSetId
            ? "The referenced Year Set does not exist."
            : "Collective assignment has no explicit Year Set owner.",
        });
      }

      continue;
    }

    if (obligation.category === "chapter") {
      const chapterId = getObjectIdString(assignment.chapter);

      if (
        chapterId &&
        existingChapterIds.has(chapterId)
      ) {
        verifiedAssignmentIds.add(assignmentId);
      } else {
        legacyOwnershipReview.push({
          ...baseReview,
          issue: "missing_chapter_owner",
          note: chapterId
            ? "The referenced Chapter does not exist."
            : "Collective assignment has no explicit Chapter owner.",
        });
      }

      continue;
    }

    legacyOwnershipReview.push({
      ...baseReview,
      issue: "unknown_obligation_category",
      note:
        "Assignment belongs to an unsupported obligation category.",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Load successful payments through report month-end
  |--------------------------------------------------------------------------
  | The payment ledger is authoritative for cash received.
  | Pending and failed payments never count as collected.
  |--------------------------------------------------------------------------
  */

  const paymentsUpToMonthEnd = assignmentIds.length
    ? await Payment.find({
        obligationAssignment: { $in: assignmentIds },
        status: "successful",
        paidAt: { $ne: null, $lt: endDate },
      })
        .select(
          "_id obligationAssignment amount paidAt status"
        )
        .lean()
    : [];

  const paidByAssignment = new Map();
  let totalCollectedThisMonth = 0;

  for (const payment of paymentsUpToMonthEnd) {
    const assignmentId = getObjectIdString(
      payment.obligationAssignment
    );

    if (!assignmentId) continue;

    const amount = toAmount(payment.amount);

    paidByAssignment.set(
      assignmentId,
      (paidByAssignment.get(assignmentId) || 0) + amount
    );

    if (
      payment.paidAt &&
      new Date(payment.paidAt) >= startDate &&
      mandatoryAssignmentIds.has(assignmentId)
    ) {
      totalCollectedThisMonth += amount;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Attach ledger amounts to ownership review records
  |--------------------------------------------------------------------------
  */

  for (const item of legacyOwnershipReview) {
    item.amountPaid =
      paidByAssignment.get(item.assignmentId) || 0;
  }

  /*
  |--------------------------------------------------------------------------
  | Payment activity created during the selected month
  |--------------------------------------------------------------------------
  */

  const paymentsCreatedThisMonth = assignmentIds.length
    ? await Payment.find({
        obligationAssignment: { $in: assignmentIds },
        status: {
          $in: ["successful", "pending", "failed", "refunded"],
        },
        createdAt: { $gte: startDate, $lt: endDate },
      })
        .select(
          "_id obligationAssignment amount status paidAt createdAt"
        )
        .lean()
    : [];

  const countByStatus = (status) =>
    paymentsCreatedThisMonth.filter(
      (payment) => payment.status === status
    ).length;

  const paymentSummary = {
    totalPayments: paymentsCreatedThisMonth.length,
    successfulPayments: countByStatus("successful"),
    pendingPayments: countByStatus("pending"),
    failedPayments: countByStatus("failed"),
    refundedPayments: countByStatus("refunded"),
    totalCollectedThisMonth,
  };

  /*
  |--------------------------------------------------------------------------
  | Group assignments by obligation
  |--------------------------------------------------------------------------
  */

  const assignmentGroups = new Map();

  for (const assignment of assignments) {
    const obligationId = getObjectIdString(
      assignment.obligation
    );

    if (!obligationId) continue;

    if (!assignmentGroups.has(obligationId)) {
      assignmentGroups.set(obligationId, []);
    }

    assignmentGroups.get(obligationId).push(assignment);
  }

  /*
  |--------------------------------------------------------------------------
  | Obligation breakdown
  |--------------------------------------------------------------------------
  */

  const obligationBreakdown = [];

  for (const obligation of obligations) {
    const obligationId = obligation._id.toString();
    const related = assignmentGroups.get(obligationId) || [];

    const isActive = obligation.isActive !== false;
    const isOptional = obligation.isOptional === true;

    let expected = 0;
    let collected = 0;
    let cashReceived = 0;
    let outstanding = 0;
    let overdue = 0;

    for (const assignment of related) {
      const assignmentId = assignment._id.toString();
      const amountDue = toAmount(assignment.amountDue);
      const paid = toAmount(
        paidByAssignment.get(assignmentId) || 0
      );

      // Preserve historical successful cash even when ownership
      // needs review. This does not make the ownership verified.
      cashReceived += paid;

      if (!verifiedAssignmentIds.has(assignmentId)) {
        continue;
      }

      const applied = Math.min(paid, amountDue);
      const remaining = Math.max(0, amountDue - applied);

      expected += amountDue;
      collected += applied;

      if (isActive) {
        outstanding += remaining;

        if (
          assignment.dueDate &&
          new Date(assignment.dueDate) < overdueCutoff &&
          remaining > 0
        ) {
          overdue += remaining;
        }
      }
    }

    obligationBreakdown.push({
      obligation: obligation._id,
      name: obligation.name,
      category: obligation.category,
      isOptional,
      isActive,
      expected,
      collected,
      cashReceived,
      outstanding,
      overdue,
      collectionRate: calculateRate(collected, expected),
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Category breakdown
  |--------------------------------------------------------------------------
  */

  const categoryBreakdown = [
    "individual",
    "yearSet",
    "chapter",
  ].map((category) => {
    const items = obligationBreakdown.filter(
      (item) => item.category === category
    );

    return {
      category,

      mandatory: calculateGroupTotals(
        items.filter(
          (item) => !item.isOptional && item.isActive
        )
      ),

      inactive: calculateGroupTotals(
        items.filter(
          (item) => !item.isOptional && !item.isActive
        )
      ),

      optional: calculateGroupTotals(
        items.filter((item) => item.isOptional)
      ),
    };
  });

  /*
  |--------------------------------------------------------------------------
  | Summary
  |--------------------------------------------------------------------------
  */

  const mandatoryAll = obligationBreakdown.filter(
    (item) => !item.isOptional
  );

  const mandatoryActive = mandatoryAll.filter(
    (item) => item.isActive
  );

  const totalExpected = sum(mandatoryActive, "expected");
  const totalOutstanding = sum(
    mandatoryActive,
    "outstanding"
  );
  const totalOverdue = sum(mandatoryActive, "overdue");

  // Includes successful cash for legacy assignments and inactive
  // mandatory obligations, preserving historical cash reconciliation.
  const totalCollected = sum(
    mandatoryAll,
    "cashReceived"
  );

  const collectedOnActive = sum(
    mandatoryActive,
    "collected"
  );

  const collectedOnInactive = sum(
    mandatoryAll.filter((item) => !item.isActive),
    "cashReceived"
  );

  const collectedRequiringOwnershipReview =
    legacyOwnershipReview.reduce(
      (total, item) => {
        const obligation = obligationsById.get(
          item.obligationId
        );

        if (!obligation || obligation.isOptional === true) {
          return total;
        }

        return total + toAmount(item.amountPaid);
      },
      0
    );

  return {
    summary: {
      totalExpected,
      totalCollected,
      totalOutstanding,
      totalOverdue,
      collectedOnActive,
      collectedOnInactive,
      collectedRequiringOwnershipReview,
      collectionRate: calculateRate(
        collectedOnActive,
        totalExpected
      ),
    },

    categoryBreakdown,
    obligationBreakdown,
    paymentSummary,

    legacyOwnershipReview,
    legacyOwnershipReviewCount:
      legacyOwnershipReview.length,

    notes: {
      reportPeriod:
        "Obligations are selected by their configured year. Payment activity and collections use the selected month's date range.",

      totalCollected:
        "Successful payment ledger amounts for mandatory obligations are preserved, including legacy ownership and inactive obligations.",

      collectedOnActive:
        "Capped successful collections for active mandatory obligations with verified ownership.",

      collectedRequiringOwnershipReview:
        "Historical successful cash attached to mandatory assignments whose direct ownership needs review. This amount remains in totalCollected and must not be added to it again.",

      outstanding:
        "Outstanding is calculated from verified assignment amounts and successful payment ledger totals. Inactive obligations do not create current outstanding debt.",

      overdue:
        "Overdue is the remaining balance on verified assignments whose due date has passed by the report cutoff.",

      monthlyCollections:
        "Only successful payments with paidAt inside the selected month count as cash collected during that month. Pending payments are excluded.",

      paymentActivity:
        "Payment counts are based on createdAt during the selected month and include successful, pending, failed, and refunded statuses.",

      ownership:
        "Individual, Year Set, and Chapter ownership must be explicit and reference an existing owner record. Legacy assignments are flagged rather than automatically reassigned.",

      donations:
        "Donation reporting has not been added to this service.",
    },
  };
};

export { EMPTY_GROUP };
