import express from "express";
import {Signup, verifyEmail, checkVerificationStatus,Login,getCurrentUser} from "../controller/auth.controller.js"
import {protect} from "../middleware/authmiddleware.js"
const router = express.Router();


router.post("/user/create", Signup);
router.get("/user/verify-email", verifyEmail);
router.get("/user/verification-status", checkVerificationStatus);
router.post("/user/login", Login);
router.get("/auth/me",protect,getCurrentUser)



export default router