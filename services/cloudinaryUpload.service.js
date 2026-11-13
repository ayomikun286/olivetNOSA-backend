import { randomUUID } from "crypto";
import cloudinary from "../config/cloudinary.js";
import { Readable } from "stream";

// Upload PDF to Cloudinary.
export const uploadPdfToCloudinary = (
    file,
    folder = "nosa/stewardship-reports",
    prefix = "stewardship"
) =>
    new Promise((resolve, reject) => {
        const publicId = `${prefix}_${randomUUID()}.pdf`;

        const uploadStream = cloudinary.uploader.upload_chunked_stream(
            {
                folder,
                public_id: publicId,
                resource_type: "raw",
                access_mode: "public",
                chunk_size: 6 * 1024 * 1024,
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        Readable.from([file.buffer]).pipe(uploadStream);
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