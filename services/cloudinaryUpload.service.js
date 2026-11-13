import { randomUUID } from "crypto";
import cloudinary from "../config/cloudinary.js";

// Upload PDF to Cloudinary.
export const uploadPdfToCloudinary = (
    file,
    folder = "nosa/stewardship-reports",
    prefix = "stewardship"
) =>
    new Promise((resolve, reject) => {
        const publicId = `${prefix}_${randomUUID()}.pdf`;

        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                public_id: publicId,
                resource_type: "raw",
                access_mode: "public",
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