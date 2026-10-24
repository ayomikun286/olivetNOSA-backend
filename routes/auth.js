import express from "express";
import {
  Signup,
  logout,
  setPasswordController,
  verifyEmail,
  resendVerifyEmailLink,
  verifyAccountSetupController,
  resetPassword,
  forgetPassword,
  checkVerificationStatus,
  Login,
  getCurrentUser,
  getMemberProfile,
  updateMemberProfile,
  uploadProfilePhoto,
  refreshActivity
} from "../controller/auth.controller.js";
import { protect } from "../middleware/authmiddleware.js";
import { requireFinancialMember } from "../middleware/financialMiddleware.js";



import {
  getPublicWebsiteContent,
} from "../controller/websiteContent.controller.js";

import {
  getPublishedLegacyLeaders,
} from "../controller/admin/legacyLeader.controller.js";

import {
  getMemberArticles,
  getMemberArticleBySlug,
} from "../controller/newsEvent.controller.js";
import upload from "../middleware/upload.middleware.js";
import {
  serverLimiter,
  loginLimiter,
  signupLimiter,
  passwordResetLimiter,
  verificationLimiter,
} from "../middleware/rateLimiter.js";// import { updateMemberFinancialStatus } from "../services/memberFinancialStatus.service.js";
import requireRole from "../middleware/roleMiddleware.js";
import { getPublishedFinancialReports } from "../controller/membersFinancialReport.js";
import {
  getPublicGeneralSettings,
} from "../controller/admin/adminSettings.controller.js";


import { contactForm } from "../controller/ContactFormController.js";
const router = express.Router();


router.post("/user/create", signupLimiter, Signup);
router.get("/user/verify-email", verifyEmail);
router.get("/user/verification-status", checkVerificationStatus);
router.post("/user/login", loginLimiter, Login);
router.get("/user/logout", logout)
router.get("/auth/me", protect, getCurrentUser)


router.post("/auth/activity", protect, refreshActivity);


router.get(
  "/auth/profile",
  protect,
  getMemberProfile
);

router.put(
  "/auth/profile",
  protect,
  serverLimiter,
  updateMemberProfile
);


router.put(
  "/auth/profile/photo",
  protect,
  upload.single("profilePhoto"),
  uploadProfilePhoto
);


router.get(
  "/api/monthly/financial-reports",
  protect,
  requireRole("member"),
  requireFinancialMember,
  getPublishedFinancialReports
);





router.get("/member/articles", protect, requireFinancialMember, getMemberArticles);
router.get("/member/articles/:slug", protect, requireFinancialMember, getMemberArticleBySlug);



router.post("/user/resendVerifyEmailLink", verificationLimiter, resendVerifyEmailLink)
router.post("/user/forgetPassword", serverLimiter, forgetPassword);
router.post("/user/reset-password", passwordResetLimiter, resetPassword)
router.get("/api/auth/activate-account", serverLimiter, verifyAccountSetupController);
router.post("/api/auth/set-password", serverLimiter, setPasswordController);



router.get("/api/public/settings/general", getPublicGeneralSettings);

router.get( "/api/public/legacy-leaders", getPublishedLegacyLeaders);

router.post("/api/contact", contactForm)
router.get(
  "/api/content/:pageKey",
  getPublicWebsiteContent
);



export default router