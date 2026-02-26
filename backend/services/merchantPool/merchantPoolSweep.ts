/**
 * Merchant Pool Sweep Operations
 * 
 * Handles gas funding, sweep execution, and scheduled sweep orchestration.
 */

import {
  merchantTempAddressModel,
  merchantPoolSweepModel,
  merchantPoolTransactionModel,
  stablecoinConversionModel,
  GAS_TOKEN_MAPPING,
  ACCOUNT_CHAINS,
} from "../../models";
import { cronLogger } from "../../utils/loggers";
import tatumApi from "../../apis/tatumApi";
import { getErrorMessage, sendAdminFeeSweepEmail } from "../../helper";
import { sendPaymentReceivedEmail } from "../../helper/sendEmail";
import { convertToUSD, convertToFiat } from "../../utils/currencyUtils";
import { getRedisItem, setRedisItem, setRedisTTL } from "../../utils/redisInstance";
import {
  getAccountResources,
  calculateDynamicTRC20Fee,
  logCostSavings,
  TRC20_ENERGY,
} from "../tronEnergyService";
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
import { directEvmSweep, isDirectEvmSupported } from "./directEvmTransfer";
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
    cronLogger.warn(`[SmartGas] No fee wallet configured for ${gasToken}`);
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
        cronLogger.info(`[SmartGas] Account not yet activated on-chain: ${tempAddress}, assuming 0 balance`);
        balanceResult = { balance: '0' };
      } else {
        throw balanceError;
      }
    }
    let currentBalance = Number(balanceResult?.balance ?? 0);
    
    if (gasToken === "TRX") {
      currentBalance = currentBalance / 1000000;
    }

    cronLogger.info(`[SmartGas] Current balance: ${currentBalance} ${gasToken} in ${tempAddress}`);

    let estimatedGas = 0;
    
    // === Energy-Aware Optimization for TRC20 ===
    // Check if the address has staked Energy that covers the transfer
    if (gasToken === "TRX" && (walletType === 'USDT-TRC20')) {
      try {
        const accountResources = await getAccountResources(tempAddress);
        if (accountResources.hasSufficientEnergy) {
          cronLogger.info(
            `[SmartGas] ⚡ ENERGY OPTIMIZATION: ${tempAddress} has ${accountResources.availableEnergy} Energy ` +
            `(need ${TRC20_ENERGY.EXISTING_RECIPIENT}) — staked Energy covers transfer!`
          );
          logCostSavings("SmartGas-EnergySkip", POOL_CONFIG.TRX_GAS_FALLBACK, 0, {
            availableEnergy: accountResources.availableEnergy,
            address: tempAddress,
          });
          // Only need a tiny amount for bandwidth (if not covered by free bandwidth)
          if (accountResources.availableBandwidth >= 345) {
            // Both Energy and Bandwidth covered — no TRX needed!
            cronLogger.info(`[SmartGas] ✅ Full Energy+Bandwidth coverage — zero gas funding needed`);
            await poolAddress.update({ gas_balance: currentBalance });
            return { funded: false, amount: 0, reason: 'Staked Energy+Bandwidth covers transfer' };
          }
          // Only need bandwidth cost (~0.345 TRX)
          estimatedGas = 0.5;
          cronLogger.info(`[SmartGas] 📊 Energy covered, only bandwidth cost needed: ~${estimatedGas} TRX`);
        } else {
          cronLogger.info(
            `[SmartGas] 📊 Energy check: ${accountResources.availableEnergy} available ` +
            `(need ${TRC20_ENERGY.EXISTING_RECIPIENT}) — will use dynamic fee estimation`
          );
        }
      } catch (resourceError) {
        cronLogger.warn(`[SmartGas] ⚠️ Energy check failed: ${getErrorMessage(resourceError)}, proceeding with fee estimation`);
      }
    }

    // Standard fee estimation (skipped if Energy optimization already set estimatedGas)
    if (estimatedGas === 0) {
      try {
        // FIX: Use energy-aware tronEnergyService for TRC20 tokens instead of
        // tatumApi.feeEstimation() which returns stale/underestimated values.
        // This prevents OUT_OF_ENERGY failures on TRON.
        if (gasToken === "TRX" && TOKEN_CHAINS.includes(walletType) && walletType.includes("TRC20")) {
          const dynamicFee = await calculateDynamicTRC20Fee(tempAddress);
          estimatedGas = dynamicFee.fast;
          cronLogger.info(`[SmartGas] 🔋 TRC20 energy-aware gas: ${estimatedGas} TRX (energy: ${dynamicFee.energyNeeded} needed, ${dynamicFee.energyAvailable} available, price: ${dynamicFee.energyPrice} SUN/unit)`);
        } else {
          let contractAddress: string | undefined;
          if (walletType === 'USDT-ERC20') {
            contractAddress = process.env.ETH_CONTRACT;
          } else if (walletType === 'USDC-ERC20') {
            contractAddress = process.env.USDC_CONTRACT;
          } else if (walletType === 'USDT-POLYGON') {
            contractAddress = process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
          } else if (walletType === 'RLUSD-ERC20') {
            contractAddress = process.env.RLUSD_ERC20_CONTRACT || "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD";
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
          } else if (gasToken === "XRP") {
            estimatedGas = Number(feeEstimate?.fast ?? 0.00005);
          } else if (gasToken === "POLYGON") {
            estimatedGas = Number(feeEstimate?.fast ?? feeEstimate?.medium ?? 0.01);
          }
        }
        
        cronLogger.info(`[SmartGas] Estimated gas for ${walletType} transfer: ${estimatedGas} ${gasToken}`);
        
      } catch (estimationError) {
        cronLogger.warn(`[SmartGas] Gas estimation failed, using fallback:`, getErrorMessage(estimationError));
        estimatedGas = gasToken === "TRX" ? POOL_CONFIG.TRX_GAS_FALLBACK 
          : gasToken === "XRP" ? POOL_CONFIG.XRP_GAS_FALLBACK
          : gasToken === "POLYGON" ? POOL_CONFIG.POLYGON_GAS_FALLBACK
          : POOL_CONFIG.ETH_GAS_FALLBACK;
      }
    }

    const requiredGas = estimatedGas * POOL_CONFIG.GAS_SAFETY_BUFFER;
    
    cronLogger.info(`[SmartGas] Required gas with ${((POOL_CONFIG.GAS_SAFETY_BUFFER - 1) * 100).toFixed(0)}% buffer: ${requiredGas.toFixed(6)} ${gasToken}`);

    const deficit = requiredGas - currentBalance;
    const minDeficit = gasToken === "TRX" ? POOL_CONFIG.TRX_MIN_DEFICIT 
      : gasToken === "XRP" ? POOL_CONFIG.XRP_MIN_DEFICIT
      : gasToken === "POLYGON" ? POOL_CONFIG.POLYGON_MIN_DEFICIT
      : POOL_CONFIG.ETH_MIN_DEFICIT;

    // Primary check: does the address actually have enough gas?
    // Only skip funding when currentBalance genuinely covers the required gas.
    // The minDeficit threshold prevents micro-fundings ONLY when the balance is already close to sufficient.
    if (currentBalance >= requiredGas || (deficit <= minDeficit && currentBalance > 0)) {
      cronLogger.info(`[SmartGas] ✅ Sufficient gas (have: ${currentBalance.toFixed(6)}, need: ${requiredGas.toFixed(6)}) - No funding needed`);
      await poolAddress.update({ gas_balance: currentBalance });
      return { funded: false, amount: 0, reason: 'Sufficient balance' };
    }

    cronLogger.info(`[SmartGas] 📊 Gas deficit: ${deficit.toFixed(6)} ${gasToken} (have: ${currentBalance.toFixed(6)}, need: ${requiredGas.toFixed(6)})`);

    // Ensure we fund at least a useful minimum amount to avoid immediate re-funding
    const fundAmount = Math.max(deficit, requiredGas, gasToken === "TRX" ? POOL_CONFIG.TRX_MIN_DEFICIT 
      : gasToken === "XRP" ? POOL_CONFIG.XRP_MIN_DEFICIT
      : gasToken === "POLYGON" ? POOL_CONFIG.POLYGON_MIN_DEFICIT
      : POOL_CONFIG.ETH_MIN_DEFICIT);
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

    cronLogger.info(`[SmartGas] 🔥 Funding ${fundAmount.toFixed(6)} ${gasToken} to ${tempAddress}`);

    let txId: string | undefined;

    if (isDirectEvmSupported(gasToken)) {
      // EVM gas funding: use directEvmSweep (ethers.js) to avoid Tatum SDK ghost TX issue
      cronLogger.info(`[SmartGas] Using direct EVM transfer for ${gasToken} gas funding`);
      const evmResult = await directEvmSweep({
        fromAddress: feeWalletAddress,
        toAddress: tempAddress,
        privateKey: feeWalletPrivateKey,
        walletType: gasToken,
        amount: fundAmount,
      });
      txId = evmResult.txHash;
      cronLogger.info(`[SmartGas] ✅ Direct EVM gas funding: ${txId} (gas: ${evmResult.gasPriceGwei} Gwei)`);
    } else {
      // Non-EVM gas funding (TRX, XRP): continue using Tatum SDK
      const txResult = await tatumApi.assetToOtherAddress({
        currency: gasToken,
        fromAddress: feeWalletAddress,
        toAddress: tempAddress,
        privateKey: feeWalletPrivateKey,
        amount: fundAmount,
        fee: null,
      });
      txId = txResult?.txId;
    }

    const newBalance = currentBalance + fundAmount;
    await poolAddress.update({ gas_balance: newBalance });

    cronLogger.info(`[SmartGas] ✅ Gas funded: ${fundAmount.toFixed(6)} ${gasToken} (TX: ${txId})`);
    cronLogger.info(`[SmartGas]    Old balance: ${currentBalance.toFixed(6)} → New balance: ${newBalance.toFixed(6)} ${gasToken}`);

    return { funded: true, amount: fundAmount, txId: txId, reason: 'Deficit funded' };
    
  } catch (error) {
    const message = getErrorMessage(error);
    cronLogger.error(`[SmartGas] ❌ Gas funding failed:`, message);
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
  feeData: { fixedFee: number; transactionFee: number; totalDeduction: number; gasPrice?: string; gasLimit?: string; fee?: string; slow?: string; fast?: string | number } | number
): Promise<ProfitabilityResult> => {
  try {
    // Extract estimated gas fee from feeData (in gas token units: TRX or ETH)
    let estimatedFee = 0;
    if (typeof feeData === "number") {
      estimatedFee = feeData;
    } else if (feeData?.fast) {
      // Preferred: 'fast' is already in gas token units (TRX for TRC20, ETH for ERC20)
      estimatedFee = parseFloat(String(feeData.fast));
    } else if (feeData?.gasPrice && feeData?.gasLimit) {
      // Fallback: gasPrice is in Gwei, gasLimit is unitless → result in ETH
      estimatedFee = (parseFloat(feeData.gasPrice) * parseInt(feeData.gasLimit)) / 1e9;
    } else if (feeData?.fee) {
      estimatedFee = parseFloat(feeData.fee);
    } else if (feeData?.slow) {
      estimatedFee = parseFloat(feeData.slow);
    }
    
    let balanceUSD = 0;
    let feeUSD = 0;
    
    // Gas fees are in the gas token (TRX/ETH), not the token itself (USDT/USDC)
    // Use GAS_TOKEN_MAPPING to get the correct currency for fee→USD conversion
    const feeCurrency = GAS_TOKEN_MAPPING[walletType] || walletType;
    
    try {
      balanceUSD = await convertToUSD(walletType, balance);
      feeUSD = await convertToUSD(feeCurrency, estimatedFee);
    } catch (convError) {
      cronLogger.warn(`[MerchantPool] Could not convert to USD for profitability check:`, convError);
      return { profitable: true, estimatedFee };
    }
    
    cronLogger.info(`[MerchantPool] Profitability: ${walletType} balance=$${balanceUSD.toFixed(2)}, gas fee=${estimatedFee} ${feeCurrency} ($${feeUSD.toFixed(2)})`);
    
    const PROFITABILITY_THRESHOLD = 0.5;
    const profitable = feeUSD < (balanceUSD * PROFITABILITY_THRESHOLD);
    const profitMargin = balanceUSD > 0 ? ((balanceUSD - feeUSD) / balanceUSD) * 100 : 0;
    
    return { profitable, balanceUSD, feeUSD, estimatedFee, profitMargin };
  } catch (error) {
    cronLogger.error(`[MerchantPool] Profitability check error:`, error);
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
      cronLogger.info(`[MerchantPool] No admin fee to sweep for address ${tempAddressId}`);
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

    cronLogger.info(`[MerchantPool] 🧹 Starting sweep for ${poolAddress.dataValues.wallet_address}`);
    
    let balanceData;
    try {
      balanceData = await tatumApi.getAddressBalance(
        poolAddress.dataValues.wallet_address,
        walletType
      );
    } catch (balanceError: unknown) {
      const balErr = balanceError as { message?: string };
      if ((balErr.message || '').includes('account.not.found') || (balErr.message || '').includes('not.found')) {
        cronLogger.info(`[MerchantPool] ⏭️ Sweep skipped - account not yet activated on-chain: ${poolAddress.dataValues.wallet_address}`);
        return { success: true, amount: 0, message: "Account not activated on-chain" };
      }
      throw balanceError;
    }
    // UTXO chains (BTC, LTC, DOGE, BCH) return {incoming, outgoing} not {balance}
    // Account-based chains (ETH, TRX, XRP, SOL, POLYGON) return {balance}
    let actualBalance: number;
    if (balanceData?.incoming !== undefined && balanceData?.outgoing !== undefined) {
      actualBalance = parseFloat(balanceData.incoming || "0") - parseFloat(balanceData.outgoing || "0");
      // Round to 8 decimal places to avoid floating point precision issues
      actualBalance = Math.round(actualBalance * 100000000) / 100000000;
      cronLogger.info(`[MerchantPool] UTXO balance: incoming=${balanceData.incoming}, outgoing=${balanceData.outgoing}, net=${actualBalance}`);
    } else {
      actualBalance = parseFloat(balanceData?.balance || "0");
    }

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
      const adminWalletForGas = ADMIN_WALLETS[walletType];
      const fundResult = await fundGasIfNeeded(poolAddress as unknown as { dataValues: { wallet_address: string }; update: (data: Record<string, unknown>) => Promise<void> }, walletType, actualBalance, adminWalletForGas);
      gasFunding = { ...fundResult, txId: fundResult.txId || null };

      // Wait for gas funding TX confirmation before attempting the sweep transfer
      if (gasFunding.funded && gasFunding.txId) {
        const gasToken = GAS_TOKEN_MAPPING[walletType] || 'TRX';
        cronLogger.info(`[MerchantPool] ⏳ Waiting for gas funding TX ${gasFunding.txId} confirmation (${gasToken})...`);
        const gasConfirmation = await tatumApi.waitForTransactionConfirmation(
          gasFunding.txId,
          gasToken,
          30000  // 30s timeout
        );
        if (gasConfirmation.confirmed) {
          cronLogger.info(`[MerchantPool] ✅ Gas funding confirmed in block ${gasConfirmation.blockNumber}`);
        } else {
          cronLogger.warn(`[MerchantPool] ⚠️ Gas funding TX not confirmed in timeout — proceeding with retry logic`);
        }
      }
    } else {
      cronLogger.info(`[MerchantPool] Native ${walletType} - gas comes from remaining balance, no external funding needed`);
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
      cronLogger.warn(`[MerchantPool] ⚠️ Sweep not profitable for ${poolAddress.dataValues.wallet_address}`);
      cronLogger.warn(`[MerchantPool]    Balance: ${actualBalance} ${walletType} ($${profitabilityResult.balanceUSD?.toFixed(2)})`);
      cronLogger.warn(`[MerchantPool]    Est. Fee: ${profitabilityResult.estimatedFee} ${walletType} ($${profitabilityResult.feeUSD?.toFixed(2)})`);
      cronLogger.warn(`[MerchantPool]    Skipping sweep - will retry when balance is higher`);
      
      await poolAddress.update({ status: "AVAILABLE" });
      
      return { 
        success: false, 
        skipped: true, 
        reason: "Not profitable",
        balanceUSD: profitabilityResult.balanceUSD,
        feeUSD: profitabilityResult.feeUSD
      };
    }
    
    cronLogger.info(`[MerchantPool] ✅ Sweep is profitable: $${profitabilityResult.balanceUSD?.toFixed(2)} balance vs $${profitabilityResult.feeUSD?.toFixed(2)} fee`);

    const isAccountChain = ACCOUNT_CHAINS.includes(walletType);
    const isUTXOChain = ["BTC", "LTC", "DOGE", "BCH"].includes(walletType);
    let amountToSend = actualBalance;
    
    if (isUTXOChain) {
      // UTXO chains: fee is separate from amount but must fit within total balance
      // amountToSend + fee = actualBalance → amountToSend = actualBalance - fee
      const utxoFee = typeof feeData === 'object' && feeData !== null
        ? parseFloat(feeData.slow || feeData.medium || feeData.fast || "0.00005")
        : parseFloat(feeData || "0.00005");
      amountToSend = actualBalance - utxoFee;
      // Round down to 8 decimal places (UTXO precision)
      amountToSend = Math.floor(amountToSend * 100000000) / 100000000;
      
      if (amountToSend <= 0) {
        cronLogger.warn(`[MerchantPool] ⚠️ UTXO balance too low after fee: ${actualBalance} - ${utxoFee} = ${amountToSend}`);
        await poolAddress.update({ status: "AVAILABLE" });
        return { success: false, skipped: true, reason: "Balance too low after UTXO fee" };
      }
      cronLogger.info(`[MerchantPool] UTXO chain sweep: ${actualBalance} - ${utxoFee} (fee) = ${amountToSend} ${walletType}`);
    } else if (isAccountChain) {
      const gasFee = parseFloat(feeData?.slow || feeData?.fast || "0");
      
      // XRP Ledger reserves (updated Dec 2, 2024 — validator vote reduced reserves 10x):
      //   Base reserve: 1 XRP per account (was 10 XRP)
      //   Owner reserve: 0.2 XRP per owned object/trust line (was 2 XRP)
      // See: https://xrpl.org/blog/2024/lower-reserves-are-in-effect
      //
      // IMPORTANT: The pool address may have trust lines (e.g., RLUSD), so we query
      // the XRP Ledger directly to get OwnerCount and compute exact reserve.
      let accountReserve = 0;
      if (walletType === 'XRP' || walletType === 'RLUSD') {
        // Default reserves (post Dec 2024)
        const BASE_RESERVE = 1;     // 1 XRP per account
        const OWNER_RESERVE = 0.2;  // 0.2 XRP per trust line/object
        
        try {
          const axios = require('axios');
          const xrplRes = await axios.post('https://s1.ripple.com:51234', {
            method: 'account_info',
            params: [{ account: poolAddress.dataValues.wallet_address, ledger_index: 'validated' }]
          }, { timeout: 10000 });
          
          const accountData = xrplRes.data?.result?.account_data;
          const ownerCount = accountData?.OwnerCount || 0;
          
          // Use on-chain balance (drops → XRP) instead of Tatum API for accuracy
          const onChainBalance = parseInt(accountData?.Balance || '0') / 1000000;
          if (onChainBalance > 0 && Math.abs(onChainBalance - actualBalance) > 0.001) {
            cronLogger.info(`[MerchantPool] Balance correction: Tatum=${actualBalance}, on-chain=${onChainBalance} XRP`);
            actualBalance = onChainBalance;
          }
          
          accountReserve = BASE_RESERVE + (OWNER_RESERVE * ownerCount);
          cronLogger.info(`[MerchantPool] XRP reserve: ${BASE_RESERVE} base + ${OWNER_RESERVE} × ${ownerCount} objects = ${accountReserve} XRP`);
        } catch (xrplErr) {
          // Fallback: assume 1 trust line (RLUSD) = 1.2 XRP total reserve
          accountReserve = 1.2;
          cronLogger.warn(`[MerchantPool] ⚠️ XRPL account_info failed, using fallback reserve ${accountReserve} XRP:`, xrplErr);
        }
      } else if (walletType === 'SOL') {
        // SOL requires a minimum rent-exempt balance (~0.00089088 SOL for a basic account).
        // If we drain below this, the Solana runtime rejects the TX with 403 "Failed creating transaction".
        // We close the account by sending ALL lamports (which returns rent to the recipient),
        // but only if Tatum SDK supports it. Otherwise, reserve rent + a safety buffer.
        const SOL_RENT_EXEMPT_MINIMUM = 0.001; // ~890880 lamports + safety buffer
        const SOL_TX_FEE = 0.000005; // 5000 lamports per signature
        accountReserve = SOL_RENT_EXEMPT_MINIMUM + SOL_TX_FEE;
        cronLogger.info(`[MerchantPool] SOL reserve: ${accountReserve} SOL (rent-exempt ${SOL_RENT_EXEMPT_MINIMUM} + tx fee ${SOL_TX_FEE})`);
      }
      
      amountToSend = actualBalance - gasFee - accountReserve;
      
      // Safety buffer: round down to 6 decimal places to avoid edge cases
      // from balance timing differences between API reads and on-chain state
      amountToSend = Math.floor(amountToSend * 1000000) / 1000000;
      
      if (amountToSend <= 0) {
        const reserveNote = accountReserve > 0 ? ` + ${accountReserve} reserve` : '';
        cronLogger.warn(`[MerchantPool] ⚠️ Balance too low for sweep after deductions: ${actualBalance} - ${gasFee} (gas)${reserveNote} = ${amountToSend}`);
        await poolAddress.update({ status: "AVAILABLE" });
        return { success: false, skipped: true, reason: `Balance too low after gas${reserveNote} deduction` };
      }
      
      const reserveLog = accountReserve > 0 ? ` - ${accountReserve} (reserve)` : '';
      cronLogger.info(`[MerchantPool] Account chain sweep: ${actualBalance} - ${gasFee} (gas)${reserveLog} = ${amountToSend} ${walletType}`);
    }

    // Sweep strategy: Use direct ethers.js for EVM chains (ETH, POLYGON) to avoid
    // Tatum SDK ghost TX issue (SDK returns TX hash but never broadcasts to network).
    // For non-EVM chains (TRX, XRP, BTC, etc.), continue using Tatum SDK.
    let sweepTxId: string | undefined;

    if (isDirectEvmSupported(walletType)) {
      // DIRECT EVM SWEEP: ethers.js signs locally + broadcasts via eth_sendRawTransaction
      // The TX hash is real — sendTransaction() throws if the RPC node rejects the TX
      cronLogger.info(`[MerchantPool] Using direct EVM sweep for ${walletType}`);
      const evmResult = await withRetry(
        async () => {
          return await directEvmSweep({
            fromAddress: poolAddress.dataValues.wallet_address,
            toAddress: adminWallet,
            privateKey,
            walletType,
            amount: amountToSend,
          });
        },
        `Direct EVM sweep for ${poolAddress.dataValues.wallet_address}`,
        POOL_CONFIG.MAX_RETRIES,
        POOL_CONFIG.SWEEP_RETRY_DELAY_MS
      );
      sweepTxId = evmResult?.txHash;
      cronLogger.info(`[MerchantPool] ✅ Direct EVM sweep broadcast: ${sweepTxId} (nonce: ${evmResult?.nonce}, gas: ${evmResult?.gasPriceGwei} Gwei)`);
    } else {
      // NON-EVM CHAINS: Use Tatum SDK (proven reliable for TRX, XRP, BTC, LTC, DOGE, etc.)
      cronLogger.info(`[MerchantPool] Using Tatum SDK sweep for ${walletType}`);
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
      sweepTxId = sweepResult?.txId;
      cronLogger.info(`[MerchantPool] ✅ Tatum SDK sweep broadcast: ${sweepTxId}`);
    }

    if (!sweepTxId) {
      throw new Error("Sweep transaction failed - no txId/txHash returned");
    }

    // BUG-4 FIX: Mark sweep TX as outgoing to prevent Tatum webhook re-processing
    try {
      const { setRedisItemWithTTL } = require("../../utils/redisInstance");
      await setRedisItemWithTTL(`outgoing-tx-${sweepTxId}`, {
        type: "sweep",
        fromAddress: poolAddress.dataValues.wallet_address,
        toAddress: adminWallet,
        amount: amountToSend,
        currency: walletType,
        markedAt: new Date().toISOString(),
      }, 7200); // 2 hour TTL — single Redis call instead of SET + EXPIRE
      cronLogger.info(`[MerchantPool] Marked sweep TX ${sweepTxId} as outgoing`);
    } catch (markErr) {
      cronLogger.warn(`[MerchantPool] Failed to mark sweep TX as outgoing (non-critical):`, markErr);
    }

    // Fetch actual on-chain gas cost (TX is confirmed, so this should succeed)
    let actualGasUsed = isAccountChain ? (actualBalance - amountToSend) : 0;
    if (sweepTxId) {
      try {
        const gasCost = await tatumApi.getTransactionGasCost(sweepTxId, walletType);
        if (gasCost.gasCostNative > 0) {
          actualGasUsed = gasCost.gasCostNative;
          cronLogger.info(`[MerchantPool]    On-chain gas: ${actualGasUsed} ${gasCost.gasToken}`);
        }
      } catch (gasErr: unknown) {
        cronLogger.warn(`[MerchantPool]    Could not fetch on-chain gas cost, using estimate`);
      }
    }

    dbTransaction = await sequelize.transaction();
    
    try {
      await merchantPoolSweepModel.create({
        temp_address_id: tempAddressId,
        owner_user_id: poolAddress.dataValues.owner_user_id,
        wallet_type: walletType,
        amount_swept: amountToSend,
        gas_funded: gasFunding.amount || 0,
        gas_used: actualGasUsed,
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
      
      cronLogger.info(`[MerchantPool] 🎉 Sweep recorded: ${amountToSend} ${walletType} → admin wallet`);
      cronLogger.info(`[MerchantPool]    Status set to: AVAILABLE`);

      // Update stablecoin conversion record with sweep TX hash so Binance deposit detection can match
      try {
        const ownerUserId = poolAddress.dataValues.owner_user_id;
        // Map wallet type to source currency (ETH, BTC, TRX, etc.)
        const sourceCurrency = walletType.toUpperCase();
        if (ownerUserId) {
          const { Op } = require("sequelize");
          const [updatedCount] = await stablecoinConversionModel.update(
            { deposit_tx_hash: sweepTxId },
            { 
              where: { 
                user_id: ownerUserId,
                source_currency: sourceCurrency,
                status: "PENDING_DEPOSIT", 
                deposit_tx_hash: { [Op.or]: [null, ""] },
              } 
            }
          );
          if (updatedCount > 0) {
            cronLogger.info(`[MerchantPool]    Updated stablecoin conversion deposit_tx_hash: ${sweepTxId.substring(0, 16)}...`);
          }
        }
      } catch (convErr) {
        cronLogger.warn(`[MerchantPool]    Could not update conversion deposit_tx_hash:`, convErr instanceof Error ? convErr.message : convErr);
      }

      try {
        const subResult = await tatumApi.createSubscription(
          poolAddress.dataValues.wallet_address,
          walletType,
          true
        );
        if (subResult?.id) {
          await poolAddress.update({ subscription_id: subResult.id });
          cronLogger.info(`[MerchantPool]    Subscription renewed: ${subResult.id}`);
        }
      } catch (subError) {
        cronLogger.warn(`[MerchantPool]    ⚠️ Failed to renew subscription (will retry on next reserve)`);
      }

      // Send admin email notification for completed sweep
      try {
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail) {
          const sweepConfig = getSweepConfig(walletType);
          const gasToken = GAS_TOKEN_MAPPING[walletType] || walletType;
          const gasDisplay = actualGasUsed > 0 ? `${actualGasUsed.toFixed(8)} ${gasToken}` : 'N/A (token transfer)';
          
          await sendAdminFeeSweepEmail(
            adminEmail,
            amountToSend.toFixed(8),
            walletType,
            poolAddress.dataValues.wallet_address,
            adminWallet,
            sweepTxId || 'N/A',
            gasDisplay,
            sweepConfig.mode
          );
          cronLogger.info(`[MerchantPool] 📧 Admin sweep notification sent: ${amountToSend} ${walletType} to ${adminEmail}`);
        }
      } catch (emailError) {
        cronLogger.error(`[MerchantPool] ⚠️ Admin sweep email failed (non-critical):`, emailError);
      }

      // ===== EMAIL RECOVERY (FIX) =====
      // When a payment was processed by another server instance (e.g. webhook URL pointed
      // to old server) or the email failed silently, the merchant never gets notified.
      // This is the LAST checkpoint before the address returns to the pool — recover
      // any missed payment notification emails here.
      try {
        const latestPoolTx = await merchantPoolTransactionModel.findOne({
          where: { temp_address_id: tempAddressId },
          order: [['created_at', 'DESC']],
        });

        if (latestPoolTx?.dataValues?.incoming_tx_id) {
          const incomingTxId = latestPoolTx.dataValues.incoming_tx_id;
          const ownerUserId = poolAddress.dataValues.owner_user_id;
          const merchantAmount = parseFloat(latestPoolTx.dataValues.merchant_amount || '0');
          const paymentAmount = merchantAmount + parseFloat(latestPoolTx.dataValues.admin_fee_amount || '0');

          // Check and recover "Payment Pending" notification
          const pendingKey = `pending-notif-${incomingTxId}`;
          const pendingSent = await getRedisItem(pendingKey);

          if (!pendingSent || !pendingSent.sent) {
            try {
              const { sendPendingPaymentNotification } = await import("../pendingPaymentService");
              await sendPendingPaymentNotification(
                poolAddress.dataValues.wallet_address,
                incomingTxId,
                paymentAmount,
                walletType,
                {
                  adm_id: ownerUserId,
                  company_id: latestPoolTx.dataValues.company_id,
                }
              );
              cronLogger.info(`[MerchantPool] 📧 [Sweep Recovery] Sent missed pending notification for ${poolAddress.dataValues.wallet_address}`);
            } catch (pendingErr: unknown) {
              cronLogger.warn(`[MerchantPool] ⚠️ [Sweep Recovery] Pending notification failed:`, getErrorMessage(pendingErr));
            }
          }

          // Check and recover "Payment Received" email
          const emailKey = `payment-received-email-${incomingTxId}`;
          const emailSent = await getRedisItem(emailKey);

          if (!emailSent || !emailSent.sent) {
            try {
              const { userModel, companyModel } = await import("../../models");
              const userData = (await userModel.findOne({ where: { user_id: ownerUserId } }))?.dataValues;
              const companyData = (await companyModel.findOne({ where: { user_id: ownerUserId } }))?.dataValues;

              if (userData?.email) {
                const txCreatedAt = new Date(latestPoolTx.dataValues.created_at);
                const dateStr = txCreatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                const timeStr = txCreatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                await sendPaymentReceivedEmail(
                  userData.email,
                  userData.name,
                  merchantAmount.toString(),
                  walletType,
                  companyData?.company_name || '',
                  incomingTxId,
                  dateStr,
                  timeStr
                );

                // Set dedup key so it won't be sent again
                await setRedisItem(emailKey, { sent: true, sentAt: new Date().toISOString(), recoveredBySweep: true });
                await setRedisTTL(emailKey, 86400);

                cronLogger.info(`[MerchantPool] 📧 [Sweep Recovery] Sent missed payment-received email to ${userData.email} for ${poolAddress.dataValues.wallet_address}`);
              }
            } catch (receivedErr: unknown) {
              cronLogger.warn(`[MerchantPool] ⚠️ [Sweep Recovery] Payment received email failed:`, getErrorMessage(receivedErr));
            }
          }
        }
      } catch (recoveryError: unknown) {
        cronLogger.warn(`[MerchantPool] ⚠️ Email recovery check failed (non-critical):`, getErrorMessage(recoveryError));
      }

      return { success: true, amount: amountToSend, txId: sweepTxId };
      
    } catch (dbError) {
      const message = getErrorMessage(dbError);
      cronLogger.error(`[MerchantPool] 🚨 CRITICAL: Sweep ${sweepTxId} succeeded but DB update failed: ${message}`);
      cronLogger.error(`[MerchantPool] 🚨 Manual intervention needed for address ${poolAddress.dataValues.wallet_address}`);
      cronLogger.error(`[MerchantPool] 🚨 Sweep details: ${actualBalance} ${walletType} sent to ${adminWallet}`);
      
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
    cronLogger.error(`[MerchantPool] ❌ Sweep failed:`, message);
    
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
 * BUG FIX: Now checks BOTH 'AVAILABLE' AND 'IN_USE' addresses with admin_fee_balance > 0.
 * Previously only checked AVAILABLE, which caused token addresses (USDT-TRC20, USDT-ERC20, USDC-ERC20)
 * to be permanently stuck — releaseAddress sets tokens to IN_USE when they have admin fees,
 * but sweepByThreshold only checked AVAILABLE, creating a deadlock.
 */
export const sweepByThreshold = async (): Promise<number> => {
  const addressesWithFees = await merchantTempAddressModel.findAll({
    where: {
      status: { [Op.in]: ["AVAILABLE", "IN_USE"] },
      admin_fee_balance: { [Op.gt]: 0 },
    },
  });

  // Skip logging entirely when nothing to check
  if (addressesWithFees.length === 0) return 0;

  cronLogger.info(`[MerchantPool] 💰 Threshold sweep: checking ${addressesWithFees.length} addresses with admin fees (AVAILABLE + IN_USE)...`);

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
        cronLogger.info(`[MerchantPool] ✅ ${walletAddress} (${walletType}): $${usdAmount.toFixed(2)} >= $${sweepConfig.value} threshold — sweeping`);
        await address.update({ status: "IN_USE" });
        eligibleAddresses.push(address);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      cronLogger.error(`[MerchantPool] ⚠️  Failed to check ${address.dataValues.wallet_type}:`, message);
    }
  }

  if (eligibleAddresses.length > 0) {
    cronLogger.info(`[MerchantPool] Found ${eligibleAddresses.length} addresses eligible for threshold sweep`);
  }

  // Sweep eligible addresses concurrently with per-address locks
  // This allows multiple chains to sweep simultaneously instead of sequentially
  const sweepPromises = eligibleAddresses.map(async (address) => {
    const addrId = address.dataValues.temp_address_id;
    const lockKey = `sweep:address:${addrId}`;
    const { acquireLock, releaseLock } = await import("../../utils/redisInstance");
    const locked = await acquireLock(lockKey, 300, 1, 50, true);
    if (!locked) {
      cronLogger.info(`[MerchantPool] Sweep skipped (locked): address ${addrId}`);
      return;
    }
    try {
      await sweepPoolAddress(addrId);
    } catch (error) {
      cronLogger.error(`[MerchantPool] Failed to sweep ${address.dataValues.wallet_address}:`, error);
    } finally {
      await releaseLock(lockKey);
    }
  });
  await Promise.allSettled(sweepPromises);
  
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

  cronLogger.info(`[MerchantPool] ⏰ Time sweep: checking ${addressesWithFees.length} IN_USE addresses...`);

  const eligibleAddresses = [];

  for (const address of addressesWithFees) {
    try {
      const walletType = address.dataValues.wallet_type;
      const cryptoAmount = parseFloat(address.dataValues.admin_fee_balance);
      const lastPayout = new Date(address.dataValues.last_merchant_payout);
      
      const sweepConfig = getSweepConfig(walletType);
      
      // UTXO chains normally have "batch" mode (no sweep needed — admin fee sent in same TX).
      // But if a UTXO chain is IN_USE with balance > 0, it means auto-convert left funds
      // in the address (pendingSweep safety net). Always sweep these regardless of mode.
      const isUTXOAutoConvertRecovery = UTXO_CHAINS.includes(walletType);
      
      if (sweepConfig.mode !== "time" && !isUTXOAutoConvertRecovery) {
        continue;
      }
      
      const timeThresholdMinutes = sweepConfig.value || 10;
      const timeThreshold = new Date();
      timeThreshold.setMinutes(timeThreshold.getMinutes() - timeThresholdMinutes);
      
      const timeSincePayout = Math.floor((new Date().getTime() - lastPayout.getTime()) / 60000);
      
      if (lastPayout < timeThreshold) {
        cronLogger.info(`[MerchantPool] ✅ ${address.dataValues.wallet_address} (${walletType}): ${cryptoAmount}, ${timeSincePayout} min since payout — sweeping`);
        eligibleAddresses.push(address);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      cronLogger.error(`[MerchantPool] ⚠️  Failed to check ${address.dataValues.wallet_type}:`, message);
    }
  }

  if (eligibleAddresses.length > 0) {
    cronLogger.info(`[MerchantPool] Found ${eligibleAddresses.length} addresses eligible for time-based sweep`);
  }

  // Sweep eligible addresses concurrently with per-address locks
  const sweepPromises = eligibleAddresses.map(async (address) => {
    const addrId = address.dataValues.temp_address_id;
    const lockKey = `sweep:address:${addrId}`;
    const { acquireLock, releaseLock } = await import("../../utils/redisInstance");
    const locked = await acquireLock(lockKey, 300, 1, 50, true);
    if (!locked) {
      cronLogger.info(`[MerchantPool] Sweep skipped (locked): address ${addrId}`);
      return;
    }
    try {
      await sweepPoolAddress(addrId);
    } catch (error) {
      cronLogger.error(`[MerchantPool] Failed to sweep ${address.dataValues.wallet_address}:`, error);
    } finally {
      await releaseLock(lockKey);
    }
  });
  await Promise.allSettled(sweepPromises);
  
  return eligibleAddresses.length;
};

/**
 * Master sweep function - runs both threshold and time-based sweeps.
 * Uses per-address locking so multiple addresses can be swept concurrently
 * without blocking the entire sweep pipeline on one slow chain.
 */
export const performScheduledSweeps = async (): Promise<void> => {
  try {
    const thresholdCount = await sweepByThreshold();
    const timeCount = await sweepByTime();
    
    // Only log banner when there was actual work
    if (thresholdCount > 0 || timeCount > 0) {
      cronLogger.info(`[MerchantPool] ✅ Sweep completed: ${thresholdCount} threshold + ${timeCount} time-based`);
    }
  } catch (error) {
    const message = getErrorMessage(error);
    cronLogger.error(`[MerchantPool] ❌ Scheduled sweep failed:`, message);
  }
};
