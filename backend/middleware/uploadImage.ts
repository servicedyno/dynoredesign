import multer from "multer";
import path from "path";
import fs from "fs";

let storage;
try {
  storage = multer.diskStorage({
    destination: (
      req: Express.Request,
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
      req: Express.Request,
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
  console.log("****ERROR****", err);
}

const uploadImage = multer({ storage });

export default uploadImage;
