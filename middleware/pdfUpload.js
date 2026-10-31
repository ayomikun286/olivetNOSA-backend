
import multer from "multer";

const storage = multer.memoryStorage();

const pdfUpload = multer({
    storage,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB
        files: 1,
    },
    fileFilter: (req, file, cb) => {
        const isPdf =
            file.mimetype === "application/pdf" &&
            file.originalname.toLowerCase().endsWith(".pdf");

        if (isPdf) {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed."));
        }
    },
});

export default pdfUpload;
