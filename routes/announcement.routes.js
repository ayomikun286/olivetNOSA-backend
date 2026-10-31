
import express from "express";

import {
  createAnnouncement,
  getAnnouncements,
  getAllAnnouncements,
  updateAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
  restoreAnnouncement,
  deleteAnnouncement,
} from "../controller/announcement.controller.js";
import requireRole from "../middleware/roleMiddleware.js";
import { protect } from "../middleware/authmiddleware.js";

const router = express.Router();

// ============================================================
// MEMBER ROUTES
// ============================================================

// Get published announcements
router.get("/", protect, getAnnouncements);

// ============================================================
// PRESIDENT MANAGEMENT ROUTES
// ============================================================

// PRESIDENT MANAGEMENT ROUTES

router.get("/manage", protect, requireRole("president"), getAllAnnouncements);

router.post("/", protect, requireRole("president"), createAnnouncement);

router.patch("/:id", protect, requireRole("president"), updateAnnouncement);

router.patch("/:id/publish", protect, requireRole("president"), publishAnnouncement);

router.patch("/:id/archive", protect, requireRole("president"), archiveAnnouncement);

router.patch("/:id/restore", protect, requireRole("president"), restoreAnnouncement);

router.delete("/:id", protect, requireRole("president"), deleteAnnouncement);
export default router;
