import express from "express";
import dotenv from "dotenv";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import router from "./routes";
// crypto and decrypt imports removed - not used
// controller import removed - not used
import { apiMiddleware } from "./middleware";
import { connectRedis } from "./utils/redisInstance";
import { setupMerchantSwagger } from "./swagger";

// Load .env from parent directory (shared with main backend)
dotenv.config({ path: path.resolve(__dirname, "../.env") });
const app = express();
const port = process.env.API_SERVICE_PORT || 3301;

app.use(cors());
app.use(express.json());
app.use(helmet({
  contentSecurityPolicy: false, // Disable for Swagger UI
}));

app.use(express.static("public"));
app.use("/images", express.static("/images"));
app.use("/videos", express.static("/videos"));

// Setup Swagger documentation
setupMerchantSwagger(app);

app.use("/api", apiMiddleware, router);

app.get("/", async (_req: express.Request, res: express.Response) => {
  res.json({ 
    message: "DynoPay Merchant API Service", 
    version: "1.0.0",
    documentation: "/docs"
  });
});

const startServer = async () => {
  try {
    await connectRedis();
    app.listen(port, () => console.log(`API Service listening on port ${port}!`));
  } catch (error) {
    console.error("Failed to start API service:", error);
    process.exit(1);
  }
};

startServer();
