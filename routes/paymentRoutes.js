import express from "express";

import {
    getMyPayments,
    initializePayment,
    verifyPayment,
    handlePaystackCallback,
    handlePaystackWebhook,
} from "../controller/paymentController.js";

import { protect } from "../middleware/authmiddleware.js";

const router = express.Router();

router.get("/", protect, getMyPayments);

router.post(
    "/initialize",
    protect,
    initializePayment
);

router.get(
    "/verify/:reference",
    protect,
    verifyPayment
);

// Paystack redirects here after checkout
router.get(
    "/callback",
    handlePaystackCallback
);

// Paystack server-to-server webhook
router.post(
    "/webhook",
    handlePaystackWebhook
);

export default router;