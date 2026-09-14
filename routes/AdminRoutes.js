import express from "express";
import { approveMemberController } from "../controller/adminController.js";
import {assignYearSetLeaderController,assignChapterLeaderController} from "../controller/leadershipController.js";
const router = express.Router();

router.patch(
  "/members/:userId/approve",
  approveMemberController
);

router.patch(
  "/members/year-set-leader",
  assignYearSetLeaderController
);

router.patch(
  "/members/chapter-leader",
  assignChapterLeaderController
);


export default router;