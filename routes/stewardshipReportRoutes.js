import express from "express";

import { protect } from "../middleware/authmiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import pdfUpload from "../middleware/pdfUpload.js";

import {
    createStewardshipReport,
    updateStewardshipReport,
    getPresidentStewardshipReports,
    getPublishedStewardshipReports,
} from "../controller/admin/stewardshipReportController.js";

const router = express.Router();

// President: create a report.
router.post(
    "/",
    protect,
    requireRole("president"),
    pdfUpload.single("pdf"),
    createStewardshipReport
);

// President: fetch their reports, including drafts.
router.get(
    "/president",
    protect,
    requireRole("president"),
    getPresidentStewardshipReports
);

// President: update a report and optionally replace its PDF.
router.put(
    "/:id",
    protect,
    requireRole("president"),
    pdfUpload.single("pdf"),
    updateStewardshipReport
);

// Members and President: view published stewardship reports.
router.get(
    "/",
    protect,
    requireRole("member", "president"),
    getPublishedStewardshipReports
);


export default router;