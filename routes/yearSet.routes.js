import express from "express";
import { getYearSet } from "../controller/yearSet.controller.js";

const router = express.Router();

router.get("/", getYearSet);

export default router;