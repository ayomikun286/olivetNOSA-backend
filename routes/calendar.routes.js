import express from "express";

import {
  getCalendarEvents,
  getCalendarEventById,
} from "../controller/calendar.controller.js";

import { protect } from "../middleware/authmiddleware.js";

const router = express.Router();

// ========================================
// MEMBER CALENDAR
// ========================================

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

export default router;