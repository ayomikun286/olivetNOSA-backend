import express from "express";

import {
    getEligibleExcomMembers,
    appointExcomMember,
    getExcomMembers,
    removeExcomMember,
} from "../../controller/excom/excomMembership.controller.js";

import {protect} from "../../middleware/authmiddleware.js";
import requireRole from "../../middleware/roleMiddleware.js";
const router = express.Router();

// All EXCOM membership management routes are President-only
router.use(protect, requireRole("president"));

// Get members available for appointment
router.get("/eligible-members", getEligibleExcomMembers);

// Appoint a member
router.post("/", appointExcomMember);

// Get current EXCOM team
router.get("/", getExcomMembers);

// Remove a member from the current EXCOM team
router.patch("/:membershipId/remove", removeExcomMember);

export default router;