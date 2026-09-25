import express from "express";

import {
  getPublishedMemorials,
  getMemorialById,
} from "../controller/memorial.controller.js";

// Use your existing auth middleware here
import { protect } from "../middleware/authmiddleware.js";

const router = express.Router();



router.get("/", getPublishedMemorials);



router.get("/:id", protect, getMemorialById);

export default router;