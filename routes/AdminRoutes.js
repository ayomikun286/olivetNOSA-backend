import express from "express";


import {
  approveMemberController,
  suspendMemberController,
  reactivateMemberController,
  getAdminDashboard,
  getAdminMembersController,
  createAdminMemberController,
  deleteMemberController
} from "../controller/adminController.js";

import {
  getTreasurerMembers,
  getTreasurerMemberDetails,
  recordOfflinePayment
} from "../controller/treasurer/treasurer.controller.js";


import {
  getAdminDonations,
  getAdminDonationSummary,
  getAdminDonationById,
} from "../controller/admin/adminDonation.controller.js";

import {
  getAdminNOSALeaders,
  getAdminNOSALeaderById,
  createNOSALeader,
  updateNOSALeader,
  deleteNOSALeader,
} from "../controller/admin/nosaLeadership.controller.js";


import {createNewsEvent, getAdminNewsEvents, updateNewsEvent,deleteNewsEvent,} from "../controller/newsEvent.controller.js"

import {
  getAdminLegacyLeaders,
  getAdminLegacyLeaderById,
  createLegacyLeader,
  updateLegacyLeader,
  deleteLegacyLeader,
} from "../controller/admin/legacyLeader.controller.js";

import { createYearSet } from "../controller/yearSet.controller.js";

import {
  getAdminWebsiteContent,
  saveWebsiteContentDraft,
  publishWebsiteContent,
  uploadWebsiteContentImage,
} from "../controller/admin/websiteContent.controller.js";


import {createTeam, getTeamMembers, suspendTeamRole, assignPresident, } from "../controller/teamController.js";
import {
  getAdminGallery,
  createGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
} from "../controller/admin/galleryController.js";


import {
  getGeneralSettings,
  updateGeneralSettings,
} from "../controller/admin/adminSettings.controller.js";


import galleryUpload from "../middleware/galleryUpload.middleware.js";

import {
    getAdminPayments,
    getAdminPaymentById,
     recoverFailedPayment,
     getAdminPaymentHistoryExport
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
import { getAdminAuditLogs } from "../controller/auditLog.controller.js";
import {
  getAdminCalendarEvents,
  getAdminCalendarEventById,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "../controller/calendar.controller.js";



const router = express.Router();
// MEMORIAL SUBMISSIONS

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
// ===============================================//








// MEMBER MANAGEMENT  //

router.patch(
  "/members/:userId/approve",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  approveMemberController
);

router.patch(
  "/members/:userId/suspend",
  protect,
  requireRole("admin", "superAdmin"),
  suspendMemberController
);

router.patch(
  "/members/:userId/reactivate",
  protect,
  requireRole("admin", "superAdmin"),
  reactivateMemberController
);


router.delete(
  "/members/:userId",
  protect,
  requireRole("admin", "superAdmin"),
  deleteMemberController
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


router.post(
  "/members",
  protect,
  requireRole("admin", "superAdmin"),
  createAdminMemberController
);

// ============================================================================= //











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
// =================================================//










// MEMORIAL MANAGEMENT


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
// ============================================================//












// CALENDAR MANAGEMENT //

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
// =========================================================//









// PAYMENT MANAGEMENT  //


router.get(
    "/payments",
    protect,
    requireRole(
        "admin",
        "treasurer",
        "secretary",
        "superAdmin"
    ),
    getAdminPayments
);

router.get(
    "/payments/export-history",
    protect,
    requireRole(
        "admin",
        "treasurer",
        "secretary",
        "superAdmin"
    ),
    getAdminPaymentHistoryExport
);


router.get(
    "/payments/:paymentId",
    protect,
    requireRole(
        "admin",
        "treasurer",
        "superAdmin",
        "secretary"
    ),
    getAdminPaymentById
);



router.post(
    "/payments/:paymentId/recover",
    protect,
    requireRole("superAdmin"),
    recoverFailedPayment
);



// ===========================================//









// AUDIT LOGS //
router.get(
  "/audit-logs",
  protect,
  requireRole("admin", "superAdmin"),
  getAdminAuditLogs
);
// ===========================================//







// GALLERY MANAGEMENT  //

router.get(
  "/gallery",
  protect,
  requireRole("admin", "superAdmin"),
  getAdminGallery
);

router.post(
  "/gallery",
  protect,
  requireRole("admin", "superAdmin"),
  galleryUpload.single("image"),
  createGalleryImage
);

router.patch(
  "/gallery/:id",
  protect,
  requireRole("admin", "superAdmin"),
  galleryUpload.single("image"),
  updateGalleryImage
);

router.delete(
  "/gallery/:id",
  protect,
  requireRole("admin", "superAdmin"),
  deleteGalleryImage
);
// =========================================================//










// team route .. //

router.get(
  "/team",
  protect,
  requireRole("admin", "superAdmin"),
  getTeamMembers
);

router.post(
  "/team",
  protect,
  requireRole("admin", "superAdmin"),
  createTeam
);

router.patch(
    "/team/:id/suspend",
    protect,
    requireRole("admin", "superAdmin"),
    suspendTeamRole
);


router.patch(
  "/team/president",
  protect,
  requireRole("superAdmin"),
  assignPresident
);
// ===================================================///









// ADMIN GENERAL SETTINGS
// ========================================

router.get(
  "/settings/general",
  protect,
  requireRole("admin", "superAdmin"),
  getGeneralSettings
);

router.patch(
  "/settings/general",
  protect,
  requireRole("admin", "superAdmin"),
  updateGeneralSettings
);
// ==========================================================//











// content management routes // 
router.get(
  "/website-content/:pageKey",
  protect,
  requireRole("admin", "superAdmin"),
  getAdminWebsiteContent
);

router.put(
  "/website-content/:pageKey/draft",
  protect,
  requireRole("admin", "superAdmin"),
  saveWebsiteContentDraft
);

router.post(
  "/website-content/:pageKey/publish",
  protect,
  requireRole("admin", "superAdmin"),
  publishWebsiteContent
);

router.post(
  "/website-content/upload-image",
  protect,
  requireRole("admin", "superAdmin"),
  galleryUpload.single("image"),
  uploadWebsiteContentImage
);
// ===================================================//








// LEGACY LEADERSHIP MANAGEMENT
router.get(
  "/legacy-leaders",
  protect,
  requireRole("admin", "superAdmin"),
  getAdminLegacyLeaders
);

router.get(
  "/legacy-leaders/:id",
  protect,
  requireRole("admin", "superAdmin"),
  getAdminLegacyLeaderById
);

router.post(
  "/legacy-leaders",
  protect,
  requireRole("admin", "superAdmin"),
  galleryUpload.single("portrait"),
  createLegacyLeader
);

router.patch(
  "/legacy-leaders/:id",
  protect,
  requireRole("admin", "superAdmin"),
  galleryUpload.single("portrait"),
  updateLegacyLeader
);

router.delete(
  "/legacy-leaders/:id",
  protect,
  requireRole("admin", "superAdmin"),
  deleteLegacyLeader
);
// ===========================================================//



// YEAR SET MANAGEMENT

router.post(
  "/year-sets",
  protect,
  requireRole("admin", "superAdmin"),
  createYearSet
);





// NOSA LEADERSHIP MANAGEMENT

router.get(
  "/nosa-leaders",
  protect,
  requireRole("admin", "superAdmin"),
  getAdminNOSALeaders
);

router.get(
  "/nosa-leaders/:id",
  protect,
  requireRole("admin", "superAdmin"),
  getAdminNOSALeaderById
);

router.post(
  "/nosa-leaders",
  protect,
  requireRole("admin", "superAdmin"),
  galleryUpload.single("image"),
  createNOSALeader
);

router.patch(
  "/nosa-leaders/:id",
  protect,
  requireRole("admin", "superAdmin"),
  galleryUpload.single("image"),
  updateNOSALeader
);

router.delete(
  "/nosa-leaders/:id",
  protect,
  requireRole("admin", "superAdmin"),
  deleteNOSALeader
);

// ===========================================================




router.get(
  "/donations/summary",
  protect,
  requireRole("admin", "superAdmin", "treasurer"),
  getAdminDonationSummary
);

router.get(
  "/donations",
  protect,
  requireRole("admin", "superAdmin", "treasurer"),
  getAdminDonations
);

router.get(
  "/donations/:donationId",
  protect,
  requireRole("admin", "superAdmin", "treasurer"),
  getAdminDonationById
);


router.get(
  "/treasurer/members",
  protect,
  requireRole("admin", "treasurer", "superAdmin"),
  getTreasurerMembers
);

router.get(
    "/treasurer/members/:userId",
    protect,
    requireRole("admin", "treasurer", "superAdmin"),
    getTreasurerMemberDetails
);


router.post(
  "/treasurer/payments/offline",
  protect,
  requireRole("admin", "treasurer", "superAdmin"),
  recordOfflinePayment
);


export default router;