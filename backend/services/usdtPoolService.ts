/**
 * USDT Pool Service
 * 
 * Manages a global pool of reusable USDT addresses for TRC20 and ERC20 payments.
 * Key features:
 * - Address reuse to accumulate admin fees
 * - Gas funding management from fee wallets
 * - Automatic sweeping when threshold is reached
 */

import { Op, Transaction } from "sequelize";
import {
  usdtPoolAddressModel,
  usdtPoolTransactionModel,
  usdtPoolSweepModel,
  adminFeeModel,
} from "../models";
import tatumApi from "../apis/tatumApi";
import sequelize from "../utils/dbInstance";
import { cronLogger } from "../utils/loggers";
import { currencyConvert, getErrorMessage } from "../helper";

// Configuration
const POOL_CONFIG = {
  INITIAL_SIZE: parseInt(process.env.USDT_POOL_INITIAL_SIZE || "2"),
  SWEEP_THRESHOLD: parseFloat(process.env.USDT_POOL_SWEEP_THRESHOLD || "30"),
  
  // Timeout settings
  RESERVATION_TIMEOUT_MINUTES: 30,  // Release address if no payment within 30 min
  PROCESSING_TIMEOUT_MINUTES: 60,   // Extend timeout when payment received, processing
  STALE_LOCK_TIMEOUT_MINUTES: 120,  // Force release stuck addresses after 2 hours (safety)
  
  // Gas funding amounts
  TRC20_GAS_AMOUNT: 60,      // TRX to fund for TRC20 transfer (covers energy burn)
  TRC20_GAS_MIN_DEFICIT: 10, // Only fund if deficit > 10 TRX
  ERC20_GAS_AMOUNT: 0.004,   // ETH to fund for ERC20 transfer
  ERC20_GAS_MIN_DEFICIT: 0.001, // Only fund if deficit > 0.001 ETH
};

// Fee wallet addresses (from .env)
const FEE_WALLETS = {
  TRX: process.env.TRX_FEE_WALLET || "TTXk9SbNj8tnRABdGDM3PZvT5bHqTNtANB",
  ETH: process.env.ETH_FEE_WALLET || "0x033d2bb052e3d85bfe96fbd86cf876a350ad6b1c",
};

// Admin USDT wallets for sweeping
const ADMIN_USDT_WALLETS = {
  "USDT-TRC20": process.env.USDT_TRC20_ADMIN_WALLET || process.env.USDT_TRC20 || "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR",
  "USDT-ERC20": process.env.USDT_ERC20_ADMIN_WALLET || process.env.USDT_ERC20 || "0x9a7221b5e32d5f99e8da95585835442e29afb38f",
};

/**
 * Initialize the pool with initial addresses if empty
 */
export const initializePool = async (walletType: "USDT-TRC20" | "USDT-ERC20"): Promise<void> => {
  try {
    const existingCount = await usdtPoolAddressModel.count({
      where: { wallet_type: walletType },
    });

    if (existingCount >= POOL_CONFIG.INITIAL_SIZE) {
      console.log(`[USDTPool] ${walletType} pool already has ${existingCount} addresses`);
      return;
    }

    const toCreate = POOL_CONFIG.INITIAL_SIZE - existingCount;
    console.log(`[USDTPool] Initializing ${walletType} pool with ${toCreate} new addresses`);

    for (let i = 0; i < toCreate; i++) {
      await addAddressToPool(walletType);
    }

    console.log(`[USDTPool] ${walletType} pool initialized successfully`);
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[USDTPool] Failed to initialize pool:`, message);
    throw error;
  }
};

/**
 * Generate a new address and add it to the pool
 */
export const addAddressToPool = async (walletType: "USDT-TRC20" | "USDT-ERC20"): Promise<any> => {
  try {
    const baseCurrency = walletType === "USDT-TRC20" ? "TRX" : "ETH";
    
    // Get the admin wallet for this currency to use its xpub
    const adminWallet = await (await import("../models")).adminWalletModel.findOne({
      where: { wallet_type: walletType },
    });

    if (!adminWallet) {
      throw new Error(`Admin wallet not found for ${walletType}`);
    }

    // Get current max derivation index from pool
    const maxIndexResult = await usdtPoolAddressModel.max("derivation_index", {
      where: { wallet_type: walletType },
    });
    const nextIndex = (maxIndexResult as number || 0) + 1;

    // Decrypt xpub/mnemonic from admin wallet
    const decryptedData = await tatumApi.decryptSymmetric(
      adminWallet.dataValues.xpub_mnemonic,
      process.env.XPUB_KEY_ID
    );
    const walletData = JSON.parse(decryptedData);

    // Generate address using the xpub
    const { address, privateKey } = await tatumApi.generateUserAddress({
      currency: walletType,
      xpub: walletData.xpub,
      index: nextIndex,
      mnemonic: walletData.mnemonic,
    });

    // Encrypt private key for storage
    const encryptedPrivateKey = await tatumApi.encryptSymmetric(
      privateKey,
      process.env.TEMP_KEY_ID
    );

    // Create Tatum subscription for this address
    const { id: subscriptionId } = await tatumApi.createSubscription(
      address,
      walletType,
      true // onlyCrypto
    );

    // Create pool address record
    const poolAddress = await usdtPoolAddressModel.create({
      wallet_type: walletType,
      wallet_address: address,
      private_key: encryptedPrivateKey,
      derivation_index: nextIndex,
      subscription_id: subscriptionId,
      status: "AVAILABLE",
      admin_fee_balance: 0,
      gas_balance: 0,
    });

    // Update admin wallet's last index
    await adminWallet.update({
      last_index: nextIndex,
    });

    console.log(`[USDTPool] Added new ${walletType} address to pool: ${address} (index: ${nextIndex})`);
    
    return poolAddress;
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[USDTPool] Failed to add address to pool:`, message);
    throw error;
  }
};

/**
 * Reserve an address from the pool for a payment
 * 
 * STATES:
 * - AVAILABLE: Ready to be assigned
 * - RESERVED: Assigned to payment, waiting for customer to pay (30 min timeout)
 * - PROCESSING: Payment received, transferring to merchant
 * - SWEEPING: Being swept to admin wallet
 * 
 * Priority selection:
 *   1. Highest accumulated admin fee balance (faster to reach sweep threshold)
 *   2. Highest transaction count (more active = better)
 * 
 * If NO addresses are available, automatically creates a new one
 */
export const reserveAddress = async (
  walletType: "USDT-TRC20" | "USDT-ERC20",
  paymentId: string,
  companyId: number,
  userId: number,
  expectedAmount: number
): Promise<any> => {
  const transaction = await sequelize.transaction();
  
  try {
    // First, release any expired reservations
    await releaseExpiredReservations(walletType, transaction);

    // Find available address - prioritize by:
    // 1. Highest admin_fee_balance (faster to reach sweep threshold)
    // 2. Highest total_transactions (more proven/active addresses)
    const poolAddress = await usdtPoolAddressModel.findOne({
      where: {
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

    // Calculate reservation expiry (30 minutes from now)
    const reservedUntil = new Date();
    reservedUntil.setMinutes(reservedUntil.getMinutes() + POOL_CONFIG.RESERVATION_TIMEOUT_MINUTES);

    if (!poolAddress) {
      // No available address - automatically create new one
      console.log(`[USDTPool] ⚠️ All ${walletType} addresses are in use, creating new one automatically`);
      await transaction.commit();
      
      const newAddress = await addAddressToPool(walletType);
      
      // Reserve new address immediately
      const lockTx = await sequelize.transaction();
      try {
        await newAddress.update({
          status: "RESERVED",
          locked_at: new Date(),
          last_used_at: new Date(),
          current_payment_id: paymentId,
          current_company_id: companyId,
          current_user_id: userId,
          expected_amount: expectedAmount,
          received_amount: 0,
          is_partial_payment: false,
          reserved_until: reservedUntil,
        }, { transaction: lockTx });
        await lockTx.commit();
        
        console.log(`[USDTPool] ✅ Created and RESERVED new ${walletType} address: ${newAddress.dataValues.wallet_address}`);
        console.log(`[USDTPool]    - Payment ID: ${paymentId}`);
        console.log(`[USDTPool]    - Company ID: ${companyId}`);
        console.log(`[USDTPool]    - Expected: $${expectedAmount} USDT`);
        console.log(`[USDTPool]    - Expires: ${reservedUntil.toISOString()}`);
        return newAddress;
      } catch (e) {
        await lockTx.rollback();
        throw e;
      }
    }

    // Reserve existing address
    await poolAddress.update({
      status: "RESERVED",
      locked_at: new Date(),
      last_used_at: new Date(),
      current_payment_id: paymentId,
      current_company_id: companyId,
      current_user_id: userId,
      expected_amount: expectedAmount,
      received_amount: 0,
      is_partial_payment: false,
      reserved_until: reservedUntil,
    }, { transaction });

    await transaction.commit();
    
    console.log(`[USDTPool] ✅ RESERVED ${walletType} address: ${poolAddress.dataValues.wallet_address}`);
    console.log(`[USDTPool]    - Payment ID: ${paymentId}`);
    console.log(`[USDTPool]    - Company ID: ${companyId}`);
    console.log(`[USDTPool]    - Expected: $${expectedAmount} USDT`);
    console.log(`[USDTPool]    - Accumulated balance: $${poolAddress.dataValues.admin_fee_balance}`);
    console.log(`[USDTPool]    - Expires: ${reservedUntil.toISOString()}`);
    
    return poolAddress;
  } catch (error) {
    await transaction.rollback();
    const message = getErrorMessage(error);
    console.error(`[USDTPool] ❌ Failed to reserve address:`, message);
    throw error;
  }
};

/**
 * Legacy function - wraps reserveAddress for backward compatibility
 */
export const getAvailableAddress = async (
  walletType: "USDT-TRC20" | "USDT-ERC20",
  paymentId?: string
): Promise<any> => {
  // For backward compatibility, use default values
  return reserveAddress(walletType, paymentId || `legacy-${Date.now()}`, 0, 0, 0);
};

/**
 * Mark address as PROCESSING when payment is received
 * This extends the timeout and prevents the address from being released due to reservation expiry
 */
export const markPaymentReceived = async (
  poolAddressId: number,
  actualAmount: number,
  incomingTxId: string
): Promise<void> => {
  try {
    const poolAddress = await usdtPoolAddressModel.findByPk(poolAddressId);
    
    if (!poolAddress) {
      throw new Error(`Pool address not found: ${poolAddressId}`);
    }

    // Extend timeout for processing
    const processingUntil = new Date();
    processingUntil.setMinutes(processingUntil.getMinutes() + POOL_CONFIG.PROCESSING_TIMEOUT_MINUTES);

    await poolAddress.update({
      status: "PROCESSING",
      reserved_until: processingUntil,  // Extend timeout
    });

    console.log(`[USDTPool] 💰 Payment received for ${poolAddress.dataValues.wallet_address}`);
    console.log(`[USDTPool]    - Amount: $${actualAmount} USDT`);
    console.log(`[USDTPool]    - Expected: $${poolAddress.dataValues.expected_amount} USDT`);
    console.log(`[USDTPool]    - TX: ${incomingTxId}`);
    console.log(`[USDTPool]    - Status: PROCESSING (timeout extended to ${processingUntil.toISOString()})`);
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[USDTPool] ❌ Failed to mark payment received:`, message);
    throw error;
  }
};

/**
 * Handle partial payment - customer paid less than expected
 * Address stays RESERVED with 30-minute grace period for additional payment
 */
export const handlePartialPayment = async (
  poolAddressId: number,
  receivedAmount: number,
  incomingTxId: string
): Promise<{ pendingAmount: number; graceDeadline: Date }> => {
  try {
    const poolAddress = await usdtPoolAddressModel.findByPk(poolAddressId);
    
    if (!poolAddress) {
      throw new Error(`Pool address not found: ${poolAddressId}`);
    }

    const expectedAmount = parseFloat(poolAddress.dataValues.expected_amount) || 0;
    const previousReceived = parseFloat(poolAddress.dataValues.received_amount) || 0;
    const totalReceived = previousReceived + receivedAmount;
    const pendingAmount = Math.max(0, expectedAmount - totalReceived);

    // Set 30-minute grace period from first partial payment
    const graceDeadline = new Date();
    graceDeadline.setMinutes(graceDeadline.getMinutes() + 30);

    await poolAddress.update({
      status: "RESERVED",  // Stay reserved, waiting for more
      received_amount: totalReceived,
      is_partial_payment: true,
      partial_payment_timestamp: poolAddress.dataValues.partial_payment_timestamp || new Date(),
      reserved_until: graceDeadline,  // Extend reservation for grace period
    });

    console.log(`[USDTPool] ⚠️ PARTIAL PAYMENT received for ${poolAddress.dataValues.wallet_address}`);
    console.log(`[USDTPool]    - Received now: $${receivedAmount} USDT`);
    console.log(`[USDTPool]    - Total received: $${totalReceived} USDT`);
    console.log(`[USDTPool]    - Expected: $${expectedAmount} USDT`);
    console.log(`[USDTPool]    - Pending: $${pendingAmount} USDT`);
    console.log(`[USDTPool]    - Grace period until: ${graceDeadline.toISOString()}`);
    console.log(`[USDTPool]    - Address stays RESERVED waiting for more payment`);

    return { pendingAmount, graceDeadline };
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[USDTPool] ❌ Failed to handle partial payment:`, message);
    throw error;
  }
};

/**
 * Handle below-threshold payment - amount too small to forward
 * 100% goes to admin fee (accumulates in pool), no merchant transfer
 */
export const handleBelowThresholdPayment = async (
  poolAddressId: number,
  receivedAmount: number,
  incomingTxId: string
): Promise<void> => {
  try {
    const poolAddress = await usdtPoolAddressModel.findByPk(poolAddressId);
    
    if (!poolAddress) {
      throw new Error(`Pool address not found: ${poolAddressId}`);
    }

    const currentAdminBalance = parseFloat(poolAddress.dataValues.admin_fee_balance) || 0;
    const currentTxCount = poolAddress.dataValues.total_transactions || 0;

    // 100% goes to admin fee - no merchant transfer
    await poolAddress.update({
      status: "AVAILABLE",  // Release immediately
      admin_fee_balance: currentAdminBalance + receivedAmount,  // All to admin
      total_transactions: currentTxCount + 1,
      current_payment_id: null,
      current_company_id: null,
      current_user_id: null,
      expected_amount: null,
      received_amount: null,
      is_partial_payment: false,
      partial_payment_timestamp: null,
      reserved_until: null,
      locked_at: null,
    });

    console.log(`[USDTPool] 📉 BELOW THRESHOLD payment for ${poolAddress.dataValues.wallet_address}`);
    console.log(`[USDTPool]    - Amount: $${receivedAmount} USDT`);
    console.log(`[USDTPool]    - 100% goes to admin fee (no merchant transfer)`);
    console.log(`[USDTPool]    - New admin balance: $${currentAdminBalance + receivedAmount}`);
    console.log(`[USDTPool]    - Address released to AVAILABLE`);

    // Check if sweep threshold reached
    if (currentAdminBalance + receivedAmount >= POOL_CONFIG.SWEEP_THRESHOLD) {
      console.log(`[USDTPool] 📍 Address reached sweep threshold ($${POOL_CONFIG.SWEEP_THRESHOLD}) - will be swept by cron`);
    }
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[USDTPool] ❌ Failed to handle below-threshold payment:`, message);
    throw error;
  }
};

/**
 * Process expired partial payments (after 30-min grace period)
 * Called by cron to handle partial payments that weren't completed
 */
export const processExpiredPartialPayments = async (): Promise<void> => {
  try {
    const now = new Date();

    // Find addresses with expired partial payments
    const expiredPartials = await usdtPoolAddressModel.findAll({
      where: {
        status: "RESERVED",
        is_partial_payment: true,
        reserved_until: {
          [Op.lt]: now,
        },
      },
    });

    console.log(`[USDTPool] Processing ${expiredPartials.length} expired partial payments...`);

    for (const address of expiredPartials) {
      try {
        const receivedAmount = parseFloat(address.dataValues.received_amount) || 0;
        const walletType = address.dataValues.wallet_type;
        
        // Get forwarding threshold for this currency
        const thresholdKey = walletType === "USDT-TRC20" ? "USDT_TRC20_THRESHOLD" : "USDT_ERC20_THRESHOLD";
        const threshold = parseFloat(process.env[thresholdKey] || "3");

        console.log(`[USDTPool] ⏰ Expired partial payment: ${address.dataValues.wallet_address}`);
        console.log(`[USDTPool]    - Payment ID: ${address.dataValues.current_payment_id}`);
        console.log(`[USDTPool]    - Received: $${receivedAmount} USDT`);
        console.log(`[USDTPool]    - Threshold: $${threshold}`);

        if (receivedAmount < threshold) {
          // Below threshold - all goes to admin
          console.log(`[USDTPool]    - Below threshold: 100% to admin fee`);
          await handleBelowThresholdPayment(
            address.dataValues.pool_address_id,
            receivedAmount,
            "expired-partial"
          );
        } else {
          // Above threshold - needs to be forwarded to merchant
          // This will be handled by the payment controller's processIncompletePayments
          console.log(`[USDTPool]    - Above threshold: Marking for merchant forwarding`);
          await address.update({
            status: "PROCESSING",
            reserved_until: new Date(Date.now() + 60 * 60 * 1000), // 1 hour to process
          });
        }
      } catch (error) {
        const message = getErrorMessage(error);
        console.error(`[USDTPool] Failed to process expired partial for ${address.dataValues.wallet_address}:`, message);
      }
    }
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[USDTPool] Fatal error in processExpiredPartialPayments:`, message);
  }
};

/**
 * Release expired reservations back to AVAILABLE
 * Called before selecting a new address to ensure we don't have stuck addresses
 */
export const releaseExpiredReservations = async (
  walletType?: string,
  transaction?: Transaction
): Promise<number> => {
  try {
    const now = new Date();

    const whereClause: any = {
      status: "RESERVED",  // Only release RESERVED, not PROCESSING
      reserved_until: {
        [Op.lt]: now,
      },
    };

    if (walletType) {
      whereClause.wallet_type = walletType;
    }

    const expiredAddresses = await usdtPoolAddressModel.findAll({
      where: whereClause,
      transaction,
    });

    for (const address of expiredAddresses) {
      console.log(`[USDTPool] ⏰ Releasing expired reservation: ${address.dataValues.wallet_address}`);
      console.log(`[USDTPool]    - Payment ID: ${address.dataValues.current_payment_id}`);
      console.log(`[USDTPool]    - Reserved until: ${address.dataValues.reserved_until}`);
      console.log(`[USDTPool]    - Customer did not pay within 30 minutes`);
    }

    const [affectedCount] = await usdtPoolAddressModel.update(
      {
        status: "AVAILABLE",
        current_payment_id: null,
        current_company_id: null,
        expected_amount: null,
        reserved_until: null,
        locked_at: null,
      },
      {
        where: whereClause,
        transaction,
      }
    );

    if (affectedCount > 0) {
      console.log(`[USDTPool] ⏰ Released ${affectedCount} expired reservations back to AVAILABLE`);
    }

    return affectedCount;
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[USDTPool] Failed to release expired reservations:`, message);
    return 0;
  }
};

/**
 * Handle late payment - when customer pays AFTER reservation expired
 * The address may have been re-assigned to another payment
 */
export const handleLatePayment = async (
  walletAddress: string,
  amount: number,
  txId: string
): Promise<{ handled: boolean; action: string; details: any }> => {
  try {
    const poolAddress = await usdtPoolAddressModel.findOne({
      where: { wallet_address: walletAddress },
    });

    if (!poolAddress) {
      return {
        handled: false,
        action: "ADDRESS_NOT_IN_POOL",
        details: { walletAddress, amount, txId },
      };
    }

    const status = poolAddress.dataValues.status;
    const currentPaymentId = poolAddress.dataValues.current_payment_id;

    console.log(`[USDTPool] 🚨 Late/unexpected payment detected!`);
    console.log(`[USDTPool]    - Address: ${walletAddress}`);
    console.log(`[USDTPool]    - Amount: $${amount} USDT`);
    console.log(`[USDTPool]    - TX: ${txId}`);
    console.log(`[USDTPool]    - Current status: ${status}`);
    console.log(`[USDTPool]    - Current payment ID: ${currentPaymentId || 'none'}`);

    if (status === "AVAILABLE") {
      // Address was released (expired or completed)
      // This is an orphan payment - needs manual handling
      return {
        handled: false,
        action: "ORPHAN_PAYMENT",
        details: {
          walletAddress,
          amount,
          txId,
          message: "Payment received to AVAILABLE address - may be late payment after reservation expired",
          recommendation: "Check if there's a recently expired payment for this amount",
        },
      };
    }

    if (status === "RESERVED" || status === "PROCESSING") {
      // Address is assigned to a payment - this is the expected payment
      return {
        handled: true,
        action: "PROCESS_NORMALLY",
        details: {
          walletAddress,
          amount,
          txId,
          paymentId: currentPaymentId,
        },
      };
    }

    if (status === "SWEEPING") {
      // Address is being swept - payment arrived during sweep
      return {
        handled: false,
        action: "PAYMENT_DURING_SWEEP",
        details: {
          walletAddress,
          amount,
          txId,
          message: "Payment received while address was being swept",
          recommendation: "Wait for sweep to complete, then process this payment",
        },
      };
    }

    return {
      handled: false,
      action: "UNKNOWN_STATUS",
      details: { walletAddress, amount, txId, status },
    };
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[USDTPool] ❌ Failed to handle late payment:`, message);
    return {
      handled: false,
      action: "ERROR",
      details: { error: message },
    };
  }
};

/**
 * Release an address back to the pool after MERCHANT PAYMENT is sent
 * 
 * IMPORTANT FLOW:
 * 1. Customer sends USDT to pool address (address is RESERVED → PROCESSING)
 * 2. Gas is funded from fee wallet
 * 3. Merchant portion is transferred to merchant wallet
 * 4. Admin fee STAYS in the pool address (accumulates)
 * 5. Address is released back to AVAILABLE immediately
 * 6. Admin fee will be swept later by cron when threshold reached
 * 
 * The address becomes AVAILABLE right after merchant payment - it does NOT
 * wait for admin fee sweep. This allows the address to be reused quickly
 * while admin fees accumulate.
 */
export const releaseAddress = async (
  poolAddressId: number,
  adminFeeAmount: number,
  gasUsed: number = 0
): Promise<void> => {
  try {
    const poolAddress = await usdtPoolAddressModel.findByPk(poolAddressId);
    
    if (!poolAddress) {
      throw new Error(`Pool address not found: ${poolAddressId}`);
    }

    const currentBalance = parseFloat(poolAddress.dataValues.admin_fee_balance) || 0;
    const currentGas = parseFloat(poolAddress.dataValues.gas_balance) || 0;
    const currentTxCount = poolAddress.dataValues.total_transactions || 0;

    // Release address back to AVAILABLE - clear all payment-specific fields
    await poolAddress.update({
      status: "AVAILABLE",  // Ready for next payment immediately
      admin_fee_balance: currentBalance + adminFeeAmount,  // Accumulate admin fee
      gas_balance: Math.max(0, currentGas - gasUsed),
      total_transactions: currentTxCount + 1,
      current_payment_id: null,
      current_company_id: null,
      current_user_id: null,
      expected_amount: null,
      received_amount: null,
      is_partial_payment: false,
      partial_payment_timestamp: null,
      reserved_until: null,
      locked_at: null,
    });

    console.log(`[USDTPool] ✅ Released address ${poolAddress.dataValues.wallet_address} back to AVAILABLE`);
    console.log(`[USDTPool]    - Admin fee added: $${adminFeeAmount}`);
    console.log(`[USDTPool]    - Total accumulated: $${currentBalance + adminFeeAmount}`);
    console.log(`[USDTPool]    - Total transactions: ${currentTxCount + 1}`);

    // Check if sweep threshold reached
    if (currentBalance + adminFeeAmount >= POOL_CONFIG.SWEEP_THRESHOLD) {
      console.log(`[USDTPool] 📍 Address reached sweep threshold ($${POOL_CONFIG.SWEEP_THRESHOLD}) - will be swept by cron`);
    }
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[USDTPool] ❌ Failed to release address:`, message);
    throw error;
  }
};

/**
 * Fund gas to a pool address if needed
 */
export const fundGasIfNeeded = async (
  poolAddress: any,
  walletType: "USDT-TRC20" | "USDT-ERC20"
): Promise<{ funded: boolean; amount: number; txId?: string }> => {
  try {
    const gasType = walletType === "USDT-TRC20" ? "TRX" : "ETH";
    const feeWalletAddress = FEE_WALLETS[gasType];
    
    // Get current gas balance on-chain
    const balanceResult = await tatumApi.getAddressBalance(
      poolAddress.wallet_address,
      gasType
    );
    
    let currentBalance = Number(balanceResult?.balance ?? 0);
    
    // Convert from SUN to TRX for TRON
    if (gasType === "TRX") {
      currentBalance = currentBalance / 1000000;
    }

    console.log(`[USDTPool] Current gas balance for ${poolAddress.wallet_address}: ${currentBalance} ${gasType}`);

    // Determine required gas and deficit
    let requiredGas: number;
    let minDeficit: number;

    if (walletType === "USDT-TRC20") {
      requiredGas = POOL_CONFIG.TRC20_GAS_AMOUNT;
      minDeficit = POOL_CONFIG.TRC20_GAS_MIN_DEFICIT;
    } else {
      requiredGas = POOL_CONFIG.ERC20_GAS_AMOUNT;
      minDeficit = POOL_CONFIG.ERC20_GAS_MIN_DEFICIT;
    }

    const deficit = requiredGas - currentBalance;

    if (deficit <= minDeficit) {
      console.log(`[USDTPool] No gas funding needed, deficit (${deficit}) <= min (${minDeficit})`);
      // Update estimated gas balance
      await poolAddress.update({ gas_balance: currentBalance });
      return { funded: false, amount: 0 };
    }

    // Get fee wallet private key
    const feeWallet = await adminFeeModel.findOne({
      where: { wallet_type: gasType },
    });

    if (!feeWallet) {
      throw new Error(`Fee wallet not found for ${gasType}`);
    }

    const feeWalletPrivateKey = await tatumApi.decryptSymmetric(
      feeWallet.dataValues.privateKey,
      process.env.TEMP_KEY_ID
    );

    // Estimate fees for gas transfer
    let transferFees = null;
    if (gasType === "ETH") {
      transferFees = await tatumApi.feeEstimation(
        gasType,
        feeWalletAddress,
        poolAddress.wallet_address,
        deficit
      );
    }

    // Transfer gas from fee wallet to pool address
    console.log(`[USDTPool] Funding ${deficit} ${gasType} to ${poolAddress.wallet_address}`);
    
    const txResult = await tatumApi.assetToOtherAddress({
      currency: gasType,
      fromAddress: feeWalletAddress,
      toAddress: poolAddress.wallet_address,
      privateKey: feeWalletPrivateKey,
      amount: deficit,
      fee: transferFees,
    });

    // Update pool address gas balance
    await poolAddress.update({ gas_balance: currentBalance + deficit });

    // Update fee wallet balance tracking
    const feeWalletBalance = parseFloat(feeWallet.dataValues.amount) || 0;
    const gasFeeUsed = transferFees?.slow ? parseFloat(transferFees.slow) : 0;
    await feeWallet.update({
      amount: feeWalletBalance - deficit - gasFeeUsed,
    });

    console.log(`[USDTPool] Gas funded successfully. TX: ${txResult?.txId}`);

    return {
      funded: true,
      amount: deficit,
      txId: txResult?.txId,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[USDTPool] Failed to fund gas:`, message);
    throw error;
  }
};

/**
 * Clean up addresses that are stuck in any non-AVAILABLE state for too long
 * This is a safety net for edge cases where normal release didn't happen
 */
export const cleanupStaleAddresses = async (
  walletType?: string,
  transaction?: Transaction
): Promise<number> => {
  try {
    // Safety timeout - force release any address stuck for over 2 hours
    const safetyTimeoutDate = new Date();
    safetyTimeoutDate.setMinutes(safetyTimeoutDate.getMinutes() - POOL_CONFIG.STALE_LOCK_TIMEOUT_MINUTES);

    const whereClause: any = {
      status: {
        [Op.in]: ["RESERVED", "PROCESSING"],  // Not SWEEPING - that's handled separately
      },
      locked_at: {
        [Op.lt]: safetyTimeoutDate,
      },
    };

    if (walletType) {
      whereClause.wallet_type = walletType;
    }

    const stuckAddresses = await usdtPoolAddressModel.findAll({
      where: whereClause,
      transaction,
    });

    for (const address of stuckAddresses) {
      console.log(`[USDTPool] 🚨 Force-releasing stuck address: ${address.dataValues.wallet_address}`);
      console.log(`[USDTPool]    - Status: ${address.dataValues.status}`);
      console.log(`[USDTPool]    - Payment ID: ${address.dataValues.current_payment_id}`);
      console.log(`[USDTPool]    - Locked at: ${address.dataValues.locked_at}`);
      console.log(`[USDTPool]    - Stuck for over ${POOL_CONFIG.STALE_LOCK_TIMEOUT_MINUTES} minutes`);
    }

    const [affectedCount] = await usdtPoolAddressModel.update(
      {
        status: "AVAILABLE",
        current_payment_id: null,
        current_company_id: null,
        expected_amount: null,
        reserved_until: null,
        locked_at: null,
      },
      {
        where: whereClause,
        transaction,
      }
    );

    if (affectedCount > 0) {
      console.log(`[USDTPool] 🚨 Force-released ${affectedCount} stuck addresses to AVAILABLE`);
    }

    return affectedCount;
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[USDTPool] Failed to cleanup stale addresses:`, message);
    return 0;
  }
};

/**
 * Sweep accumulated admin fees from pool addresses to admin wallet
 */
export const sweepPoolAddress = async (poolAddressId: number): Promise<any> => {
  const transaction = await sequelize.transaction();
  
  try {
    const poolAddress = await usdtPoolAddressModel.findByPk(poolAddressId, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!poolAddress) {
      throw new Error(`Pool address not found: ${poolAddressId}`);
    }

    if (poolAddress.dataValues.status !== "AVAILABLE") {
      console.log(`[USDTPool] Address ${poolAddressId} is not AVAILABLE, skipping sweep`);
      await transaction.rollback();
      return null;
    }

    const walletType = poolAddress.dataValues.wallet_type;
    const adminWalletAddress = ADMIN_USDT_WALLETS[walletType];
    const gasType = walletType === "USDT-TRC20" ? "TRX" : "ETH";
    const contractAddress = walletType === "USDT-TRC20" 
      ? process.env.TRX_CONTRACT 
      : process.env.ETH_CONTRACT;

    // Mark as SWEEPING
    await poolAddress.update({ status: "SWEEPING" }, { transaction });

    // Get actual USDT balance on-chain
    const usdtBalance = await tatumApi.getAddressBalance(
      poolAddress.dataValues.wallet_address,
      walletType
    );

    const actualBalance = Number(usdtBalance?.balance ?? 0);
    
    if (actualBalance <= 0) {
      console.log(`[USDTPool] No USDT balance to sweep for ${poolAddress.dataValues.wallet_address}`);
      await poolAddress.update({
        status: "AVAILABLE",
        admin_fee_balance: 0,
      }, { transaction });
      await transaction.commit();
      return null;
    }

    console.log(`[USDTPool] Sweeping ${actualBalance} USDT from ${poolAddress.dataValues.wallet_address}`);

    // Create sweep record
    const sweepRecord = await usdtPoolSweepModel.create({
      pool_address_id: poolAddressId,
      wallet_type: walletType,
      amount_swept: actualBalance,
      to_address: adminWalletAddress,
      status: "pending",
    }, { transaction });

    await transaction.commit();

    // Fund gas if needed (outside transaction)
    const gasFunding = await fundGasIfNeeded(poolAddress.dataValues, walletType);
    
    if (gasFunding.funded) {
      await sweepRecord.update({
        gas_funded: gasFunding.amount,
        gas_funding_tx_id: gasFunding.txId,
        status: "gas_funded",
      });
    }

    // Decrypt private key
    const privateKey = await tatumApi.decryptSymmetric(
      poolAddress.dataValues.private_key,
      process.env.TEMP_KEY_ID
    );

    // Estimate fees for USDT transfer
    const fees = await tatumApi.feeEstimation(
      walletType,
      poolAddress.dataValues.wallet_address,
      adminWalletAddress,
      actualBalance,
      contractAddress
    );

    // Transfer USDT to admin wallet
    const txResult = await tatumApi.assetToOtherAddress({
      currency: walletType,
      fromAddress: poolAddress.dataValues.wallet_address,
      toAddress: adminWalletAddress,
      privateKey: privateKey,
      amount: actualBalance,
      fee: fees,
      contractAddress,
    });

    // Convert to USD for logging
    const usdValue = await currencyConvert({
      sourceCurrency: "USDT",
      currency: ["USD"],
      amount: actualBalance,
      fixedDecimal: true,
    });

    // Update sweep record
    await sweepRecord.update({
      sweep_tx_id: txResult?.txId,
      gas_used: fees?.fast || fees?.slow || 0,
      amount_in_usd: usdValue[0]?.amount || actualBalance,
      status: "completed",
    });

    // Update pool address
    await poolAddress.update({
      status: "AVAILABLE",
      admin_fee_balance: 0,
      last_swept_at: new Date(),
    });

    console.log(`[USDTPool] Sweep completed: ${actualBalance} USDT ($${usdValue[0]?.amount}) - TX: ${txResult?.txId}`);

    return {
      amount: actualBalance,
      txId: txResult?.txId,
      usdValue: usdValue[0]?.amount,
    };
  } catch (error) {
    await transaction.rollback();
    
    // Reset pool address status
    try {
      await usdtPoolAddressModel.update(
        { status: "AVAILABLE" },
        { where: { pool_address_id: poolAddressId } }
      );
    } catch (e) {
      // Ignore
    }

    const message = getErrorMessage(error);
    console.error(`[USDTPool] Failed to sweep address ${poolAddressId}:`, message);
    throw error;
  }
};

/**
 * Cron job: Sweep all pool addresses that have reached threshold
 */
export const sweepAllEligibleAddresses = async (): Promise<void> => {
  console.log("[USDTPool] Starting sweep of eligible addresses...");
  
  try {
    // Find all AVAILABLE addresses with balance >= threshold
    const eligibleAddresses = await usdtPoolAddressModel.findAll({
      where: {
        status: "AVAILABLE",
        admin_fee_balance: {
          [Op.gte]: POOL_CONFIG.SWEEP_THRESHOLD,
        },
      },
    });

    console.log(`[USDTPool] Found ${eligibleAddresses.length} addresses eligible for sweep`);

    for (const address of eligibleAddresses) {
      try {
        await sweepPoolAddress(address.dataValues.pool_address_id);
      } catch (error) {
        const message = getErrorMessage(error);
        console.error(`[USDTPool] Failed to sweep address ${address.dataValues.pool_address_id}:`, message);
        cronLogger.error(`[USDTPool] Sweep failed for ${address.dataValues.wallet_address}`, {}, new Error(error));
      }
    }

    console.log("[USDTPool] Sweep cycle completed");
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("[USDTPool] Fatal error in sweep cycle:", message);
    cronLogger.error("[USDTPool] Fatal sweep error", {}, new Error(error));
  }
};

/**
 * Record a transaction in the pool transaction log
 */
export const recordPoolTransaction = async (data: {
  poolAddressId: number;
  tempId?: number;
  companyId?: number;
  userId?: number;
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
  return await usdtPoolTransactionModel.create({
    pool_address_id: data.poolAddressId,
    temp_id: data.tempId,
    company_id: data.companyId,
    user_id: data.userId,
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
 * Get pool status for admin dashboard
 */
export const getPoolStatus = async (): Promise<any> => {
  const [trc20Stats, erc20Stats] = await Promise.all([
    usdtPoolAddressModel.findAll({
      where: { wallet_type: "USDT-TRC20" },
      attributes: [
        "pool_address_id",
        "wallet_address",
        "status",
        "admin_fee_balance",
        "gas_balance",
        "total_transactions",
        "last_used_at",
        "last_swept_at",
      ],
    }),
    usdtPoolAddressModel.findAll({
      where: { wallet_type: "USDT-ERC20" },
      attributes: [
        "pool_address_id",
        "wallet_address",
        "status",
        "admin_fee_balance",
        "gas_balance",
        "total_transactions",
        "last_used_at",
        "last_swept_at",
      ],
    }),
  ]);

  const trc20Total = trc20Stats.reduce((sum, addr) => sum + parseFloat(addr.dataValues.admin_fee_balance || 0), 0);
  const erc20Total = erc20Stats.reduce((sum, addr) => sum + parseFloat(addr.dataValues.admin_fee_balance || 0), 0);

  return {
    "USDT-TRC20": {
      addresses: trc20Stats,
      totalAddresses: trc20Stats.length,
      availableCount: trc20Stats.filter(a => a.dataValues.status === "AVAILABLE").length,
      reservedCount: trc20Stats.filter(a => a.dataValues.status === "RESERVED").length,
      processingCount: trc20Stats.filter(a => a.dataValues.status === "PROCESSING").length,
      sweepingCount: trc20Stats.filter(a => a.dataValues.status === "SWEEPING").length,
      totalAccumulatedFees: trc20Total,
      sweepThreshold: POOL_CONFIG.SWEEP_THRESHOLD,
      autoExpands: true,
    },
    "USDT-ERC20": {
      addresses: erc20Stats,
      totalAddresses: erc20Stats.length,
      availableCount: erc20Stats.filter(a => a.dataValues.status === "AVAILABLE").length,
      reservedCount: erc20Stats.filter(a => a.dataValues.status === "RESERVED").length,
      processingCount: erc20Stats.filter(a => a.dataValues.status === "PROCESSING").length,
      sweepingCount: erc20Stats.filter(a => a.dataValues.status === "SWEEPING").length,
      totalAccumulatedFees: erc20Total,
      sweepThreshold: POOL_CONFIG.SWEEP_THRESHOLD,
      autoExpands: true,
    },
    config: POOL_CONFIG,
    stateDescriptions: {
      AVAILABLE: "Ready for new payment",
      RESERVED: "Assigned to payment, waiting for customer (30 min timeout)",
      PROCESSING: "Payment received, transferring to merchant",
      SWEEPING: "Admin fees being swept to admin wallet",
    },
  };
};

export default {
  initializePool,
  addAddressToPool,
  getAvailableAddress,
  reserveAddress,
  markPaymentReceived,
  handlePartialPayment,
  handleBelowThresholdPayment,
  processExpiredPartialPayments,
  releaseExpiredReservations,
  handleLatePayment,
  releaseAddress,
  fundGasIfNeeded,
  cleanupStaleAddresses,
  sweepPoolAddress,
  sweepAllEligibleAddresses,
  recordPoolTransaction,
  getPoolStatus,
  POOL_CONFIG,
  FEE_WALLETS,
  ADMIN_USDT_WALLETS,
};
