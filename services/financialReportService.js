import Obligation from "../models/Obligation.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import Payment from "../models/Payment.js";

/*
|--------------------------------------------------------------------------
| Date Helpers
|--------------------------------------------------------------------------
| Report months are defined in Lagos time (WAT, UTC+1, no DST), so a
| payment at 00:30 on the 1st in Lagos belongs to the NEW month.
|--------------------------------------------------------------------------
*/

const LAGOS_OFFSET_MS = 60 * 60 * 1000;

const getMonthDateRange = (year, month) => ({
  startDate: new Date(Date.UTC(year, month - 1, 1) - LAGOS_OFFSET_MS),
  endDate: new Date(Date.UTC(year, month, 1) - LAGOS_OFFSET_MS),
});

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const calculateRate = (collected, expected) => {
  if (!expected || expected <= 0) return 0;

  return Math.min(100, Number(((collected / expected) * 100).toFixed(2)));
};

const sum = (items, key) =>
  items.reduce((total, item) => total + Number(item[key] || 0), 0);

const calculateGroupTotals = (items) => {
  const expected = sum(items, "expected");
  const collected = sum(items, "collected");

  return {
    expected,
    collected, // capped at amountDue per assignment
    cashReceived: sum(items, "cashReceived"), // raw cash incl. overpayments
    outstanding: sum(items, "outstanding"),
    overdue: sum(items, "overdue"),
    collectionRate: calculateRate(collected, expected),
  };
};

const EMPTY_GROUP = calculateGroupTotals([]);

/*
|--------------------------------------------------------------------------
| Generate Financial Report Snapshot
|--------------------------------------------------------------------------
|
| DEFINITIONS (all for the selected financial year, as of report month-end)
|
| Mandatory   = obligation.isOptional !== true
| Active      = obligation.isActive !== false   (single definition, used everywhere)
|
| summary.totalExpected     = expected on ACTIVE MANDATORY obligations
| summary.totalOutstanding  = outstanding on ACTIVE MANDATORY obligations
| summary.totalOverdue      = overdue on ACTIVE MANDATORY obligations
| summary.totalCollected    = cash received on ALL MANDATORY obligations
|                             (active + inactive, historical cash)
| summary.collectedOnActive = capped collected on ACTIVE MANDATORY obligations
| summary.collectionRate    = collectedOnActive / totalExpected
|                             (same population, so the rate is meaningful)
|
| categoryBreakdown buckets per category:
|   mandatory = active mandatory
|   inactive  = inactive mandatory   (historical cash only)
|   optional  = all optional         (never part of summary totals)
|
| => mandatory.cashReceived + inactive.cashReceived summed over categories
|    equals summary.totalCollected.
|
|--------------------------------------------------------------------------
*/

export const generateFinancialReportSnapshot = async ({ month, year }) => {
  /*
  | Validate Input
  */

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Invalid report month.");
  }

  if (!Number.isInteger(year) || year < 1900) {
    throw new Error("Invalid report year.");
  }

  const { startDate, endDate } = getMonthDateRange(year, month);

  /*
  | Overdue cut-off: never later than "now", so generating a report
  | mid-month does not flag items due later this month as overdue.
  */

  const overdueCutoff = new Date(Math.min(endDate.getTime(), Date.now()));

  /*
  | Obligations for the selected financial year
  */

  const obligations = await Obligation.find({ year })
    .select("_id name category amount dueDate isOptional isActive")
    .lean();

  if (!obligations.length) {
    return {
      summary: {
        totalExpected: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        totalOverdue: 0,
        collectedOnActive: 0,
        collectionRate: 0,
      },

      categoryBreakdown: [],

      obligationBreakdown: [],

      paymentSummary: {
        totalPayments: 0,
        successfulPayments: 0,
        pendingPayments: 0,
        failedPayments: 0,
        refundedPayments: 0,
        totalCollectedThisMonth: 0,
      },
    };
  }

  const mandatoryObligationIds = new Set(
    obligations
      .filter((obligation) => obligation.isOptional !== true)
      .map((obligation) => obligation._id.toString())
  );

  /*
  | Assignments for the year, created before report month-end.
  | Inactive assignments are intentionally included (historical cash).
  |
  | NOTE: requires `timestamps: true` on the ObligationAssignment schema.
  */

  const assignments = await ObligationAssignment.find({
    obligation: {
      $in: obligations.map((obligation) => obligation._id),
    },
    createdAt: { $lt: endDate },
  })
    .select("_id obligation user amountDue amountPaid status dueDate")
    .lean();

  const assignmentIds = assignments.map((assignment) => assignment._id);

  const mandatoryAssignmentIds = new Set(
    assignments
      .filter((assignment) =>
        mandatoryObligationIds.has(assignment.obligation?.toString())
      )
      .map((assignment) => assignment._id.toString())
  );

  /*
  | Successful payments up to report month-end (single query).
  | Used for both historical totals and "cash this month".
  */

  const paymentsUpToMonthEnd = assignmentIds.length
    ? await Payment.find({
        obligationAssignment: { $in: assignmentIds },
        status: "successful",
        paidAt: { $ne: null, $lt: endDate },
      })
        .select("_id obligationAssignment amount paidAt status")
        .lean()
    : [];

  const paidByAssignment = new Map();

  let totalCollectedThisMonth = 0;

  for (const payment of paymentsUpToMonthEnd) {
    const assignmentId = payment.obligationAssignment?.toString();

    if (!assignmentId) continue;

    const amount = Number(payment.amount || 0);

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
  | Payment activity created during the selected month
  | (transaction activity, all obligations incl. optional)
  */

  const paymentsCreatedThisMonth = assignmentIds.length
    ? await Payment.find({
        obligationAssignment: { $in: assignmentIds },
        status: {
          $in: ["successful", "pending", "failed", "refunded"],
        },
        createdAt: { $gte: startDate, $lt: endDate },
      })
        .select("_id obligationAssignment amount status paidAt createdAt")
        .lean()
    : [];

  const countByStatus = (status) =>
    paymentsCreatedThisMonth.filter((payment) => payment.status === status)
      .length;

  const paymentSummary = {
    totalPayments: paymentsCreatedThisMonth.length,
    successfulPayments: countByStatus("successful"),
    pendingPayments: countByStatus("pending"),
    failedPayments: countByStatus("failed"),
    refundedPayments: countByStatus("refunded"),
    totalCollectedThisMonth,
  };

  /*
  | Group assignments by obligation
  */

  const assignmentGroups = new Map();

  for (const assignment of assignments) {
    const obligationId = assignment.obligation?.toString();

    if (!obligationId) continue;

    if (!assignmentGroups.has(obligationId)) {
      assignmentGroups.set(obligationId, []);
    }

    assignmentGroups.get(obligationId).push(assignment);
  }

  /*
  | Obligation breakdown
  */

  const obligationBreakdown = [];

  for (const obligation of obligations) {
    const obligationId = obligation._id.toString();
    const related = assignmentGroups.get(obligationId) || [];

    if (!related.length) continue;

    const isActive = obligation.isActive !== false;
    const isOptional = obligation.isOptional === true;

    let expected = 0;
    let collected = 0;
    let cashReceived = 0;
    let outstanding = 0;
    let overdue = 0;

    for (const assignment of related) {
      const amountDue = Number(assignment.amountDue || 0);

      const paid = paidByAssignment.get(assignment._id.toString()) || 0;

      const applied = Math.min(paid, amountDue);
      const remaining = Math.max(0, amountDue - applied);

      expected += amountDue;
      collected += applied; // capped
      cashReceived += paid; // raw cash

      // Inactive obligations never create current debt
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
  | Category breakdown
  */

  const categoryBreakdown = ["individual", "yearSet", "chapter"].map(
    (category) => {
      const items = obligationBreakdown.filter(
        (item) => item.category === category
      );

      return {
        category,

        mandatory: calculateGroupTotals(
          items.filter((item) => !item.isOptional && item.isActive)
        ),

        inactive: calculateGroupTotals(
          items.filter((item) => !item.isOptional && !item.isActive)
        ),

        optional: calculateGroupTotals(items.filter((item) => item.isOptional)),
      };
    }
  );

  /*
  | Summary (derived from the breakdown so everything reconciles)
  */

  const mandatoryAll = obligationBreakdown.filter((item) => !item.isOptional);
  const mandatoryActive = mandatoryAll.filter((item) => item.isActive);

  const totalExpected = sum(mandatoryActive, "expected");
  const totalOutstanding = sum(mandatoryActive, "outstanding");
  const totalOverdue = sum(mandatoryActive, "overdue");

  // Historical cash on all mandatory obligations (includes inactive)
  const totalCollected = sum(mandatoryAll, "cashReceived");

  // Same population as totalExpected
  const collectedOnActive = sum(mandatoryActive, "collected");

  return {
    summary: {
      totalExpected,
      totalCollected,
      totalOutstanding,
      totalOverdue,
      collectedOnActive,
      collectionRate: calculateRate(collectedOnActive, totalExpected),
    },

    categoryBreakdown,

    obligationBreakdown,

    paymentSummary,
  };
};

export { EMPTY_GROUP };
