import express from "express";

import { protect } from "../middleware/authmiddleware.js";
import { getDirectoryMembers } from "../controller/directory.controller.js";

const router = express.Router();

router.get("/", protect, getDirectoryMembers);

export default router;