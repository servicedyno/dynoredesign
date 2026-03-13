/**
 * Fee-Free Trial Service
 * 
 * Manages the "First $500 Fee-Free" promotion for new merchants.
 * 
 * Key features:
 * - Track cumulative transaction volume per company
 * - Calculate fee-free remaining balance
 * - Atomic decrement to prevent race conditions
 * - Fee override: waive or reduce fees while balance remains
 */

import { Op } from "sequelize";
import sequelize from "../utils/dbInstance";
import { companyModel } from "../models";
import { log } from "../utils/loggers";

const FREE_TRIAL_VOLUME_USD = parseFloat(process.env.FREE_TRIAL_VOLUME_USD || "500");

export interface FeeFreeStatus {
  company_id: number;
  cumulative_volume_usd: number;
  fee_free_remaining_usd: number;
  fee_free_total_usd: number;
  fee_free_used_usd: number;
  fee_tier: string;
  is_fee_free: boolean;
  percentage_used: number;
}

/**
 * Get the fee-free status for a company
 */
export const getFeeFreeStatus = async (companyId: number): Promise<FeeFreeStatus | null> => {
  try {
    const company = await companyModel.findByPk(companyId, {
      attributes: ["company_id", "cumulative_volume_usd", "fee_free_remaining_usd", "fee_tier"],
    });

    if (!company) return null;

    const data = company.get({ plain: true }) as any;
    const remaining = parseFloat(data.fee_free_remaining_usd || "0");
    const cumulative = parseFloat(data.cumulative_volume_usd || "0");
    const used = FREE_TRIAL_VOLUME_USD - remaining;

    return {
      company_id: data.company_id,
      cumulative_volume_usd: cumulative,
      fee_free_remaining_usd: Math.max(0, remaining),
      fee_free_total_usd: FREE_TRIAL_VOLUME_USD,
      fee_free_used_usd: Math.min(used, FREE_TRIAL_VOLUME_USD),
      fee_tier: data.fee_tier || "trial",
      is_fee_free: remaining > 0,
      percentage_used: Math.min(100, (used / FREE_TRIAL_VOLUME_USD) * 100),
    };
  } catch (error: any) {
    log(`[FeeFree] Error getting fee-free status for company ${companyId}: ${error.message}`, "error");
    return null;
  }
};

/**
 * Calculate the fee-free discount for a transaction.
 * Returns the portion of the transaction that should be fee-free.
 * 
 * @param companyId - The company making the transaction
 * @param transactionAmountUsd - The transaction amount in USD
 * @returns Object with fee_free_amount (portion that's free) and fee_applicable_amount (portion with fees)
 */
export const calculateFeeFreeDiscount = async (
  companyId: number,
  transactionAmountUsd: number
): Promise<{
  fee_free_amount: number;
  fee_applicable_amount: number;
  is_fully_free: boolean;
  remaining_after: number;
}> => {
  try {
    const status = await getFeeFreeStatus(companyId);

    if (!status || !status.is_fee_free || status.fee_free_remaining_usd <= 0) {
      return {
        fee_free_amount: 0,
        fee_applicable_amount: transactionAmountUsd,
        is_fully_free: false,
        remaining_after: 0,
      };
    }

    const remaining = status.fee_free_remaining_usd;

    if (transactionAmountUsd <= remaining) {
      // Entire transaction is fee-free
      return {
        fee_free_amount: transactionAmountUsd,
        fee_applicable_amount: 0,
        is_fully_free: true,
        remaining_after: remaining - transactionAmountUsd,
      };
    } else {
      // Partial fee-free: some portion free, rest charged
      return {
        fee_free_amount: remaining,
        fee_applicable_amount: transactionAmountUsd - remaining,
        is_fully_free: false,
        remaining_after: 0,
      };
    }
  } catch (error: any) {
    log(`[FeeFree] Error calculating discount for company ${companyId}: ${error.message}`, "error");
    return {
      fee_free_amount: 0,
      fee_applicable_amount: transactionAmountUsd,
      is_fully_free: false,
      remaining_after: 0,
    };
  }
};

/**
 * Record a transaction and decrement the fee-free balance.
 * Uses atomic DB operation to prevent race conditions.
 * 
 * @param companyId - The company
 * @param amountUsd - Transaction amount in USD
 * @returns Updated fee-free status
 */
export const recordTransactionVolume = async (
  companyId: number,
  amountUsd: number
): Promise<FeeFreeStatus | null> => {
  const t = await sequelize.transaction();

  try {
    // Atomic update: increment volume, decrement remaining
    await companyModel.update(
      {
        cumulative_volume_usd: sequelize.literal(`COALESCE("cumulative_volume_usd", 0) + ${amountUsd}`),
        fee_free_remaining_usd: sequelize.literal(
          `GREATEST(0, COALESCE("fee_free_remaining_usd", 0) - ${amountUsd})`
        ),
      },
      {
        where: { company_id: companyId },
        transaction: t,
      }
    );

    // Check if fee-free period just ended
    const updated = await companyModel.findByPk(companyId, {
      attributes: ["fee_free_remaining_usd", "fee_tier"],
      transaction: t,
    });

    if (updated) {
      const remaining = parseFloat((updated as any).fee_free_remaining_usd || "0");
      const currentTier = (updated as any).fee_tier;

      // Transition from trial to standard when free balance is exhausted
      if (remaining <= 0 && currentTier === "trial") {
        await companyModel.update(
          { fee_tier: "standard" },
          { where: { company_id: companyId }, transaction: t }
        );
        log(`[FeeFree] Company ${companyId} exhausted fee-free balance. Tier: trial → standard`, "info");
      }
    }

    await t.commit();

    log(`[FeeFree] Company ${companyId} recorded $${amountUsd} volume`, "info");
    return getFeeFreeStatus(companyId);
  } catch (error: any) {
    await t.rollback();
    log(`[FeeFree] Error recording volume for company ${companyId}: ${error.message}`, "error");
    return null;
  }
};

export default {
  getFeeFreeStatus,
  calculateFeeFreeDiscount,
  recordTransactionVolume,
};
