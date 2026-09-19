import express from "express";
import {Signup,logout,setPasswordController, verifyEmail,resendVerifyEmailLink, verifyAccountSetupController, resetPassword ,forgetPassword, checkVerificationStatus,Login,getCurrentUser} from "../controller/auth.controller.js"
import {protect} from "../middleware/authmiddleware.js";

const router = express.Router();


router.post("/user/create", Signup);
router.get("/user/verify-email", verifyEmail);
router.get("/user/verification-status", checkVerificationStatus);
router.post("/user/login", Login);
router.get("/user/logout",protect,logout)
router.get("/auth/me",protect,getCurrentUser)
router.post("/user/resendVerifyEmailLink", resendVerifyEmailLink)
router.post("/user/forgetPassword", forgetPassword);
router.post("/user/reset-password", resetPassword)
router.get( "/api/auth/activate-account", verifyAccountSetupController);
router.post( "/api/auth/set-password", setPasswordController );
export default router