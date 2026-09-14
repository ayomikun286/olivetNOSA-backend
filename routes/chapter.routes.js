import express from "express";
import { getChapters ,getMyChapter } from "../controller/chapter.controller.js";
import {protect} from "../middleware/authmiddleware.js";

const router = express.Router();

router.get("/", getChapters);
router.get("/obligation",protect, getMyChapter)

export default router;