/**
 * Merchant Pool Sweep Operations
 * 
 * Handles gas funding, sweep execution, and scheduled sweep orchestration.
 */

import {
  merchantTempAddressModel,
  merchantPoolSweepModel,
  GAS_TOKEN_MAPPING,
  ACCOUNT_CHAINS,
} from "../../models";
import tatumApi from "../../apis/tatumApi";
import { getErrorMessage } from "../../helper";
import { convertToUSD, convertToFiat } from "../../utils/currencyUtils";
import {
  POOL_CONFIG,
  UTXO_CHAINS,
  TOKEN_CHAINS,
  FEE_WALLETS,
  ADMIN_WALLETS,
  getSweepConfig,
  withRetry,
  Op,
} from "./merchantPoolConfig";
import sequelize from "../../utils/dbInstance";

/**
 * Smart Gas Funding for account-based chains (ETH, TRX)
 */
export const fundGasIfNeeded = async (
  poolAddress: { dataValues: { wallet_address: string }; update: (data: Record<string, unknown>) => Promise<void> },
  walletType: string,
  transferAmount?: number,
  recipientAddress?: string
): Promise<{ funded: boolean; amount: number; txId?: string; reason?: string }> => {
  if (UTXO_CHAINS.includes(walletType)) {
    return { funded: false, amount: 0, reason: 'UTXO chain - no gas needed' };
  }

  const gasToken = GAS_TOKEN_MAPPING[walletType];
  if (!gasToken) {
    return { funded: false, amount: 0, reason: 'No gas token mapping' };
  }

  const feeWalletAddress = FEE_WALLETS[gasToken];
  if (!feeWalletAddress) {
    console.warn(`[SmartGas] No fee wallet configured for ${gasToken}`);
    return { funded: false, amount: 0, reason: 'No fee wallet configured' };
  }

  try {
    const tempAddress = poolAddress.dataValues.wallet_address;
    
    let balanceResult;
    try {
      balanceResult = await tatumApi.getAddressBalance(tempAddress, gasToken);
    } catch (balanceError: unknown) {
      const balErr = balanceError as { message?: string };
      if ((balErr.message || '').includes('account.not.found') || (balErr.message || '').includes('not.found')) {
        console.log(`[SmartGas] Account not yet activated on-chain: ${tempAddress}, assuming 0 balance`);
        balanceResult = { balance: '0' };
      } else {
        throw balanceError;
      }
    }
    let currentBalance = Number(balanceResult?.balance ?? 0);
    
    if (gasToken === "TRX") {
      currentBalance = currentBalance / 1000000;
    }

    console.log(`[SmartGas] Current balance: ${currentBalance} ${gasToken} in ${tempAddress}`);

    let estimatedGas = 0;
    
    try {
      let contractAddress: string | undefined;
      if (walletType === 'USDT-ERC20') {
        contractAddress = process.env.ETH_CONTRACT;
      } else if (walletType === 'USDC-ERC20') {
        contractAddress = process.env.USDC_CONTRACT;
      } else if (walletType === 'USDT-TRC20') {
        contractAddress = process.env.TRX_CONTRACT;
      }
      
      const estimationRecipient = recipientAddress || feeWalletAddress;
      const estimationAmount = transferAmount || 100;
      
      const feeEstimate = await tatumApi.feeEstimation(
        walletType,
        tempAddress,
        estimationRecipient,
        estimationAmount,
        contractAddress
      );
      
      if (gasToken === "ETH") {
        estimatedGas = Number(feeEstimate?.fast ?? feeEstimate?.medium ?? feeEstimate?.slow ?? 0);
      } else if (gasToken === "TRX") {
        estimatedGas = Number(feeEstimate?.fast ?? feeEstimate?.medium ?? 5);
      }
      
      console.log(`[SmartGas] Estimated gas for ${walletType} transfer: ${estimatedGas} ${gasToken}`);
      
    } catch (estimationError) {
      console.warn(`[SmartGas] Gas estimation failed, using fallback:`, getErrorMessage(estimationError));
      estimatedGas = gasToken === "TRX" ? POOL_CONFIG.TRX_GAS_FALLBACK : POOL_CONFIG.ETH_GAS_FALLBACK;
    }

    const requiredGas = estimatedGas * POOL_CONFIG.GAS_SAFETY_BUFFER;
    
    console.log(`[SmartGas] Required gas with ${((POOL_CONFIG.GAS_SAFETY_BUFFER - 1) * 100).toFixed(0)}% buffer: ${requiredGas.toFixed(6)} ${gasToken}`);

    const deficit = requiredGas - currentBalance;
    const minDeficit = gasToken === "TRX" ? POOL_CONFIG.TRX_MIN_DEFICIT : POOL_CONFIG.ETH_MIN_DEFICIT;

    if (deficit <= minDeficit) {
      console.log(`[SmartGas] ✅ Sufficient gas (have: ${currentBalance.toFixed(6)}, need: ${requiredGas.toFixed(6)}) - No funding needed`);
      await poolAddress.update({ gas_balance: currentBalance });
      return { funded: false, amount: 0, reason: 'Sufficient balance' };
    }

    console.log(`[SmartGas] 📊 Gas deficit: ${deficit.toFixed(6)} ${gasToken} (have: ${currentBalance.toFixed(6)}, need: ${requiredGas.toFixed(6)})`);

    const { adminFeeModel } = await import("../../models");
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

    let transferFees = null;
    if (gasToken === "ETH") {
      transferFees = await tatumApi.feeEstimation(
        gasToken,
        feeWalletAddress,
        tempAddress,
        deficit
      );
    }

    console.log(`[SmartGas] 🔥 Funding ${deficit.toFixed(6)} ${gasToken} to ${tempAddress}`);

    const txResult = await tatumApi.assetToOtherAddress({
      currency: gasToken,
      fromAddress: feeWalletAddress,
      toAddress: tempAddress,
      privateKey: feeWalletPrivateKey,
      amount: deficit,
      fee: transferFees,
    });

    const newBalance = currentBalance + deficit;
    await poolAddress.update({ gas_balance: newBalance });

    console.log(`[SmartGas] ✅ Gas funded: ${deficit.toFixed(6)} ${gasToken} (TX: ${txResult?.txId})`);
    console.log(`[SmartGas]    Old balance: ${currentBalance.toFixed(6)} → New balance: ${newBalance.toFixed(6)} ${gasToken}`);

    return { funded: true, amount: deficit, txId: txResult?.txId, reason: 'Deficit funded' };
    
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[SmartGas] ❌ Gas funding failed:`, message);
    return { funded: false, amount: 0, reason: `Error: ${message}` };
  }
};

/**
 * Check if sweep is profitable
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
  feeData: { fixedFee: number; transactionFee: number; blockchainBuffer: number; totalDeduction: number; gasPrice?: string; gasLimit?: string; fee?: string; slow?: string } | number
): Promise<ProfitabilityResult> => {
  try {
    let estimatedFee = 0;
    if (typeof feeData === "number") {
      estimatedFee = feeData;
    } else if (feeData?.gasPrice && feeData?.gasLimit) {
      estimatedFee = (parseFloat(feeData.gasPrice) * parseInt(feeData.gasLimit)) / 1e18;
    } else if (feeData?.fee) {
      estimatedFee = parseFloat(feeData.fee);
    } else if (feeData?.slow) {
      estimatedFee = parseFloat(feeData.slow);
    }
    
    let balanceUSD = 0;
    let feeUSD = 0;
    
    try {
      balanceUSD = await convertToUSD(walletType, balance);
      feeUSD = await convertToUSD(walletType, estimatedFee);
    } catch (convError) {
      console.warn(`[MerchantPool] Could not convert to USD for profitability check:`, convError);
      return { profitable: true, estimatedFee };
    }
    
    const PROFITABILITY_THRESHOLD = 0.5;
    const profitable = feeUSD < (balanceUSD * PROFITABILITY_THRESHOLD);
    const profitMargin = balanceUSD > 0 ? ((balanceUSD - feeUSD) / balanceUSD) * 100 : 0;
    
    return { profitable, balanceUSD, feeUSD, estimatedFee, profitMargin };
  } catch (error) {
    console.error(`[MerchantPool] Profitability check error:`, error);
    return { profitable: true };
  }
};

/**
 * Sweep admin fees from pool address to admin wallet
 */
export const sweepPoolAddress = async (tempAddressId: number): Promise<unknown> => {
  let dbTransaction;
  
  try {
    dbTransaction = await sequelize.transaction();
    
    const poolAddress = await merchantTempAddressModel.findByPk(tempAddressId, {
      lock: dbTransaction.LOCK.UPDATE,
      transaction: dbTransaction,
    });

    if (!poolAddress) {
      throw new Error(`Pool address not found: ${tempAddressId}`);
    }

    const status = poolAddress.dataValues.status;
    const adminBalance = parseFloat(poolAddress.dataValues.admin_fee_balance || "0");
    
    if (status !== "IN_USE") {
      throw new Error(`Cannot sweep address in ${status} status. Only IN_USE addresses can be swept.`);
    }
    
    if (adminBalance <= 0) {
      console.log(`[MerchantPool] No admin fee to sweep for address ${tempAddressId}`);
      await poolAddress.update({ status: "AVAILABLE" }, { transaction: dbTransaction });
      await dbTransaction.commit();
      return { success: true, amount: 0, message: "No admin fee balance" };
    }

    const walletType = poolAddress.dataValues.wallet_type;
    const adminWallet = ADMIN_WALLETS[walletType];
    
    if (!adminWallet) {
      throw new Error(`No admin wallet configured for ${walletType}`);
    }

    await poolAddress.update({ status: "SWEEPING" }, { transaction: dbTransaction });
    await dbTransaction.commit();
    dbTransaction = null;

    console.log(`[MerchantPool] 🧹 Starting sweep for ${poolAddress.dataValues.wallet_address}`);
    
    let balanceData;
    try {
      balanceData = await tatumApi.getAddressBalance(
        poolAddress.dataValues.wallet_address,
        walletType
      );
    } catch (balanceError: unknown) {
      const balErr = balanceError as { message?: string };
      if ((balErr.message || '').includes('account.not.found') || (balErr.message || '').includes('not.found')) {
        console.log(`[MerchantPool] ⏭️ Sweep skipped - account not yet activated on-chain: ${poolAddress.dataValues.wallet_address}`);
        return { success: true, amount: 0, message: "Account not activated on-chain" };
      }
      throw balanceError;
    }
    const actualBalance = parseFloat(balanceData?.balance || "0");

    if (actualBalance <= 0) {
      await poolAddress.update({
        status: "AVAILABLE",
        admin_fee_balance: 0,
        last_swept_at: new Date(),
      });
      return { success: true, amount: 0, message: "No balance to sweep" };
    }

    let gasFunding: { funded: boolean; amount: number; txId: string | null } = { funded: false, amount: 0, txId: null };
    const isToken = TOKEN_CHAINS.includes(walletType);
    
    if (isToken) {
      const fundResult = await fundGasIfNeeded(poolAddress as unknown as { dataValues: { wallet_address: string }; update: (data: Record<string, unknown>) => Promise<void> }, walletType);
      gasFunding = { ...fundResult, txId: fundResult.txId || null };
    } else {
      console.log(`[MerchantPool] Native ${walletType} - gas comes from remaining balance, no external funding needed`);
    }

    const privateKey = await tatumApi.decryptSymmetric(
      poolAddress.dataValues.private_key,
      process.env.TEMP_KEY_ID
    );

    const feeData = await tatumApi.feeEstimation(
      walletType,
      poolAddress.dataValues.wallet_address,
      adminWallet,
      actualBalance.toString()
    );

    const profitabilityResult = await checkSweepProfitability(walletType, actualBalance, feeData);
    
    if (!profitabilityResult.profitable) {
      console.warn(`[MerchantPool] ⚠️ Sweep not profitable for ${poolAddress.dataValues.wallet_address}`);
      console.warn(`[MerchantPool]    Balance: ${actualBalance} ${walletType} ($${profitabilityResult.balanceUSD?.toFixed(2)})`);
      console.warn(`[MerchantPool]    Est. Fee: ${profitabilityResult.estimatedFee} ${walletType} ($${profitabilityResult.feeUSD?.toFixed(2)})`);
      console.warn(`[MerchantPool]    Skipping sweep - will retry when balance is higher`);
      
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

    const sweepResult = await withRetry(
      async () => {
        const result = await tatumApi.assetToOtherAddress({
          currency: walletType,
          fromAddress: poolAddress.dataValues.wallet_address,
          toAddress: adminWallet,
          privateKey,
          amount: amountToSend.toString(),
          fee: feeData,
        });
        if (!result?.txId) {
          throw new Error("Sweep transaction failed - no txId returned");
        }
        return result;
      },
      `Sweep transfer for ${poolAddress.dataValues.wallet_address}`,
      POOL_CONFIG.MAX_RETRIES,
      POOL_CONFIG.SWEEP_RETRY_DELAY_MS
    );

    const sweepTxId = sweepResult?.txId;

    console.log(`[MerchantPool] ✅ Blockchain sweep successful: ${sweepTxId}`);

    dbTransaction = await sequelize.transaction();
    
    try {
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
      const message = getErrorMessage(dbError);
      console.error(`[MerchantPool] 🚨 CRITICAL: Sweep ${sweepTxId} succeeded but DB update failed: ${message}`);
      console.error(`[MerchantPool] 🚨 Manual intervention needed for address ${poolAddress.dataValues.wallet_address}`);
      console.error(`[MerchantPool] 🚨 Sweep details: ${actualBalance} ${walletType} sent to ${adminWallet}`);
      
      if (dbTransaction) {
        try { await dbTransaction.rollback(); } catch {}
      }
      
      try {
        await merchantTempAddressModel.update(
          { status: "IN_USE" },
          { where: { temp_address_id: tempAddressId } }
        );
      } catch {}
      
      return { 
        success: true, 
        amount: actualBalance, 
        txId: sweepTxId,
        warning: "DB update failed, manual verification needed",
        critical: true
      };
    }
    
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[MerchantPool] ❌ Sweep failed:`, message);
    
    if (dbTransaction) {
      try { await dbTransaction.rollback(); } catch {}
    }
    
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
 * Sweep addresses by USD threshold
 */
export const sweepByThreshold = async (): Promise<number> => {
  const addressesWithFees = await merchantTempAddressModel.findAll({
    where: {
      status: "AVAILABLE",
      admin_fee_balance: { [Op.gt]: 0 },
    },
  });

  // Skip logging entirely when nothing to check
  if (addressesWithFees.length === 0) return 0;

  console.log(`[MerchantPool] 💰 Threshold sweep: checking ${addressesWithFees.length} AVAILABLE addresses...`);

  const eligibleAddresses = [];
  
  for (const address of addressesWithFees) {
    try {
      const cryptoAmount = parseFloat(address.dataValues.admin_fee_balance);
      const walletType = address.dataValues.wallet_type;
      const walletAddress = address.dataValues.wallet_address;
      
      const sweepConfig = getSweepConfig(walletType);
      
      if (sweepConfig.mode !== "threshold") {
        continue;
      }
      
      const usdAmount = await convertToUSD(walletType, cryptoAmount);
      
      if (usdAmount >= (sweepConfig.value || 30)) {
        console.log(`[MerchantPool] ✅ ${walletAddress} (${walletType}): $${usdAmount.toFixed(2)} >= $${sweepConfig.value} threshold — sweeping`);
        await address.update({ status: "IN_USE" });
        eligibleAddresses.push(address);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      console.error(`[MerchantPool] ⚠️  Failed to check ${address.dataValues.wallet_type}:`, message);
    }
  }

  if (eligibleAddresses.length > 0) {
    console.log(`[MerchantPool] Found ${eligibleAddresses.length} addresses eligible for threshold sweep`);
  }

  for (const address of eligibleAddresses) {
    try {
      await sweepPoolAddress(address.dataValues.temp_address_id);
    } catch (error) {
      console.error(`[MerchantPool] Failed to sweep ${address.dataValues.wallet_address}:`, error);
    }
  }
  
  return eligibleAddresses.length;
};

/**
 * Sweep addresses after time threshold
 */
export const sweepByTime = async (): Promise<number> => {
  const addressesWithFees = await merchantTempAddressModel.findAll({
    where: {
      status: "IN_USE",
      admin_fee_balance: { [Op.gt]: 0 },
      last_merchant_payout: { [Op.ne]: null },
    },
  });

  // Skip logging entirely when nothing to check
  if (addressesWithFees.length === 0) return 0;

  console.log(`[MerchantPool] ⏰ Time sweep: checking ${addressesWithFees.length} IN_USE addresses...`);

  const eligibleAddresses = [];

  for (const address of addressesWithFees) {
    try {
      const walletType = address.dataValues.wallet_type;
      const cryptoAmount = parseFloat(address.dataValues.admin_fee_balance);
      const lastPayout = new Date(address.dataValues.last_merchant_payout);
      
      const sweepConfig = getSweepConfig(walletType);
      
      if (sweepConfig.mode !== "time") {
        continue;
      }
      
      const timeThresholdMinutes = sweepConfig.value || 10;
      const timeThreshold = new Date();
      timeThreshold.setMinutes(timeThreshold.getMinutes() - timeThresholdMinutes);
      
      const timeSincePayout = Math.floor((new Date().getTime() - lastPayout.getTime()) / 60000);
      
      if (lastPayout < timeThreshold) {
        console.log(`[MerchantPool] ✅ ${address.dataValues.wallet_address} (${walletType}): ${cryptoAmount}, ${timeSincePayout} min since payout — sweeping`);
        eligibleAddresses.push(address);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      console.error(`[MerchantPool] ⚠️  Failed to check ${address.dataValues.wallet_type}:`, message);
    }
  }

  if (eligibleAddresses.length > 0) {
    console.log(`[MerchantPool] Found ${eligibleAddresses.length} addresses eligible for time-based sweep`);
  }

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
 */
export const performScheduledSweeps = async (): Promise<void> => {
  try {
    const thresholdCount = await sweepByThreshold();
    const timeCount = await sweepByTime();
    
    // Only log banner when there was actual work
    if (thresholdCount > 0 || timeCount > 0) {
      console.log(`[MerchantPool] ✅ Sweep completed: ${thresholdCount} threshold + ${timeCount} time-based`);
    }
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[MerchantPool] ❌ Scheduled sweep failed:`, message);
  }
};
