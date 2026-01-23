import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import router from "./routes";
import crypto from "crypto";
import { decrypt } from "./helper";
import { apiMiddleware } from "./middleware";
import controller from "./controller";

dotenv.config();
const app = express();
const port = process.env.PORT || 3300;

app.use(cors());
app.use(express.json());
app.use(helmet());

app.use(express.static("public"));
app.use("/images", express.static("/images"));
app.use("/videos", express.static("/videos"));
app.use("/api", apiMiddleware, router);

app.get("/", async (req: express.Request, res: express.Response) => {
  res.json({ message: "hello" });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
