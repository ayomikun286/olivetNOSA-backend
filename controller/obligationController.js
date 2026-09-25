import Obligation from "../models/Obligation.js";
import ObligationAssignment from "../models/ObligationAssignment.js";

import {
  assignIndividualObligationToMembers,
} from "../services/obligationAssignmentService.js";

import { createAuditLog } from "../services/auditLog.service.js";
import { createNotification } from "../services/notificationService.js";


// CREATE OBLIGATION
export const createObligation = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      amount,
      paymentPlans,
      year,
      dueDate,
    } = req.body;

    // VALIDATION
    if (!name || !category || amount === undefined || !year) {
      return res.status(400).json({
        success: false,
        message: "Name, category, amount and year are required.",
      });
    }

    if (amount < 0) {
      return res.status(400).json({
        success: false,
        message: "Amount cannot be negative.",
      });
    }

    if (paymentPlans?.length) {
      for (const plan of paymentPlans) {
        if (!plan.frequency || plan.amount === undefined) {
          return res.status(400).json({
            success: false,
            message:
              "Each payment plan must have a frequency and amount.",
          });
        }

        if (plan.amount < 0) {
          return res.status(400).json({
            success: false,
            message: "Payment plan amount cannot be negative.",
          });
        }
      }
    }

    // CREATE OBLIGATION
    const obligation = await Obligation.create({
      name,
      description,
      category,
      amount,
      paymentPlans: paymentPlans || [],
      year,
      dueDate: dueDate || null,
      createdBy: req.user._id,
    });

    // ASSIGN INDIVIDUAL OBLIGATION
    let obligationsAssigned = 0;

    if (category === "individual") {
      const result = await assignIndividualObligationToMembers(
        obligation._id,
        req.user._id
      );

      obligationsAssigned = result.assigned;
    }

    // ========================================
    // NOTIFY ASSIGNED MEMBERS
    // ========================================

    try {
      const assignments = await ObligationAssignment.find({
        obligation: obligation._id,
      }).select("user");

      if (assignments.length > 0) {
        await Promise.all(
          assignments.map((assignment) =>
            createNotification({
              userId: assignment.user,
              type: "obligation",
              title: "New Payment Obligation",
              message: `A new payment obligation, ${obligation.name}, of ₦${Number(
                obligation.amount
              ).toLocaleString()} has been added to your account. Please review the obligation details.`,
              link: "/portal/member/dashboard/my-obligation",
            })
          )
        );
      }
    } catch (notificationError) {
      console.error(
        "Obligation creation notification error:",
        notificationError
      );
    }

    // ========================================
    // AUDIT LOG
    // ========================================

    await createAuditLog({
      actor: req.user._id,
      action: "obligation.created",
      resource: "Obligation",
      resourceId: obligation._id,
      details: {
        name: obligation.name,
        description: obligation.description,
        category: obligation.category,
        amount: obligation.amount,
        paymentPlans: obligation.paymentPlans,
        year: obligation.year,
        dueDate: obligation.dueDate,
        obligationsAssigned,
      },
      req,
    });

    return res.status(201).json({
      success: true,
      message: "Obligation created successfully.",
      obligation,
      obligationsAssigned,
    });
  } catch (error) {
    console.error("Create obligation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create obligation.",
    });
  }
};


// GET ALL OBLIGATIONS
export const getObligations = async (req, res) => {
  try {
    const { category, year, isActive } = req.query;

    const filter = {};

    if (category) filter.category = category;
    if (year) filter.year = Number(year);
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const obligations = await Obligation.find(filter)
      .populate("createdBy", "firstName lastName email")
      .sort({ year: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: obligations.length,
      obligations,
    });
  } catch (error) {
    console.error("Get obligations error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch obligations.",
    });
  }
};


// get single obligation 
export const getObligation = async (req, res) => {
  try {
    const { id } = req.params;

    const obligation = await Obligation.findById(id).populate(
      "createdBy",
      "firstName lastName email"
    );

    if (!obligation) {
      return res.status(404).json({
        success: false,
        message: "Obligation not found.",
      });
    }

    return res.status(200).json({
      success: true,
      obligation,
    });
  } catch (error) {
    console.error("Get obligation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch obligation.",
    });
  }
};



export const updateObligation = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedFields = [
      "name",
      "description",
      "category",
      "amount",
      "paymentPlans",
      "year",
      "dueDate",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (
      updates.amount !== undefined &&
      updates.amount < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Amount cannot be negative.",
      });
    }

    if (updates.paymentPlans?.length) {
      for (const plan of updates.paymentPlans) {
        if (
          !plan.frequency ||
          plan.amount === undefined
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Each payment plan must have a frequency and amount.",
          });
        }

        if (plan.amount < 0) {
          return res.status(400).json({
            success: false,
            message:
              "Payment plan amount cannot be negative.",
          });
        }
      }
    }

    const obligation = await Obligation.findById(id);

    if (!obligation) {
      return res.status(404).json({
        success: false,
        message: "Obligation not found.",
      });
    }

    const before = {
      name: obligation.name,
      description: obligation.description,
      category: obligation.category,
      amount: obligation.amount,
      paymentPlans: obligation.paymentPlans,
      year: obligation.year,
      dueDate: obligation.dueDate,
      isActive: obligation.isActive,
    };

    Object.assign(obligation, updates);

    await obligation.save();

    // ========================================
    // NOTIFY ASSIGNED MEMBERS
    // ========================================

    if (Object.keys(updates).length > 0) {
      try {
        const assignments = await ObligationAssignment.find({
          obligation: obligation._id,
        }).select("user");

        if (assignments.length > 0) {
          await Promise.all(
            assignments.map((assignment) =>
              createNotification({
                userId: assignment.user,
                type: "obligation",
                title: "Payment Obligation Updated",
                message: `The ${obligation.name} payment obligation has been updated. Please review the latest obligation details.`,
                link: "/portal/member/dashboard/my-obligation",
              })
            )
          );
        }
      } catch (notificationError) {
        console.error(
          "Obligation update notification error:",
          notificationError
        );
      }
    }

    // ========================================
    // AUDIT LOG
    // ========================================

    await createAuditLog({
      actor: req.user._id,
      action: "obligation.updated",
      resource: "Obligation",
      resourceId: obligation._id,
      details: {
        before,
        after: {
          name: obligation.name,
          description: obligation.description,
          category: obligation.category,
          amount: obligation.amount,
          paymentPlans: obligation.paymentPlans,
          year: obligation.year,
          dueDate: obligation.dueDate,
          isActive: obligation.isActive,
        },
      },
      req,
    });

    return res.status(200).json({
      success: true,
      message: "Obligation updated successfully.",
      obligation,
    });
  } catch (error) {
    console.error("Update obligation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update obligation.",
    });
  }
};



export const toggleObligationStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const obligation = await Obligation.findById(id);

    if (!obligation) {
      return res.status(404).json({
        success: false,
        message: "Obligation not found.",
      });
    }

    obligation.isActive = !obligation.isActive;

    await obligation.save();

    // ========================================
    // NOTIFY ASSIGNED MEMBERS
    // ========================================

    try {
      const assignments = await ObligationAssignment.find({
        obligation: obligation._id,
      }).select("user");

      const title = obligation.isActive
        ? "Payment Obligation Activated"
        : "Payment Obligation Deactivated";

      const message = obligation.isActive
        ? `The ${obligation.name} payment obligation is now active. Please review your obligation details.`
        : `The ${obligation.name} payment obligation has been deactivated. Please review your obligation details for the latest status.`;

      if (assignments.length > 0) {
        await Promise.all(
          assignments.map((assignment) =>
            createNotification({
              userId: assignment.user,
              type: "obligation",
              title,
              message,
              link: "/portal/member/dashboard/my-obligation",
            })
          )
        );
      }
    } catch (notificationError) {
      console.error(
        "Obligation status notification error:",
        notificationError
      );
    }

    // ========================================
    // AUDIT LOG
    // ========================================

    await createAuditLog({
      actor: req.user._id,
      action: obligation.isActive
        ? "obligation.activated"
        : "obligation.deactivated",
      resource: "Obligation",
      resourceId: obligation._id,
      details: {
        name: obligation.name,
        isActive: obligation.isActive,
      },
      req,
    });

    return res.status(200).json({
      success: true,
      message: obligation.isActive
        ? "Obligation activated successfully."
        : "Obligation deactivated successfully.",
      obligation,
    });
  } catch (error) {
    console.error(
      "Toggle obligation status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update obligation status.",
    });
  }
};