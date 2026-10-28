import express from "express";

import {
  createFinancialReport,
  getFinancialReports,
  getFinancialReportById,
  updateFinancialReport,
  publishFinancialReport,
  unpublishFinancialReport,
} from "../../controller/admin/financialReportController.js";

import { protect } from "../../middleware/authmiddleware.js";
import requireRole from "../../middleware/roleMiddleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Financial Reports
|--------------------------------------------------------------------------
| Admin + SuperAdmin only
*/

// Get all financial reports
router.get(
  "/",
  protect,
  requireRole("admin", "superAdmin", "treasurer",),
  getFinancialReports
);

// Get single financial report
router.get(
  "/:id",
  protect,
  requireRole("admin", "superAdmin", "treasurer"),
  getFinancialReportById
);

// Create financial report
router.post(
  "/",
  protect,
  requireRole("admin", "superAdmin", "treasurer"),
  createFinancialReport
);

// Regenerate/update draft financial report
router.put(
  "/:id",
  protect,
  requireRole("admin", "superAdmin", "treasurer",),
  updateFinancialReport
);

// Publish financial report
router.post(
  "/:id/publish",
  protect,
  requireRole("admin", "superAdmin","treasurer",),
  publishFinancialReport
);

// Unpublish financial report
router.post(
  "/:id/unpublish",
  protect,
  requireRole("admin", "superAdmin" ,"treasurer"),
  unpublishFinancialReport
);

export default router;