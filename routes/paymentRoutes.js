import express from "express";

import {
    getMyPayments,
    initializePayment,
    verifyPayment,
    handlePaystackCallback,
    verifyPendingPaymentsInternal
} from "../controller/paymentController.js";

import {
    dispatchPaystackWebhook
} from "../controller/paystackWebhook.controller.js";

import { protect } from "../middleware/authmiddleware.js";

const router = express.Router();

router.get("/", protect, getMyPayments);
router.post("/initialize", protect, initializePayment);
router.get("/verify/:reference", protect, verifyPayment);
router.get("/callback", handlePaystackCallback);
router.post("/webhook", dispatchPaystackWebhook);
router.get("/internal/verify-pending", verifyPendingPaymentsInternal);

export default router;