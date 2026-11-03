
import mongoose from "mongoose";
import Album from "../../models/Album.js";
import Gallery from "../../models/Gallery.js";
import { createAuditLog } from "../../services/auditLog.service.js";



const ALLOWED_CATEGORIES = [
    "Heritage",
    "Olivet",
    "Community",
    "People",
    "Students",
    "Campus",
];





const validateAlbumData = ({ title, category, year }) => {
    if (typeof title !== "string" || !title.trim()) {
        return "Album title is required.";
    }

    if (!ALLOWED_CATEGORIES.includes(category)) {
        return "Invalid album category.";
    }

    const parsedYear = Number(year);

    if (
        !Number.isInteger(parsedYear) ||
        parsedYear < 1900 ||
        parsedYear > 2100
    ) {
        return "Please provide a valid album year.";
    }

    return null;
};

// CREATE ALBUM
export const createAlbum = async (req, res) => {
    try {
        const { title, description = "", category, year } = req.body;

        const validationError = validateAlbumData({
            title,
            category,
            year,
        });

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError,
            });
        }

        if (typeof description !== "string") {
    return res.status(400).json({
        success: false,
        message: "Album description must be a string.",
    });
}

        const album = await Album.create({
            title,
            description,
            category,
            year: Number(year),
            createdBy: req.user?._id || null,
        });

        await createAuditLog({
            actor: req.user?._id,
            action: "ALBUM_CREATED",
            resource: "Album",
            resourceId: album._id,
            details: {
                title: album.title,
                category: album.category,
                year: album.year,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
        });

        return res.status(201).json({
            success: true,
            message: "Album created successfully.",
            data: album,
        });
    } catch (error) {
        console.error("Create album error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create album.",
        });
    }
};



// GET ALL ALBUMS (ADMIN)
export const getAdminAlbums = async (req, res) => {
    try {
        const albums = await Album.find()
            .populate("coverImage", "image title")
            .sort({ year: -1, createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: albums.length,
            data: albums,
        });
    } catch (error) {
        console.error("Get admin albums error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch albums.",
        });
    }
};



// GET SINGLE ALBUM (ADMIN)
export const getAdminAlbumById = async (req, res) => {
    try {
        const { albumId } = req.params;

        if (!mongoose.isValidObjectId(albumId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid album ID.",
            });
        }

        const album = await Album.findById(albumId)
            .populate("coverImage", "image title")
            .lean();

        if (!album) {
            return res.status(404).json({
                success: false,
                message: "Album not found.",
            });
        }

        const imageCount = await Gallery.countDocuments({
            album: albumId,
        });

        return res.status(200).json({
            success: true,
            data: {
                ...album,
                imageCount,
            },
        });
    } catch (error) {
        console.error("Get admin album error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch album.",
        });
    }
};



// UPDATE ALBUM
export const updateAlbum = async (req, res) => {
    try {
        const { albumId } = req.params;

        if (!mongoose.isValidObjectId(albumId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid album ID.",
            });
        }

        const album = await Album.findById(albumId);

        if (!album) {
            return res.status(404).json({
                success: false,
                message: "Album not found.",
            });
        }

        const {
            title = album.title,
            description = album.description,
            category = album.category,
            year = album.year,
            isPublished = album.isPublished,
            coverImage,
        } = req.body;

        const validationError = validateAlbumData({
            title,
            category,
            year,
        });

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError,
            });
        }

        if (typeof description !== "string") {
    return res.status(400).json({
        success: false,
        message: "Album description must be a string.",
    });
}

        if (
            typeof isPublished !== "boolean" &&
            !["true", "false"].includes(isPublished)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid publication status.",
            });
        }

        // Validate cover image selection.
        if (coverImage !== undefined) {
            if (coverImage === null || coverImage === "") {
                album.coverImage = null;
            } else {
                if (!mongoose.isValidObjectId(coverImage)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid cover image ID.",
                    });
                }

                const selectedImage = await Gallery.findOne({
                    _id: coverImage,
                    album: album._id,
                    isPublished: true,
                });

                if (!selectedImage) {
                    return res.status(400).json({
                        success: false,
                        message: "Cover image must be a published image belonging to this album.",
                    });
                }

                album.coverImage = selectedImage._id;
            }
        }

        album.title = title;
        album.description = description;
        album.category = category;
        album.year = Number(year);
        album.isPublished =
            typeof isPublished === "boolean"
                ? isPublished
                : isPublished === "true";

        await album.save();

        await createAuditLog({
            actor: req.user?._id,
            action: "ALBUM_UPDATED",
            resource: "Album",
            resourceId: album._id,
            details: {
                title: album.title,
                category: album.category,
                year: album.year,
                isPublished: album.isPublished,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
        });

        return res.status(200).json({
            success: true,
            message: "Album updated successfully.",
            data: album,
        });
    } catch (error) {
        console.error("Update album error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update album.",
        });
    }
};




// DELETE ALBUM
export const deleteAlbum = async (req, res) => {
    try {
        const { albumId } = req.params;

        if (!mongoose.isValidObjectId(albumId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid album ID.",
            });
        }

        const album = await Album.findById(albumId);

        if (!album) {
            return res.status(404).json({
                success: false,
                message: "Album not found.",
            });
        }

        const imageCount = await Gallery.countDocuments({
            album: albumId,
        });

        if (imageCount > 0) {
            return res.status(409).json({
                success: false,
                message: `This album contains ${imageCount} images. Remove its images before deleting the album.`,
            });
        }

        await album.deleteOne();

        await createAuditLog({
            actor: req.user?._id,
            action: "ALBUM_DELETED",
            resource: "Album",
            resourceId: album._id,
            details: {
                title: album.title,
                category: album.category,
                year: album.year,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
        });

        return res.status(200).json({
            success: true,
            message: "Album deleted successfully.",
        });
    } catch (error) {
        console.error("Delete album error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete album.",
        });
    }
};



// GET PUBLISHED ALBUMS (PUBLIC)
export const getPublicAlbums = async (req, res) => {
    try {
        const { category, year } = req.query;

        const filter = {
            isPublished: true,
        };

        if (category && category !== "All") {
            if (!ALLOWED_CATEGORIES.includes(category)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid album category.",
                });
            }

            filter.category = category;
        }

        if (year) {
            const parsedYear = Number(year);

            if (!Number.isInteger(parsedYear)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid album year.",
                });
            }

            filter.year = parsedYear;
        }

        const albums = await Album.find(filter)
            .populate({
                path: "coverImage",
                select: "image title",
                match: { isPublished: true },
            })
            .sort({ year: -1, createdAt: -1 })
            .lean();

        const albumsWithCounts = await Promise.all(
            albums.map(async (album) => ({
                ...album,
                imageCount: await Gallery.countDocuments({
                    album: album._id,
                    isPublished: true,
                }),
            }))
        );

        return res.status(200).json({
            success: true,
            count: albumsWithCounts.length,
            data: albumsWithCounts,
        });
    } catch (error) {
        console.error("Get public albums error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch albums.",
        });
    }
};




// GET PUBLISHED IMAGES INSIDE A PUBLIC ALBUM
export const getPublicAlbumImages = async (req, res) => {
    try {
        const { albumId } = req.params;

        if (!mongoose.isValidObjectId(albumId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid album ID.",
            });
        }

        const album = await Album.findOne({
            _id: albumId,
            isPublished: true,
        }).lean();

        if (!album) {
            return res.status(404).json({
                success: false,
                message: "Album not found.",
            });
        }

        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(
            48,
            Math.max(1, Number.parseInt(req.query.limit, 10) || 24)
        );

        const filter = {
            album: albumId,
            isPublished: true,
        };

        const [images, total] = await Promise.all([
            Gallery.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),

            Gallery.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            data: {
                album,
                images,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                    hasNextPage: page * limit < total,
                    hasPreviousPage: page > 1,
                },
            },
        });
    } catch (error) {
        console.error("Get public album images error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch album images.",
        });
    }
};
