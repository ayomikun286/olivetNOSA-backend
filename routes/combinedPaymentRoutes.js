
import express from "express";

import { protect } from "../middleware/authmiddleware.js";

import {
    initializeCombinedPayment,
    verifyCombinedPayment,
} from "../controller/combinedPaymentController.js";

const router = express.Router();

// Initialize one Paystack transaction for multiple obligations.
router.post(
    "/initialize",
    protect,
    initializeCombinedPayment
);

// Verify a combined Paystack transaction.
router.get(
    "/verify/:reference",
    protect,
    verifyCombinedPayment
);

export default router;
