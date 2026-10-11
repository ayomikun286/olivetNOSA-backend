import express from "express";

import {
    getMyNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getAllMyNotifications
} from "../controller/notificationController.js";

import {protect} from "../middleware/authmiddleware.js";

const router = express.Router();

// api/notifications

router.get("/", protect, getMyNotifications);

router.get("/unread-count", protect, getUnreadNotificationCount);

router.patch("/:id/read", protect, markNotificationAsRead);

router.patch("/read-all", protect, markAllNotificationsAsRead);
router.get("/all", protect, getAllMyNotifications);
export default router;