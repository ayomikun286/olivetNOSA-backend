import express from "express";

import {
  createObligation,
  getObligations,
  getObligation,
  updateObligation,
  toggleObligationStatus,
} from "../controller/obligationController.js";

import { protect } from "../middleware/authmiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";

const router = express.Router();

// ========================================
// OBLIGATION ROUTES
// ========================================

router.use(protect);

// Admin / SuperAdmin only
router.post(
  "/",
  requireRole("admin", "superAdmin"),
  createObligation
);

router.get(
  "/",
  requireRole("admin", "superAdmin"),
  getObligations
);

router.get(
  "/:id",
  requireRole("admin", "superAdmin"),
  getObligation
);

router.patch(
  "/:id",
  requireRole("admin", "superAdmin"),
  updateObligation
);

router.patch(
  "/:id/status",
  requireRole("admin", "superAdmin"),
  toggleObligationStatus
);

export default router;