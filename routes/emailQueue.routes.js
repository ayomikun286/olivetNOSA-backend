import express from "express";
import { runEmailQueueJob } from "../controller/admin/emailQueue.controller.js";

const router = express.Router();

router.post("/process", runEmailQueueJob);
router.get("/process", runEmailQueueJob);

export default router;