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
  UTXO_CHAINS,
  ACCOUNT_CHAINS,
  TOKEN_CHAINS,
  GAS_TOKEN_MAPPING,
} from "../models";
import tatumApi from "../apis/tatumApi";
import sequelize from "../utils/dbInstance";
import { cronLogger } from "../utils/loggers";
import { currencyConvert, getErrorMessage } from "../helper";
import { encryptWithKMS, decryptWithKMS } from "../utils/kmsHelper";

// Configuration
const POOL_CONFIG = {
  INITIAL_SIZE: parseInt(process.env.MERCHANT_POOL_INITIAL_SIZE || "2"),
  SWEEP_THRESHOLD: parseFloat(process.env.MERCHANT_POOL_SWEEP_THRESHOLD || "30"),
  
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
    const decryptedMnemonic = await decryptWithKMS(
      merchantWallet.dataValues.mnemonic,
      process.env.XPUB_KEY_ID
    );
    return {
      xpub: merchantWallet.dataValues.xpub,
      mnemonic: decryptedMnemonic,
    };
  }

  // Generate new wallet for this chain
  console.log(`[MerchantPool] Generating new ${baseChain} wallet for merchant ${userId}...`);
  
  const walletData = await tatumApi.generateWallet(baseChain);
  
  if (!walletData || !walletData.xpub || !walletData.mnemonic) {
    throw new Error(`Failed to generate ${baseChain} wallet for merchant ${userId}`);
  }

  // Encrypt mnemonic
  const encryptedMnemonic = await encryptWithKMS(
    walletData.mnemonic,
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
    
    // Derive address from xpub
    const baseChain = CHAIN_XPUB_MAPPING[walletType] || walletType;
    const addressData = await tatumApi.generateAddressFromXpub(
      baseChain,
      xpub,
      derivationIndex
    );

    if (!addressData || !addressData.address) {
      throw new Error(`Failed to derive address for ${walletType} at index ${derivationIndex}`);
    }

    // Get private key for this address
    const privateKeyData = await tatumApi.generatePrivateKeyFromMnemonic(
      baseChain,
      mnemonic,
      derivationIndex
    );

    if (!privateKeyData || !privateKeyData.key) {
      throw new Error(`Failed to generate private key for ${walletType} at index ${derivationIndex}`);
    }

    // Encrypt private key
    const encryptedPrivateKey = await encryptWithKMS(
      privateKeyData.key,
      process.env.TEMP_KEY_ID
    );

    // Create Tatum subscription for webhook
    let subscriptionId = null;
    try {
      // For tokens, subscribe to the token transfers
      if (TOKEN_CHAINS.includes(walletType)) {
        const contractAddress = TOKEN_CONTRACTS[walletType];
        subscriptionId = await tatumApi.subscribeToAddressWithContract(
          addressData.address,
          walletType,
          contractAddress
        );
      } else {
        subscriptionId = await tatumApi.subscribeToAddress(
          addressData.address,
          walletType
        );
      }
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
    // Priority: highest admin_fee_balance, then most active
    let poolAddress = await merchantTempAddressModel.findOne({
      where: {
        owner_user_id: userId,
        wallet_type: walletType,
        status: "AVAILABLE",
      },
      order: [
        ["admin_fee_balance", "DESC"],
        ["total_transactions", "DESC"],
      ],
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    // If no address available, create new one
    if (!poolAddress) {
      console.log(`[MerchantPool] No available ${walletType} address for merchant ${userId}, creating new...`);
      poolAddress = await addAddressToMerchantPool(userId, walletType, transaction);
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

  const currentAdminBalance = parseFloat(poolAddress.dataValues.admin_fee_balance) || 0;
  const currentGasBalance = parseFloat(poolAddress.dataValues.gas_balance) || 0;
  const currentTxCount = poolAddress.dataValues.total_transactions || 0;

  await poolAddress.update({
    status: "AVAILABLE",
    admin_fee_balance: currentAdminBalance + adminFeeAmount,
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
  });

  console.log(`[MerchantPool] ✅ Released address ${poolAddress.dataValues.wallet_address}`);
  console.log(`[MerchantPool]    - Admin fee added: ${adminFeeAmount}`);
  console.log(`[MerchantPool]    - New admin balance: ${currentAdminBalance + adminFeeAmount}`);

  // Check if sweep threshold reached
  if (currentAdminBalance + adminFeeAmount >= POOL_CONFIG.SWEEP_THRESHOLD) {
    console.log(`[MerchantPool] 📍 Sweep threshold reached - will be swept by cron`);
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

  const feeWallet = FEE_WALLETS[gasToken];
  if (!feeWallet) {
    console.warn(`[MerchantPool] No fee wallet configured for ${gasToken}`);
    return { funded: false, amount: 0 };
  }

  // Determine gas requirements
  const gasAmount = gasToken === "TRX" ? POOL_CONFIG.TRX_GAS_AMOUNT : POOL_CONFIG.ETH_GAS_AMOUNT;
  const minDeficit = gasToken === "TRX" ? POOL_CONFIG.TRX_GAS_MIN_DEFICIT : POOL_CONFIG.ETH_GAS_MIN_DEFICIT;

  // Get current gas balance on-chain
  let currentBalance = 0;
  try {
    const balanceData = await tatumApi.getAddressBalance(
      poolAddress.dataValues.wallet_address,
      gasToken
    );
    currentBalance = parseFloat(balanceData?.balance || "0");
  } catch (error) {
    console.warn(`[MerchantPool] Could not get gas balance, using tracked value`);
    currentBalance = parseFloat(poolAddress.dataValues.gas_balance) || 0;
  }

  const deficit = gasAmount - currentBalance;

  // Only fund if deficit exceeds minimum
  if (deficit <= minDeficit) {
    console.log(`[MerchantPool] Gas sufficient (have: ${currentBalance}, need: ${gasAmount}, deficit: ${deficit})`);
    return { funded: false, amount: 0 };
  }

  console.log(`[MerchantPool] 🔥 Funding gas: ${deficit} ${gasToken} to ${poolAddress.dataValues.wallet_address}`);

  try {
    // Transfer gas from fee wallet
    const result = await tatumApi.transferNative(
      feeWallet,
      poolAddress.dataValues.wallet_address,
      deficit.toString(),
      gasToken
    );

    // Update gas balance tracker
    await poolAddress.update({
      gas_balance: currentBalance + deficit,
    });

    console.log(`[MerchantPool] ✅ Gas funded: ${deficit} ${gasToken} (TX: ${result?.txId})`);

    return { funded: true, amount: deficit, txId: result?.txId };
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
 * Sweep admin fees from pool address to admin wallet
 */
export const sweepPoolAddress = async (tempAddressId: number): Promise<any> => {
  const transaction = await sequelize.transaction();
  
  try {
    const poolAddress = await merchantTempAddressModel.findByPk(tempAddressId, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!poolAddress) {
      throw new Error(`Pool address not found: ${tempAddressId}`);
    }

    if (poolAddress.dataValues.status !== "AVAILABLE") {
      throw new Error(`Cannot sweep address in ${poolAddress.dataValues.status} status`);
    }

    const walletType = poolAddress.dataValues.wallet_type;
    const adminWallet = ADMIN_WALLETS[walletType];
    
    if (!adminWallet) {
      throw new Error(`No admin wallet configured for ${walletType}`);
    }

    // Mark as sweeping
    await poolAddress.update({ status: "SWEEPING" }, { transaction });
    await transaction.commit();

    // Get actual balance
    let actualBalance = 0;
    if (TOKEN_CHAINS.includes(walletType)) {
      const tokenBalance = await tatumApi.getTokenBalance(
        poolAddress.dataValues.wallet_address,
        walletType,
        TOKEN_CONTRACTS[walletType]
      );
      actualBalance = parseFloat(tokenBalance?.balance || "0");
    } else {
      const balanceData = await tatumApi.getAddressBalance(
        poolAddress.dataValues.wallet_address,
        walletType
      );
      actualBalance = parseFloat(balanceData?.balance || "0");
    }

    if (actualBalance <= 0) {
      // Reset and release
      await poolAddress.update({
        status: "AVAILABLE",
        admin_fee_balance: 0,
        last_swept_at: new Date(),
      });
      return { success: true, amount: 0, message: "No balance to sweep" };
    }

    // Fund gas if needed
    const gasFunding = await fundGasIfNeeded(poolAddress, walletType);

    // Decrypt private key
    const privateKey = await decryptWithKMS(
      poolAddress.dataValues.private_key,
      process.env.TEMP_KEY_ID
    );

    // Transfer to admin wallet
    let sweepTxId;
    if (TOKEN_CHAINS.includes(walletType)) {
      sweepTxId = await tatumApi.transferToken(
        privateKey,
        adminWallet,
        actualBalance.toString(),
        walletType,
        TOKEN_CONTRACTS[walletType]
      );
    } else {
      sweepTxId = await tatumApi.transferCrypto(
        privateKey,
        adminWallet,
        actualBalance.toString(),
        walletType
      );
    }

    // Record sweep
    await merchantPoolSweepModel.create({
      temp_address_id: tempAddressId,
      owner_user_id: poolAddress.dataValues.owner_user_id,
      wallet_type: walletType,
      amount_swept: actualBalance,
      gas_funded: gasFunding.amount,
      sweep_tx_id: sweepTxId,
      gas_funding_tx_id: gasFunding.txId,
      admin_wallet: adminWallet,
      status: "completed",
    });

    // Reset and release
    await poolAddress.update({
      status: "AVAILABLE",
      admin_fee_balance: 0,
      last_swept_at: new Date(),
    });

    console.log(`[MerchantPool] 🧹 Swept ${actualBalance} ${walletType} to admin wallet`);

    return { success: true, amount: actualBalance, txId: sweepTxId };
  } catch (error) {
    await transaction.rollback();
    const message = getErrorMessage(error);
    console.error(`[MerchantPool] ❌ Sweep failed:`, message);
    
    // Try to reset status
    try {
      await merchantTempAddressModel.update(
        { status: "AVAILABLE" },
        { where: { temp_address_id: tempAddressId } }
      );
    } catch {}
    
    throw error;
  }
};

/**
 * Sweep all eligible addresses (called by cron)
 */
export const sweepAllEligibleAddresses = async (): Promise<void> => {
  const eligibleAddresses = await merchantTempAddressModel.findAll({
    where: {
      status: "AVAILABLE",
      admin_fee_balance: { [Op.gte]: POOL_CONFIG.SWEEP_THRESHOLD },
    },
  });

  console.log(`[MerchantPool] Found ${eligibleAddresses.length} addresses eligible for sweep`);

  for (const address of eligibleAddresses) {
    try {
      await sweepPoolAddress(address.dataValues.temp_address_id);
    } catch (error) {
      console.error(`[MerchantPool] Failed to sweep ${address.dataValues.wallet_address}:`, error);
    }
  }
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
      sweepThreshold: POOL_CONFIG.SWEEP_THRESHOLD,
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
  sweepAllEligibleAddresses,
  recordPoolTransaction,
  getPoolStatus,
  findByWalletAddress,
  processQueuedPayments,
  POOL_CONFIG,
  FEE_WALLETS,
  ADMIN_WALLETS,
  TOKEN_CONTRACTS,
};
