import express from "express";
import {
  getMyObligations,
} from "../controller/obligationAssignmentController.js";
import {protect} from "../middleware/authmiddleware.js"
const router = express.Router();
router.get("/myObligations", protect, getMyObligations);

export default router;