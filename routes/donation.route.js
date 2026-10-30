import express from "express";
import {
    initializeDonation,
    verifyDonation,
    verifyPendingDonationsInternal
} from "../controller/donation.controller.js";

const router = express.Router();

router.post("/initialize", initializeDonation);
router.get("/verify/:reference", verifyDonation);

router.get("/verify-donation-pending", verifyPendingDonationsInternal);


export default router;