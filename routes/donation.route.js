import express from "express";
import {
    initializeDonation,
    verifyDonation,
} from "../controller/donation.controller.js";

const router = express.Router();

router.post("/initialize", initializeDonation);
router.get("/verify/:reference", verifyDonation);

export default router;