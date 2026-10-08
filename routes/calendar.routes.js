import express from "express";

import {
  getCalendarEvents,
  getCalendarEventById,
  getAdminCalendarEvents,
  getAdminCalendarEventById,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "../controller/calendar.controller.js";
import {requireFinancialMember} from "../middleware/financialMiddleware.js";

import { protect } from "../middleware/authmiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";

const router = express.Router();

// ============================================================
// MEMBER CALENDAR
// ============================================================

router.get(
  "/",
  protect,
  getCalendarEvents
);

router.get(
  "/:id",
  protect,
  getCalendarEventById
);


// Admin calendar — viewing
router.get(
  "/admin/all",
  protect,
  requireRole("admin", "treasurer", "secretary", "superAdmin"),
  getAdminCalendarEvents
);

router.get(
  "/admin/:id",
  protect,
  requireRole("admin", "treasurer", "secretary", "superAdmin"),
  getAdminCalendarEventById
);

// Admin calendar — creating/editing/deleting
router.post(
  "/admin",
  protect,
  requireRole("admin", "superAdmin"),
  createCalendarEvent
);

router.put(
  "/admin/:id",
  protect,
  requireRole("admin", "superAdmin"),
  updateCalendarEvent
);

router.delete(
  "/admin/:id",
  protect,
  requireRole("admin", "superAdmin"),
  deleteCalendarEvent
);

export default router;