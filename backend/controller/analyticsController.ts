/**
 * Analytics Controller
 * 
 * Admin-only endpoints for revenue analytics, cohort analysis, and funnels.
 */
import express from "express";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { apiLogger } from "../utils/loggers";
import {
  getRevenueAnalytics,
  getUserGrowthAnalytics,
  getCohortAnalysis,
  getPaymentFunnel,
} from "../services/analyticsService";

/**
 * GET /api/admin/analytics/revenue?period=30d
 */
const revenue = async (req: express.Request, res: express.Response) => {
  try {
    const period = (req.query.period as string) || "30d";
    const validPeriods = ["7d", "30d", "90d", "1y"];
    if (!validPeriods.includes(period)) {
      return errorResponseHelper(res, 400, `Invalid period. Must be one of: ${validPeriods.join(", ")}`);
    }

    const data = await getRevenueAnalytics(period as "7d" | "30d" | "90d" | "1y");
    successResponseHelper(res, 200, "Revenue analytics retrieved", data);
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

/**
 * GET /api/admin/analytics/users
 */
const userGrowth = async (_req: express.Request, res: express.Response) => {
  try {
    const data = await getUserGrowthAnalytics();
    successResponseHelper(res, 200, "User growth analytics retrieved", data);
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

/**
 * GET /api/admin/analytics/cohorts?weeks=8
 */
const cohorts = async (req: express.Request, res: express.Response) => {
  try {
    const weeks = parseInt(req.query.weeks as string) || 8;
    const data = await getCohortAnalysis(Math.min(weeks, 52));
    successResponseHelper(res, 200, "Cohort analysis retrieved", data);
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

/**
 * GET /api/admin/analytics/funnel?days=30
 */
const funnel = async (req: express.Request, res: express.Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const data = await getPaymentFunnel(Math.min(days, 365));
    successResponseHelper(res, 200, "Payment funnel analysis retrieved", data);
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

export default {
  revenue,
  userGrowth,
  cohorts,
  funnel,
};
