import express from "express";
import {
  getPublishedNewsEvents,
  getPublishedNewsEventBySlug,
  getMemberArticles,
  getMemberArticleBySlug,
} from "../controller/newsEvent.controller.js";
import { protect } from "../middleware/authmiddleware.js";

const router = express.Router();

router.get("/", getPublishedNewsEvents);
router.get("/:slug", getPublishedNewsEventBySlug);



export default router;