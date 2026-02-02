/**
 * Company Pool Service
 * 
 * TRUE MULTI-TENANT address pool management - each company has its own isolated pool.
 * 
 * Key Differences from Merchant Pool:
 * - Wallets are per-COMPANY, not per-merchant
 * - Addresses belong to a COMPANY permanently
 * - Subscription URLs use company's backend_url
 * - Complete isolation between companies
 */

import { Transaction, Op } from "sequelize";
import sequelize from "../utils/dbInstance";
import {
  companyWalletModel,
  companyAddressPoolModel,
  companyPoolTransactionModel,
  companyPoolSweepModel,
  COMPANY_POOL_CRYPTO_TYPES,
} from "../models/companyPoolModels";
import companyModel from "../models/companyModels/companyModel";
import tatumApi from "../apis/tatumApi";
import { getErrorMessage, buildUrl } from "../helper";
import { v4 as uuidv4 } from "uuid";

// Pool configuration
export const COMPANY_POOL_CONFIG = {
  INITIAL_SIZE: 2,           // Initial addresses per company per chain
  MAX_SIZE: 10,              // Max addresses per company per chain
  RESERVATION_TIMEOUT: 30,    // Minutes before reserved address is released
  PROCESSING_TIMEOUT: 60,     // Minutes before processing address is released
};

// Chain categories
export const UTXO_CHAINS = ['BTC', 'LTC', 'DOGE', 'BCH'];
export const ACCOUNT_CHAINS = ['ETH', 'TRX'];
export const TOKEN_CHAINS = ['USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20'];

// Chain to base chain mapping (for xpub)
const CHAIN_XPUB_MAPPING: Record<string, string> = {
  'BTC': 'BTC',
  'ETH': 'ETH',
  'LTC': 'LTC',
  'DOGE': 'DOGE',
  'TRX': 'TRX',
  'BCH': 'BCH',
  'USDT-TRC20': 'TRX',
  'USDT-ERC20': 'ETH',
  'USDC-ERC20': 'ETH',
};

// Native currencies
export const NATIVE_CURRENCIES: Record<string, string> = {
  'ETH': 'ETH',
  'BTC': 'BTC',
  'LTC': 'LTC',
  'DOGE': 'DOGE',
  'TRX': 'TRX',
  'BCH': 'BCH',
};

/**
 * Get company's backend URL for webhook delivery
 * Falls back to global SERVER_URL if not set
 */
const getCompanyWebhookUrl = async (companyId: number): Promise<string> => {
  const company = await companyModel.findByPk(companyId, {
    attributes: ['backend_url'],
  });
  
  const baseUrl = company?.dataValues?.backend_url || process.env.SERVER_URL || '';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  return normalizedBase + 'api/tatum-crypto-webhook';
};

/**
 * Get or create company wallet for a specific chain
 * Each company gets its own xpub/mnemonic - COMPLETE ISOLATION
 */
export const getOrCreateCompanyWallet = async (
  companyId: number,
  userId: number,
  walletType: string,
  transaction?: Transaction
): Promise<any> => {
  const baseChain = CHAIN_XPUB_MAPPING[walletType] || walletType;
  
  // Check for existing wallet
  let wallet = await companyWalletModel.findOne({
    where: { company_id: companyId, wallet_type: baseChain },
    transaction,
  });
  
  if (wallet) {
    console.log(`[CompanyPool] Using existing ${baseChain} wallet for company ${companyId}`);
    return wallet;
  }
  
  // Generate new wallet for this company
  console.log(`[CompanyPool] Generating new ${baseChain} wallet for company ${companyId}`);
  
  const walletData = await tatumApi.generateWallet(baseChain);
  if (!walletData?.xpub || !walletData?.mnemonic) {
    throw new Error(`Failed to generate ${baseChain} wallet for company ${companyId}`);
  }
  
  // Encrypt mnemonic
  const encryptedMnemonic = await tatumApi.encryptSymmetric(
    JSON.stringify({ mnemonic: walletData.mnemonic, xpub: walletData.xpub }),
    process.env.XPUB_KEY_ID
  );
  
  // Create wallet record
  wallet = await companyWalletModel.create({
    company_id: companyId,
    user_id: userId,
    wallet_type: baseChain,
    xpub: walletData.xpub,
    mnemonic: encryptedMnemonic,
    last_derivation_index: 0,
  }, { transaction });
  
  console.log(`[CompanyPool] ✅ Created ${baseChain} wallet for company ${companyId}`);
  return wallet;
};

/**
 * Add new address to company's pool
 * Derives from company's xpub, creates Tatum subscription with company's URL
 */
export const addAddressToCompanyPool = async (
  companyId: number,
  userId: number,
  walletType: string,
  transaction?: Transaction
): Promise<any> => {
  const baseChain = CHAIN_XPUB_MAPPING[walletType] || walletType;
  
  // Get or create company wallet
  const wallet = await getOrCreateCompanyWallet(companyId, userId, baseChain, transaction);
  
  // Get next derivation index
  const nextIndex = (wallet.dataValues.last_derivation_index || 0) + 1;
  
  // Decrypt mnemonic
  const decryptedData = await tatumApi.decryptSymmetric(
    wallet.dataValues.mnemonic,
    process.env.XPUB_KEY_ID
  );
  const { mnemonic } = JSON.parse(decryptedData);
  
  // Generate address from xpub
  const addressData = await tatumApi.generateAddressFromXpub(
    wallet.dataValues.xpub,
    nextIndex,
    baseChain
  );
  
  if (!addressData?.address) {
    throw new Error(`Failed to generate address for company ${companyId}`);
  }
  
  // Generate and encrypt private key
  const privateKey = await tatumApi.generatePrivateKeyFromMnemonic(
    mnemonic,
    nextIndex,
    baseChain
  );
  
  const encryptedKey = await tatumApi.encryptSymmetric(
    privateKey,
    process.env.TEMP_KEY_ID
  );
  
  // Get company's webhook URL
  const webhookUrl = await getCompanyWebhookUrl(companyId);
  
  // Create Tatum subscription with company's URL
  // SYNCHRONOUS - ensures subscription exists before payment can arrive
  console.log(`[CompanyPool] Creating subscription for ${addressData.address} -> ${webhookUrl}`);
  const subResult = await tatumApi.createSubscriptionWithUrl(
    addressData.address,
    walletType,
    webhookUrl
  );
  
  const subscriptionId = subResult?.id || `local-${Date.now()}`;
  
  // Update wallet derivation index
  await wallet.update({ last_derivation_index: nextIndex }, { transaction });
  
  // Create address pool record
  const poolAddress = await companyAddressPoolModel.create({
    company_id: companyId,
    user_id: userId,
    wallet_type: walletType,
    wallet_address: addressData.address,
    private_key: encryptedKey,
    derivation_index: nextIndex,
    subscription_id: subscriptionId,
    webhook_url: webhookUrl,
    status: "AVAILABLE",
    admin_fee_balance: 0,
    gas_balance: 0,
    total_transactions: 0,
  }, { transaction });
  
  console.log(`[CompanyPool] ✅ Added ${walletType} address to company ${companyId}'s pool: ${addressData.address}`);
  console.log(`[CompanyPool]    Subscription: ${subscriptionId}`);
  console.log(`[CompanyPool]    Webhook URL: ${webhookUrl}`);
  
  return poolAddress;
};

/**
 * Initialize company's pool for a specific wallet type
 */
export const initializeCompanyPool = async (
  companyId: number,
  userId: number,
  walletType: string,
  count: number = COMPANY_POOL_CONFIG.INITIAL_SIZE
): Promise<void> => {
  console.log(`[CompanyPool] Initializing ${walletType} pool for company ${companyId} with ${count} addresses`);
  
  const transaction = await sequelize.transaction();
  
  try {
    for (let i = 0; i < count; i++) {
      await addAddressToCompanyPool(companyId, userId, walletType, transaction);
    }
    await transaction.commit();
    console.log(`[CompanyPool] ✅ Initialized ${walletType} pool for company ${companyId}`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Get an available address from company's pool
 */
const getAvailableAddress = async (
  companyId: number,
  walletType: string,
  transaction?: Transaction
): Promise<any> => {
  // First, release any expired reservations
  await releaseExpiredReservations(companyId, walletType, transaction);
  
  // Find available address with least transactions (load balancing)
  return companyAddressPoolModel.findOne({
    where: {
      company_id: companyId,
      wallet_type: walletType,
      status: "AVAILABLE",
    },
    order: [
      ["admin_fee_balance", "ASC"],
      ["total_transactions", "ASC"],
    ],
    transaction,
    lock: transaction ? Transaction.LOCK.UPDATE : undefined,
  });
};

/**
 * Release expired address reservations
 */
const releaseExpiredReservations = async (
  companyId: number,
  walletType: string,
  transaction?: Transaction
): Promise<void> => {
  const now = new Date();
  
  // Release RESERVED addresses past timeout
  await companyAddressPoolModel.update(
    {
      status: "AVAILABLE",
      current_payment_id: null,
      expected_amount: null,
      received_amount: 0,
      reserved_until: null,
    },
    {
      where: {
        company_id: companyId,
        wallet_type: walletType,
        status: "RESERVED",
        reserved_until: { [Op.lt]: now },
      },
      transaction,
    }
  );
  
  // Release PROCESSING addresses past timeout
  const processingTimeout = new Date(now.getTime() - COMPANY_POOL_CONFIG.PROCESSING_TIMEOUT * 60 * 1000);
  await companyAddressPoolModel.update(
    {
      status: "AVAILABLE",
      current_payment_id: null,
      expected_amount: null,
      received_amount: 0,
      locked_at: null,
    },
    {
      where: {
        company_id: companyId,
        wallet_type: walletType,
        status: "PROCESSING",
        locked_at: { [Op.lt]: processingTimeout },
      },
      transaction,
    }
  );
};

/**
 * Reserve an address from company's pool for a payment
 * This is the main entry point for payment processing
 */
export const reserveCompanyAddress = async (
  companyId: number,
  userId: number,
  walletType: string,
  paymentId: string,
  expectedAmount: number
): Promise<{
  address: string;
  address_id: number;
  is_company_pool: boolean;
  transaction_id: string;
}> => {
  console.log(`[CompanyPool] Reserving ${walletType} address for company ${companyId}, payment ${paymentId}`);
  
  const transaction = await sequelize.transaction();
  
  try {
    // Try to get available address
    let poolAddress = await getAvailableAddress(companyId, walletType, transaction);
    
    // If no available address, create new one
    if (!poolAddress) {
      console.log(`[CompanyPool] No available ${walletType} address for company ${companyId}, creating new one`);
      poolAddress = await addAddressToCompanyPool(companyId, userId, walletType, transaction);
    }
    
    // Verify subscription exists and URL is correct
    const expectedWebhookUrl = await getCompanyWebhookUrl(companyId);
    if (poolAddress.dataValues.webhook_url !== expectedWebhookUrl) {
      console.log(`[CompanyPool] ⚠️ Webhook URL mismatch, updating subscription`);
      console.log(`[CompanyPool]    Current: ${poolAddress.dataValues.webhook_url}`);
      console.log(`[CompanyPool]    Expected: ${expectedWebhookUrl}`);
      
      // Update subscription URL
      const subResult = await tatumApi.createSubscriptionWithUrl(
        poolAddress.dataValues.wallet_address,
        walletType,
        expectedWebhookUrl
      );
      
      await poolAddress.update({
        subscription_id: subResult?.id || poolAddress.dataValues.subscription_id,
        webhook_url: expectedWebhookUrl,
      }, { transaction });
    }
    
    // Reserve the address
    const reservedUntil = new Date(Date.now() + COMPANY_POOL_CONFIG.RESERVATION_TIMEOUT * 60 * 1000);
    const transactionId = uuidv4();
    
    await poolAddress.update({
      status: "RESERVED",
      current_payment_id: paymentId,
      expected_amount: expectedAmount,
      received_amount: 0,
      reserved_until: reservedUntil,
      locked_at: new Date(),
    }, { transaction });
    
    await transaction.commit();
    
    console.log(`[CompanyPool] ✅ Reserved address ${poolAddress.dataValues.wallet_address} for company ${companyId}`);
    console.log(`[CompanyPool]    Payment: ${paymentId}`);
    console.log(`[CompanyPool]    Expected: ${expectedAmount} ${walletType}`);
    console.log(`[CompanyPool]    Expires: ${reservedUntil.toISOString()}`);
    
    return {
      address: poolAddress.dataValues.wallet_address,
      address_id: poolAddress.dataValues.address_id,
      is_company_pool: true,
      transaction_id: transactionId,
    };
    
  } catch (error) {
    await transaction.rollback();
    const message = getErrorMessage(error);
    console.error(`[CompanyPool] ❌ Failed to reserve address: ${message}`);
    throw error;
  }
};

/**
 * Mark address as processing (payment received)
 */
export const markPaymentReceived = async (
  address: string,
  receivedAmount: number,
  txId: string
): Promise<any> => {
  const poolAddress = await companyAddressPoolModel.findOne({
    where: { wallet_address: address },
  });
  
  if (!poolAddress) {
    throw new Error(`Address ${address} not found in company pool`);
  }
  
  await poolAddress.update({
    status: "PROCESSING",
    received_amount: receivedAmount,
    locked_at: new Date(),
  });
  
  console.log(`[CompanyPool] ✅ Marked ${address} as PROCESSING, received ${receivedAmount}`);
  return poolAddress;
};

/**
 * Release address back to pool after payment completion
 */
export const releaseCompanyAddress = async (
  addressId: number,
  adminFeeAmount: number = 0,
  transaction?: Transaction
): Promise<void> => {
  const poolAddress = await companyAddressPoolModel.findByPk(addressId, { transaction });
  
  if (!poolAddress) {
    console.warn(`[CompanyPool] Address ${addressId} not found for release`);
    return;
  }
  
  const walletType = poolAddress.dataValues.wallet_type;
  const isUtxo = UTXO_CHAINS.includes(walletType);
  
  // For UTXO chains, address becomes AVAILABLE immediately (no fee accumulation)
  // For account chains, address becomes IN_USE until fees are swept
  const newStatus = isUtxo || adminFeeAmount === 0 ? "AVAILABLE" : "IN_USE";
  
  await poolAddress.update({
    status: newStatus,
    current_payment_id: null,
    expected_amount: null,
    received_amount: 0,
    reserved_until: null,
    locked_at: null,
    admin_fee_balance: sequelize.literal(`admin_fee_balance + ${adminFeeAmount}`),
    total_transactions: sequelize.literal('total_transactions + 1'),
    last_used_at: new Date(),
    last_merchant_payout: new Date(),
  }, { transaction });
  
  console.log(`[CompanyPool] ✅ Released address ${addressId} -> ${newStatus}`);
  if (adminFeeAmount > 0) {
    console.log(`[CompanyPool]    Added ${adminFeeAmount} to admin fee balance`);
  }
};

/**
 * Get pool statistics for a company
 */
export const getCompanyPoolStats = async (companyId: number): Promise<{
  total: number;
  available: number;
  reserved: number;
  in_use: number;
  processing: number;
  by_type: Record<string, { total: number; available: number }>;
}> => {
  const addresses = await companyAddressPoolModel.findAll({
    where: { company_id: companyId },
    attributes: ['wallet_type', 'status'],
  });
  
  const stats = {
    total: addresses.length,
    available: 0,
    reserved: 0,
    in_use: 0,
    processing: 0,
    by_type: {} as Record<string, { total: number; available: number }>,
  };
  
  for (const addr of addresses) {
    const type = addr.dataValues.wallet_type;
    const status = addr.dataValues.status;
    
    if (!stats.by_type[type]) {
      stats.by_type[type] = { total: 0, available: 0 };
    }
    stats.by_type[type].total++;
    
    switch (status) {
      case 'AVAILABLE':
        stats.available++;
        stats.by_type[type].available++;
        break;
      case 'RESERVED':
        stats.reserved++;
        break;
      case 'IN_USE':
        stats.in_use++;
        break;
      case 'PROCESSING':
        stats.processing++;
        break;
    }
  }
  
  return stats;
};

/**
 * Find address by wallet address
 */
export const findCompanyAddressByWallet = async (walletAddress: string): Promise<any> => {
  return companyAddressPoolModel.findOne({
    where: { wallet_address: walletAddress },
  });
};

/**
 * Check if an address belongs to company pool
 */
export const isCompanyPoolAddress = async (walletAddress: string): Promise<boolean> => {
  const address = await companyAddressPoolModel.findOne({
    where: { wallet_address: walletAddress },
    attributes: ['address_id'],
  });
  return !!address;
};

/**
 * Ensure all company pool addresses have valid subscriptions
 */
export const ensureCompanyPoolSubscriptions = async (companyId?: number): Promise<{
  checked: number;
  valid: number;
  updated: number;
  failed: number;
  errors: string[];
}> => {
  const result = {
    checked: 0,
    valid: 0,
    updated: 0,
    failed: 0,
    errors: [] as string[],
  };
  
  console.log(`[CompanyPool] 🔍 Starting subscription health check...`);
  
  // Get all company pool addresses
  const whereClause = companyId ? { company_id: companyId } : {};
  const addresses = await companyAddressPoolModel.findAll({
    where: whereClause,
    include: [{
      model: companyModel,
      as: 'company',
      attributes: ['company_id', 'backend_url'],
    }],
  });
  
  console.log(`[CompanyPool] Found ${addresses.length} addresses to check`);
  
  for (const addr of addresses) {
    result.checked++;
    
    const walletAddress = addr.dataValues.wallet_address;
    const walletType = addr.dataValues.wallet_type;
    const addrCompanyId = addr.dataValues.company_id;
    const currentSubId = addr.dataValues.subscription_id;
    const currentWebhookUrl = addr.dataValues.webhook_url;
    
    // Get expected webhook URL for this company
    const expectedWebhookUrl = await getCompanyWebhookUrl(addrCompanyId);
    
    try {
      // Create/update subscription with correct URL
      const subResult = await tatumApi.createSubscriptionWithUrl(
        walletAddress,
        walletType,
        expectedWebhookUrl
      );
      
      if (subResult?.id) {
        const needsUpdate = currentSubId !== subResult.id || currentWebhookUrl !== expectedWebhookUrl;
        
        if (needsUpdate) {
          await addr.update({
            subscription_id: subResult.id,
            webhook_url: expectedWebhookUrl,
          });
          result.updated++;
          console.log(`[CompanyPool] ✅ Updated subscription for ${walletAddress}`);
        } else {
          result.valid++;
        }
      }
    } catch (error: any) {
      result.failed++;
      result.errors.push(`${walletAddress}: ${error.message}`);
      console.error(`[CompanyPool] ❌ Failed for ${walletAddress}: ${error.message}`);
    }
  }
  
  console.log(`[CompanyPool] ✅ Health check complete:`);
  console.log(`   - Checked: ${result.checked}`);
  console.log(`   - Valid: ${result.valid}`);
  console.log(`   - Updated: ${result.updated}`);
  console.log(`   - Failed: ${result.failed}`);
  
  return result;
};

export default {
  getOrCreateCompanyWallet,
  addAddressToCompanyPool,
  initializeCompanyPool,
  reserveCompanyAddress,
  markPaymentReceived,
  releaseCompanyAddress,
  getCompanyPoolStats,
  findCompanyAddressByWallet,
  isCompanyPoolAddress,
  ensureCompanyPoolSubscriptions,
  COMPANY_POOL_CONFIG,
  UTXO_CHAINS,
  ACCOUNT_CHAINS,
  TOKEN_CHAINS,
  NATIVE_CURRENCIES,
};
