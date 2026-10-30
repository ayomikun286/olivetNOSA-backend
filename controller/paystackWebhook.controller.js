import Donation from "../models/Donation.js";

import { handlePaystackWebhook } from "./paymentController.js";
import { handleDonationWebhook } from "./donation.controller.js";

export const dispatchPaystackWebhook = async (req, res) => {
    try {
        if (!Buffer.isBuffer(req.body)) {
            return res.status(400).json({
                success: false,
                message: "Invalid webhook request body",
            });
        }

        let payload;

        try {
            payload = JSON.parse(req.body.toString("utf8"));
        } catch {
            return res.status(400).json({
                success: false,
                message: "Invalid webhook payload",
            });
        }

        const reference = payload?.data?.reference;

        if (!reference) {
            return handlePaystackWebhook(req, res);
        }

        const donation = await Donation.exists({
            gatewayReference: reference,
            gateway: "paystack",
        });

        if (donation) {
            return handleDonationWebhook(req, res);
        }

        return handlePaystackWebhook(req, res);

    } catch (error) {
        console.error("Paystack webhook dispatcher error:", error);

        return res.status(500).json({
            success: false,
            message: "Webhook dispatch failed",
        });
    }
};