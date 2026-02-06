import express from "express";
import jwt from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
  currencyConvert,
} from "../helper";
import { IUserType } from "../utils/types";
import { userTransactionModel, userWalletModel, companyModel } from "../models";
import sequelize from "../utils/dbInstance";
import { getRedisItem, setRedisItem, setRedisTTL } from "../utils/redisInstance";

// Cache TTL for dashboard data (30 seconds)
const DASHBOARD_CACHE_TTL = 30;

// Fee Tiers Configuration (thresholds in USD - will be converted for display)
const FEE_TIERS = [
  { name: "Starter", min: 0, max: 10000, description: "For new users testing the platform" },
  { name: "Standard", min: 10000, max: 50000, description: "For growing users" },
  { name: "Pro", min: 50000, max: 250000, description: "For serious merchants and creators" },
  { name: "Business", min: 250000, max: 1000000, description: "For high-volume operations" },
  { name: "Enterprise", min: 1000000, max: Infinity, description: "Custom pricing, priority support" },
];

/**
 * Get currency symbol for a given currency code
 */
const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', CHF: 'CHF ',
    CNY: '¥', JPY: '¥', HKD: 'HK$', NZD: 'NZ$', SGD: 'S$',
    BRL: 'R$', NGN: '₦', ZAR: 'R', KES: 'KSh', MXN: 'MX$'
  };
  return symbols[currency?.toUpperCase()] || '';
};

/**
 * Get current fee tier based on monthly volume (in USD)
 * @param monthlyVolumeUSD - Volume in USD
 * @param displayCurrency - Currency to display thresholds in
 * @param conversionRate - Rate to convert USD to display currency (1 USD = X displayCurrency)
 */
const getFeeTier = (monthlyVolumeUSD: number, displayCurrency: string = 'USD', conversionRate: number = 1) => {
  const tier = FEE_TIERS.find(t => monthlyVolumeUSD >= t.min && monthlyVolumeUSD < t.max) || FEE_TIERS[FEE_TIERS.length - 1];
  const nextTier = FEE_TIERS.find(t => t.min > monthlyVolumeUSD);
  
  // Convert thresholds to display currency
  const displayVolume = Math.round(monthlyVolumeUSD * conversionRate * 100) / 100;
  const displayThreshold = tier.max === Infinity ? null : Math.round(tier.max * conversionRate);
  const displayAmountToNext = nextTier ? Math.round((nextTier.min - monthlyVolumeUSD) * conversionRate * 100) / 100 : 0;
  const currencySymbol = getCurrencySymbol(displayCurrency);
  
  return {
    current_tier: tier.name,
    tier_description: tier.description,
    monthly_volume: displayVolume,
    monthly_volume_usd: monthlyVolumeUSD, // Always include USD for reference
    tier_threshold: displayThreshold,
    tier_threshold_formatted: displayThreshold ? `${currencySymbol}${displayThreshold.toLocaleString()} ${displayCurrency}` : 'Unlimited',
    percent_complete: tier.max === Infinity ? 100 : Math.round((monthlyVolumeUSD / tier.max) * 100 * 10) / 10,
    amount_to_next_tier: displayAmountToNext,
    amount_to_next_tier_formatted: nextTier ? `${currencySymbol}${displayAmountToNext.toLocaleString()} ${displayCurrency}` : null,
    next_tier: nextTier?.name || null,
    currency: displayCurrency,
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
 * OPTIMIZED: Combined single query + Redis caching (30s TTL)
 */
const getDashboard = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const { company_id } = req.query;
    const userId = userData.user_id;
    
    // Validate company ownership if company_id is provided
    if (company_id) {
      const company = await companyModel.findOne({
        where: { 
          company_id: company_id,
          user_id: userId  // Ensure company belongs to user
        }
      });
      
      if (!company) {
        return errorResponseHelper(res, 403, "You don't have access to this company's dashboard");
      }
    }
    
    // Get company's preferred currency from their most recent active API key
    let preferredCurrency = "USD";
    if (company_id) {
      // Use raw SQL to ensure proper ordering
      const apiKeys = await sequelize.query(
        `SELECT base_currency FROM tbl_api 
         WHERE company_id = :companyId AND status = 'active' 
         ORDER BY "createdAt" DESC LIMIT 1`,
        {
          replacements: { companyId: company_id },
          type: QueryTypes.SELECT,
        }
      ) as Array<{ base_currency: string }>;
      
      if (apiKeys.length > 0 && apiKeys[0].base_currency) {
        preferredCurrency = apiKeys[0].base_currency;
        console.log(`[Dashboard] Using currency ${preferredCurrency} for company ${company_id}`);
      }
    }
    
    // Check Redis cache first (include currency in cache key)
    const cacheKey = `dashboard:${userId}:${company_id || 'all'}:${preferredCurrency}`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      console.log(`[Dashboard] Cache hit for user ${userId}, currency ${preferredCurrency}`);
      return successResponseHelper(res, 200, "Dashboard data retrieved successfully", cached);
    }

    // Date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // OPTIMIZED: Single combined query for all transaction stats
    const companyJoin = company_id ? 'LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id' : '';
    const companyFilter = company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : '';
    
    const combinedQuery = `
      SELECT 
        -- Current month stats
        COUNT(*) FILTER (WHERE ut.status = 'done' AND ut."createdAt" >= :startOfMonth) as current_month_count,
        COALESCE(SUM(ut.base_amount) FILTER (WHERE ut.status = 'done' AND ut."createdAt" >= :startOfMonth), 0) as current_month_volume,
        -- Last month stats
        COUNT(*) FILTER (WHERE ut.status = 'done' AND ut."createdAt" >= :startOfLastMonth AND ut."createdAt" <= :endOfLastMonth) as last_month_count,
        COALESCE(SUM(ut.base_amount) FILTER (WHERE ut.status = 'done' AND ut."createdAt" >= :startOfLastMonth AND ut."createdAt" <= :endOfLastMonth), 0) as last_month_volume,
        -- All-time stats
        COUNT(*) FILTER (WHERE ut.status = 'done') as total_count,
        COALESCE(SUM(ut.base_amount) FILTER (WHERE ut.status = 'done'), 0) as total_volume,
        -- Pending count
        COUNT(*) FILTER (WHERE ut.status = 'pending') as pending_count
      FROM tbl_user_transaction ut
      ${companyJoin}
      WHERE ut.user_id = :userId ${companyFilter}
    `;

    // Run both queries in parallel
    const [transactionStats, activeWallets] = await Promise.all([
      sequelize.query(combinedQuery, {
        replacements: { userId, startOfMonth, startOfLastMonth, endOfLastMonth, companyId: company_id },
        type: QueryTypes.SELECT,
      }),
      sequelize.query(
        `SELECT DISTINCT wallet_type, wallet_name, company_id
         FROM tbl_user_wallet 
         WHERE user_id = :userId 
         AND currency_type = 'CRYPTO'
         AND wallet_address IS NOT NULL
         ${company_id ? 'AND company_id = :companyId' : ''}`,
        {
          replacements: { userId, companyId: company_id },
          type: QueryTypes.SELECT,
        }
      )
    ]) as [Array<Record<string, unknown>>, Array<Record<string, unknown>>];

    // Parse results from combined query
    const stats = transactionStats[0] || {} as Record<string, string>;
    const currentCount = parseInt(String(stats.current_month_count || '0'));
    let currentVolume = parseFloat(String(stats.current_month_volume || '0'));
    const lastCount = parseInt(String(stats.last_month_count || '0'));
    let lastVolume = parseFloat(String(stats.last_month_volume || '0'));
    const totalCount = parseInt(String(stats.total_count || '0'));
    let totalVolume = parseFloat(String(stats.total_volume || '0'));
    const pendingCount = parseInt(String(stats.pending_count || '0'));
    
    // Store USD values for fee tier calculation
    const currentMonthVolumeUSD = parseFloat(String(stats.current_month_volume || '0'));

    // Convert volumes to preferred currency if not USD
    let conversionRate = 1;
    if (preferredCurrency !== 'USD' && (totalVolume > 0 || currentVolume > 0)) {
      try {
        const conversions = await currencyConvert({
          sourceCurrency: 'USD',
          currency: [preferredCurrency],
          amount: 1, // Get rate for 1 USD
          fixedDecimal: true,
        });
        
        if (conversions && conversions[0]?.amount) {
          conversionRate = Number(conversions[0].amount);
          totalVolume = totalVolume * conversionRate;
          currentVolume = currentVolume * conversionRate;
          lastVolume = lastVolume * conversionRate;
          console.log(`[Dashboard] Converted volumes to ${preferredCurrency} (rate: ${conversionRate})`);
        }
      } catch (convErr) {
        console.warn(`[Dashboard] Currency conversion failed, showing USD:`, convErr);
        preferredCurrency = 'USD'; // Fallback to USD
        conversionRate = 1;
      }
    }

    // Calculate fee tier (based on USD, but display in preferred currency)
    const feeTier = getFeeTier(currentMonthVolumeUSD, preferredCurrency, conversionRate);

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
        currency: preferredCurrency,
        change_percent: calculateChange(currentVolume, lastVolume),
        comparison_period: "last_month",
      },
      pending_transactions: {
        count: pendingCount,
      },
      active_wallets: {
        count: activeWallets.length,
        wallets: activeWallets.map((w: Record<string, unknown>) => w.wallet_type),
        details: activeWallets,
      },
      fee_tier: feeTier,
    };

    // Cache the result
    await setRedisItem(cacheKey, dashboardData);
    await setRedisTTL(cacheKey, DASHBOARD_CACHE_TTL);

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

    // Check cache first (60 second TTL for chart data)
    const cacheKey = `chart:${userId}:${company_id || 'all'}:${period}`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      console.log(`[Chart] Cache hit for user ${userId}`);
      return successResponseHelper(res, 200, "Chart data retrieved successfully", cached);
    }

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
          DATE(ut."createdAt") as date,
          COUNT(*) as transaction_count,
          COALESCE(SUM(ut.base_amount), 0) as volume
        FROM tbl_user_transaction ut
        ${company_id ? 'LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id' : ''}
        WHERE ut.user_id = :userId 
        AND ut.status = 'done'
        AND ut."createdAt" >= :startDate
        ${company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : ''}
        GROUP BY DATE(ut."createdAt")
        ORDER BY date ASC
      `;
    } else if (groupBy === 'week') {
      chartQuery = `
        SELECT 
          DATE_TRUNC('week', ut."createdAt") as date,
          COUNT(*) as transaction_count,
          COALESCE(SUM(ut.base_amount), 0) as volume
        FROM tbl_user_transaction ut
        ${company_id ? 'LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id' : ''}
        WHERE ut.user_id = :userId 
        AND ut.status = 'done'
        AND ut."createdAt" >= :startDate
        ${company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : ''}
        GROUP BY DATE_TRUNC('week', ut."createdAt")
        ORDER BY date ASC
      `;
    } else {
      chartQuery = `
        SELECT 
          DATE_TRUNC('month', ut."createdAt") as date,
          COUNT(*) as transaction_count,
          COALESCE(SUM(ut.base_amount), 0) as volume
        FROM tbl_user_transaction ut
        ${company_id ? 'LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id' : ''}
        WHERE ut.user_id = :userId 
        AND ut.status = 'done'
        AND ut."createdAt" >= :startDate
        ${company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : ''}
        GROUP BY DATE_TRUNC('month', ut."createdAt")
        ORDER BY date ASC
      `;
    }

    const chartData = await sequelize.query(chartQuery, {
      replacements: { userId, startDate, companyId: company_id },
      type: QueryTypes.SELECT,
    }) as Array<Record<string, unknown>>;

    // Get transaction breakdown by currency
    const currencyBreakdown = await sequelize.query(
      `SELECT 
        ut.base_currency,
        COUNT(*) as count,
        COALESCE(SUM(ut.base_amount), 0) as volume
       FROM tbl_user_transaction ut
       ${company_id ? 'LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id' : ''}
       WHERE ut.user_id = :userId 
       AND ut.status = 'done'
       AND ut."createdAt" >= :startDate
       ${company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : ''}
       GROUP BY ut.base_currency
       ORDER BY volume DESC`,
      {
        replacements: { userId, startDate, companyId: company_id },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    // Get transaction breakdown by status
    const statusBreakdown = await sequelize.query(
      `SELECT 
        ut.status,
        COUNT(*) as count
       FROM tbl_user_transaction ut
       ${company_id ? 'LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id' : ''}
       WHERE ut.user_id = :userId 
       AND ut."createdAt" >= :startDate
       ${company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : ''}
       GROUP BY ut.status`,
      {
        replacements: { userId, startDate, companyId: company_id },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    // Format chart data
    const formattedChartData = chartData.map((item: Record<string, unknown>) => ({
      date: item.date,
      volume: Math.round(parseFloat(String(item.volume || '0')) * 100) / 100,
      transaction_count: parseInt(String(item.transaction_count || '0')),
    }));

    // Fill in missing dates with zero values
    const filledChartData = fillMissingDates(formattedChartData, startDate, new Date(), groupBy);

    const responseData = {
      period,
      group_by: groupBy,
      start_date: startDate.toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      chart_data: filledChartData,
      currency_breakdown: currencyBreakdown.map((c: Record<string, unknown>) => ({
        currency: c.base_currency,
        count: parseInt(String(c.count || '0')),
        volume: Math.round(parseFloat(String(c.volume || '0')) * 100) / 100,
      })),
      status_breakdown: statusBreakdown.map((s: Record<string, unknown>) => ({
        status: s.status,
        count: parseInt(String(s.count || '0')),
      })),
    };

    // Cache the result (60 second TTL)
    await setRedisItem(cacheKey, responseData);
    await setRedisTTL(cacheKey, 60);

    return successResponseHelper(res, 200, "Chart data retrieved successfully", responseData);

  } catch (e) {
    const message = getErrorMessage(e);
    console.error("Chart data error:", message);
    return errorResponseHelper(res, 500, message);
  }
};

/**
 * Helper function to fill missing dates with zero values
 */
const fillMissingDates = (data: Array<Record<string, unknown>>, startDate: Date, endDate: Date, groupBy: string) => {
  const filledData: Array<Record<string, unknown>> = [];
  const dataMap = new Map(data.map(d => [new Date(String(d.date)).toISOString().split('T')[0], d]));
  
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
 * GET /api/dashboard/fee-tiers
 * Returns fee tiers with user's current tier based on transaction volume
 */
const getFeeTiers = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const { company_id } = req.query;
    const userId = userData.user_id;

    // Get company's preferred currency
    let preferredCurrency = 'USD';
    let conversionRate = 1;
    
    if (company_id) {
      const apiKeyResult = await sequelize.query(
        `SELECT base_currency FROM tbl_api WHERE company_id = :companyId AND status = 'active' ORDER BY CASE WHEN environment = 'production' THEN 0 ELSE 1 END, "createdAt" DESC LIMIT 1`,
        { replacements: { companyId: company_id }, type: QueryTypes.SELECT }
      ) as Array<{ base_currency: string }>;
      
      if (apiKeyResult.length > 0 && apiKeyResult[0].base_currency) {
        preferredCurrency = apiKeyResult[0].base_currency;
      }
    }

    // Calculate user's monthly transaction volume (in USD)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyVolumeResult = await sequelize.query(
      `SELECT COALESCE(SUM(ut.base_amount), 0) as volume
       FROM tbl_user_transaction ut
       ${company_id ? 'LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id' : ''}
       WHERE ut.user_id = :userId 
       AND ut.status = 'done'
       AND ut."createdAt" >= :startOfMonth
       ${company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : ''}`,
      {
        replacements: { userId, startOfMonth, companyId: company_id },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    const monthlyVolumeUSD = parseFloat(String(monthlyVolumeResult[0]?.volume || 0));
    
    // Get conversion rate if not USD
    if (preferredCurrency !== 'USD') {
      try {
        const conversions = await currencyConvert({
          sourceCurrency: 'USD',
          currency: [preferredCurrency],
          amount: 1,
          fixedDecimal: true,
        });
        if (conversions && conversions[0]?.amount) {
          conversionRate = Number(conversions[0].amount);
        }
      } catch (e) {
        console.warn(`[getFeeTiers] Currency conversion failed, using USD`);
        preferredCurrency = 'USD';
      }
    }
    
    const userTierInfo = getFeeTier(monthlyVolumeUSD, preferredCurrency, conversionRate);
    const currencySymbol = getCurrencySymbol(preferredCurrency);

    // Build tiers with indicator for current tier (show thresholds in preferred currency)
    const tiersWithStatus = FEE_TIERS.map(tier => ({
      name: tier.name,
      min_volume: Math.round(tier.min * conversionRate),
      max_volume: tier.max === Infinity ? null : Math.round(tier.max * conversionRate),
      min_volume_formatted: `${currencySymbol}${Math.round(tier.min * conversionRate).toLocaleString()}`,
      max_volume_formatted: tier.max === Infinity ? 'Unlimited' : `${currencySymbol}${Math.round(tier.max * conversionRate).toLocaleString()}`,
      description: tier.description,
      is_current: tier.name === userTierInfo.current_tier,
    }));

    return successResponseHelper(res, 200, "Fee tiers retrieved successfully", {
      tiers: tiersWithStatus,
      currency: preferredCurrency,
      user_tier: {
        current_tier: userTierInfo.current_tier,
        tier_description: userTierInfo.tier_description,
        monthly_volume: userTierInfo.monthly_volume,
        monthly_volume_formatted: `${currencySymbol}${userTierInfo.monthly_volume.toLocaleString()} ${preferredCurrency}`,
        percent_to_next_tier: userTierInfo.percent_complete,
        amount_to_next_tier: userTierInfo.amount_to_next_tier,
        amount_to_next_tier_formatted: userTierInfo.amount_to_next_tier_formatted,
        next_tier: userTierInfo.next_tier,
      },
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
