import mongoose from "mongoose";
import Gallery from "../../models/Gallery.js";
import cloudinary from "../../config/cloudinary.js";

import Album from "../../models/Album.js";


import { createAuditLog } from "../../services/auditLog.service.js";





const ALLOWED_SIZES = ["normal", "large", "tall"];

const uploadToCloudinary = (file) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "onw-nosa/gallery",
                resource_type: "image",
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        stream.end(file.buffer);
    });




const deleteCloudinaryImage = async (publicId) => {
    if (!publicId) return;

    const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
    });

    if (result.result !== "ok" && result.result !== "not found") {
        throw new Error("Cloudinary image deletion failed.");
    }
};




// GET /api/admin/gallery
export const getAdminGallery = async (req, res) => {
    try {
        const images = await Gallery.find()
            .populate("album", "title category year")
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: images.length,
            data: images,
        });
    } catch (error) {
        console.error("Get admin gallery error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch gallery images.",
        });
    }
};

// POST /api/admin/gallery

export const createGalleryImage = async (req, res) => {
    const uploadedImages = [];
    const createdImages = [];

    try {
        const {
            albumId,
            size = "normal",
            isPublished = "true",
        } = req.body;

        if (!mongoose.isValidObjectId(albumId)) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid album.",
            });
        }

        const album = await Album.findById(albumId);

        if (!album) {
            return res.status(404).json({
                success: false,
                message: "Album not found.",
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please select at least one image.",
            });
        }

        if (!ALLOWED_SIZES.includes(size)) {
            return res.status(400).json({
                success: false,
                message: "Invalid image size.",
            });
        }

        if (!["true", "false", true, false].includes(isPublished)) {
            return res.status(400).json({
                success: false,
                message: "Invalid publication status.",
            });
        }

        // Validate every image before uploading any.
        for (const file of req.files) {
            if (!file.mimetype?.startsWith("image/")) {
                return res.status(400).json({
                    success: false,
                    message: "Only image files are allowed.",
                });
            }

            if (file.size > 10 * 1024 * 1024) {
                return res.status(400).json({
                    success: false,
                    message: "Each image must not exceed 10MB.",
                });
            }
        }

        const published =
            isPublished === true || isPublished === "true";

        // Upload images to Cloudinary.
        for (const file of req.files) {
            const result = await uploadToCloudinary(file);

            uploadedImages.push(result);

            const title = file.originalname
                .replace(/\.[^/.]+$/, "")
                .replace(/[_-]+/g, " ")
                .trim();

            const image = await Gallery.create({
                title: title || album.title,
                image: result.secure_url,
                album: album._id,
                size,
                imageSource: "cloudinary",
                cloudinaryPublicId: result.public_id,
                isPublished: published,
                createdBy: req.user?._id || null,
            });

            createdImages.push(image);
        }

        await createAuditLog({
            actor: req.user?._id,
            action: "GALLERY_IMAGES_CREATED",
            resource: "Gallery",
            resourceId: album._id,
            details: {
                albumTitle: album.title,
                albumId: album._id,
                imageCount: createdImages.length,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
        });

        return res.status(201).json({
            success: true,
            message: `${createdImages.length} images uploaded successfully.`,
            count: createdImages.length,
            data: createdImages,
        });
    } catch (error) {
        console.error("Create gallery images error:", error);

        // Remove any database records created during this failed batch.
        if (createdImages.length > 0) {
            await Gallery.deleteMany({
                _id: { $in: createdImages.map((image) => image._id) },
            }).catch(console.error);
        }

        // Remove uploaded Cloudinary assets.
        for (const image of uploadedImages) {
            await deleteCloudinaryImage(image.public_id).catch(console.error);
        }

        return res.status(500).json({
            success: false,
            message: "Failed to upload gallery images.",
        });
    }
};




// PATCH /api/admin/gallery/:id

export const updateGalleryImage = async (req, res) => {
    let uploadedAsset = null;
    let databaseUpdated = false;

    try {
        const { id } = req.params;

        // Validate gallery image ID.
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid gallery image ID.",
            });
        }

        // Find existing gallery image.
        const image = await Gallery.findById(id);

        if (!image) {
            return res.status(404).json({
                success: false,
                message: "Gallery image not found.",
            });
        }

        const { title, size, isPublished, isFeatured } = req.body;

        // Validate title.
        if (title !== undefined) {
            if (typeof title !== "string" || !title.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Title cannot be empty.",
                });
            }
        }

        // Validate image size.
        if (
            size !== undefined &&
            !ALLOWED_SIZES.includes(size)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid gallery size.",
            });
        }

        // Validate featured status.
        if (
            isFeatured !== undefined &&
            ![true, false, "true", "false"].includes(isFeatured)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid featured status.",
            });
        }

        // Enforce maximum of 8 featured images.
if (isFeatured === true || isFeatured === "true") {
    if (!image.isFeatured) {
        const featuredCount = await Gallery.countDocuments({
            isFeatured: true,
            _id: { $ne: image._id },
        });

        if (featuredCount >= 8) {
            return res.status(400).json({
                success: false,
                message: "You can only feature a maximum of 8 gallery images.",
            });
        }
    }
}

        // Validate publication status.
        if (
            isPublished !== undefined &&
            ![true, false, "true", "false"].includes(isPublished)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid publication status.",
            });
        }

        // Capture existing data for audit logging.
        const before = {
            title: image.title,
            size: image.size,
            isPublished: image.isPublished,
            isFeatured: image.isFeatured,
            image: image.image,
            imageSource: image.imageSource,
            cloudinaryPublicId: image.cloudinaryPublicId,
        };

        // Upload replacement only when a new file is provided.
        if (req.file) {
            if (!req.file.mimetype?.startsWith("image/")) {
                return res.status(400).json({
                    success: false,
                    message: "Please upload a valid image.",
                });
            }

            if (req.file.size > 10 * 1024 * 1024) {
                return res.status(400).json({
                    success: false,
                    message: "Image must not exceed 10MB.",
                });
            }

            const result = await uploadToCloudinary(req.file);

            uploadedAsset = result;

            image.image = result.secure_url;
            image.imageSource = "cloudinary";
            image.cloudinaryPublicId = result.public_id;
        }

        // Update metadata.
        if (title !== undefined) {
            image.title = title.trim();
        }

        if (size !== undefined) {
            image.size = size;
        }

        if (isPublished !== undefined) {
            image.isPublished =
                isPublished === true || isPublished === "true";
        }

        // Featured status must be updated independently of file uploads.
        if (isFeatured !== undefined) {
            image.isFeatured =
                isFeatured === true || isFeatured === "true";
        }

        await image.save();
        databaseUpdated = true;

        // Record audit log.
        await createAuditLog({
            actor: req.user._id,
            action: "GALLERY_IMAGE_UPDATED",
            resource: "Gallery",
            resourceId: image._id,
            req,
            details: {
                before,
                after: {
                    title: image.title,
                    size: image.size,
                    isPublished: image.isPublished,
                    isFeatured: image.isFeatured,
                    image: image.image,
                },
            },
        });

        // Delete previous Cloudinary image after successful update.
        if (
            uploadedAsset &&
            before.imageSource === "cloudinary" &&
            before.cloudinaryPublicId &&
            before.cloudinaryPublicId !== uploadedAsset.public_id
        ) {
            try {
                await deleteCloudinaryImage(
                    before.cloudinaryPublicId
                );
            } catch (cleanupError) {
                console.error(
                    "Failed to delete previous gallery image:",
                    cleanupError
                );
            }
        }

        return res.status(200).json({
            success: true,
            message: "Gallery image updated successfully.",
            data: image,
        });

    } catch (error) {
        console.error("Update gallery image error:", error);

        // Remove the new upload if the database never saved it.
        if (uploadedAsset && !databaseUpdated) {
            try {
                await deleteCloudinaryImage(uploadedAsset.public_id);
            } catch (cleanupError) {
                console.error(
                    "Failed to clean up replacement image:",
                    cleanupError
                );
            }
        }

        return res.status(500).json({
            success: false,
            message: "Failed to update gallery image.",
        });
    }
};




// DELETE /api/admin/gallery/:id
export const deleteGalleryImage = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid gallery image ID.",
            });
        }

        const image = await Gallery.findById(id);

        if (!image) {
            return res.status(404).json({
                success: false,
                message: "Gallery image not found.",
            });
        }

        // Clear album cover if this image is being used as its cover.
        const album = await Album.findById(image.album);

        if (album?.coverImage?.toString() === image._id.toString()) {
            album.coverImage = null;
            await album.save();
        }

        // Delete the database record.
        await image.deleteOne();

        // Record deletion in audit log.
        await createAuditLog({
            actor: req.user._id,
            action: "GALLERY_IMAGE_DELETED",
            resource: "Gallery",
            resourceId: image._id,
            req,
            details: {
                title: image.title,
                album: image.album,
                size: image.size,
                imageSource: image.imageSource,
                cloudinaryPublicId: image.cloudinaryPublicId,
            },
        });

        // Clean up Cloudinary asset.
        if (
            image.imageSource === "cloudinary" &&
            image.cloudinaryPublicId
        ) {
            try {
                await deleteCloudinaryImage(image.cloudinaryPublicId);
            } catch (cleanupError) {
                console.error(
                    "Failed to delete Cloudinary gallery image:",
                    cleanupError
                );
            }
        }

        return res.status(200).json({
            success: true,
            message: "Gallery image deleted successfully.",
        });

    } catch (error) {
        console.error("Delete gallery image error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete gallery image.",
        });
    }
};




// GET /api/gallery/featured

export const getFeaturedGalleryImages = async (req, res) => {
    try {
        const images = await Gallery.find({
            isFeatured: true,
            isPublished: true,
        })
            .populate({
                path: "album",
                select: "title category year",
                match: { isPublished: true },
            })
            .sort({ createdAt: -1 })
            .lean();

        const featuredImages = images
            .filter((image) => image.album)
            .slice(0, 8);

        return res.status(200).json({
            success: true,
            count: featuredImages.length,
            data: featuredImages,
        });

    } catch (error) {
        console.error("Get featured gallery images error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch featured gallery images.",
        });
    }
};
