import express from "express";

import { protect } from "../middleware/authmiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import pdfUpload from "../middleware/pdfUpload.js";

import {
    createStewardshipReport,
    updateStewardshipReport,
    getPresidentStewardshipReports,
    getPublishedStewardshipReports,
    getAdminStewardshipReports,
    getStewardshipPresidents,
    archivePresidentStewardshipReports,
    restorePresidentStewardshipReports,
} from "../controller/admin/stewardshipReportController.js";



const router = express.Router();



// President: create a report.
router.post(
    "/",
    protect,
    requireRole("president", "superAdmin"),
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



// Super Admin: fetch all stewardship reports.
router.get(
    "/admin",
    protect,
    requireRole("superAdmin"),
    getAdminStewardshipReports
);

// Super Admin: archive all published reports by a President.
router.patch(
    "/admin/presidents/:presidentId/archive",
    protect,
    requireRole("superAdmin"),
    archivePresidentStewardshipReports
);

// Super Admin: restore archived reports by a President.
router.patch(
    "/admin/presidents/:presidentId/restore",
    protect,
    requireRole("superAdmin"),
    restorePresidentStewardshipReports
);


// Super Admin: fetch Presidents for stewardship assignment.
router.get(
    "/admin/presidents",
    protect,
    requireRole("superAdmin"),
    getStewardshipPresidents
);


export default router;