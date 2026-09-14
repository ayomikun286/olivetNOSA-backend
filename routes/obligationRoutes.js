import express from "express";

import {
  createObligation,
  getObligations,
  getObligation,
  updateObligation,
  toggleObligationStatus,
} from "../controller/obligationController.js";

// import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// ========================================
// OBLIGATION ROUTES
// ========================================

// router.use(protect);

router.post("/", createObligation);

router.get("/", getObligations);

router.get("/:id", getObligation);

router.patch("/:id", updateObligation);

router.patch("/:id/status", toggleObligationStatus);

export default router;