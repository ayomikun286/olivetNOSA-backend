import express from "express";
import {
  getAdminYearSets,
  getAdminYearSetById,
} from "../controller/adminYearSetController.js";

import {
  getAdminChapters,
  getAdminChapterById,
} from "../controller/adminChapterController.js";
import {protect} from "../middleware/authmiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import {
  assignYearSetLeaderController,
  assignChapterLeaderController,
} from "../controller/leadershipController.js";


const router = express.Router();

// ========================================
// YEAR SET MANAGEMENT
// ========================================

router.get(
  "/year-sets",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  getAdminYearSets
);

router.get(
  "/year-sets/:id",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  getAdminYearSetById
);


// ========================================
// CHAPTER MANAGEMENT
// ========================================

router.get(
  "/chapter",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  getAdminChapters
);

router.get(
  "/chapter/:id",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  getAdminChapterById
);


// ========================================
// YEAR SET LEADERSHIP
// ========================================

router.post(
  "/leadership/year-set/:id",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  (req, res, next) => {
    req.body.yearSetId = req.params.id;
    next();
  },
  assignYearSetLeaderController
);


// ========================================
// CHAPTER LEADERSHIP
// ========================================

router.post(
  "/leadership/chapter/:id",
  protect,
  requireRole(
    "admin",
    "superAdmin"
  ),
  (req, res, next) => {
    req.body.chapterId = req.params.id;
    next();
  },
  assignChapterLeaderController
);

export default router;