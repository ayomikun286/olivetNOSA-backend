import mongoose from "mongoose";
import Gallery from "../../models/Gallery.js";
import cloudinary from "../../config/cloudinary.js";


import { createAuditLog } from "../../services/auditLog.service.js";

const ALLOWED_CATEGORIES = [
    "Heritage",
    "Olivet",
    "Community",
    "People",
    "Students",
    "Campus",
];




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
    let uploadedImage;

    try {
        const { title, category, size = "normal", isPublished = "true" } =
            req.body;

        if (!title?.trim() || !category) {
            return res.status(400).json({
                success: false,
                message: "Title and category are required.",
            });
        }

        if (!ALLOWED_CATEGORIES.includes(category)) {
            return res.status(400).json({
                success: false,
                message: "Invalid gallery category.",
            });
        }

        if (!ALLOWED_SIZES.includes(size)) {
            return res.status(400).json({
                success: false,
                message: "Invalid gallery size.",
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please select an image to upload.",
            });
        }

        if (!req.file.mimetype?.startsWith("image/")) {
            return res.status(400).json({
                success: false,
                message: "Only image files are allowed.",
            });
        }

        if (req.file.size > 10 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                message: "Image must not exceed 10MB.",
            });
        }

        if (!["true", "false", true, false].includes(isPublished)) {
            return res.status(400).json({
                success: false,
                message: "Invalid publication status.",
            });
        }

        uploadedImage = await uploadToCloudinary(req.file);

        const image = await Gallery.create({
            title: title.trim(),
            category,
            size,
            image: uploadedImage.secure_url,
            imageSource: "cloudinary",
            cloudinaryPublicId: uploadedImage.public_id,
            isPublished: isPublished === true || isPublished === "true",
            createdBy: req.user?._id ?? null,
        });

        await createAuditLog({
            actor: req.user._id,
            action: "GALLERY_IMAGE_CREATED",
            resource: "Gallery",
            resourceId: image._id,
            req,
            details: {
                title: image.title,
                category: image.category,
                size: image.size,
                isPublished: image.isPublished,
                imageSource: image.imageSource,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Gallery image created successfully.",
            data: image,
        });
    } catch (error) {
        if (uploadedImage?.public_id) {
            try {
                await deleteCloudinaryImage(uploadedImage.public_id);
            } catch (cleanupError) {
                console.error("Cloudinary cleanup error:", cleanupError);
            }
        }

        console.error("Create gallery image error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create gallery image.",
        });
    }
};

// PATCH /api/admin/gallery/:id
export const updateGalleryImage = async (req, res) => {
    let uploadedAsset = null;
    let databaseUpdated = false;

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

        const {
            title,
            category,
            size,
            isPublished,
        } = req.body;

        // Validate metadata before uploading anything.
        if (title !== undefined) {
            if (typeof title !== "string" || !title.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Title cannot be empty.",
                });
            }
        }

        if (
            category !== undefined &&
            !ALLOWED_CATEGORIES.includes(category)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid gallery category.",
            });
        }

        if (
            size !== undefined &&
            !ALLOWED_SIZES.includes(size)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid gallery size.",
            });
        }

        if (
            isPublished !== undefined &&
            ![true, false, "true", "false"].includes(isPublished)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid publication status.",
            });
        }

        const before = {
            title: image.title,
            category: image.category,
            size: image.size,
            isPublished: image.isPublished,
            image: image.image,
            imageSource: image.imageSource,
            cloudinaryPublicId: image.cloudinaryPublicId,
        };

        // Upload a replacement only if a new file was provided.
        if (req.file) {
            if (!req.file.mimetype?.startsWith("image/")) {
                return res.status(400).json({
                    success: false,
                    message: "Please upload a valid image.",
                });
            }

          
            const result = await uploadToCloudinary(req.file);

          
            uploadedAsset = result;

            image.image = result.secure_url;
            image.imageSource = "cloudinary";
            image.cloudinaryPublicId = result.public_id;
        }

        if (title !== undefined) {
            image.title = title.trim();
        }

        if (category !== undefined) {
            image.category = category;
        }

        if (size !== undefined) {
            image.size = size;
        }

        if (isPublished !== undefined) {
            image.isPublished =
                isPublished === true || isPublished === "true";
        }

        await image.save();
        databaseUpdated = true;

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
                    category: image.category,
                    size: image.size,
                    isPublished: image.isPublished,
                    image: image.image,
                },
            },
        });


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

        // Clean up the new upload only if the database was
        // not updated to reference it.
        if (uploadedAsset && !databaseUpdated) {
            try {
                await cloudinary.uploader.destroy(
                    uploadedAsset.public_id
                );
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

        // Delete the Cloudinary asset before removing the database record.
        if (
            image.imageSource === "cloudinary" &&
            image.cloudinaryPublicId
        ) {
            await deleteCloudinaryImage(image.cloudinaryPublicId);
        }

        await image.deleteOne();

        await createAuditLog({
            actor: req.user._id,
            action: "GALLERY_IMAGE_DELETED",
            resource: "Gallery",
            resourceId: image._id,
            req,
            details: {
                title: image.title,
                category: image.category,
                size: image.size,
                imageSource: image.imageSource,
                cloudinaryPublicId: image.cloudinaryPublicId,
            },
        });

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