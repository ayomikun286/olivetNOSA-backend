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
import {protect} from "../middleware/authmiddleware.js";
import {requireFinancialMember} from "../middleware/financialMiddleware.js";


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
import  requireRole  from "../middleware/roleMiddleware.js";
import {getPublishedFinancialReports} from "../controller/membersFinancialReport.js";  
const router = express.Router();


router.post("/user/create", signupLimiter, Signup);
router.get("/user/verify-email", verifyEmail);
router.get("/user/verification-status", checkVerificationStatus);
router.post("/user/login",loginLimiter , Login);
router.get("/user/logout",logout)
router.get("/auth/me",protect,getCurrentUser)


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
  




router.get("/member/articles", protect,requireFinancialMember, getMemberArticles);
router.get("/member/articles/:slug", protect,requireFinancialMember, getMemberArticleBySlug);



router.post("/user/resendVerifyEmailLink",  verificationLimiter, resendVerifyEmailLink)
router.post("/user/forgetPassword",serverLimiter, forgetPassword);
router.post("/user/reset-password",  passwordResetLimiter,resetPassword)
router.get( "/api/auth/activate-account",serverLimiter, verifyAccountSetupController);
router.post( "/api/auth/set-password",serverLimiter, setPasswordController );
export default router