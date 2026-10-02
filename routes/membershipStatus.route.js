import express from "express";
import {

  runDailyMembershipJob
} from "../controller/obligationController.js";

const router = express.Router();



router.get(
  "/",
  runDailyMembershipJob
);

export default router;