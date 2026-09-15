import express from "express";

import {
    getMyNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
} from "../controller/notificationController.js";

import {protect} from "../middleware/authmiddleware.js";

const router = express.Router();

router.get("/", protect, getMyNotifications);

router.get("/unread-count", protect, getUnreadNotificationCount);

router.patch("/:id/read", protect, markNotificationAsRead);

router.patch("/read-all", protect, markAllNotificationsAsRead);

export default router;