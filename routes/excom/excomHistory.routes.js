import express from "express";

import {
    getAllPresidentialTenures,
    getPresidentialTenureDetails,
     exportPresidentialTenurePDF,
} from "../../controller/excom/excomHistory.controller.js";

import {protect} from "../../middleware/authmiddleware.js";
import requireRole from "../../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect, requireRole("superAdmin"));

router.get("/tenures", getAllPresidentialTenures);

router.get("/tenures/:tenureId", getPresidentialTenureDetails);

router.get(
    "/tenures/:tenureId/export",
    exportPresidentialTenurePDF
);

export default router;