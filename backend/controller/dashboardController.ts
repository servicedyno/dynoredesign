import express from "express";
import jwt from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../helper";
import { IUserType } from "../utils/types";
import { userTransactionModel, userWalletModel, companyModel } from "../models";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";
import sequelize from "../utils/dbInstance";
import { getRedisItem, setRedisItem, setRedisTTL } from "../utils/redisInstance";
import { getCurrencySymbol, getCurrencyInfo, formatAmountForDisplay, COMPANY_CURRENCY_QUERY, convertToFiat, getCompanyBaseCurrency } from "../utils/currencyUtils";

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
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
    }
    
    // Get company's preferred currency
    let preferredCurrency = "USD";
    if (company_id) {
      preferredCurrency = await getCompanyBaseCurrency(company_id as string);
      if (preferredCurrency !== 'USD') {
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
        const result = await convertToFiat('USD', preferredCurrency, 1);
        
        if (result.amount) {
          conversionRate = result.amount;
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
        amount_formatted: formatAmountForDisplay(Math.round(totalVolume * 100) / 100, preferredCurrency).display_value,
        current_month: Math.round(currentVolume * 100) / 100,
        current_month_formatted: formatAmountForDisplay(Math.round(currentVolume * 100) / 100, preferredCurrency).display_value,
        currency: preferredCurrency,
        currency_info: getCurrencyInfo(preferredCurrency),
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
      preferredCurrency = await getCompanyBaseCurrency(company_id as string);
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
        const result = await convertToFiat('USD', preferredCurrency, 1);
        if (result.amount) {
          conversionRate = result.amount;
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

/**
 * Get all conversion records for the merchant (with optional status filter)
 * GET /api/dashboard/conversions
 * Query params: status (optional), company_id (required for scoping), limit (default 20)
 */
const getConversions = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const { status, company_id, limit = 20 } = req.query;
    const userId = userData.user_id;

    // Validate company ownership when company_id is provided
    if (company_id) {
      const company = await companyModel.findOne({
        where: { company_id, user_id: userId },
      });
      if (!company) {
        return errorResponseHelper(res, 403, "You don't have access to this company's conversions");
      }
    }

    let whereClause = `sc.user_id = :userId`;
    const replacements: Record<string, unknown> = { userId, limit: parseInt(limit as string) };

    if (company_id) {
      whereClause += ` AND sc.company_id = :companyId`;
      replacements.companyId = company_id;
    }
    if (status) {
      whereClause += ` AND sc.status = :status`;
      replacements.status = status;
    }

    const conversions = await sequelize.query(
      `SELECT 
        sc.conversion_id,
        sc.transaction_id,
        sc.company_id,
        co.company_name,
        sc.source_currency,
        sc.source_amount,
        sc.source_amount_usd,
        sc.target_currency,
        sc.target_amount,
        sc.settlement_wallet_address,
        sc.settlement_chain,
        sc.deposit_tx_hash,
        sc.binance_order_id,
        sc.conversion_rate,
        sc.conversion_fee,
        sc.sweep_fee_usd,
        sc.trade_fee_usd,
        sc.withdrawal_fee,
        sc.withdrawal_tx_hash,
        sc.withdrawal_id,
        sc.merchant_payout_usd,
        sc.locked_merchant_usd,
        sc.actual_sale_usd,
        sc.platform_surplus,
        sc.price_movement_pct,
        sc.sell_method,
        sc.status,
        sc.error_message,
        sc.retry_count,
        sc."createdAt",
        sc.deposit_confirmed_at,
        sc.converted_at,
        sc.withdrawn_at,
        sc.completed_at
       FROM tbl_stablecoin_conversion sc
       LEFT JOIN tbl_company co ON sc.company_id = co.company_id
       WHERE ${whereClause}
       ORDER BY sc."createdAt" DESC
       LIMIT :limit`,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    // Count by status for summary
    const statusCounts = await sequelize.query(
      `SELECT sc.status, COUNT(*)::int as count
       FROM tbl_stablecoin_conversion sc
       WHERE sc.user_id = :userId ${company_id ? 'AND sc.company_id = :companyId' : ''}
       GROUP BY sc.status`,
      {
        replacements: { userId, companyId: company_id },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    const statusMap: Record<string, number> = {};
    statusCounts.forEach((s: Record<string, unknown>) => {
      statusMap[s.status as string] = s.count as number;
    });

    // Map each conversion to include its pipeline stage
    const DB_STATUS_TO_PIPELINE: Record<string, string> = {
      PENDING_DEPOSIT: "SWEEPING",
      DEPOSIT_CREDITED: "DEPOSITING",
      CONVERTING: "CONVERTING",
      CONVERTED: "CONVERTING",
      WITHDRAWING: "WITHDRAWING",
      COMPLETED: "COMPLETE",
      FAILED: "FAILED",
    };

    const enrichedConversions = conversions.map((c: Record<string, unknown>) => ({
      ...c,
      pipeline_stage: DB_STATUS_TO_PIPELINE[c.status as string] || c.status,
    }));

    return successResponseHelper(res, 200, "Conversions retrieved successfully", {
      conversions: enrichedConversions,
      count: enrichedConversions.length,
      status_summary: statusMap,
      pipeline_stages: ["DETECTED", "SWEEPING", "DEPOSITING", "CONVERTING", "WITHDRAWING", "COMPLETE"],
    });

  } catch (e) {
    const message = getErrorMessage(e);
    console.error("Conversions error:", message);
    return errorResponseHelper(res, 500, message);
  }
};

/**
 * Get single conversion with detailed timeline
 * GET /api/dashboard/conversions/:id
 * Query params: company_id (optional, for ownership validation)
 */
const getConversionDetail = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const { id } = req.params;
    const { company_id } = req.query;
    const userId = userData.user_id;

    // Validate company ownership when company_id is provided
    if (company_id) {
      const company = await companyModel.findOne({
        where: { company_id, user_id: userId },
      });
      if (!company) {
        return errorResponseHelper(res, 403, "You don't have access to this company's conversions");
      }
    }

    let detailWhere = `sc.conversion_id = :id AND sc.user_id = :userId`;
    const detailReplacements: Record<string, unknown> = { id, userId };
    if (company_id) {
      detailWhere += ` AND sc.company_id = :companyId`;
      detailReplacements.companyId = company_id;
    }

    const conversions = await sequelize.query(
      `SELECT sc.*, co.company_name
       FROM tbl_stablecoin_conversion sc
       LEFT JOIN tbl_company co ON sc.company_id = co.company_id
       WHERE ${detailWhere}`,
      {
        replacements: detailReplacements,
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    if (conversions.length === 0) {
      return errorResponseHelper(res, 404, "Conversion not found");
    }

    const conversion = conversions[0];

    // Build timeline: Detected → Sweeping → Depositing → Converting → Withdrawing → Complete
    // Maps DB statuses to user-facing pipeline stages
    const STAGES = [
      { key: "DETECTED",    label: "Detected",    dbStatus: "PENDING_DEPOSIT",  field: "createdAt" },
      { key: "SWEEPING",    label: "Sweeping",    dbStatus: "PENDING_DEPOSIT",  field: "createdAt" },
      { key: "DEPOSITING",  label: "Depositing",  dbStatus: "DEPOSIT_CREDITED", field: "deposit_confirmed_at" },
      { key: "CONVERTING",  label: "Converting",  dbStatus: "CONVERTED",        field: "converted_at" },
      { key: "WITHDRAWING", label: "Withdrawing", dbStatus: "WITHDRAWING",      field: "withdrawn_at" },
      { key: "COMPLETE",    label: "Complete",     dbStatus: "COMPLETED",        field: "completed_at" },
    ];

    // Map DB status to pipeline index
    const DB_STATUS_TO_STAGE: Record<string, number> = {
      PENDING_DEPOSIT:  1, // Sweeping (detected + sweep already happened to create record)
      DEPOSIT_CREDITED: 2, // Depositing confirmed, ready for conversion
      CONVERTING:       3, // Converting on exchange
      CONVERTED:        3, // Conversion done, same stage
      WITHDRAWING:      4, // Withdrawing to merchant
      COMPLETED:        5, // Complete
    };
    const currentIdx = DB_STATUS_TO_STAGE[conversion.status as string] ?? -1;

    const timeline = STAGES.map((stage, idx) => ({
      stage: stage.key,
      label: stage.label,
      timestamp: conversion[stage.field] || null,
      completed: idx <= currentIdx && conversion.status !== "FAILED",
      active: idx === currentIdx && conversion.status !== "FAILED",
    }));

    // Fee breakdown
    const feeBreakdown = {
      platform_fee_usd: parseFloat(String(conversion.conversion_fee || "0")),
      sweep_gas_fee_usd: parseFloat(String(conversion.sweep_fee_usd || "0")),
      trade_fee_usd: parseFloat(String(conversion.trade_fee_usd || "0")),
      withdrawal_fee_usd: parseFloat(String(conversion.withdrawal_fee || "0")),
      gross_sale_usd: parseFloat(String(conversion.actual_sale_usd || "0")),
      net_payout_usd: parseFloat(String(conversion.merchant_payout_usd || "0")),
    };

    return successResponseHelper(res, 200, "Conversion detail retrieved", {
      conversion,
      timeline,
      fee_breakdown: feeBreakdown,
      is_failed: conversion.status === "FAILED",
      is_complete: conversion.status === "COMPLETED",
    });

  } catch (e) {
    const message = getErrorMessage(e);
    console.error("Conversion detail error:", message);
    return errorResponseHelper(res, 500, message);
  }
};

export default {
  getDashboard,
  getChartData,
  getFeeTiers,
  getRecentTransactions,
  getConversions,
  getConversionDetail,
};
