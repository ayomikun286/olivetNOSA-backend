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

import upload from "../middleware/upload.middleware.js";
import {serverLimiter} from "../middleware/rateLimiter.js";
import { updateMemberFinancialStatus } from "../services/memberFinancialStatus.service.js";
import  requireRole  from "../middleware/roleMiddleware.js";
import {getPublishedFinancialReports} from "../controller/membersFinancialReport.js";  
const router = express.Router();


router.post("/user/create",serverLimiter, Signup);
router.get("/user/verify-email", verifyEmail);
router.get("/user/verification-status", checkVerificationStatus);
router.post("/user/login",serverLimiter, Login);
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
  





router.get("/api/debug/financial/:userId", async (req, res) => {
  try {
    const status = await updateMemberFinancialStatus(
      req.params.userId,
      2026
    );

    res.json({
      ok: true,
      status,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: error.message,
    });
  }
});


router.post("/user/resendVerifyEmailLink", serverLimiter, resendVerifyEmailLink)
router.post("/user/forgetPassword",serverLimiter, forgetPassword);
router.post("/user/reset-password",serverLimiter, resetPassword)
router.get( "/api/auth/activate-account",serverLimiter, verifyAccountSetupController);
router.post( "/api/auth/set-password",serverLimiter, setPasswordController );
export default router