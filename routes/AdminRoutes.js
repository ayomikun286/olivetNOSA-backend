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
import {
    getAdminPayments,
    getAdminPaymentById,
} from "../controller/paymentController.js";
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
import {
  getAdminMemorialSubmissions,
  getAdminMemorialSubmissionById,
  reviewMemorialSubmission,
} from "../controller/memorialSubmission.controller.js";
import memorialUpload from "../middleware/memorialUpload.middleware.js";

import {
  getAdminCalendarEvents,
  getAdminCalendarEventById,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "../controller/calendar.controller.js";



const router = express.Router();
// ========================================
// MEMORIAL SUBMISSIONS
// ========================================

router.get(
  "/memorial-submissions",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  getAdminMemorialSubmissions
);


router.get(
  "/memorial-submissions/:id",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  getAdminMemorialSubmissionById
);


router.patch(
  "/memorial-submissions/:id/review",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  reviewMemorialSubmission
);



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









// ========================================
// CALENDAR MANAGEMENT
// ========================================

router.get(
  "/calendar",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  getAdminCalendarEvents
);

router.get(
  "/calendar/:id",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  getAdminCalendarEventById
);

router.post(
  "/calendar",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  createCalendarEvent
);

router.patch(
  "/calendar/:id",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  updateCalendarEvent
);

router.delete(
  "/calendar/:id",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  deleteCalendarEvent
);



// ========================================
// PAYMENT MANAGEMENT
// ========================================

router.get(
    "/payments",
    protect,
    requireRole(
        "admin",
        "treasurer",
        "superAdmin"
    ),
    getAdminPayments
);

router.get(
    "/payments/:paymentId",
    protect,
    requireRole(
        "admin",
        "treasurer",
        "superAdmin"
    ),
    getAdminPaymentById
);

export default router;