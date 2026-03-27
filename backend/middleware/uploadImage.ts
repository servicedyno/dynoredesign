import multer from "multer";
import path from "path";
import fs from "fs";
import { apiLogger } from "../utils/loggers";

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

let storage;
try {
  storage = multer.diskStorage({
    destination: (
      _req: Express.Request,
      file: Express.Multer.File,
      callback: (error: Error | null, destination: string) => void
    ) => {
      if (file) {
        let directoryPath;

        if (file.mimetype.includes("image"))
          directoryPath = path.join(__dirname, "../public/images");

        if (!fs.existsSync(directoryPath)) {
          fs.mkdirSync(directoryPath, { recursive: true });
        }
        callback(null, directoryPath);
      }
    },
    filename: (
      _req: Express.Request,
      file: Express.Multer.File,
      callback: (errror: Error | null, destination: string) => void
    ) => {
      if (file && file.originalname) {
        let extension;
        const tempExtension = file.originalname.split(".");
        const extensionName = tempExtension.length - 1;
        extension = tempExtension[extensionName];

        const randomString = (Math.random() + 1).toString(36).substring(2);
        callback(null, `media_${randomString}.${extension}`);
      }
    },
  });
} catch (err) {
  apiLogger.error("****UPLOAD ERROR****", err);
}

const uploadImage = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max file size
  },
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    callback: multer.FileFilterCallback
  ) => {
    if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error(`Invalid file type: ${file.mimetype}. Only image files (JPEG, PNG, GIF, WebP, SVG) are allowed.`));
    }
  },
});

export default uploadImage;
