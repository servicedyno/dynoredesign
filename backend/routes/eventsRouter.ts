/**
 * SSE Events Router
 * 
 * Provides Server-Sent Events endpoint for real-time updates.
 * GET /api/events/stream?channels=payments,prices,notifications
 */
import express from "express";
import crypto from "crypto";
import authMiddleware from "../middleware/authMiddleware";
import { registerClient, getSSEStats } from "../services/sseService";
import { IUserType } from "../utils/types";
import { successResponseHelper } from "../helper";

const eventsRouter = express.Router();

/**
 * GET /api/events/stream
 * SSE endpoint — requires authentication
 * Query params: channels (comma-separated)
 */
eventsRouter.get("/stream", authMiddleware, (req: express.Request, res: express.Response) => {
  const userData = res.locals.user as IUserType;
  const channelsParam = (req.query.channels as string) || "payments,notifications";
  const channels = channelsParam.split(",").map((c) => c.trim()).filter(Boolean);
  const clientId = crypto.randomUUID();

  registerClient(clientId, userData.user_id, res, channels);

  // Keep connection open — response will be closed by SSE service on disconnect
  req.on("close", () => {
    // Client disconnected — handled by SSE service
  });
});

/**
 * GET /api/events/stats
 * Get SSE connection stats (admin)
 */
eventsRouter.get("/stats", (req: express.Request, res: express.Response) => {
  const stats = getSSEStats();
  successResponseHelper(res, 200, "SSE stats", stats);
});

export default eventsRouter;
