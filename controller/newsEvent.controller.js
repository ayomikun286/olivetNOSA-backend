import NewsEvent from "../models/NewsEvent.js";
import cloudinary from "../config/cloudinary.js";

export const getPublishedNewsEvents = async (req, res) => {
  try {
    const { type } = req.query;

    const filter = {
      isPublished: true,
    };

    if (type && ["news", "event"].includes(type)) {
      filter.type = type;
    }

    const newsEvents = await NewsEvent.find(filter)
      .sort({
        publishedAt: -1,
        createdAt: -1,
      })
      .populate("createdBy", "firstName lastName");

    return res.status(200).json({
      success: true,
      message: "News and events retrieved successfully.",
      data: newsEvents,
    });
  } catch (error) {
    console.error("Get published news/events error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving news and events.",
    });
  }
};



export const getPublishedNewsEventBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const newsEvent = await NewsEvent.findOne({
      slug,
      isPublished: true,
    }).populate("createdBy", "firstName lastName");

    if (!newsEvent) {
      return res.status(404).json({
        success: false,
        message: "News or event not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "News or event retrieved successfully.",
      data: newsEvent,
    });
  } catch (error) {
    console.error("Get published news/event error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving the news or event.",
    });
  }
};














// admin //
export const createNewsEvent = async (req, res) => {
  try {
    const {
      title,
      slug,
      type,
      category,
      excerpt,
      content,
      eventDate,
      startTime,
      endTime,
      location,
      registrationUrl,
      isPublished,
      isFeatured,
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title is required.",
      });
    }

    if (!type || !["news", "event"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be either news or event.",
      });
    }

    if (!slug?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Slug is required.",
      });
    }

    if (type === "event" && !eventDate) {
      return res.status(400).json({
        success: false,
        message: "Event date is required for events.",
      });
    }

    const existingNewsEvent = await NewsEvent.findOne({
      slug: slug.trim().toLowerCase(),
    });

    if (existingNewsEvent) {
      return res.status(409).json({
        success: false,
        message: "A news or event with this slug already exists.",
      });
    }



    let imageUrl = "";
    let imagePublicId = "";

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "olivetnosa/news-events",
            resource_type: "image",
            transformation: [
              {
                width: 1600,
                height: 900,
                crop: "limit",
              },
              {
                quality: "auto",
                fetch_format: "auto",
              },
            ],
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );

        stream.end(req.file.buffer);
      });

      imageUrl = uploadResult.secure_url;
      imagePublicId = uploadResult.public_id;
    }

    const published = isPublished === true || isPublished === "true";

    const newsEvent = await NewsEvent.create({
      title: title.trim(),
      slug: slug.trim().toLowerCase(),
      type,
      category: category?.trim() || "",
      excerpt: excerpt?.trim() || "",
      content: content?.trim() || "",

      image: imageUrl,
      imagePublicId,

      eventDate: eventDate || null,
      startTime: startTime?.trim() || "",
      endTime: endTime?.trim() || "",
      location: location?.trim() || "",
      registrationUrl: registrationUrl?.trim() || "",

      isPublished: published,
      isFeatured:
        isFeatured === true || isFeatured === "true",

      publishedAt: published ? new Date() : null,

      createdBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "News or event created successfully.",
      data: newsEvent,
    });
  } catch (error) {
    console.error("Create news/event error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while creating the news or event.",
    });
  }
};

export const getAdminNewsEvents = async (req, res) => {
  try {
    const { type, status } = req.query;

    const filter = {};

    // Filter by type
    if (type && ["news", "event"].includes(type)) {
      filter.type = type;
    }

    // Filter by publication status
    if (status === "published") {
      filter.isPublished = true;
    }

    if (status === "draft") {
      filter.isPublished = false;
    }

    const newsEvents = await NewsEvent.find(filter)
      .sort({
        createdAt: -1,
      })
      .populate("createdBy", "firstName lastName");

    return res.status(200).json({
      success: true,
      message: "News and events retrieved successfully.",
      data: newsEvents,
    });
  } catch (error) {
    console.error("Get admin news/events error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving news and events.",
    });
  }
};

export const updateNewsEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const newsEvent = await NewsEvent.findById(id);

    if (!newsEvent) {
      return res.status(404).json({
        success: false,
        message: "News or event not found.",
      });
    }

    const {
      title,
      slug,
      type,
      category,
      excerpt,
      content,
      eventDate,
      startTime,
      endTime,
      location,
      registrationUrl,
      isPublished,
      isFeatured,
    } = req.body;

    if (type !== undefined && !["news", "event"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be either news or event.",
      });
    }

  

    if (slug !== undefined) {
      const cleanSlug = slug.trim().toLowerCase();

      const existingNewsEvent = await NewsEvent.findOne({
        slug: cleanSlug,
        _id: { $ne: id },
      });

      if (existingNewsEvent) {
        return res.status(409).json({
          success: false,
          message: "A news or event with this slug already exists.",
        });
      }

      newsEvent.slug = cleanSlug;
    }


    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Title cannot be empty.",
        });
      }

      newsEvent.title = title.trim();
    }

    if (type !== undefined) newsEvent.type = type;
    if (category !== undefined) newsEvent.category = category.trim();
    if (excerpt !== undefined) newsEvent.excerpt = excerpt.trim();
    if (content !== undefined) newsEvent.content = content.trim();

 

    if (eventDate !== undefined) {
      newsEvent.eventDate = eventDate || null;
    }

    if (startTime !== undefined) {
      newsEvent.startTime = startTime.trim();
    }

    if (endTime !== undefined) {
      newsEvent.endTime = endTime.trim();
    }

    if (location !== undefined) {
      newsEvent.location = location.trim();
    }

    if (registrationUrl !== undefined) {
      newsEvent.registrationUrl = registrationUrl.trim();
    }

    
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "olivetnosa/news-events",
            resource_type: "image",
            transformation: [
              {
                width: 1600,
                height: 900,
                crop: "limit",
              },
              {
                quality: "auto",
                fetch_format: "auto",
              },
            ],
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );

        stream.end(req.file.buffer);
      });

      newsEvent.image = uploadResult.secure_url;
      newsEvent.imagePublicId = uploadResult.public_id;
    }

   
    if (isPublished !== undefined) {
      const published =
        isPublished === true || isPublished === "true";

      if (published && !newsEvent.isPublished) {
        newsEvent.publishedAt = new Date();
      }

      if (!published) {
        newsEvent.publishedAt = null;
      }

      newsEvent.isPublished = published;
    }

    if (isFeatured !== undefined) {
      newsEvent.isFeatured =
        isFeatured === true || isFeatured === "true";
    }

    await newsEvent.save();

    return res.status(200).json({
      success: true,
      message: "News or event updated successfully.",
      data: newsEvent,
    });
  } catch (error) {
    console.error("Update news/event error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while updating the news or event.",
    });
  }
};


export const deleteNewsEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const newsEvent = await NewsEvent.findById(id);

    if (!newsEvent) {
      return res.status(404).json({
        success: false,
        message: "News or event not found.",
      });
    }

    // Delete image from Cloudinary if one exists
    if (newsEvent.imagePublicId) {
      await cloudinary.uploader.destroy(
        newsEvent.imagePublicId,
        {
          resource_type: "image",
        }
      );
    }

    await NewsEvent.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "News or event deleted successfully.",
    });
  } catch (error) {
    console.error("Delete news/event error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while deleting the news or event.",
    });
  }
};

