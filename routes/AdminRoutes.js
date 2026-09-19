import express from "express";

import {
  approveMemberController,
  getAdminDashboard,
  getAdminMembersController,
  createAdminMemberController
} from "../controller/adminController.js";

import {
  assignYearSetLeaderController,
  assignChapterLeaderController,
  
} from "../controller/leadershipController.js";

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


export default router;