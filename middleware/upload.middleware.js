import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/",
      "video/",
    ];

    const isAllowed = allowedTypes.some((type) =>
      file.mimetype.startsWith(type)
    );

    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed."));
    }
  },
});

export default upload;