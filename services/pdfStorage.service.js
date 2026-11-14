
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PDF_STORAGE_DIR = path.resolve(
    __dirname,
    "../../announcement-pdfs"
);

// Save PDF to the Plesk server
export const uploadPdfToLocalStorage = async (file, req) => {
    if (!file?.buffer) {
        throw new Error("No PDF file provided.");
    }

    const filename = `${randomUUID()}.pdf`;

    await fs.mkdir(PDF_STORAGE_DIR, { recursive: true });

    await fs.writeFile(
        path.join(PDF_STORAGE_DIR, filename),
        file.buffer
    );

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    return {
        url: `${baseUrl}/api/uploads/pdfs/${filename}`,
        publicId: filename,
        fileName: file.originalname,
        storage: "local",
    };
};

// Delete a locally stored PDF
export const deleteLocalPdf = async (filename) => {
    if (!filename) return;

    const safeFilename = path.basename(filename);

    await fs.unlink(
        path.join(PDF_STORAGE_DIR, safeFilename)
    ).catch((error) => {
        if (error.code !== "ENOENT") throw error;
    });
};
