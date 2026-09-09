import express from "express";
import { getChapters } from "../controller/chapter.controller.js";

const router = express.Router();

router.get("/", getChapters);

export default router;