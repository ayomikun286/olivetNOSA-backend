import express from "express";

import {
  trackAnalyticsEvent,
  getAnalyticsDashboardData,
} from "../controller/analytics.controller.js";

import { protect } from "../middleware/authmiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import { analyticsLimiter } from "../middleware/rateLimiter.js";


const router = express.Router();

// Public website tracking
router.post(
  "/track",
  analyticsLimiter,
  trackAnalyticsEvent
);
// Protected analytics dashboard
router.get(
  "/dashboard",
  protect,
  requireRole("admin", "superAdmin"),
  getAnalyticsDashboardData
);

export default router;