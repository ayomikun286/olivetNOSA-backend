import express from "express";

import {
    getMyPayments,
} from "../controller/paymentController.js";

import {protect} from "../middleware/authmiddleware.js";

const router = express.Router();

router.get("/", protect, getMyPayments);

export default router;