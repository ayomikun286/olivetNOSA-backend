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
import {
  getAdminMemorials,
  getAdminMemorialById,
  createMemorial,
  updateMemorial,
  deleteMemorial,
} from "../controller/memorial.controller.js";

import memorialUpload from "../middleware/memorialUpload.middleware.js";

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





// ========================================
// MEMORIAL MANAGEMENT
// ========================================

router.get(
  "/memorials",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  getAdminMemorials
);

router.get(
  "/memorials/:id",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  getAdminMemorialById
);

router.post(
  "/memorials",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  memorialUpload.fields([
    {
      name: "photograph",
      maxCount: 1,
    },
    {
      name: "additionalPhotos",
      maxCount: 10,
    },
  ]),
  createMemorial
);

router.patch(
  "/memorials/:id",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  memorialUpload.fields([
    {
      name: "photograph",
      maxCount: 1,
    },
    {
      name: "additionalPhotos",
      maxCount: 10,
    },
  ]),
  updateMemorial
);

router.delete(
  "/memorials/:id",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  deleteMemorial
);

export default router;