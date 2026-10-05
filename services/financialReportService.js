import Obligation from "../models/Obligation.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import Payment from "../models/Payment.js";

/*
|--------------------------------------------------------------------------
| Date Helpers
|--------------------------------------------------------------------------
*/

const getMonthDateRange = (year, month) => {
  const startDate = new Date(
    Date.UTC(year, month - 1, 1)
  );

  const endDate = new Date(
    Date.UTC(year, month, 1)
  );

  return {
    startDate,
    endDate,
  };
};

/*
|--------------------------------------------------------------------------
| Collection Rate
|--------------------------------------------------------------------------
*/

const calculateRate = (collected, expected) => {
  if (!expected || expected <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Number(
      ((collected / expected) * 100).toFixed(2)
    )
  );
};

/*
|--------------------------------------------------------------------------
| Generate Financial Report Snapshot
|--------------------------------------------------------------------------
|
| Financial reports are based on ANNUAL obligations.
|
| For a selected month/year:
|
| - Expected = all assignments for that financial year
| - Collected = successful payments received up to the report month-end
| - Outstanding = Expected - Collected
| - Overdue = unpaid amount whose due date has passed
| - Cash This Month = successful payments whose paidAt falls
|   inside the selected month
|
| Optional obligations are visible in both the obligation breakdown
| and category breakdown, but are excluded from the main financial
| summary totals.
|
| Inactive obligations remain visible for history but are excluded
| from current financial totals/overdue calculations.
|
|--------------------------------------------------------------------------
*/

export const generateFinancialReportSnapshot = async ({
  month,
  year,
}) => {
  /*
  |--------------------------------------------------------------------------
  | Validate Input
  |--------------------------------------------------------------------------
  */

  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error("Invalid report month.");
  }

  if (
    !Number.isInteger(year) ||
    year < 1900
  ) {
    throw new Error("Invalid report year.");
  }

  /*
  |--------------------------------------------------------------------------
  | Month Range
  |--------------------------------------------------------------------------
  */

  const {
    startDate,
    endDate,
  } = getMonthDateRange(year, month);

  /*
  |--------------------------------------------------------------------------
  | Get Obligations For Selected Financial Year
  |--------------------------------------------------------------------------
  */

  const obligations = await Obligation.find({
    year,
  })
    .select(
      "_id name category amount dueDate isOptional isActive"
    )
    .lean();

  /*
  |--------------------------------------------------------------------------
  | No Obligations
  |--------------------------------------------------------------------------
  */

  if (!obligations.length) {
    return {
      summary: {
        totalExpected: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        totalOverdue: 0,
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

  /*
  |--------------------------------------------------------------------------
  | Get ALL Assignments For Selected Financial Year
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  |
  | We do NOT filter assignments by dueDate/month here.
  |
  | These are annual obligations.
  |
  |--------------------------------------------------------------------------
  */

  const assignments =
    await ObligationAssignment.find({
      obligation: {
        $in: obligations.map(
          (obligation) => obligation._id
        ),
      },
    })
      .select(
        "_id obligation user amountDue amountPaid status dueDate"
      )
      .lean();

  /*
  |--------------------------------------------------------------------------
  | Get Successful Payments Up To Report Month-End
  |--------------------------------------------------------------------------
  |
  | These payments determine the annual financial position
  | as of the selected report month.
  |
  |--------------------------------------------------------------------------
  */

  const assignmentIds = assignments.map(
    (assignment) => assignment._id
  );

  const paymentsUpToMonthEnd =
    assignmentIds.length
      ? await Payment.find({
          obligationAssignment: {
            $in: assignmentIds,
          },

          status: "successful",

          paidAt: {
            $ne: null,
            $lt: endDate,
          },
        })
          .select(
            "_id obligationAssignment amount paidAt"
          )
          .lean()
      : [];


      console.log(
  "REPORT PAYMENTS UP TO MONTH END:",
  paymentsUpToMonthEnd.map((payment) => ({
    id: payment._id.toString(),
    assignment: payment.obligationAssignment?.toString(),
    amount: payment.amount,
    paidAt: payment.paidAt,
    status: payment.status,
  }))
);

  /*
  |--------------------------------------------------------------------------
  | Group Successful Payments By Assignment
  |--------------------------------------------------------------------------
  */

  const paidByAssignment = new Map();

  for (const payment of paymentsUpToMonthEnd) {
    const assignmentId =
      payment.obligationAssignment?.toString();

    if (!assignmentId) {
      continue;
    }

    const current =
      paidByAssignment.get(
        assignmentId
      ) || 0;

    paidByAssignment.set(
      assignmentId,
      current +
        Number(payment.amount || 0)
    );
  }


  console.log(
  "PAID BY ASSIGNMENT:",
  Array.from(paidByAssignment.entries())
);

  /*
  |--------------------------------------------------------------------------
  | Payment Activity Created During Selected Month
  |--------------------------------------------------------------------------
  |
  | This is transaction activity, not financial collection.
  |
  |--------------------------------------------------------------------------
  */

  const paymentsCreatedThisMonth =
    await Payment.find({
      status: {
        $in: [
          "successful",
          "pending",
          "failed",
          "refunded",
        ],
      },

      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
    })
      .select(
        "_id obligationAssignment amount status paidAt createdAt"
      )
      .lean();

  /*
  |--------------------------------------------------------------------------
  | Payment Counts
  |--------------------------------------------------------------------------
  */

  const successfulPayments =
    paymentsCreatedThisMonth.filter(
      (payment) =>
        payment.status === "successful"
    );

  const pendingPayments =
    paymentsCreatedThisMonth.filter(
      (payment) =>
        payment.status === "pending"
    );

  const failedPayments =
    paymentsCreatedThisMonth.filter(
      (payment) =>
        payment.status === "failed"
    );

  const refundedPayments =
    paymentsCreatedThisMonth.filter(
      (payment) =>
        payment.status === "refunded"
    );

  /*
  |--------------------------------------------------------------------------
  | Cash Received During Selected Month
  |--------------------------------------------------------------------------
  |
  | This is the actual cash received during the month.
  |
  |--------------------------------------------------------------------------
  */

  const cashPaymentsThisMonth =
    await Payment.find({
      status: "successful",

      paidAt: {
        $gte: startDate,
        $lt: endDate,
      },
    })
      .select(
        "_id obligationAssignment amount paidAt"
      )
      .lean();

  const totalCollectedThisMonth =
    cashPaymentsThisMonth.reduce(
      (total, payment) =>
        total +
        Number(payment.amount || 0),
      0
    );

  /*
  |--------------------------------------------------------------------------
  | Payment Summary
  |--------------------------------------------------------------------------
  */

  const paymentSummary = {
    totalPayments:
      paymentsCreatedThisMonth.length,

    successfulPayments:
      successfulPayments.length,

    pendingPayments:
      pendingPayments.length,

    failedPayments:
      failedPayments.length,

    refundedPayments:
      refundedPayments.length,

    totalCollectedThisMonth,
  };

  /*
  |--------------------------------------------------------------------------
  | Group Assignments By Obligation
  |--------------------------------------------------------------------------
  */

  const assignmentGroups = new Map();

  for (const assignment of assignments) {
    const obligationId =
      assignment.obligation?.toString();

    if (!obligationId) {
      continue;
    }

    if (
      !assignmentGroups.has(
        obligationId
      )
    ) {
      assignmentGroups.set(
        obligationId,
        []
      );
    }

    assignmentGroups
      .get(obligationId)
      .push(assignment);
  }

  /*
  |--------------------------------------------------------------------------
  | Obligation Breakdown
  |--------------------------------------------------------------------------
  */

  const obligationBreakdown = [];

  for (const obligation of obligations) {
    const obligationId =
      obligation._id.toString();

    const relatedAssignments =
      assignmentGroups.get(
        obligationId
      ) || [];

    /*
    |--------------------------------------------------------------------------
    | Skip obligations with no assignments
    |--------------------------------------------------------------------------
    */

    if (!relatedAssignments.length) {
      continue;
    }

    let expected = 0;
    let collected = 0;
    let outstanding = 0;
    let overdue = 0;

    /*
    |--------------------------------------------------------------------------
    | Calculate Assignment Totals
    |--------------------------------------------------------------------------
    */

    for (const assignment of relatedAssignments) {
      const amountDue =
        Number(
          assignment.amountDue || 0
        );

      /*
      |--------------------------------------------------------------------------
      | Successful payments received by report month-end
      |--------------------------------------------------------------------------
      */

      const amountPaidByMonthEnd =
  paidByAssignment.get(
    assignment._id.toString()
  ) || 0;


      /*
      |--------------------------------------------------------------------------
      | Expected
      |--------------------------------------------------------------------------
      */

      expected += amountDue;

      /*
      |--------------------------------------------------------------------------
      | Collected
      |--------------------------------------------------------------------------
      */

      const collectedForAssignment =
        Math.min(
          amountPaidByMonthEnd,
          amountDue
        );

      collected +=
        collectedForAssignment;

      /*
      |--------------------------------------------------------------------------
      | Outstanding
      |--------------------------------------------------------------------------
      */

      const remaining =
        Math.max(
          0,
          amountDue -
            collectedForAssignment
        );

      outstanding += remaining;

      /*
      |--------------------------------------------------------------------------
      | Overdue
      |--------------------------------------------------------------------------
      |
      | Only active obligations can be overdue.
      |
      | The obligation is overdue when its due date
      | has passed as of the report month-end.
      |
      |--------------------------------------------------------------------------
      */

      if (
        obligation.isActive &&
        assignment.dueDate &&
        new Date(
          assignment.dueDate
        ) < endDate &&
        remaining > 0
      ) {
        overdue += remaining;
      }
    }

/*
    |--------------------------------------------------------------------------
    | Add Obligation
    |--------------------------------------------------------------------------
    */

    obligationBreakdown.push({
      obligation:
        obligation._id,

      name:
        obligation.name,

      category:
        obligation.category,

      isOptional:
        obligation.isOptional === true,

      isActive:
        obligation.isActive !== false,

      expected,

      collected,

      outstanding,

      overdue,

      collectionRate:
        calculateRate(
          collected,
          expected
        ),
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Category Breakdown
  |--------------------------------------------------------------------------
  |
  | Each category is now separated into:
  |
  | - mandatory
  | - optional
  |
  | Optional obligations remain visible for reporting,
  | but do NOT contribute to the main financial summary.
  |
  |--------------------------------------------------------------------------
  */



  const categoryBreakdown = [];

  for (const category of [
    "individual",
    "yearSet",
    "chapter",
  ]) {
    const categoryObligations =
      obligationBreakdown.filter(
        (item) =>
          item.category === category
      );


      console.log(
  "FINANCIAL CATEGORY BREAKDOWN:",
  JSON.stringify(
    categoryBreakdown,
    null,
    2
  )
);
    /*
    |--------------------------------------------------------------------------
    | Mandatory Active Obligations
    |--------------------------------------------------------------------------
    */

    const mandatory =
      categoryObligations.filter(
        (item) =>
          !item.isOptional &&
          item.isActive
      );

    /*
    |--------------------------------------------------------------------------
    | Optional Active Obligations
    |--------------------------------------------------------------------------
    */

    const optional =
      categoryObligations.filter(
        (item) =>
          item.isOptional &&
          item.isActive
      );

    /*
    |--------------------------------------------------------------------------
    | Calculate Group Totals
    |--------------------------------------------------------------------------
    */

    const calculateGroupTotals = (
      items
    ) => {
      const expected =
        items.reduce(
          (total, item) =>
            total + item.expected,
          0
        );

      const collected =
        items.reduce(
          (total, item) =>
            total + item.collected,
          0
        );

      const outstanding =
        items.reduce(
          (total, item) =>
            total + item.outstanding,
          0
        );

      const overdue =
        items.reduce(
          (total, item) =>
            total + item.overdue,
          0
        );

      return {
        expected,
        collected,
        outstanding,
        overdue,
        collectionRate:
          calculateRate(
            collected,
            expected
          ),
      };
    };

    /*
    |--------------------------------------------------------------------------
    | Add Category
    |--------------------------------------------------------------------------
    */

    categoryBreakdown.push({
      category,

      mandatory:
        calculateGroupTotals(
          mandatory
        ),

      optional:
        calculateGroupTotals(
          optional
        ),
    

    });

    
  }


 
  /*
  |--------------------------------------------------------------------------
  | Mandatory Active Obligation Totals
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  |
  | These totals intentionally use ONLY:
  |
  | - mandatory obligations
  | - active obligations
  |
  | Optional obligations are NOT included.
  |
  |--------------------------------------------------------------------------
  */

  const mandatoryObligations =
    obligationBreakdown.filter(
      (item) =>
        !item.isOptional &&
        item.isActive
    );

  /*
  |--------------------------------------------------------------------------
  | Total Expected
  |--------------------------------------------------------------------------
  */

  const totalExpected =
    mandatoryObligations.reduce(
      (total, item) =>
        total + item.expected,
      0
    );

  /*
  |--------------------------------------------------------------------------
  | Total Collected YTD / By Report Month-End
  |--------------------------------------------------------------------------
  */

  const totalCollected =
    mandatoryObligations.reduce(
      (total, item) =>
        total + item.collected,
      0
    );

  /*
  |--------------------------------------------------------------------------
  | Total Outstanding
  |--------------------------------------------------------------------------
  */

  const totalOutstanding =
    mandatoryObligations.reduce(
      (total, item) =>
        total + item.outstanding,
      0
    );

  /*
  |--------------------------------------------------------------------------
  | Total Overdue
  |--------------------------------------------------------------------------
  */

  const totalOverdue =
    mandatoryObligations.reduce(
      (total, item) =>
        total + item.overdue,
      0
    );

  /*
  |--------------------------------------------------------------------------
  | Final Snapshot
  |--------------------------------------------------------------------------
  */

  return {
    summary: {
      totalExpected,

      /*
      | Collected is cumulative for the
      | selected financial year up to
      | the end of the selected month.
      */

      totalCollected,

      totalOutstanding,

      totalOverdue,

      collectionRate:
        calculateRate(
          totalCollected,
          totalExpected
        ),
    },

    categoryBreakdown,

    obligationBreakdown,

    paymentSummary,
  };
};