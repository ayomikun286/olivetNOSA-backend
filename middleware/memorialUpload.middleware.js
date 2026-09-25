import multer from "multer";

const storage = multer.memoryStorage();

const memorialUpload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per image
    files: 11, // 1 main photo + up to 10 additional photos
  },

  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed for memorials."));
    }
  },
});

export default memorialUpload;