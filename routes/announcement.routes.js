
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

// Get all announcements (drafts, published, archived)
router.get("/manage", protect, getAllAnnouncements);

// Create announcement
router.post("/", protect, createAnnouncement);

// Update announcement
router.patch("/:id", protect, updateAnnouncement);

// Publish announcement
router.patch("/:id/publish", protect, publishAnnouncement);

// Archive announcement
router.patch("/:id/archive", protect, archiveAnnouncement);

// Restore archived announcement as draft
router.patch("/:id/restore", protect, restoreAnnouncement);

// Permanently delete announcement
router.delete("/:id", protect, deleteAnnouncement);

export default router;
