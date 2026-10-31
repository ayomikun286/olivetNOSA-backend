
import cloudinary from "../config/cloudinary.js";

// Upload PDF to Cloudinary.
export const uploadPdfToCloudinary = (file) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "nosa/stewardship-reports",
                resource_type: "raw",
                use_filename: true,
                unique_filename: true,
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        stream.end(file.buffer);
    });

// Delete PDF from Cloudinary.
export const deleteCloudinaryPdf = async (publicId) => {
    if (!publicId) return;

    const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "raw",
    });

    if (
        result.result !== "ok" &&
        result.result !== "not found"
    ) {
        throw new Error("Cloudinary PDF deletion failed.");
    }
};
