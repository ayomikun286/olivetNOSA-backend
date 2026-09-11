import express from "express";
import {Signup, verifyEmail,resendVerifyEmailLink,resetPassword ,forgetPassword, checkVerificationStatus,Login,getCurrentUser} from "../controller/auth.controller.js"
import {protect} from "../middleware/authmiddleware.js"
const router = express.Router();


router.post("/user/create", Signup);
router.get("/user/verify-email", verifyEmail);
router.get("/user/verification-status", checkVerificationStatus);
router.post("/user/login", Login);
router.get("/auth/me",protect,getCurrentUser)
router.post("/user/resendVerifyEmailLink", resendVerifyEmailLink)
router.post("/user/forgetPassword", forgetPassword);
router.post("/user/reset-password", resetPassword)


export default router