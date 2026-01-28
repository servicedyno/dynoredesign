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
  LOCK_TIMEOUT_MINUTES: 120, // Reset IN_USE addresses after 2 hours
  
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
 * Get an available address from the pool
 * Prefers addresses with highest accumulated balance (faster to reach sweep threshold)
 * If NO addresses are available, automatically creates a new one
 */
export const getAvailableAddress = async (
  walletType: "USDT-TRC20" | "USDT-ERC20",
  paymentId?: string
): Promise<any> => {
  const transaction = await sequelize.transaction();
  
  try {
    // First, clean up any stale IN_USE addresses
    await cleanupStaleAddresses(walletType, transaction);

    // Find available address with highest balance
    const poolAddress = await usdtPoolAddressModel.findOne({
      where: {
        wallet_type: walletType,
        status: "AVAILABLE",
      },
      order: [["admin_fee_balance", "DESC"]],
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!poolAddress) {
      // No available address - automatically create new one
      console.log(`[USDTPool] ⚠️ All ${walletType} addresses are IN_USE, creating new one automatically`);
      await transaction.commit();
      
      const newAddress = await addAddressToPool(walletType);
      
      // Mark new address as IN_USE immediately
      const lockTx = await sequelize.transaction();
      try {
        await newAddress.update({
          status: "IN_USE",
          locked_at: new Date(),
          last_used_at: new Date(),
          current_payment_id: paymentId || null,
        }, { transaction: lockTx });
        await lockTx.commit();
        
        console.log(`[USDTPool] ✅ Created and assigned NEW ${walletType} address: ${newAddress.dataValues.wallet_address}`);
        return newAddress;
      } catch (e) {
        await lockTx.rollback();
        throw e;
      }
    }

    // Mark existing address as IN_USE
    await poolAddress.update({
      status: "IN_USE",
      locked_at: new Date(),
      last_used_at: new Date(),
      current_payment_id: paymentId || null,
    }, { transaction });

    await transaction.commit();
    
    console.log(`[USDTPool] ✅ Assigned existing ${walletType} address: ${poolAddress.dataValues.wallet_address} (accumulated: $${poolAddress.dataValues.admin_fee_balance})`);
    
    return poolAddress;
  } catch (error) {
    await transaction.rollback();
    const message = getErrorMessage(error);
    console.error(`[USDTPool] ❌ Failed to get available address:`, message);
    throw error;
  }
};

/**
 * Release an address back to the pool after payment is processed
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

    await poolAddress.update({
      status: "AVAILABLE",
      admin_fee_balance: currentBalance + adminFeeAmount,
      gas_balance: Math.max(0, currentGas - gasUsed),
      total_transactions: currentTxCount + 1,
      current_payment_id: null,
      locked_at: null,
    });

    console.log(`[USDTPool] Released address ${poolAddress.dataValues.wallet_address}, new balance: $${currentBalance + adminFeeAmount}`);

    // Check if sweep threshold reached
    if (currentBalance + adminFeeAmount >= POOL_CONFIG.SWEEP_THRESHOLD) {
      console.log(`[USDTPool] Address ${poolAddress.dataValues.wallet_address} reached sweep threshold ($${POOL_CONFIG.SWEEP_THRESHOLD})`);
      // Sweep will be handled by cron job
    }
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[USDTPool] Failed to release address:`, message);
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
 * Clean up addresses that have been IN_USE for too long
 */
export const cleanupStaleAddresses = async (
  walletType?: string,
  transaction?: Transaction
): Promise<number> => {
  try {
    const timeoutDate = new Date();
    timeoutDate.setMinutes(timeoutDate.getMinutes() - POOL_CONFIG.LOCK_TIMEOUT_MINUTES);

    const whereClause: any = {
      status: "IN_USE",
      locked_at: {
        [Op.lt]: timeoutDate,
      },
    };

    if (walletType) {
      whereClause.wallet_type = walletType;
    }

    const [affectedCount] = await usdtPoolAddressModel.update(
      {
        status: "AVAILABLE",
        current_payment_id: null,
        locked_at: null,
      },
      {
        where: whereClause,
        transaction,
      }
    );

    if (affectedCount > 0) {
      console.log(`[USDTPool] Reset ${affectedCount} stale addresses to AVAILABLE`);
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
      inUseCount: trc20Stats.filter(a => a.dataValues.status === "IN_USE").length,
      totalAccumulatedFees: trc20Total,
      sweepThreshold: POOL_CONFIG.SWEEP_THRESHOLD,
    },
    "USDT-ERC20": {
      addresses: erc20Stats,
      totalAddresses: erc20Stats.length,
      availableCount: erc20Stats.filter(a => a.dataValues.status === "AVAILABLE").length,
      inUseCount: erc20Stats.filter(a => a.dataValues.status === "IN_USE").length,
      totalAccumulatedFees: erc20Total,
      sweepThreshold: POOL_CONFIG.SWEEP_THRESHOLD,
    },
    config: POOL_CONFIG,
  };
};

export default {
  initializePool,
  addAddressToPool,
  getAvailableAddress,
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
