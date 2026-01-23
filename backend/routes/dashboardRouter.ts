import express from "express";
import dashboardController from "../controller/dashboardController";
import { authMiddleware } from "../middleware";

const dashboardRouter = express.Router();

// All dashboard routes require authentication
dashboardRouter.use(authMiddleware);

// GET /api/dashboard - Get all dashboard statistics
dashboardRouter.get("/", dashboardController.getDashboard);

// GET /api/dashboard/chart - Get volume chart data
// Query params: period (7d, 30d, 90d, 1y), company_id
dashboardRouter.get("/chart", dashboardController.getChartData);

// GET /api/dashboard/fee-tiers - Get fee tiers information
dashboardRouter.get("/fee-tiers", dashboardController.getFeeTiers);

// GET /api/dashboard/recent-transactions - Get recent transactions
// Query params: limit (default 10), company_id
dashboardRouter.get("/recent-transactions", dashboardController.getRecentTransactions);

export default dashboardRouter;
