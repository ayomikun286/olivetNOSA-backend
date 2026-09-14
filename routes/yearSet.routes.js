import express from "express";
import { getYearSet } from "../controller/yearSet.controller.js";
import {getMyYearSet} from "../controller/memberYearSetController.js";
import {protect} from "../middleware/authmiddleware.js";
const router = express.Router();

router.get("/", getYearSet);
router.get("/obligation", protect, getMyYearSet)

export default router;