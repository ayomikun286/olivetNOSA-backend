import express from "express";
import { getPublicGallery } from "../controller/galleryController.js";

const router = express.Router();

router.get("/", getPublicGallery);

export default router;
