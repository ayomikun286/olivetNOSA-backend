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
} from "../controller/auth.controller.js";
import {protect} from "../middleware/authmiddleware.js";
import upload from "../middleware/upload.middleware.js";
import {serverLimiter} from "../middleware/rateLimiter.js";
const router = express.Router();


router.post("/user/create",serverLimiter, Signup);
router.get("/user/verify-email", verifyEmail);
router.get("/user/verification-status", checkVerificationStatus);
router.post("/user/login",serverLimiter, Login);
router.get("/user/logout",protect,logout)
router.get("/auth/me",protect,getCurrentUser)

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

router.post("/user/resendVerifyEmailLink", serverLimiter, resendVerifyEmailLink)
router.post("/user/forgetPassword",serverLimiter, forgetPassword);
router.post("/user/reset-password",serverLimiter, resetPassword)
router.get( "/api/auth/activate-account",serverLimiter, verifyAccountSetupController);
router.post( "/api/auth/set-password",serverLimiter, setPasswordController );
export default router