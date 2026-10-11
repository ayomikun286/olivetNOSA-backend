import express from "express";

import {
  createSupportTicketController,
  getMySupportTicketsController,
  getSupportTicketByIdController,
  getAllSupportTicketsController,
  replyToSupportTicketController,
  updateSupportTicketStatusController,
} from "../controller/support.controller.js";
import requireRole from "../middleware/roleMiddleware.js";

import { protect } from "../middleware/authmiddleware.js";

const router = express.Router();

// MEMBER: Create and view own support requests
router.post("/", protect, createSupportTicketController);
router.get("/my", protect, getMySupportTicketsController);

// ADMIN: View all support requests
router.get("/admin", protect, getAllSupportTicketsController);

// MEMBER OR ADMIN: View a ticket and reply
router.get("/:id", protect, getSupportTicketByIdController);
router.post("/:id/replies", protect, replyToSupportTicketController);

// ADMIN: Update status and assignment
router.patch("/:id/status", protect, updateSupportTicketStatusController);

export default router;