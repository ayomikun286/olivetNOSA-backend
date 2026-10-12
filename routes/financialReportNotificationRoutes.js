import express from "express";
import {
  runFinancialReportNotificationJob,
} from "../controller/financialReportNotificationController.js";

const router = express.Router();

router.get("/", runFinancialReportNotificationJob);
export default router;