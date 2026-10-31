import express from "express";

import {
    createExcomConversation,
    getExcomConversations,
    getExcomConversationDetails,
    replyToExcomConversation,
} from "../../controller/excom/excomConversation.controller.js";

import {protect} from "../../middleware/authMiddleware.js";
import requireRole from "../../middleware/roleMiddleware.js";

const router = express.Router();

// Only Presidents and EXCOM members can access discussions
router.use(protect);

// President creates a discussion
router.post(
    "/",
    requireRole("president"),
    createExcomConversation
);

// President and EXCOM members can view discussions
router.get(
    "/",
    requireRole("president", "member"),
    getExcomConversations
);

router.get(
    "/:conversationId",
    requireRole("president", "member"),
    getExcomConversationDetails
);

// President and EXCOM members can reply
router.post(
    "/:conversationId/replies",
    requireRole("president", "member"),
    replyToExcomConversation
);

export default router;