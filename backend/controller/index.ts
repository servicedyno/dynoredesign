import {
  feesModel,
} from "../models";
import { getRedisItem, setRedisItem } from "../utils/redisInstance";
import { log } from "../utils/loggers";
import apiController from "./apiController";
import companyController from "./companyController";
import paymentController from "./paymentController";
import userController from "./userController";
import walletController from "./walletController";
import taxController from "./taxController";
import dashboardController from "./dashboardController";
import notificationController, { createNotification, NOTIFICATION_TYPES } from "./notificationController";
import subscriptionController from "./subscriptionController";
import { getBlockchainThreshold, getTransactionFeePercent, getFeeTiers } from "../utils/feeConfigUtils";
import User from "../models/userModels/userModel";

export const getTransactionFee = async () => {
  const envFee = getTransactionFeePercent();
  if (envFee) return envFee;

  const admin_fee = await getRedisItem("admin_fee");
  let transaction_fee;
  if (!admin_fee?.transaction_fee) {
    const { fee } = await (
      await feesModel.findOne({
        where: {
          feeType: "TRANSACTION_FEE",
        },
      })
    ).dataValues;
    transaction_fee = fee;
    await setRedisItem("admin_fee", { transaction_fee });
  } else {
    transaction_fee = admin_fee?.transaction_fee;
  }
  return transaction_fee;
};

/**
 * Get transaction fee with user's referral discount applied
 * @param userId - User ID to check for discount
 * @returns Object with original fee, discount info, and final fee
 */
export const getDiscountedTransactionFee = async (userId: number) => {
  const baseFee = await getTransactionFee();
  
  // Get user's discount status
  const user = await User.findByPk(userId, {
    attributes: ['fee_discount_percent', 'fee_discount_expires_at', 'fee_discount_reason'],
  });

  if (!user) {
    return {
      base_fee: baseFee,
      discount_percent: 0,
      discount_reason: null,
      final_fee: baseFee,
      discount_expires_at: null,
    };
  }

  const discountPercent = Number((user as { fee_discount_percent?: number }).fee_discount_percent) || 0;
  const expiresAt = (user as { fee_discount_expires_at?: Date }).fee_discount_expires_at;
  const reason = (user as { fee_discount_reason?: string }).fee_discount_reason;

  // Check if discount is still active
  const isActive = expiresAt && new Date() < expiresAt && discountPercent > 0;

  if (!isActive) {
    return {
      base_fee: baseFee,
      discount_percent: 0,
      discount_reason: null,
      final_fee: baseFee,
      discount_expires_at: null,
    };
  }

  // Calculate discounted fee
  const discountAmount = (Number(baseFee) * discountPercent) / 100;
  const finalFee = Math.max(0, Number(baseFee) - discountAmount);

  return {
    base_fee: baseFee,
    discount_percent: discountPercent,
    discount_reason: reason,
    final_fee: parseFloat(finalFee.toFixed(2)),
    discount_expires_at: expiresAt,
  };
};

export const getBlockchainFee = async () => {
  const admin_fee = await getRedisItem("admin_fee");
  let blockchain_fee;
  if (!admin_fee?.blockchain_fee) {
    const { fee } = await (
      await feesModel.findOne({
        where: {
          feeType: "BLOCKCHAIN_FEE",
        },
      })
    ).dataValues;
    blockchain_fee = fee;
    await setRedisItem("admin_fee", { blockchain_fee });
  } else {
    blockchain_fee = admin_fee?.blockchain_fee;
  }
  return blockchain_fee;
};

export const getBlockchainConfig = async (blockchain: string) => {
  const threshold = getBlockchainThreshold(blockchain);
  const tiers = getFeeTiers();

  if (threshold !== undefined && tiers.length > 0) {
    return {
      blockchain,
      min_forwarding_amount: threshold,
      transaction_fee_percent: getTransactionFeePercent(),
      tiers: tiers.map(t => ({
        min_amount: t.min,
        max_amount: t.max,
        fixed_fee: t.fixed,
      }))
    };
  }
};

export const calculateTransactionFees = async (
  blockchain: string,
  amount: number
) => {
  const config = await getBlockchainConfig(blockchain);
  if (!config) {
    throw new Error(`Blockchain ${blockchain} configuration not found`);
  }

  // Find the matching tier based on amount
  interface FeeTier {
    min_amount: number;
    max_amount: number | null;
    fixed_fee: number;
    id?: number;
  }
  const tiers = (config.tiers || []) as FeeTier[];
  const matchingTier = tiers.find(
    (tier: FeeTier) =>
      amount >= tier.min_amount &&
      (tier.max_amount === null || amount <= tier.max_amount)
  );

  // Fallback: if amount is below the lowest tier, use the lowest tier
  // This handles edge cases like very small payments ($1-$4) that fall below tier minimums
  const effectiveTier = matchingTier || (() => {
    const sortedTiers = [...tiers].sort((a: FeeTier, b: FeeTier) => a.min_amount - b.min_amount);
    if (sortedTiers[0] && amount > 0) {
      console.warn(`[calculateTransactionFees] No exact tier for amount ${amount}, using lowest tier (min=${sortedTiers[0].min_amount})`);
      return sortedTiers[0];
    }
    return null;
  })();

  if (!effectiveTier) {
    throw new Error(`No fee tier found for amount ${amount}`);
  }

  // Calculate fees: platform % + tier fixed fee
  const fixedFee = effectiveTier.fixed_fee;
  const transactionFee = (amount * config.transaction_fee_percent) / 100;

  const totalDeduction = fixedFee + transactionFee;
  const userReceives = amount - totalDeduction;

  return {
    fixedFee,
    transactionFee,
    totalDeduction,
    userReceives,
    tierId: effectiveTier.id ?? 0,
    minForwarding: config.min_forwarding_amount,
  };
};

/**
 * Calculate transaction fees with user's referral discount applied
 */
export const calculateTransactionFeesWithDiscount = async (
  blockchain: string,
  amount: number,
  userId: number
) => {
  const config = await getBlockchainConfig(blockchain);
  if (!config) {
    throw new Error(`Blockchain ${blockchain} configuration not found`);
  }

  // Find the matching tier based on amount
  interface FeeTierDiscount {
    min_amount: number;
    max_amount: number | null;
    fixed_fee: number;
    id?: number;
  }
  const tiers = (config.tiers || []) as FeeTierDiscount[];
  const matchingTierDiscount = tiers.find(
    (tier: FeeTierDiscount) =>
      amount >= tier.min_amount &&
      (tier.max_amount === null || amount <= tier.max_amount)
  );

  // Fallback: if amount is below the lowest tier, use the lowest tier
  const effectiveTierDiscount = matchingTierDiscount || (() => {
    const sortedTiers = [...tiers].sort((a: FeeTierDiscount, b: FeeTierDiscount) => a.min_amount - b.min_amount);
    if (sortedTiers[0] && amount > 0) {
      console.warn(`[calculateTransactionFeesWithDiscount] No exact tier for amount ${amount}, using lowest tier (min=${sortedTiers[0].min_amount})`);
      return sortedTiers[0];
    }
    return null;
  })();

  if (!effectiveTierDiscount) {
    throw new Error(`No fee tier found for amount ${amount}`);
  }

  // Get user's discount
  const discountInfo = await getDiscountedTransactionFee(userId);
  const discountPercent = discountInfo.discount_percent || 0;

  // Calculate fees: platform % + tier fixed fee
  const fixedFee = effectiveTierDiscount.fixed_fee;
  const baseTransactionFeePercent = config.transaction_fee_percent;
  
  // Apply discount to transaction fee percentage
  const discountedFeePercent = discountPercent > 0 
    ? baseTransactionFeePercent * (1 - discountPercent / 100)
    : baseTransactionFeePercent;
  
  const transactionFee = (amount * discountedFeePercent) / 100;

  const totalDeduction = fixedFee + transactionFee;
  const userReceives = amount - totalDeduction;

  return {
    fixedFee,
    transactionFee,
    transactionFeeOriginal: (amount * baseTransactionFeePercent) / 100,
    totalDeduction,
    userReceives,
    tierId: effectiveTierDiscount.id ?? 0,
    minForwarding: config.min_forwarding_amount,
    // Discount info
    discountApplied: discountPercent > 0,
    discountPercent,
    discountReason: discountInfo.discount_reason,
    discountExpiresAt: discountInfo.discount_expires_at,
    savings: discountPercent > 0 
      ? (amount * baseTransactionFeePercent / 100) - transactionFee
      : 0,
  };
};

export {
  userController,
  companyController,
  paymentController,
  walletController,
  apiController,
  taxController,
  dashboardController,
  notificationController,
  subscriptionController,
  createNotification,
  NOTIFICATION_TYPES,
};
