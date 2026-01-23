import express from "express";
import jwt from "jsonwebtoken";
import { Op, QueryTypes } from "sequelize";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../helper";
import { IUserType } from "../utils/types";
import { userTransactionModel, userWalletModel, companyModel } from "../models";
import sequelize from "../utils/dbInstance";

// Fee Tiers Configuration
const FEE_TIERS = [
  { name: "Starter", min: 0, max: 10000, description: "For new users testing the platform" },
  { name: "Standard", min: 10000, max: 50000, description: "For growing users" },
  { name: "Pro", min: 50000, max: 250000, description: "For serious merchants and creators" },
  { name: "Business", min: 250000, max: 1000000, description: "For high-volume operations" },
  { name: "Enterprise", min: 1000000, max: Infinity, description: "Custom pricing, priority support" },
];

/**
 * Get current fee tier based on monthly volume
 */
const getFeeTier = (monthlyVolume: number) => {
  const tier = FEE_TIERS.find(t => monthlyVolume >= t.min && monthlyVolume < t.max) || FEE_TIERS[FEE_TIERS.length - 1];
  const nextTier = FEE_TIERS.find(t => t.min > monthlyVolume);
  
  return {
    current_tier: tier.name,
    tier_description: tier.description,
    monthly_volume: monthlyVolume,
    tier_threshold: tier.max === Infinity ? null : tier.max,
    percent_complete: tier.max === Infinity ? 100 : Math.round((monthlyVolume / tier.max) * 100 * 10) / 10,
    amount_to_next_tier: nextTier ? Math.round((nextTier.min - monthlyVolume) * 100) / 100 : 0,
    next_tier: nextTier?.name || null,
  };
};

/**
 * Calculate percentage change between two values
 */
const calculateChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
};

/**
 * Get all dashboard statistics
 * GET /api/dashboard
 */
const getDashboard = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const { company_id } = req.query;
    const userId = userData.user_id;

    // Date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Build where clause
    const baseWhere: any = { user_id: userId };
    if (company_id) {
      baseWhere.company_id = company_id;
    }

    // Get current month transactions
    const currentMonthTransactions = await sequelize.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(base_amount), 0) as volume
       FROM tbl_user_transaction 
       WHERE user_id = :userId 
       AND status = 'done'
       AND "createdAt" >= :startOfMonth`,
      {
        replacements: { userId, startOfMonth },
        type: QueryTypes.SELECT,
      }
    ) as any[];

    // Get last month transactions
    const lastMonthTransactions = await sequelize.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(base_amount), 0) as volume
       FROM tbl_user_transaction 
       WHERE user_id = :userId 
       AND status = 'done'
       AND "createdAt" >= :startOfLastMonth
       AND "createdAt" <= :endOfLastMonth`,
      {
        replacements: { userId, startOfLastMonth, endOfLastMonth },
        type: QueryTypes.SELECT,
      }
    ) as any[];

    // Get all-time totals
    const allTimeTransactions = await sequelize.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(base_amount), 0) as volume
       FROM tbl_user_transaction 
       WHERE user_id = :userId 
       AND status = 'done'`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    ) as any[];

    // Get active wallets
    const activeWallets = await sequelize.query(
      `SELECT DISTINCT wallet_type, wallet_name, company_id
       FROM tbl_user_wallet 
       WHERE user_id = :userId 
       AND currency_type = 'CRYPTO'
       AND wallet_address IS NOT NULL`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    ) as any[];

    // Get pending transactions count
    const pendingTransactions = await sequelize.query(
      `SELECT COUNT(*) as count
       FROM tbl_user_transaction 
       WHERE user_id = :userId 
       AND status = 'pending'`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    ) as any[];

    // Parse results
    const currentCount = parseInt(currentMonthTransactions[0]?.count || '0');
    const currentVolume = parseFloat(currentMonthTransactions[0]?.volume || '0');
    const lastCount = parseInt(lastMonthTransactions[0]?.count || '0');
    const lastVolume = parseFloat(lastMonthTransactions[0]?.volume || '0');
    const totalCount = parseInt(allTimeTransactions[0]?.count || '0');
    const totalVolume = parseFloat(allTimeTransactions[0]?.volume || '0');
    const pendingCount = parseInt(pendingTransactions[0]?.count || '0');

    // Calculate fee tier
    const feeTier = getFeeTier(currentVolume);

    // Build response
    const dashboardData = {
      total_transactions: {
        count: totalCount,
        current_month: currentCount,
        change_percent: calculateChange(currentCount, lastCount),
        comparison_period: "last_month",
      },
      total_volume: {
        amount: Math.round(totalVolume * 100) / 100,
        current_month: Math.round(currentVolume * 100) / 100,
        currency: "USD",
        change_percent: calculateChange(currentVolume, lastVolume),
        comparison_period: "last_month",
      },
      pending_transactions: {
        count: pendingCount,
      },
      active_wallets: {
        count: activeWallets.length,
        wallets: activeWallets.map((w: any) => w.wallet_type),
        details: activeWallets,
      },
      fee_tier: feeTier,
    };

    return successResponseHelper(res, 200, "Dashboard data retrieved successfully", dashboardData);

  } catch (e) {
    const message = getErrorMessage(e);
    console.error("Dashboard error:", message);
    return errorResponseHelper(res, 500, message);
  }
};

/**
 * Get volume chart data
 * GET /api/dashboard/chart
 */
const getChartData = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const { period = '30d', company_id } = req.query;
    const userId = userData.user_id;

    // Determine date range based on period
    let days = 30;
    let groupBy = 'day';
    
    switch (period) {
      case '7d':
        days = 7;
        groupBy = 'day';
        break;
      case '30d':
        days = 30;
        groupBy = 'day';
        break;
      case '90d':
        days = 90;
        groupBy = 'week';
        break;
      case '1y':
        days = 365;
        groupBy = 'month';
        break;
      default:
        days = 30;
        groupBy = 'day';
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get aggregated data based on groupBy
    let chartQuery = '';
    
    if (groupBy === 'day') {
      chartQuery = `
        SELECT 
          DATE("createdAt") as date,
          COUNT(*) as transaction_count,
          COALESCE(SUM(base_amount), 0) as volume
        FROM tbl_user_transaction 
        WHERE user_id = :userId 
        AND status = 'done'
        AND "createdAt" >= :startDate
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `;
    } else if (groupBy === 'week') {
      chartQuery = `
        SELECT 
          DATE_TRUNC('week', "createdAt") as date,
          COUNT(*) as transaction_count,
          COALESCE(SUM(base_amount), 0) as volume
        FROM tbl_user_transaction 
        WHERE user_id = :userId 
        AND status = 'done'
        AND "createdAt" >= :startDate
        GROUP BY DATE_TRUNC('week', "createdAt")
        ORDER BY date ASC
      `;
    } else {
      chartQuery = `
        SELECT 
          DATE_TRUNC('month', "createdAt") as date,
          COUNT(*) as transaction_count,
          COALESCE(SUM(base_amount), 0) as volume
        FROM tbl_user_transaction 
        WHERE user_id = :userId 
        AND status = 'done'
        AND "createdAt" >= :startDate
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY date ASC
      `;
    }

    const chartData = await sequelize.query(chartQuery, {
      replacements: { userId, startDate },
      type: QueryTypes.SELECT,
    }) as any[];

    // Get transaction breakdown by currency
    const currencyBreakdown = await sequelize.query(
      `SELECT 
        base_currency,
        COUNT(*) as count,
        COALESCE(SUM(base_amount), 0) as volume
       FROM tbl_user_transaction 
       WHERE user_id = :userId 
       AND status = 'done'
       AND "createdAt" >= :startDate
       GROUP BY base_currency
       ORDER BY volume DESC`,
      {
        replacements: { userId, startDate },
        type: QueryTypes.SELECT,
      }
    ) as any[];

    // Get transaction breakdown by status
    const statusBreakdown = await sequelize.query(
      `SELECT 
        status,
        COUNT(*) as count
       FROM tbl_user_transaction 
       WHERE user_id = :userId 
       AND "createdAt" >= :startDate
       GROUP BY status`,
      {
        replacements: { userId, startDate },
        type: QueryTypes.SELECT,
      }
    ) as any[];

    // Format chart data
    const formattedChartData = chartData.map((item: any) => ({
      date: item.date,
      volume: Math.round(parseFloat(item.volume) * 100) / 100,
      transaction_count: parseInt(item.transaction_count),
    }));

    // Fill in missing dates with zero values
    const filledChartData = fillMissingDates(formattedChartData, startDate, new Date(), groupBy);

    return successResponseHelper(res, 200, "Chart data retrieved successfully", {
      period,
      group_by: groupBy,
      start_date: startDate.toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      chart_data: filledChartData,
      currency_breakdown: currencyBreakdown.map((c: any) => ({
        currency: c.base_currency,
        count: parseInt(c.count),
        volume: Math.round(parseFloat(c.volume) * 100) / 100,
      })),
      status_breakdown: statusBreakdown.map((s: any) => ({
        status: s.status,
        count: parseInt(s.count),
      })),
    });

  } catch (e) {
    const message = getErrorMessage(e);
    console.error("Chart data error:", message);
    return errorResponseHelper(res, 500, message);
  }
};

/**
 * Helper function to fill missing dates with zero values
 */
const fillMissingDates = (data: any[], startDate: Date, endDate: Date, groupBy: string) => {
  const filledData: any[] = [];
  const dataMap = new Map(data.map(d => [new Date(d.date).toISOString().split('T')[0], d]));
  
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dateKey = current.toISOString().split('T')[0];
    const existingData = dataMap.get(dateKey);
    
    if (existingData) {
      filledData.push({
        date: dateKey,
        volume: existingData.volume,
        transaction_count: existingData.transaction_count,
      });
    } else {
      filledData.push({
        date: dateKey,
        volume: 0,
        transaction_count: 0,
      });
    }
    
    // Increment based on groupBy
    if (groupBy === 'day') {
      current.setDate(current.getDate() + 1);
    } else if (groupBy === 'week') {
      current.setDate(current.getDate() + 7);
    } else {
      current.setMonth(current.getMonth() + 1);
    }
  }
  
  return filledData;
};

/**
 * Get fee tiers information
 * GET /api/dashboard/fee-tiers
 */
const getFeeTiers = async (req: express.Request, res: express.Response) => {
  try {
    return successResponseHelper(res, 200, "Fee tiers retrieved successfully", {
      tiers: FEE_TIERS.map(tier => ({
        name: tier.name,
        min_volume: tier.min,
        max_volume: tier.max === Infinity ? null : tier.max,
        description: tier.description,
      })),
    });
  } catch (e) {
    const message = getErrorMessage(e);
    return errorResponseHelper(res, 500, message);
  }
};

/**
 * Get recent transactions for dashboard
 * GET /api/dashboard/recent-transactions
 */
const getRecentTransactions = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const { limit = 10, company_id } = req.query;
    const userId = userData.user_id;

    const recentTransactions = await sequelize.query(
      `SELECT 
        ut.transaction_id,
        ut.id,
        ut.base_amount,
        ut.base_currency,
        ut.status,
        ut.transaction_type,
        ut.transaction_reference,
        ut."createdAt",
        uw.wallet_type,
        c.customer_name,
        c.email as customer_email
       FROM tbl_user_transaction ut
       LEFT JOIN tbl_user_wallet uw ON ut.wallet_id = uw.wallet_id
       LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id
       WHERE ut.user_id = :userId
       ORDER BY ut."createdAt" DESC
       LIMIT :limit`,
      {
        replacements: { userId, limit: parseInt(limit as string) },
        type: QueryTypes.SELECT,
      }
    );

    return successResponseHelper(res, 200, "Recent transactions retrieved successfully", {
      transactions: recentTransactions,
      count: recentTransactions.length,
    });

  } catch (e) {
    const message = getErrorMessage(e);
    console.error("Recent transactions error:", message);
    return errorResponseHelper(res, 500, message);
  }
};

export default {
  getDashboard,
  getChartData,
  getFeeTiers,
  getRecentTransactions,
};
