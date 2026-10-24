import express from "express";

import {
  createMemorialSubmission,
  getMyMemorialSubmissions,
  getApprovedMemorialCondolences,
} from "../controller/memorialSubmission.controller.js";

import { protect } from "../middleware/authmiddleware.js";

import memorialSubmissionUpload from "../middleware/memorialSubmissionUpload.middleware.js";

const router = express.Router();


// MEMBER MEMORIAL SUBMISSIONS
// ========================================

router.post(
  "/",
  protect,
  memorialSubmissionUpload.fields([
    {
      name: "photographs",
      maxCount: 10,
    },
  ]),
  createMemorialSubmission
);

router.get(
  "/memorial/:memorialId/condolences",
  getApprovedMemorialCondolences
);


router.get(
  "/mine",
  protect,
  getMyMemorialSubmissions
);


export default router;