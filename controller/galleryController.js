import Gallery from "../models/Gallery.js";



export const getPublicGallery = async (req, res) => {
  try {
    const { category } = req.query;

    const filter = {
      isPublished: true,
    };

    if (category && category !== "All") {
      const allowedCategories = [
        "Heritage",
        "Olivet",
        "Community",
        "People",
        "Students",
        "Campus",
      ];

      if (!allowedCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid gallery category.",
        });
      }

      filter.category = category;
    }

    const images = await Gallery.find(filter)
      .select("title image category size createdAt")
      .sort({ createdAt: -1 })
      .lean();

     
    return res.status(200).json({
      success: true,
      count: images.length,
      data: images,
    });
  } catch (error) {
    console.error("Get public gallery error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch gallery images.",
    });
  }
};