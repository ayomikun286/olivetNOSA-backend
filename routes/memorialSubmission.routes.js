import express from "express";

import {
  createMemorialSubmission,
  getMyMemorialSubmissions,
} from "../controller/memorialSubmission.controller.js";

import { protect } from "../middleware/authmiddleware.js";

import memorialSubmissionUpload from "../middleware/memorialSubmissionUpload.middleware.js";

const router = express.Router();


// ========================================
// MEMBER MEMORIAL SUBMISSIONS
// ========================================

router.post(
  "/",
  protect,
  memorialSubmissionUpload.array(
    "photographs",
    10
  ),
  createMemorialSubmission
);


router.get(
  "/mine",
  protect,
  getMyMemorialSubmissions
);


export default router;