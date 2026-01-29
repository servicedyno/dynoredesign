/**
 * Merchant Pool Service
 * 
 * Manages per-merchant pool of reusable addresses for ALL crypto payments.
 * Key features:
 * - Per-merchant xpub/mnemonic for each chain
 * - Address reuse to accumulate admin fees
 * - Lazy initialization (xpub generated on first use)
 * - Gas funding management
 * - Automatic sweeping when threshold is reached
 */

import { Op, Transaction } from "sequelize";
import {
  merchantWalletModel,
  merchantTempAddressModel,
  merchantPoolTransactionModel,
  merchantPoolSweepModel,
  MERCHANT_POOL_CRYPTO_TYPES,
  CHAIN_XPUB_MAPPING,
  UTXO_CHAINS as MODEL_UTXO_CHAINS,
  ACCOUNT_CHAINS,
  TOKEN_CHAINS as MODEL_TOKEN_CHAINS,
  GAS_TOKEN_MAPPING,
} from "../models";
import tatumApi from "../apis/tatumApi";
import sequelize from "../utils/dbInstance";
import { cronLogger } from "../utils/loggers";
import { currencyConvert, getErrorMessage } from "../helper";

// Configuration
const POOL_CONFIG = {
  INITIAL_SIZE: parseInt(process.env.MERCHANT_POOL_INITIAL_SIZE || "2"),
  
  // Timeout settings
  RESERVATION_TIMEOUT_MINUTES: 30,
  PROCESSING_TIMEOUT_MINUTES: 60,
  STALE_LOCK_TIMEOUT_MINUTES: 120,
  
  // Gas funding amounts
  TRX_GAS_AMOUNT: 60,
  TRX_GAS_MIN_DEFICIT: 10,
  ETH_GAS_AMOUNT: 0.004,
  ETH_GAS_MIN_DEFICIT: 0.001,
};

// UTXO chains that support batch transfers (merchant + admin in one transaction)
const UTXO_CHAINS = MODEL_UTXO_CHAINS || ["BTC", "LTC", "DOGE", "BCH"];

// Native currencies that can use both threshold and time-based sweep
const NATIVE_CURRENCIES = ["TRX", "ETH"];

// Tokens that can only use threshold-based sweep (not time-based)
const TOKEN_CHAINS = MODEL_TOKEN_CHAINS || ["USDT-TRC20", "USDT-ERC20", "USDC-ERC20"];

/**
 * Parse per-chain sweep configuration from environment
 * Format: CHAIN_SWEEP=mode:value
 * Example: ETH_SWEEP=threshold:30 or TRX_SWEEP=time:10
 */
interface SweepConfig {
  mode: "threshold" | "time" | "batch";
  value?: number;
}

const parseSweepConfig = (walletType: string): SweepConfig => {
  // UTXO chains always use batch transfer
  if (UTXO_CHAINS.includes(walletType)) {
    return { mode: "batch" };
  }

  // Get config from environment (e.g., TRX_SWEEP, USDT_TRC20_SWEEP)
  const envKey = `${walletType.replace(/-/g, "_")}_SWEEP`;
  const configValue = process.env[envKey];

  if (!configValue) {
    // Default: threshold:30 for all non-UTXO chains
    console.warn(`[MerchantPool] No sweep config for ${walletType}, using default: threshold:30`);
    return { mode: "threshold", value: 30 };
  }

  const [mode, valueStr] = configValue.split(":");

  if (mode !== "threshold" && mode !== "time") {
    console.error(`[MerchantPool] Invalid sweep mode for ${walletType}: ${mode}. Using threshold:30`);
    return { mode: "threshold", value: 30 };
  }

  // Validate tokens can only use threshold mode
  if (TOKEN_CHAINS.includes(walletType) && mode === "time") {
    console.error(`[MerchantPool] Tokens cannot use time-based sweep! ${walletType} must use threshold. Using threshold:30`);
    return { mode: "threshold", value: 30 };
  }

  const value = valueStr ? parseInt(valueStr) : (mode === "threshold" ? 30 : 10);

  if (isNaN(value) || value <= 0) {
    console.error(`[MerchantPool] Invalid sweep value for ${walletType}: ${valueStr}. Using default.`);
    return { mode, value: mode === "threshold" ? 30 : 10 };
  }

  return { mode, value };
};

/**
 * Get sweep configuration for a wallet type
 */
export const getSweepConfig = (walletType: string): SweepConfig => {
  return parseSweepConfig(walletType);
};

// Fee wallet addresses (for gas funding)
const FEE_WALLETS = {
  TRX: process.env.TRX_FEE_WALLET || "",
  ETH: process.env.ETH_FEE_WALLET || "",
};

// Admin wallets for sweeping
const ADMIN_WALLETS: Record<string, string> = {
  "BTC": process.env.BTC || "",
  "ETH": process.env.ETH || "",
  "LTC": process.env.LTC || "",
  "DOGE": process.env.DOGE || "",
  "TRX": process.env.TRX || "",
  "BCH": process.env.BCH || "",
  "USDT-TRC20": process.env.USDT_TRC20_ADMIN_WALLET || process.env.USDT_TRC20 || "",
  "USDT-ERC20": process.env.USDT_ERC20_ADMIN_WALLET || process.env.USDT_ERC20 || "",
  "USDC-ERC20": process.env.USDC_ERC20 || "",
};

// Token contract addresses
const TOKEN_CONTRACTS: Record<string, string> = {
  "USDT-TRC20": process.env.TRX_CONTRACT || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  "USDT-ERC20": process.env.ETH_CONTRACT || "0xdac17f958d2ee523a2206206994597c13d831ec7",
  "USDC-ERC20": process.env.USDC_CONTRACT || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
};

/**
 * Get or create merchant's xpub/mnemonic for a chain
 * Lazy initialization - only generates when first needed
 */
export const getOrCreateMerchantWallet = async (
  userId: number,
  walletType: string
): Promise<{ xpub: string; mnemonic: string }> => {
  // Get base chain type (tokens use parent chain)
  const baseChain = CHAIN_XPUB_MAPPING[walletType] || walletType;
  
  // Check if merchant already has wallet for this chain
  let merchantWallet = await merchantWalletModel.findOne({
    where: {
      user_id: userId,
      wallet_type: baseChain,
    },
  });

  if (merchantWallet) {
    // Decrypt and return existing
    const decryptedData = await tatumApi.decryptSymmetric(
      merchantWallet.dataValues.mnemonic,
      process.env.XPUB_KEY_ID
    );
    const walletData = JSON.parse(decryptedData);
    return {
      xpub: merchantWallet.dataValues.xpub,
      mnemonic: walletData.mnemonic,
    };
  }

  // Generate new wallet for this chain
  console.log(`[MerchantPool] Generating new ${baseChain} wallet for merchant ${userId}...`);
  
  const walletData = await tatumApi.generateWallet(baseChain);
  
  if (!walletData || !walletData.xpub || !walletData.mnemonic) {
    throw new Error(`Failed to generate ${baseChain} wallet for merchant ${userId}`);
  }

  // Encrypt mnemonic (store both xpub and mnemonic for future reference)
  const encryptedMnemonic = await tatumApi.encryptSymmetric(
    JSON.stringify({ xpub: walletData.xpub, mnemonic: walletData.mnemonic }),
    process.env.XPUB_KEY_ID
  );

  // Store in database
  merchantWallet = await merchantWalletModel.create({
    user_id: userId,
    wallet_type: baseChain,
    xpub: walletData.xpub,
    mnemonic: encryptedMnemonic,
    last_derivation_index: 0,
  });

  console.log(`[MerchantPool] ✅ Created ${baseChain} wallet for merchant ${userId}`);

  return {
    xpub: walletData.xpub,
    mnemonic: walletData.mnemonic,
  };
};

/**
 * Get next derivation index for merchant's wallet
 */
const getNextDerivationIndex = async (
  userId: number,
  walletType: string,
  transaction?: Transaction
): Promise<number> => {
  const baseChain = CHAIN_XPUB_MAPPING[walletType] || walletType;
  
  const merchantWallet = await merchantWalletModel.findOne({
    where: {
      user_id: userId,
      wallet_type: baseChain,
    },
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
    transaction,
  });

  if (!merchantWallet) {
    throw new Error(`Merchant wallet not found for user ${userId}, chain ${baseChain}`);
  }

  const nextIndex = (merchantWallet.dataValues.last_derivation_index || 0) + 1;

  await merchantWallet.update(
    { last_derivation_index: nextIndex },
    { transaction }
  );

  return nextIndex;
};

/**
 * Add a new address to merchant's pool
 */
export const addAddressToMerchantPool = async (
  userId: number,
  walletType: string,
  transaction?: Transaction
): Promise<any> => {
  try {
    // Get or create merchant's wallet
    const { xpub, mnemonic } = await getOrCreateMerchantWallet(userId, walletType);
    
    // Get next derivation index
    const derivationIndex = await getNextDerivationIndex(userId, walletType, transaction);
    
    // Generate address and private key using existing tatumApi function
    // Note: For tokens, we use the base chain but pass the actual wallet type for correct handling
    const addressData = await tatumApi.generateUserAddress({
      currency: walletType,  // Pass actual type (e.g., USDT-ERC20) for correct handling
      xpub,
      mnemonic,
      index: derivationIndex,
    });

    if (!addressData || !addressData.address) {
      throw new Error(`Failed to generate address for ${walletType} at index ${derivationIndex}`);
    }

    // Encrypt private key
    const encryptedPrivateKey = await tatumApi.encryptSymmetric(
      addressData.privateKey,
      process.env.TEMP_KEY_ID
    );

    // Create Tatum subscription for webhook
    let subscriptionId = null;
    try {
      const subResult = await tatumApi.createSubscription(
        addressData.address,
        walletType,
        true  // onlyCrypto = true
      );
      subscriptionId = subResult?.id;
    } catch (subError) {
      console.error(`[MerchantPool] Warning: Failed to create subscription for ${addressData.address}:`, subError);
    }

    // Create pool address record
    const poolAddress = await merchantTempAddressModel.create(
      {
        owner_user_id: userId,
        wallet_type: walletType,
        wallet_address: addressData.address,
        private_key: encryptedPrivateKey,
        derivation_index: derivationIndex,
        subscription_id: subscriptionId,
        status: "AVAILABLE",
        admin_fee_balance: 0,
        gas_balance: 0,
        total_transactions: 0,
      },
      { transaction }
    );

    console.log(`[MerchantPool] ✅ Added ${walletType} address to merchant ${userId}'s pool: ${addressData.address}`);

    return poolAddress;
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[MerchantPool] ❌ Failed to add address to pool:`, message);
    throw error;
  }
};

/**
 * Initialize merchant's pool for a specific wallet type
 * Called when merchant configures a wallet for a chain
 */
export const initializeMerchantPool = async (
  userId: number,
  walletType: string
): Promise<void> => {
  const transaction = await sequelize.transaction();

  try {
    // Check if pool already exists for this merchant and type
    const existingCount = await merchantTempAddressModel.count({
      where: {
        owner_user_id: userId,
        wallet_type: walletType,
      },
      transaction,
    });

    if (existingCount >= POOL_CONFIG.INITIAL_SIZE) {
      console.log(`[MerchantPool] Pool already exists for merchant ${userId}, type ${walletType}`);
      await transaction.commit();
      return;
    }

    // Create initial pool addresses
    const toCreate = POOL_CONFIG.INITIAL_SIZE - existingCount;
    console.log(`[MerchantPool] Creating ${toCreate} ${walletType} addresses for merchant ${userId}...`);

    for (let i = 0; i < toCreate; i++) {
      await addAddressToMerchantPool(userId, walletType, transaction);
    }

    await transaction.commit();
    console.log(`[MerchantPool] ✅ Initialized ${walletType} pool for merchant ${userId}`);
  } catch (error) {
    await transaction.rollback();
    const message = getErrorMessage(error);
    console.error(`[MerchantPool] ❌ Failed to initialize pool:`, message);
    throw error;
  }
};

/**
 * Reserve an address from merchant's pool for a payment
 */
export const reserveAddress = async (
  walletType: string,
  paymentId: string,
  userId: number,
  companyId: number,
  expectedAmount: number
): Promise<any> => {
  const transaction = await sequelize.transaction();

  try {
    // First, release any expired reservations
    await releaseExpiredReservations(userId, walletType, transaction);

    // Find available address from merchant's pool
    // Priority: most active first, then highest balance (for threshold-based sweeps like USDT/USDC)
    let poolAddress = await merchantTempAddressModel.findOne({
      where: {
        owner_user_id: userId,
        wallet_type: walletType,
        status: "AVAILABLE",
      },
      order: [
        ["total_transactions", "DESC"],
        ["admin_fee_balance", "DESC"],
      ],
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    // If no address available, create new one
    if (!poolAddress) {
      console.log(`[MerchantPool] No available ${walletType} address for merchant ${userId}, creating new...`);
      poolAddress = await addAddressToMerchantPool(userId, walletType, transaction);
    }

    // Ensure Tatum subscription exists for webhook notifications
    // This is critical for receiving payment notifications
    let subscriptionId = poolAddress.dataValues.subscription_id;
    try {
      const subResult = await tatumApi.createSubscription(
        poolAddress.dataValues.wallet_address,
        walletType,
        true  // onlyCrypto = true for payment webhooks
      );
      subscriptionId = subResult?.id || subscriptionId;
      console.log(`[MerchantPool] ✅ Subscription ensured for ${poolAddress.dataValues.wallet_address}: ${subscriptionId}`);
    } catch (subError) {
      console.error(`[MerchantPool] ⚠️ Failed to ensure subscription for ${poolAddress.dataValues.wallet_address}:`, subError);
      // Continue anyway - payment can still be processed manually via webhook retry
    }

    // Reserve the address
    const reservedUntil = new Date();
    reservedUntil.setMinutes(reservedUntil.getMinutes() + POOL_CONFIG.RESERVATION_TIMEOUT_MINUTES);

    await poolAddress.update(
      {
        status: "RESERVED",
        current_payment_id: paymentId,
        current_company_id: companyId,
        expected_amount: expectedAmount,
        received_amount: 0,
        is_partial_payment: false,
        partial_payment_timestamp: null,
        reserved_until: reservedUntil,
        locked_at: new Date(),
        subscription_id: subscriptionId,  // Update subscription ID
      },
      { transaction }
    );

    await transaction.commit();

    console.log(`[MerchantPool] ✅ Reserved ${walletType} address for payment ${paymentId}`);
    console.log(`[MerchantPool]    - Merchant: ${userId}`);
    console.log(`[MerchantPool]    - Company: ${companyId}`);
    console.log(`[MerchantPool]    - Address: ${poolAddress.dataValues.wallet_address}`);
    console.log(`[MerchantPool]    - Expected: ${expectedAmount} ${walletType}`);
    console.log(`[MerchantPool]    - Reserved until: ${reservedUntil}`);
    console.log(`[MerchantPool]    - Subscription: ${subscriptionId}`);

    return poolAddress;
  } catch (error) {
    await transaction.rollback();
    const message = getErrorMessage(error);
    console.error(`[MerchantPool] ❌ Failed to reserve address:`, message);
    throw error;
  }
};

/**
 * Get an available address from merchant's pool (for checking only, no reservation)
 */
export const getAvailableAddress = async (
  userId: number,
  walletType: string
): Promise<any | null> => {
  return await merchantTempAddressModel.findOne({
    where: {
      owner_user_id: userId,
      wallet_type: walletType,
      status: "AVAILABLE",
    },
    order: [
      ["admin_fee_balance", "DESC"],
      ["total_transactions", "DESC"],
    ],
  });
};

/**
 * Mark payment as received (status: PROCESSING)
 */
export const markPaymentReceived = async (
  tempAddressId: number,
  receivedAmount: number,
  incomingTxId: string
): Promise<void> => {
  const processingTimeout = new Date();
  processingTimeout.setMinutes(processingTimeout.getMinutes() + POOL_CONFIG.PROCESSING_TIMEOUT_MINUTES);

  await merchantTempAddressModel.update(
    {
      status: "PROCESSING",
      received_amount: receivedAmount,
      reserved_until: processingTimeout,
    },
    { where: { temp_address_id: tempAddressId } }
  );

  console.log(`[MerchantPool] 💰 Payment received: ${receivedAmount} (TX: ${incomingTxId})`);
};

/**
 * Handle partial payment
 */
export const handlePartialPayment = async (
  tempAddressId: number,
  receivedAmount: number,
  expectedAmount: number,
  incomingTxId: string
): Promise<void> => {
  const poolAddress = await merchantTempAddressModel.findByPk(tempAddressId);
  
  if (!poolAddress) {
    throw new Error(`Pool address not found: ${tempAddressId}`);
  }

  const previousAmount = parseFloat(poolAddress.dataValues.received_amount) || 0;
  const totalReceived = previousAmount + receivedAmount;
  
  // Extend grace period
  const graceDeadline = new Date();
  graceDeadline.setMinutes(graceDeadline.getMinutes() + POOL_CONFIG.RESERVATION_TIMEOUT_MINUTES);

  await poolAddress.update({
    received_amount: totalReceived,
    is_partial_payment: true,
    partial_payment_timestamp: new Date(),
    reserved_until: graceDeadline,
  });

  console.log(`[MerchantPool] ⚠️ PARTIAL payment for ${poolAddress.dataValues.wallet_address}`);
  console.log(`[MerchantPool]    - Payment ID: ${poolAddress.dataValues.current_payment_id}`);
  console.log(`[MerchantPool]    - Received: ${receivedAmount} (Total: ${totalReceived})`);
  console.log(`[MerchantPool]    - Expected: ${expectedAmount}`);
  console.log(`[MerchantPool]    - Grace period extended to: ${graceDeadline}`);
};

/**
 * Handle below-threshold payment (100% to admin)
 */
export const handleBelowThresholdPayment = async (
  tempAddressId: number,
  receivedAmount: number,
  incomingTxId: string
): Promise<void> => {
  const poolAddress = await merchantTempAddressModel.findByPk(tempAddressId);
  
  if (!poolAddress) {
    throw new Error(`Pool address not found: ${tempAddressId}`);
  }

  const currentAdminBalance = parseFloat(poolAddress.dataValues.admin_fee_balance) || 0;
  const currentTxCount = poolAddress.dataValues.total_transactions || 0;

  // 100% goes to admin fee
  await poolAddress.update({
    status: "AVAILABLE",
    admin_fee_balance: currentAdminBalance + receivedAmount,
    total_transactions: currentTxCount + 1,
    current_payment_id: null,
    current_company_id: null,
    expected_amount: null,
    received_amount: null,
    is_partial_payment: false,
    partial_payment_timestamp: null,
    reserved_until: null,
    locked_at: null,
    last_used_at: new Date(),
  });

  // Record transaction
  await recordPoolTransaction({
    tempAddressId,
    ownerUserId: poolAddress.dataValues.owner_user_id,
    companyId: poolAddress.dataValues.current_company_id,
    walletType: poolAddress.dataValues.wallet_type,
    paymentAmount: receivedAmount,
    merchantAmount: 0,
    adminFeeAmount: receivedAmount,
    incomingTxId,
    status: "below_threshold",
  });

  console.log(`[MerchantPool] 📉 BELOW THRESHOLD: ${receivedAmount} ${poolAddress.dataValues.wallet_type}`);
  console.log(`[MerchantPool]    - 100% to admin fee`);
  console.log(`[MerchantPool]    - New admin balance: ${currentAdminBalance + receivedAmount}`);
};

/**
 * Release expired reservations
 */
export const releaseExpiredReservations = async (
  userId?: number,
  walletType?: string,
  transaction?: Transaction
): Promise<number> => {
  const whereClause: any = {
    status: "RESERVED",
    is_partial_payment: false, // Don't release partials here
    reserved_until: { [Op.lt]: new Date() },
  };

  if (userId) whereClause.owner_user_id = userId;
  if (walletType) whereClause.wallet_type = walletType;

  const [affectedCount] = await merchantTempAddressModel.update(
    {
      status: "AVAILABLE",
      current_payment_id: null,
      current_company_id: null,
      expected_amount: null,
      reserved_until: null,
      locked_at: null,
    },
    { where: whereClause, transaction }
  );

  if (affectedCount > 0) {
    console.log(`[MerchantPool] ⏰ Released ${affectedCount} expired reservations`);
  }

  return affectedCount;
};

/**
 * Release address back to pool after payment completion
 */
export const releaseAddress = async (
  tempAddressId: number,
  adminFeeAmount: number,
  gasUsed: number = 0
): Promise<void> => {
  const poolAddress = await merchantTempAddressModel.findByPk(tempAddressId);
  
  if (!poolAddress) {
    throw new Error(`Pool address not found: ${tempAddressId}`);
  }

  const walletType = poolAddress.dataValues.wallet_type;
  const sweepConfig = getSweepConfig(walletType);
  const isUTXO = UTXO_CHAINS.includes(walletType);
  const isToken = TOKEN_CHAINS.includes(walletType);

  const currentAdminBalance = parseFloat(poolAddress.dataValues.admin_fee_balance) || 0;
  const currentGasBalance = parseFloat(poolAddress.dataValues.gas_balance) || 0;
  const currentTxCount = poolAddress.dataValues.total_transactions || 0;

  // UTXO: admin fee sent in same tx, no accumulation
  // Token/Native: accumulate admin fee
  const newAdminBalance = isUTXO ? currentAdminBalance : (currentAdminBalance + adminFeeAmount);
  
  // Determine new status based on chain type:
  // - UTXO (batch): AVAILABLE immediately (admin fee already sent)
  // - Token (threshold): AVAILABLE (accumulate fees, reuse until threshold)
  // - Native (time): IN_USE (wait for time-based sweep)
  let newStatus: string;
  if (isUTXO) {
    newStatus = "AVAILABLE";
  } else if (isToken) {
    newStatus = "AVAILABLE"; // Accumulate fees, reuse address
  } else {
    // Native chains (ETH, TRX) - time-based sweep
    newStatus = newAdminBalance > 0 ? "IN_USE" : "AVAILABLE";
  }

  await poolAddress.update({
    status: newStatus,
    admin_fee_balance: newAdminBalance,
    gas_balance: Math.max(0, currentGasBalance - gasUsed),
    total_transactions: currentTxCount + 1,
    current_payment_id: null,
    current_company_id: null,
    expected_amount: null,
    received_amount: null,
    is_partial_payment: false,
    partial_payment_timestamp: null,
    reserved_until: null,
    locked_at: null,
    last_used_at: new Date(),
    last_merchant_payout: isUTXO ? null : new Date(),
  });

  console.log(`[MerchantPool] ✅ Released address ${poolAddress.dataValues.wallet_address} (${walletType})`);
  console.log(`[MerchantPool]    - Chain type: ${isUTXO ? 'UTXO' : isToken ? 'Token' : 'Native'}`);
  console.log(`[MerchantPool]    - New status: ${newStatus}`);
  console.log(`[MerchantPool]    - Admin fee balance: ${newAdminBalance}`);
  
  // Create/renew subscription for addresses that are now AVAILABLE
  if (newStatus === "AVAILABLE") {
    try {
      const subResult = await tatumApi.createSubscription(
        poolAddress.dataValues.wallet_address,
        walletType,
        true
      );
      if (subResult?.id) {
        await poolAddress.update({ subscription_id: subResult.id });
        console.log(`[MerchantPool]    - Subscription renewed: ${subResult.id}`);
      }
    } catch (subError) {
      console.warn(`[MerchantPool]    - ⚠️ Failed to renew subscription (will retry on next reserve)`);
    }
  } else {
    console.log(`[MerchantPool]    - Sweep mode: ${sweepConfig.mode}:${sweepConfig.value || 'N/A'}`);
  }
};

/**
 * Fund gas if needed for account-based chains
 */
export const fundGasIfNeeded = async (
  poolAddress: any,
  walletType: string
): Promise<{ funded: boolean; amount: number; txId?: string }> => {
  // UTXO chains don't need separate gas funding
  if (UTXO_CHAINS.includes(walletType)) {
    return { funded: false, amount: 0 };
  }

  const gasToken = GAS_TOKEN_MAPPING[walletType];
  if (!gasToken) {
    return { funded: false, amount: 0 };
  }

  const feeWalletAddress = FEE_WALLETS[gasToken];
  if (!feeWalletAddress) {
    console.warn(`[MerchantPool] No fee wallet configured for ${gasToken}`);
    return { funded: false, amount: 0 };
  }

  try {
    // Get current gas balance on-chain
    const balanceResult = await tatumApi.getAddressBalance(
      poolAddress.dataValues.wallet_address,
      gasToken
    );
    
    let currentBalance = Number(balanceResult?.balance ?? 0);
    
    // Convert from SUN to TRX for TRON
    if (gasToken === "TRX") {
      currentBalance = currentBalance / 1000000;
    }

    console.log(`[MerchantPool] Current gas balance: ${currentBalance} ${gasToken}`);

    // Determine gas requirements
    const gasAmount = gasToken === "TRX" ? POOL_CONFIG.TRX_GAS_AMOUNT : POOL_CONFIG.ETH_GAS_AMOUNT;
    const minDeficit = gasToken === "TRX" ? POOL_CONFIG.TRX_GAS_MIN_DEFICIT : POOL_CONFIG.ETH_GAS_MIN_DEFICIT;

    const deficit = gasAmount - currentBalance;

    // Only fund if deficit exceeds minimum
    if (deficit <= minDeficit) {
      console.log(`[MerchantPool] Gas sufficient (have: ${currentBalance}, need: ${gasAmount})`);
      await poolAddress.update({ gas_balance: currentBalance });
      return { funded: false, amount: 0 };
    }

    // Get fee wallet private key from adminFeeModel
    const { adminFeeModel } = await import("../models");
    const feeWallet = await adminFeeModel.findOne({
      where: { wallet_type: gasToken },
    });

    if (!feeWallet) {
      throw new Error(`Fee wallet not found for ${gasToken}`);
    }

    const feeWalletPrivateKey = await tatumApi.decryptSymmetric(
      feeWallet.dataValues.privateKey,
      process.env.TEMP_KEY_ID
    );

    // Estimate fees for gas transfer (only for ETH)
    let transferFees = null;
    if (gasToken === "ETH") {
      transferFees = await tatumApi.feeEstimation(
        gasToken,
        feeWalletAddress,
        poolAddress.dataValues.wallet_address,
        deficit
      );
    }

    console.log(`[MerchantPool] 🔥 Funding ${deficit} ${gasToken} to ${poolAddress.dataValues.wallet_address}`);

    // Transfer gas from fee wallet to pool address
    const txResult = await tatumApi.assetToOtherAddress({
      currency: gasToken,
      fromAddress: feeWalletAddress,
      toAddress: poolAddress.dataValues.wallet_address,
      privateKey: feeWalletPrivateKey,
      amount: deficit,
      fee: transferFees,
    });

    // Update gas balance tracker
    await poolAddress.update({ gas_balance: currentBalance + deficit });

    console.log(`[MerchantPool] ✅ Gas funded: ${deficit} ${gasToken} (TX: ${txResult?.txId})`);

    return { funded: true, amount: deficit, txId: txResult?.txId };
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[MerchantPool] ❌ Gas funding failed:`, message);
    return { funded: false, amount: 0 };
  }
};

/**
 * Cleanup stale addresses (safety net - 2 hour timeout)
 */
export const cleanupStaleAddresses = async (
  walletType?: string
): Promise<number> => {
  const safetyTimeout = new Date();
  safetyTimeout.setMinutes(safetyTimeout.getMinutes() - POOL_CONFIG.STALE_LOCK_TIMEOUT_MINUTES);

  const whereClause: any = {
    status: { [Op.in]: ["RESERVED", "PROCESSING"] },
    locked_at: { [Op.lt]: safetyTimeout },
  };

  if (walletType) whereClause.wallet_type = walletType;

  const stuckAddresses = await merchantTempAddressModel.findAll({ where: whereClause });

  for (const address of stuckAddresses) {
    console.log(`[MerchantPool] 🚨 Force-releasing stuck address: ${address.dataValues.wallet_address}`);
  }

  const [affectedCount] = await merchantTempAddressModel.update(
    {
      status: "AVAILABLE",
      current_payment_id: null,
      current_company_id: null,
      expected_amount: null,
      reserved_until: null,
      locked_at: null,
    },
    { where: whereClause }
  );

  if (affectedCount > 0) {
    console.log(`[MerchantPool] 🚨 Force-released ${affectedCount} stuck addresses`);
  }

  return affectedCount;
};

/**
 * Check if sweep is profitable (fee < balance * threshold)
 * Returns profitability status and USD values
 */
interface ProfitabilityResult {
  profitable: boolean;
  balanceUSD?: number;
  feeUSD?: number;
  estimatedFee?: number;
  profitMargin?: number;
}

const checkSweepProfitability = async (
  walletType: string,
  balance: number,
  feeData: any
): Promise<ProfitabilityResult> => {
  try {
    // Get fee amount from feeData
    let estimatedFee = 0;
    if (typeof feeData === "number") {
      estimatedFee = feeData;
    } else if (feeData?.gasPrice && feeData?.gasLimit) {
      // ETH-style fee
      estimatedFee = (parseFloat(feeData.gasPrice) * parseInt(feeData.gasLimit)) / 1e18;
    } else if (feeData?.fee) {
      estimatedFee = parseFloat(feeData.fee);
    } else if (feeData?.slow) {
      estimatedFee = parseFloat(feeData.slow);
    }
    
    // Convert balance to USD
    let balanceUSD = 0;
    let feeUSD = 0;
    
    try {
      const balanceConversion = await currencyConvert({
        currency: ["USD"],
        sourceCurrency: walletType,
        amount: balance,
        fixedDecimal: true,
      });
      balanceUSD = parseFloat(String(balanceConversion[0]?.amount || "0"));
      
      const feeConversion = await currencyConvert({
        currency: ["USD"],
        sourceCurrency: walletType,
        amount: estimatedFee,
        fixedDecimal: true,
      });
      feeUSD = parseFloat(String(feeConversion[0]?.amount || "0"));
    } catch (convError) {
      console.warn(`[MerchantPool] Could not convert to USD for profitability check:`, convError);
      // If conversion fails, assume profitable to avoid blocking legitimate sweeps
      return { profitable: true, estimatedFee };
    }
    
    // Profitability threshold: fee should be less than 50% of balance
    // This ensures we're not losing money on the sweep
    const PROFITABILITY_THRESHOLD = 0.5;
    const profitable = feeUSD < (balanceUSD * PROFITABILITY_THRESHOLD);
    const profitMargin = balanceUSD > 0 ? ((balanceUSD - feeUSD) / balanceUSD) * 100 : 0;
    
    return {
      profitable,
      balanceUSD,
      feeUSD,
      estimatedFee,
      profitMargin,
    };
  } catch (error) {
    console.error(`[MerchantPool] Profitability check error:`, error);
    // If check fails, assume profitable to avoid blocking legitimate sweeps
    return { profitable: true };
  }
};

/**
 * Recover stranded gas from pool addresses
 * This handles cases where gas was funded but token transfer failed
 * leaving small amounts of ETH/TRX in pool addresses
 */
export const recoverStrandedGas = async (): Promise<{
  recovered: number;
  totalRecovered: Record<string, number>;
  errors: string[];
}> => {
  console.log(`[MerchantPool] ========================================`);
  console.log(`[MerchantPool] Starting stranded gas recovery`);
  console.log(`[MerchantPool] ========================================`);
  
  const result = {
    recovered: 0,
    totalRecovered: {} as Record<string, number>,
    errors: [] as string[],
  };
  
  try {
    // Find addresses with gas balance but no admin fee balance
    // These are likely "stranded" - gas was sent but token transfer failed
    const strandedAddresses = await merchantTempAddressModel.findAll({
      where: {
        status: "AVAILABLE",
        gas_balance: { [Op.gt]: 0 },
        admin_fee_balance: { [Op.lte]: 0 },
      },
    });
    
    console.log(`[MerchantPool] Found ${strandedAddresses.length} addresses with potential stranded gas`);
    
    // Also check for addresses with native currency where the actual blockchain balance
    // is significantly different from admin_fee_balance (indicates stranded funds)
    const nativeAddresses = await merchantTempAddressModel.findAll({
      where: {
        status: "AVAILABLE",
        wallet_type: { [Op.in]: NATIVE_CURRENCIES },
        admin_fee_balance: { [Op.eq]: 0 },
      },
    });
    
    console.log(`[MerchantPool] Checking ${nativeAddresses.length} native currency addresses for stranded balance`);
    
    const addressesToProcess = [...strandedAddresses, ...nativeAddresses];
    const processedAddresses = new Set<string>();
    
    for (const address of addressesToProcess) {
      const walletAddress = address.dataValues.wallet_address;
      
      // Skip if already processed
      if (processedAddresses.has(walletAddress)) continue;
      processedAddresses.add(walletAddress);
      
      const walletType = address.dataValues.wallet_type;
      
      try {
        // Get actual blockchain balance
        const balanceData = await tatumApi.getAddressBalance(walletAddress, walletType);
        const actualBalance = parseFloat(balanceData?.balance || "0");
        
        // Skip if no actual balance
        if (actualBalance <= 0) {
          continue;
        }
        
        // For native currencies, check if balance is just gas leftovers
        // (small amount, less than $5 USD)
        const conversionResult = await currencyConvert({
          currency: ["USD"],
          sourceCurrency: walletType,
          amount: actualBalance,
          fixedDecimal: true,
        });
        const balanceUSD = parseFloat(String(conversionResult[0]?.amount || "0"));
        
        // Skip if balance is too small to be worth recovering (< $1)
        // or too large (might be legitimate funds, not stranded gas)
        if (balanceUSD < 1 || balanceUSD > 10) {
          if (balanceUSD > 10) {
            console.log(`[MerchantPool] Skipping ${walletAddress} - balance $${balanceUSD.toFixed(2)} may be legitimate funds`);
          }
          continue;
        }
        
        console.log(`[MerchantPool] 🔄 Recovering stranded gas from ${walletAddress}: ${actualBalance} ${walletType} ($${balanceUSD.toFixed(2)})`);
        
        // Get fee wallet to send recovered gas to
        const gasToken = GAS_TOKEN_MAPPING[walletType] || walletType;
        const feeWalletAddress = FEE_WALLETS[gasToken];
        
        if (!feeWalletAddress) {
          console.warn(`[MerchantPool] No fee wallet for ${gasToken}, skipping recovery`);
          continue;
        }
        
        // Estimate fee
        const feeData = await tatumApi.feeEstimation(
          walletType,
          walletAddress,
          feeWalletAddress,
          actualBalance.toString()
        );
        
        // Calculate send amount (balance - fee)
        let sendAmount = actualBalance;
        if (feeData?.slow) {
          sendAmount = actualBalance - parseFloat(feeData.slow);
        }
        
        if (sendAmount <= 0) {
          console.log(`[MerchantPool] Balance too low to recover after fees: ${walletAddress}`);
          continue;
        }
        
        // Decrypt private key and execute transfer
        const privateKey = await tatumApi.decryptSymmetric(
          address.dataValues.private_key,
          process.env.TEMP_KEY_ID
        );
        
        const transferResult = await tatumApi.assetToOtherAddress({
          currency: walletType,
          fromAddress: walletAddress,
          toAddress: feeWalletAddress,
          privateKey,
          amount: sendAmount.toString(),
          fee: feeData,
        });
        
        if (transferResult?.txId) {
          console.log(`[MerchantPool] ✅ Recovered ${sendAmount} ${walletType} from ${walletAddress}`);
          result.recovered++;
          result.totalRecovered[walletType] = (result.totalRecovered[walletType] || 0) + sendAmount;
          
          // Update gas_balance in database
          await address.update({ gas_balance: 0 });
        } else {
          throw new Error("No txId returned from transfer");
        }
        
      } catch (error) {
        const message = getErrorMessage(error);
        console.error(`[MerchantPool] Failed to recover gas from ${walletAddress}:`, message);
        result.errors.push(`${walletAddress}: ${message}`);
      }
    }
    
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[MerchantPool] Gas recovery failed:`, message);
    result.errors.push(`General error: ${message}`);
  }
  
  console.log(`[MerchantPool] ========================================`);
  console.log(`[MerchantPool] Gas recovery completed`);
  console.log(`[MerchantPool]   Recovered: ${result.recovered} addresses`);
  console.log(`[MerchantPool]   Totals:`, result.totalRecovered);
  if (result.errors.length > 0) {
    console.log(`[MerchantPool]   Errors: ${result.errors.length}`);
  }
  console.log(`[MerchantPool] ========================================`);
  
  return result;
};

/**
 * Sweep admin fees from pool address to admin wallet
 * FIXED: Better transaction consistency - blockchain transfer first, then DB update
 */
export const sweepPoolAddress = async (tempAddressId: number): Promise<any> => {
  let dbTransaction;
  
  try {
    // Phase 1: Lock address and validate
    dbTransaction = await sequelize.transaction();
    
    const poolAddress = await merchantTempAddressModel.findByPk(tempAddressId, {
      lock: dbTransaction.LOCK.UPDATE,
      transaction: dbTransaction,
    });

    if (!poolAddress) {
      throw new Error(`Pool address not found: ${tempAddressId}`);
    }

    // Only sweep addresses with IN_USE status (pending admin fee sweep)
    const status = poolAddress.dataValues.status;
    const adminBalance = parseFloat(poolAddress.dataValues.admin_fee_balance || "0");
    
    if (status !== "IN_USE") {
      throw new Error(`Cannot sweep address in ${status} status. Only IN_USE addresses can be swept.`);
    }
    
    if (adminBalance <= 0) {
      console.log(`[MerchantPool] No admin fee to sweep for address ${tempAddressId}`);
      // Set to AVAILABLE since there's nothing to sweep
      await poolAddress.update({ status: "AVAILABLE" }, { transaction: dbTransaction });
      await dbTransaction.commit();
      return { success: true, amount: 0, message: "No admin fee balance" };
    }

    const walletType = poolAddress.dataValues.wallet_type;
    const adminWallet = ADMIN_WALLETS[walletType];
    
    if (!adminWallet) {
      throw new Error(`No admin wallet configured for ${walletType}`);
    }

    // Mark as sweeping
    await poolAddress.update({ status: "SWEEPING" }, { transaction: dbTransaction });
    await dbTransaction.commit();
    dbTransaction = null; // Transaction completed

    // Phase 2: Execute blockchain transfer (outside DB transaction)
    console.log(`[MerchantPool] 🧹 Starting sweep for ${poolAddress.dataValues.wallet_address}`);
    
    // Get actual balance from blockchain
    const balanceData = await tatumApi.getAddressBalance(
      poolAddress.dataValues.wallet_address,
      walletType
    );
    const actualBalance = parseFloat(balanceData?.balance || "0");

    if (actualBalance <= 0) {
      // No balance to sweep, just reset
      await poolAddress.update({
        status: "AVAILABLE",
        admin_fee_balance: 0,
        last_swept_at: new Date(),
      });
      return { success: true, amount: 0, message: "No balance to sweep" };
    }

    // Fund gas if needed - ONLY for tokens (USDT, USDC), NOT for native currencies
    // Native currencies (ETH, TRX) already have gas in the remaining balance (admin's portion)
    let gasFunding: { funded: boolean; amount: number; txId: string | null } = { funded: false, amount: 0, txId: null };
    const isToken = TOKEN_CHAINS.includes(walletType);
    
    if (isToken) {
      const fundResult = await fundGasIfNeeded(poolAddress, walletType);
      gasFunding = { ...fundResult, txId: fundResult.txId || null };
    } else {
      console.log(`[MerchantPool] Native ${walletType} - gas comes from remaining balance, no external funding needed`);
    }

    // Decrypt private key
    const privateKey = await tatumApi.decryptSymmetric(
      poolAddress.dataValues.private_key,
      process.env.TEMP_KEY_ID
    );

    // Estimate fees
    const feeData = await tatumApi.feeEstimation(
      walletType,
      poolAddress.dataValues.wallet_address,
      adminWallet,
      actualBalance.toString()
    );

    // PROFITABILITY CHECK: Ensure sweep is cost-effective
    const profitabilityResult = await checkSweepProfitability(
      walletType,
      actualBalance,
      feeData
    );
    
    if (!profitabilityResult.profitable) {
      console.warn(`[MerchantPool] ⚠️ Sweep not profitable for ${poolAddress.dataValues.wallet_address}`);
      console.warn(`[MerchantPool]    Balance: ${actualBalance} ${walletType} ($${profitabilityResult.balanceUSD?.toFixed(2)})`);
      console.warn(`[MerchantPool]    Est. Fee: ${profitabilityResult.estimatedFee} ${walletType} ($${profitabilityResult.feeUSD?.toFixed(2)})`);
      console.warn(`[MerchantPool]    Skipping sweep - will retry when balance is higher`);
      
      // Reset status back to AVAILABLE without sweeping
      await poolAddress.update({ status: "AVAILABLE" });
      
      return { 
        success: false, 
        skipped: true, 
        reason: "Not profitable",
        balanceUSD: profitabilityResult.balanceUSD,
        feeUSD: profitabilityResult.feeUSD
      };
    }
    
    console.log(`[MerchantPool] ✅ Sweep is profitable: $${profitabilityResult.balanceUSD?.toFixed(2)} balance vs $${profitabilityResult.feeUSD?.toFixed(2)} fee`);

    // For account-based chains (ETH, TRX), deduct gas from the amount to send
    // For UTXO chains, gas is handled differently (deducted by the API)
    const isAccountChain = ACCOUNT_CHAINS.includes(walletType);
    let amountToSend = actualBalance;
    
    if (isAccountChain) {
      const gasFee = parseFloat(feeData?.slow || feeData?.fast || "0");
      amountToSend = actualBalance - gasFee;
      
      if (amountToSend <= 0) {
        console.warn(`[MerchantPool] ⚠️ Balance too low for sweep after gas: ${actualBalance} - ${gasFee} = ${amountToSend}`);
        await poolAddress.update({ status: "AVAILABLE" });
        return { success: false, skipped: true, reason: "Balance too low after gas deduction" };
      }
      
      console.log(`[MerchantPool] Account chain sweep: ${actualBalance} - ${gasFee} (gas) = ${amountToSend} ${walletType}`);
    }

    // Execute blockchain transfer
    const sweepResult = await tatumApi.assetToOtherAddress({
      currency: walletType,
      fromAddress: poolAddress.dataValues.wallet_address,
      toAddress: adminWallet,
      privateKey,
      amount: amountToSend.toString(),
      fee: feeData,
    });

    const sweepTxId = sweepResult?.txId;
    
    if (!sweepTxId) {
      throw new Error("Sweep transaction failed - no txId returned");
    }

    console.log(`[MerchantPool] ✅ Blockchain sweep successful: ${sweepTxId}`);

    // Phase 3: Update database atomically (blockchain succeeded, now record it)
    dbTransaction = await sequelize.transaction();
    
    try {
      // Record sweep - use amountToSend (actual amount sent to admin)
      await merchantPoolSweepModel.create({
        temp_address_id: tempAddressId,
        owner_user_id: poolAddress.dataValues.owner_user_id,
        wallet_type: walletType,
        amount_swept: amountToSend,
        gas_funded: gasFunding.amount || 0,
        gas_used: isAccountChain ? (actualBalance - amountToSend) : 0,
        sweep_tx_id: sweepTxId,
        gas_funding_tx_id: gasFunding.txId || null,
        admin_wallet: adminWallet,
        status: "completed",
      }, { transaction: dbTransaction });

      // After successful sweep, set status to AVAILABLE and renew subscription
      await poolAddress.update({
        status: "AVAILABLE",
        admin_fee_balance: 0,
        gas_balance: 0,
        last_swept_at: new Date(),
      }, { transaction: dbTransaction });

      await dbTransaction.commit();
      dbTransaction = null;
      
      console.log(`[MerchantPool] 🎉 Sweep recorded: ${amountToSend} ${walletType} → admin wallet`);
      console.log(`[MerchantPool]    Status set to: AVAILABLE`);

      // Renew subscription for the address so it's ready for next payment
      try {
        const subResult = await tatumApi.createSubscription(
          poolAddress.dataValues.wallet_address,
          walletType,
          true
        );
        if (subResult?.id) {
          await poolAddress.update({ subscription_id: subResult.id });
          console.log(`[MerchantPool]    Subscription renewed: ${subResult.id}`);
        }
      } catch (subError) {
        console.warn(`[MerchantPool]    ⚠️ Failed to renew subscription (will retry on next reserve)`);
      }

      return { success: true, amount: amountToSend, txId: sweepTxId };
      
    } catch (dbError) {
      // CRITICAL: Blockchain transfer succeeded but DB update failed
      const message = getErrorMessage(dbError);
      console.error(`[MerchantPool] 🚨 CRITICAL: Sweep ${sweepTxId} succeeded but DB update failed: ${message}`);
      console.error(`[MerchantPool] 🚨 Manual intervention needed for address ${poolAddress.dataValues.wallet_address}`);
      console.error(`[MerchantPool] 🚨 Sweep details: ${actualBalance} ${walletType} sent to ${adminWallet}`);
      
      // Try to rollback DB transaction
      if (dbTransaction) {
        try {
          await dbTransaction.rollback();
        } catch {}
      }
      
      // Reset status to IN_USE (sweep failed, still has admin fee)
      try {
        await merchantTempAddressModel.update(
          { status: "IN_USE" },
          { where: { temp_address_id: tempAddressId } }
        );
      } catch {}
      
      // Return success with warning (blockchain succeeded, DB issue needs manual fix)
      return { 
        success: true, 
        amount: actualBalance, 
        txId: sweepTxId,
        warning: "DB update failed, manual verification needed",
        critical: true
      };
    }
    
  } catch (error) {
    // Blockchain transfer failed or validation error
    const message = getErrorMessage(error);
    console.error(`[MerchantPool] ❌ Sweep failed:`, message);
    
    // Rollback any open transaction
    if (dbTransaction) {
      try {
        await dbTransaction.rollback();
      } catch {}
    }
    
    // Try to reset status to IN_USE (still has admin fee pending)
    try {
      await merchantTempAddressModel.update(
        { status: "IN_USE" },
        { where: { temp_address_id: tempAddressId } }
      );
    } catch {}
    
    throw error;
  }
};

/**
 * Sweep addresses by USD threshold (per-chain configuration)
 * For token chains (USDT/USDC) that accumulate fees while AVAILABLE
 * When threshold is met, set to IN_USE and sweep
 */
export const sweepByThreshold = async (): Promise<void> => {
  // Get all AVAILABLE addresses with accumulated fees (token chains accumulate while available)
  const addressesWithFees = await merchantTempAddressModel.findAll({
    where: {
      status: "AVAILABLE",
      admin_fee_balance: { [Op.gt]: 0 },
    },
  });

  console.log(`[MerchantPool] Checking ${addressesWithFees.length} AVAILABLE addresses for threshold-based sweep...`);

  const eligibleAddresses = [];
  
  // Check each address against its chain-specific threshold
  for (const address of addressesWithFees) {
    try {
      const cryptoAmount = parseFloat(address.dataValues.admin_fee_balance);
      const walletType = address.dataValues.wallet_type;
      const walletAddress = address.dataValues.wallet_address;
      
      // Get sweep config for this chain
      const sweepConfig = getSweepConfig(walletType);
      
      // Skip if not threshold mode (only process token chains here)
      if (sweepConfig.mode !== "threshold") {
        continue;
      }
      
      // Convert crypto amount to USD
      const conversionResult = await currencyConvert({
        currency: ['USD'],
        sourceCurrency: walletType,
        amount: cryptoAmount,
        fixedDecimal: true,
      });
      
      const usdAmount = parseFloat(String(conversionResult?.[0]?.amount || "0"));
      
      console.log(`[MerchantPool] ${walletAddress} (${walletType}): ${cryptoAmount} = $${usdAmount.toFixed(2)} USD (threshold: $${sweepConfig.value})`);
      
      // Compare USD value to chain-specific threshold
      if (usdAmount >= (sweepConfig.value || 30)) {
        console.log(`[MerchantPool]    ✅ Threshold met - marking for sweep`);
        // Set to IN_USE before sweeping (prevents new payments while sweeping)
        await address.update({ status: "IN_USE" });
        eligibleAddresses.push(address);
      } else {
        console.log(`[MerchantPool]    ⏳ Below threshold - continuing to accumulate`);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      console.error(`[MerchantPool] ⚠️  Failed to check ${address.dataValues.wallet_type}:`, message);
    }
  }

  console.log(`[MerchantPool] Found ${eligibleAddresses.length} addresses eligible for threshold sweep`);

  for (const address of eligibleAddresses) {
    try {
      await sweepPoolAddress(address.dataValues.temp_address_id);
    } catch (error) {
      console.error(`[MerchantPool] Failed to sweep ${address.dataValues.wallet_address}:`, error);
    }
  }
};

/**
 * Sweep addresses after time threshold (per-chain configuration)
 * Only for chains configured with time mode
 */
export const sweepByTime = async (): Promise<void> => {
  // Get all IN_USE addresses with accumulated fees and merchant payout timestamp
  const addressesWithFees = await merchantTempAddressModel.findAll({
    where: {
      status: "IN_USE",
      admin_fee_balance: { [Op.gt]: 0 },
      last_merchant_payout: { [Op.ne]: null },
    },
  });

  console.log(`[MerchantPool] Checking ${addressesWithFees.length} IN_USE addresses for time-based sweep...`);

  const eligibleAddresses = [];

  for (const address of addressesWithFees) {
    try {
      const walletType = address.dataValues.wallet_type;
      const cryptoAmount = parseFloat(address.dataValues.admin_fee_balance);
      const lastPayout = new Date(address.dataValues.last_merchant_payout);
      
      // Get sweep config for this chain
      const sweepConfig = getSweepConfig(walletType);
      
      // Skip if not time mode
      if (sweepConfig.mode !== "time") {
        continue;
      }
      
      const timeThresholdMinutes = sweepConfig.value || 10;
      const timeThreshold = new Date();
      timeThreshold.setMinutes(timeThreshold.getMinutes() - timeThresholdMinutes);
      
      const timeSincePayout = Math.floor((new Date().getTime() - lastPayout.getTime()) / 60000);
      
      console.log(`[MerchantPool] ${address.dataValues.wallet_address} (${walletType}): ${cryptoAmount}, ${timeSincePayout} min since payout (threshold: ${timeThresholdMinutes} min)`);
      
      // Check if time threshold met
      if (lastPayout < timeThreshold) {
        console.log(`[MerchantPool]    ✅ Eligible for time-based sweep`);
        eligibleAddresses.push(address);
      } else {
        console.log(`[MerchantPool]    ⏳ Not yet (${timeSincePayout} < ${timeThresholdMinutes} min)`);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      console.error(`[MerchantPool] ⚠️  Failed to check ${address.dataValues.wallet_type}:`, message);
    }
  }

  console.log(`[MerchantPool] Found ${eligibleAddresses.length} addresses eligible for time-based sweep`);

  for (const address of eligibleAddresses) {
    try {
      await sweepPoolAddress(address.dataValues.temp_address_id);
    } catch (error) {
      console.error(`[MerchantPool] Failed to sweep ${address.dataValues.wallet_address}:`, error);
    }
  }
};

/**
 * Master sweep function - runs both threshold and time-based sweeps
 * Called by cron job
 */
export const performScheduledSweeps = async (): Promise<void> => {
  console.log(`[MerchantPool] ========================================`);
  console.log(`[MerchantPool] Starting scheduled sweep (per-chain config)`);
  console.log(`[MerchantPool] ========================================`);

  try {
    // Run threshold-based sweep (for chains configured with threshold mode)
    console.log(`[MerchantPool] 💰 Running threshold-based sweep...`);
    await sweepByThreshold();

    // Run time-based sweep (for chains configured with time mode)
    console.log(`[MerchantPool] ⏰ Running time-based sweep...`);
    await sweepByTime();
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[MerchantPool] ❌ Scheduled sweep failed:`, message);
  }

  console.log(`[MerchantPool] ========================================`);
  console.log(`[MerchantPool] Scheduled sweep completed`);
  console.log(`[MerchantPool] ========================================`);
};

/**
 * Record pool transaction for audit
 */
export const recordPoolTransaction = async (data: {
  tempAddressId: number;
  ownerUserId: number;
  companyId?: number;
  customerId?: number;
  paymentReference?: string;
  walletType: string;
  paymentAmount: number;
  merchantAmount: number;
  adminFeeAmount: number;
  gasFunded?: number;
  gasUsed?: number;
  incomingTxId?: string;
  merchantTxId?: string;
  gasFundingTxId?: string;
  status: string;
}): Promise<any> => {
  return await merchantPoolTransactionModel.create({
    temp_address_id: data.tempAddressId,
    owner_user_id: data.ownerUserId,
    company_id: data.companyId,
    customer_id: data.customerId,
    payment_reference: data.paymentReference,
    wallet_type: data.walletType,
    payment_amount: data.paymentAmount,
    merchant_amount: data.merchantAmount,
    admin_fee_amount: data.adminFeeAmount,
    gas_funded: data.gasFunded || 0,
    gas_used: data.gasUsed || 0,
    incoming_tx_id: data.incomingTxId,
    merchant_tx_id: data.merchantTxId,
    gas_funding_tx_id: data.gasFundingTxId,
    status: data.status,
  });
};

/**
 * Get pool status for dashboard
 */
export const getPoolStatus = async (userId?: number): Promise<any> => {
  const whereClause: any = {};
  if (userId) whereClause.owner_user_id = userId;

  const addresses = await merchantTempAddressModel.findAll({
    where: whereClause,
    attributes: [
      "temp_address_id",
      "owner_user_id",
      "wallet_type",
      "wallet_address",
      "status",
      "admin_fee_balance",
      "gas_balance",
      "total_transactions",
      "last_used_at",
      "last_swept_at",
    ],
  });

  // Group by wallet type
  const byType: Record<string, any[]> = {};
  for (const addr of addresses) {
    const type = addr.dataValues.wallet_type;
    if (!byType[type]) byType[type] = [];
    byType[type].push(addr.dataValues);
  }

  const result: Record<string, any> = {};
  for (const [type, addrs] of Object.entries(byType)) {
    const totalFees = addrs.reduce((sum, a) => sum + parseFloat(a.admin_fee_balance || 0), 0);
    result[type] = {
      addresses: addrs,
      totalAddresses: addrs.length,
      availableCount: addrs.filter(a => a.status === "AVAILABLE").length,
      reservedCount: addrs.filter(a => a.status === "RESERVED").length,
      processingCount: addrs.filter(a => a.status === "PROCESSING").length,
      sweepingCount: addrs.filter(a => a.status === "SWEEPING").length,
      totalAccumulatedFees: totalFees,
      sweepConfig: getSweepConfig(type),
    };
  }

  return {
    ...result,
    config: POOL_CONFIG,
    supportedChains: MERCHANT_POOL_CRYPTO_TYPES,
  };
};

/**
 * Find pool address by wallet address
 */
export const findByWalletAddress = async (walletAddress: string): Promise<any | null> => {
  return await merchantTempAddressModel.findOne({
    where: { wallet_address: walletAddress },
  });
};

/**
 * Process queued payments (arrived during sweep)
 */
export const processQueuedPayments = async (tempAddressId: number): Promise<void> => {
  // This will be called after sweep completes
  // Implementation depends on how queued payments are stored
  console.log(`[MerchantPool] Processing queued payments for address ${tempAddressId}`);
};

export default {
  getOrCreateMerchantWallet,
  addAddressToMerchantPool,
  initializeMerchantPool,
  reserveAddress,
  getAvailableAddress,
  markPaymentReceived,
  handlePartialPayment,
  handleBelowThresholdPayment,
  releaseExpiredReservations,
  releaseAddress,
  fundGasIfNeeded,
  cleanupStaleAddresses,
  sweepPoolAddress,
  sweepByThreshold,
  sweepByTime,
  performScheduledSweeps,
  recoverStrandedGas,
  getSweepConfig,
  recordPoolTransaction,
  getPoolStatus,
  findByWalletAddress,
  processQueuedPayments,
  POOL_CONFIG,
  UTXO_CHAINS,
  NATIVE_CURRENCIES,
  TOKEN_CHAINS,
  FEE_WALLETS,
  ADMIN_WALLETS,
  TOKEN_CONTRACTS,
};
