import express from "express";
import { getPublicGallery} from "../controller/galleryController.js";
import {getFeaturedGalleryImages} from  "../controller/admin/galleryController.js";
import {
    getPublicAlbums,
    getPublicAlbumImages,
    
} from "../controller/admin/album.controller.js";

const router = express.Router();

router.get("/", getPublicGallery);
router.get("/albums", getPublicAlbums);
router.get("/featured", getFeaturedGalleryImages);
router.get(
    "/albums/:albumId/images",
    getPublicAlbumImages
);

export default router;
