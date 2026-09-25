import express from "express";

import {
  getPublishedNewsEvents,
  getPublishedNewsEventBySlug,
} from "../controller/newsEvent.controller.js";

const router = express.Router();

// Published news & events
router.get("/", getPublishedNewsEvents);

// Single published news/event
router.get("/:slug", getPublishedNewsEventBySlug);

export default router;