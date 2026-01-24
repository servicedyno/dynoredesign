import express from "express";
import statusController from "../controller/statusController";

const statusRouter = express.Router();

// Public endpoints (no auth required for status page)

// GET /api/status - Overall system status
statusRouter.get("/", statusController.getStatus);

// GET /api/status/health - Simple health check
statusRouter.get("/health", statusController.healthCheck);

// GET /api/status/services - All services status
statusRouter.get("/services", statusController.getServicesStatus);

// GET /api/status/service/:serviceId - Specific service status
statusRouter.get("/service/:serviceId", statusController.getServiceStatus);

// GET /api/status/uptime - 90-day uptime chart data
statusRouter.get("/uptime", statusController.getUptimeChart);

// GET /api/status/incidents - Recent incidents
statusRouter.get("/incidents", statusController.getIncidents);

// GET /api/status/incidents/:id - Specific incident
statusRouter.get("/incidents/:id", statusController.getIncident);

export default statusRouter;
