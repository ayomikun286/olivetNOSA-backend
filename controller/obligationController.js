import Obligation from "../models/Obligation.js";
// import User from "../models/User.js";
import ObligationAssignment from "../models/ObligationAssignment.js";
import { assignIndividualObligationToMembers,} from "../services/obligationAssignmentService.js";
// import ObligationAssignment from "../models/ObligationAssignment.js";
// ========================================
// CREATE OBLIGATION
// ========================================
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

    // 1. Create the obligation
    const obligation = await Obligation.create({
      name,
      description,
      category,
      amount,
      paymentPlans: paymentPlans || [],
      year,
      dueDate: dueDate || null,
      createdBy: null, // temporary until admin auth is ready
    });

    // 2. Allocate individual obligation
    if (category === "individual") {
            await assignIndividualObligationToMembers(
    obligation._id,
    null
  );
}

    return res.status(201).json({
      success: true,
      message: "Obligation created successfully.",
      obligation,
    });
  } catch (error) {
    console.error("Create obligation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create obligation.",
    });
  }
};





// ========================================
// GET ALL OBLIGATIONS
// ========================================

export const getObligations = async (req, res) => {
  try {
    const {
      category,
      year,
      isActive,
    } = req.query;

    const filter = {};

    if (category) {
      filter.category = category;
    }

    if (year) {
      filter.year = Number(year);
    }

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

// ========================================
// GET SINGLE OBLIGATION
// ========================================

export const getObligation = async (req, res) => {
  try {
    const { id } = req.params;

    const obligation = await Obligation.findById(id)
      .populate("createdBy", "firstName lastName email");

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


// ========================================
// UPDATE OBLIGATION
// ========================================

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

    if (updates.amount !== undefined && updates.amount < 0) {
      return res.status(400).json({
        success: false,
        message: "Amount cannot be negative.",
      });
    }

    const obligation = await Obligation.findByIdAndUpdate(
      id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!obligation) {
      return res.status(404).json({
        success: false,
        message: "Obligation not found.",
      });
    }

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


// ========================================
// TOGGLE OBLIGATION STATUS
// ========================================

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

    return res.status(200).json({
      success: true,
      message: obligation.isActive
        ? "Obligation activated successfully."
        : "Obligation deactivated successfully.",
      obligation,
    });
  } catch (error) {
    console.error("Toggle obligation status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update obligation status.",
    });
  }
};