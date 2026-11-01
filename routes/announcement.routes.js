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
     markAnnouncementAsViewed,
} from "../controller/announcement.controller.js";

import requireRole from "../middleware/roleMiddleware.js";
import { protect } from "../middleware/authmiddleware.js";

const router = express.Router();

// MEMBER ROUTES
// MEMBER ROUTES
router.get("/", protect, getAnnouncements);

router.patch(
    "/:id/view",
    protect,
    markAnnouncementAsViewed
);

// TREASURER & SUPER ADMIN MANAGEMENT ROUTES
router.get(
    "/manage",
    protect,
    requireRole("president", "treasurer", "superAdmin"),
    getAllAnnouncements
);

router.post(
    "/",
    protect,
    requireRole("treasurer", "superAdmin", "president"),
    createAnnouncement
);

router.patch(
    "/:id",
    protect,
    requireRole("treasurer", "superAdmin"),
    updateAnnouncement
);

router.patch(
    "/:id/publish",
    protect,
    requireRole("treasurer", "superAdmin"),
    publishAnnouncement
);

router.patch(
    "/:id/archive",
    protect,
    requireRole("treasurer", "superAdmin"),
    archiveAnnouncement
);

router.patch(
    "/:id/restore",
    protect,
    requireRole("treasurer", "superAdmin"),
    restoreAnnouncement
);

// Permanent deletion restricted to Super Admin
router.delete(
    "/:id",
    protect,
    requireRole("superAdmin"),
    deleteAnnouncement
);

export default router;