import express from "express";

import {
  approveMemberController,
  getAdminDashboard,
  getAdminMembersController,
  createAdminMemberController
} from "../controller/adminController.js";
import {createNewsEvent, getAdminNewsEvents, updateNewsEvent,deleteNewsEvent,} from "../controller/newsEvent.controller.js"
import {
  assignYearSetLeaderController,
  assignChapterLeaderController,
  
} from "../controller/leadershipController.js";
import upload from "../middleware/upload.middleware.js";
import { protect } from "../middleware/authmiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";

const router = express.Router();


// ========================================
// ADMIN DASHBOARD
// ========================================

router.get(
  "/dashboard",
  protect,
  requireRole(
    "admin",
    "treasurer",
    "secretary",
    "superAdmin"
  ),
  getAdminDashboard
);


// ========================================
// MEMBER MANAGEMENT
// ========================================

router.patch(
  "/members/:userId/approve",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  approveMemberController
);


router.get(
  "/members/",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  getAdminMembersController
);

// ========================================
// LEADERSHIP
// ========================================

router.patch(
  "/members/year-set-leader",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  assignYearSetLeaderController
);

router.patch(
  "/members/chapter-leader",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  assignChapterLeaderController
);



router.post(
  "/members",
  protect,
  requireRole("admin", "superAdmin"),
  createAdminMemberController
);



// news-events//

router.get(
  "/news-events",
  protect,
  requireRole(
    "admin",
    "treasurer",
    "secretary",
    "superAdmin"
  ),
  getAdminNewsEvents
);

router.post(
  "/news-events",
  protect,
  upload.single("image"),
  requireRole(
    "admin",
    "treasurer",
    "secretary",
    "superAdmin"
  ),
  createNewsEvent
);


router.patch(
  "/news-events/:id",
  protect,
  upload.single("image"),
  requireRole(
    "admin",
    "treasurer",
    "secretary",
    "superAdmin"
  ),
  updateNewsEvent
);

router.delete(
  "/news-events/:id",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  deleteNewsEvent
);

export default router;