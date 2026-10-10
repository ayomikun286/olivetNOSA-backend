import express from "express";

import {
  getAllJobs,
  createJob,
  updateJob,
  deleteJob,
  getAvailableJobs,
} from "../controller/jobController.js";

import { protect } from "../middleware/authmiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import { requireFinancialMember } from "../middleware/financialMiddleware.js";

const router = express.Router();

// ========================================
// MEMBER JOBS
// Only logged-in financial members
// ========================================

router.get(
  "/available",
  protect,
  requireFinancialMember,
  getAvailableJobs
);

// ========================================
// ADMIN JOB MANAGEMENT
// ========================================

router.get(
  "/",
  protect,
  requireRole("admin", "superAdmin"),
  getAllJobs
);

router.post(
  "/",
  protect,
  requireRole("admin", "superAdmin"),
  createJob
);

router.patch(
  "/:jobId",
  protect,
  requireRole("admin", "superAdmin"),
  updateJob
);

router.delete(
  "/:jobId",
  protect,
  requireRole("admin", "superAdmin"),
  deleteJob
);

export default router;