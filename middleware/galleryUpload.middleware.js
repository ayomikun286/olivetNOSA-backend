import multer from "multer";

const galleryUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per image
    files: 50, // Maximum 50 images per upload
  },

  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed for the gallery."));
    }
  },
});

export default galleryUpload;