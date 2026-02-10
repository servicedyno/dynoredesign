/**
 * Merchant Pool Wallet Management
 * 
 * Handles wallet creation, address generation, and pool initialization.
 */

import { Transaction, Op } from "sequelize";
import {
  merchantWalletModel,
  merchantTempAddressModel,
  CHAIN_XPUB_MAPPING,
  NON_HD_CHAINS,
} from "../../models";
import tatumApi from "../../apis/tatumApi";
import sequelize from "../../utils/dbInstance";
import { getErrorMessage } from "../../helper";
import { POOL_CONFIG, RLUSD_CONFIG, isTagBasedChain, XRP_MASTER_ADDRESS, getCryptoRedisKey } from "./merchantPoolConfig";
import { adminFeeModel } from "../../models";

/**
 * Generate a unique destination tag for XRP-based payments.
 * Uses a random 32-bit unsigned integer (1 to 4,294,967,295).
 * Tag 0 is avoided as some wallets treat it as "no tag".
 */
const generateUniqueDestinationTag = async (
  userId: number,
  walletType: string,
  transaction?: Transaction
): Promise<number> => {
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    // Random tag between 1 and 4,294,967,295
    const tag = Math.floor(Math.random() * 4294967294) + 1;
    
    // Check uniqueness in the pool
    const existing = await merchantTempAddressModel.findOne({
      where: {
        wallet_address: XRP_MASTER_ADDRESS,
        destination_tag: tag,
      },
      transaction,
    });
    
    if (!existing) {
      return tag;
    }
  }
  // Fallback: use timestamp-based tag
  return (Date.now() % 4294967294) + 1;
};

/**
 * Get or create merchant's xpub/mnemonic for a chain
 */
export const getOrCreateMerchantWallet = async (
  userId: number,
  walletType: string
): Promise<{ xpub: string; mnemonic: string }> => {
  const baseChain = CHAIN_XPUB_MAPPING[walletType] || walletType;
  
  let merchantWallet = await merchantWalletModel.findOne({
    where: {
      user_id: userId,
      wallet_type: baseChain,
    },
  });

  if (merchantWallet) {
    // Non-HD chains: mnemonic field stores "NON_HD" marker
    if (NON_HD_CHAINS.includes(baseChain)) {
      return { xpub: merchantWallet.dataValues.xpub, mnemonic: "NON_HD" };
    }
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

  console.log(`[MerchantPool] Generating new ${baseChain} wallet for merchant ${userId}...`);
  
  const walletData = await tatumApi.generateWallet(baseChain);
  
  // Non-HD chains (SOL, XRP): no real xpub/mnemonic — store placeholders
  if (NON_HD_CHAINS.includes(baseChain)) {
    if (!walletData || !walletData.xpub) {
      throw new Error(`Failed to generate ${baseChain} wallet for merchant ${userId}`);
    }
    
    const encryptedMnemonic = await tatumApi.encryptSymmetric(
      JSON.stringify({ xpub: walletData.xpub, mnemonic: "NON_HD" }),
      process.env.XPUB_KEY_ID
    );

    merchantWallet = await merchantWalletModel.create({
      user_id: userId,
      wallet_type: baseChain,
      xpub: walletData.xpub,
      mnemonic: encryptedMnemonic,
      last_derivation_index: 0,
    });

    console.log(`[MerchantPool] ✅ Created ${baseChain} (non-HD) wallet marker for merchant ${userId}`);
    return { xpub: walletData.xpub, mnemonic: "NON_HD" };
  }
  
  if (!walletData || !walletData.xpub || !walletData.mnemonic) {
    throw new Error(`Failed to generate ${baseChain} wallet for merchant ${userId}`);
  }

  const encryptedMnemonic = await tatumApi.encryptSymmetric(
    JSON.stringify({ xpub: walletData.xpub, mnemonic: walletData.mnemonic }),
    process.env.XPUB_KEY_ID
  );

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
 * 
 * For TAG_BASED_CHAINS (XRP, RLUSD): Uses a single master address with unique
 * destination tags. No per-address funding or trust line setup needed.
 * 
 * For all other chains: Generates a new HD-derived or non-HD address as before.
 */
export const addAddressToMerchantPool = async (
  userId: number,
  walletType: string,
  transaction?: Transaction
): Promise<unknown> => {
  try {
    // ──────────────────────────────────────────────────────────────
    // TAG-BASED CHAINS (XRP, RLUSD): Master address + destination tag
    // ──────────────────────────────────────────────────────────────
    if (isTagBasedChain(walletType)) {
      if (!XRP_MASTER_ADDRESS) {
        throw new Error(`XRP_FEE_WALLET (master address) not configured. Cannot create ${walletType} pool address.`);
      }

      const destinationTag = await generateUniqueDestinationTag(userId, walletType, transaction);

      // Get the master address's encrypted private key from admin fee wallet
      const xrpFeeWalletRecord = await adminFeeModel.findOne({ where: { wallet_type: "XRP" } });
      if (!xrpFeeWalletRecord) {
        throw new Error("XRP admin fee wallet record not found in DB. Cannot create tag-based address.");
      }
      const encryptedMasterKey = xrpFeeWalletRecord.dataValues.privateKey;

      // Create a subscription on the master address (idempotent — Tatum deduplicates by address)
      let subscriptionId = null;
      try {
        const subResult = await tatumApi.createSubscription(
          XRP_MASTER_ADDRESS,
          walletType === "RLUSD" ? "XRP" : walletType,  // Subscription is on the XRP address
          true
        );
        subscriptionId = subResult?.id;
      } catch (subError) {
        console.warn(`[MerchantPool] Warning: Subscription for master address:`, getErrorMessage(subError));
      }

      const poolAddress = await merchantTempAddressModel.create(
        {
          owner_user_id: userId,
          wallet_type: walletType,
          wallet_address: XRP_MASTER_ADDRESS,
          destination_tag: destinationTag,
          private_key: encryptedMasterKey,
          derivation_index: destinationTag,  // Use tag as derivation index for uniqueness
          subscription_id: subscriptionId,
          status: "AVAILABLE",
          admin_fee_balance: 0,
          gas_balance: 0,
          total_transactions: 0,
        },
        { transaction }
      );

      console.log(`[MerchantPool] ✅ Added tag-based ${walletType} address for merchant ${userId}: ${XRP_MASTER_ADDRESS}:${destinationTag}`);
      return poolAddress;
    }

    // ──────────────────────────────────────────────────────────────
    // STANDARD CHAINS: Generate individual address (existing logic)
    // ──────────────────────────────────────────────────────────────
    const { xpub, mnemonic } = await getOrCreateMerchantWallet(userId, walletType);
    
    const derivationIndex = await getNextDerivationIndex(userId, walletType, transaction);
    
    const addressData = await tatumApi.generateUserAddress({
      currency: walletType,
      xpub,
      mnemonic,
      index: derivationIndex,
    });

    if (!addressData || !addressData.address) {
      throw new Error(`Failed to generate address for ${walletType} at index ${derivationIndex}`);
    }

    const encryptedPrivateKey = await tatumApi.encryptSymmetric(
      addressData.privateKey,
      process.env.TEMP_KEY_ID
    );

    let subscriptionId = null;
    try {
      const subResult = await tatumApi.createSubscription(
        addressData.address,
        walletType,
        true
      );
      subscriptionId = subResult?.id;
    } catch (subError) {
      console.error(`[MerchantPool] Warning: Failed to create subscription for ${addressData.address}:`, subError);
    }

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

    // For RLUSD: Set up XRP Trust Line so the address can receive RLUSD tokens
    if (walletType === "RLUSD") {
      let trustLineEstablished = false;
      try {
        const rlusdIssuer = RLUSD_CONFIG.issuer;
        const rlusdCurrencyHex = RLUSD_CONFIG.currencyHex;
        
        console.log(`[MerchantPool] 🔗 Setting up RLUSD trust line for ${addressData.address}...`);
        
        // Fund the address with XRP from the fee wallet
        const xrpFeeWallet = process.env.XRP_FEE_WALLET || process.env.XRP;
        if (xrpFeeWallet) {
          const { adminFeeModel } = await import("../../models");
          const xrpFeeWalletRecord = await adminFeeModel.findOne({ where: { wallet_type: "XRP" } });
          if (xrpFeeWalletRecord) {
            const xrpFeePrivateKey = await tatumApi.decryptSymmetric(
              xrpFeeWalletRecord.dataValues.privateKey,
              process.env.TEMP_KEY_ID
            );
            // Fund with 2 XRP (1 base reserve + 0.2 trust line reserve + 0.8 buffer)
            await tatumApi.assetToOtherAddress({
              currency: "XRP",
              fromAddress: xrpFeeWallet,
              toAddress: addressData.address,
              privateKey: xrpFeePrivateKey,
              amount: 2,
              fee: null,
            });
            console.log(`[MerchantPool] ✅ Funded ${addressData.address} with 2 XRP for RLUSD trust line`);
            
            // Poll for account activation instead of fixed wait
            // XRP Ledger closes every 3-5 seconds; Tatum API adds propagation delay
            let accountActivated = false;
            for (let attempt = 0; attempt < 8; attempt++) {
              await new Promise(resolve => setTimeout(resolve, 3000));
              try {
                accountActivated = await tatumApi.verifyXrpAccountActivated(addressData.address);
                if (accountActivated) {
                  console.log(`[MerchantPool] ✅ Account ${addressData.address} activated on-ledger (attempt ${attempt + 1})`);
                  break;
                }
              } catch {
                // Ignore check errors, keep polling
              }
            }
            
            if (!accountActivated) {
              console.warn(`[MerchantPool] ⚠️ Account ${addressData.address} not yet activated after polling, attempting trust line anyway...`);
            }
            
            // Attempt trust line creation with retry
            let lastError: unknown = null;
            for (let retry = 0; retry < 3; retry++) {
              try {
                await tatumApi.setupXrpTrustLine(
                  addressData.address,
                  addressData.privateKey,
                  rlusdIssuer,
                  rlusdCurrencyHex,
                  "999999999"
                );
                console.log(`[MerchantPool] ✅ RLUSD trust line established for ${addressData.address}`);
                trustLineEstablished = true;
                break;
              } catch (retryError) {
                lastError = retryError;
                console.warn(`[MerchantPool] ⚠️ Trust line attempt ${retry + 1}/3 failed: ${getErrorMessage(retryError)}`);
                if (retry < 2) {
                  await new Promise(resolve => setTimeout(resolve, 5000));
                }
              }
            }
            
            if (!trustLineEstablished && lastError) {
              console.error(`[MerchantPool] ❌ RLUSD trust line failed after 3 retries for ${addressData.address}`);
            }
          } else {
            console.error(`[MerchantPool] ❌ XRP fee wallet record not found in DB, cannot fund RLUSD address`);
          }
        } else {
          console.error(`[MerchantPool] ❌ XRP_FEE_WALLET not configured, cannot fund RLUSD address`);
        }
      } catch (trustLineError) {
        console.error(`[MerchantPool] ❌ RLUSD trust line setup failed:`, getErrorMessage(trustLineError));
      }
      
      // If trust line was NOT established, mark address as PENDING_TRUSTLINE
      // so it won't be picked up by reserveAddress
      if (!trustLineEstablished) {
        console.warn(`[MerchantPool] ⚠️ Marking ${addressData.address} as PENDING_TRUSTLINE (trust line not confirmed)`);
        await poolAddress.update({ status: "PENDING_TRUSTLINE" }, { transaction });
      }
    }

    return poolAddress;
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[MerchantPool] ❌ Failed to add address to pool:`, message);
    throw error;
  }
};

/**
 * Initialize merchant's pool for a specific wallet type
 */
export const initializeMerchantPool = async (
  userId: number,
  walletType: string
): Promise<void> => {
  const transaction = await sequelize.transaction();

  try {
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
 * Pre-warm pool addresses for active merchants.
 * 
 * Checks each merchant+chain combination that has been used before.
 * If AVAILABLE count is below MIN_AVAILABLE, creates new addresses
 * in the background so the next payment request has an address ready.
 * 
 * This eliminates the ~3-4s Tatum API call bottleneck during payment creation.
 */
export const prewarmPoolAddresses = async (): Promise<{
  checked: number;
  created: number;
  errors: string[];
}> => {
  const result = { checked: 0, created: 0, errors: [] as string[] };
  
  try {
    // Find all distinct merchant+chain combos that have pool addresses
    const activePoolGroups = await merchantTempAddressModel.findAll({
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('owner_user_id')), 'owner_user_id'],
        'wallet_type',
      ],
      where: {
        owner_user_id: { [Op.ne]: null },
      },
      group: ['owner_user_id', 'wallet_type'],
      raw: true,
    }) as unknown as Array<{ owner_user_id: number; wallet_type: string }>;

    console.log(`[PreWarm] Checking ${activePoolGroups.length} merchant+chain combinations...`);

    for (const group of activePoolGroups) {
      result.checked++;
      const { owner_user_id: userId, wallet_type: walletType } = group;

      try {
        // Count currently AVAILABLE addresses for this merchant+chain
        const availableCount = await merchantTempAddressModel.count({
          where: {
            owner_user_id: userId,
            wallet_type: walletType,
            status: 'AVAILABLE',
          },
        });

        if (availableCount >= POOL_CONFIG.MIN_AVAILABLE) {
          continue; // Already has enough available addresses
        }

        const toCreate = POOL_CONFIG.MIN_AVAILABLE - availableCount;
        console.log(`[PreWarm] 🔥 Merchant ${userId} / ${walletType}: ${availableCount} available, creating ${toCreate} more...`);

        for (let i = 0; i < toCreate; i++) {
          try {
            await addAddressToMerchantPool(userId, walletType);
            result.created++;
            console.log(`[PreWarm] ✅ Created pre-warmed ${walletType} address for merchant ${userId}`);
          } catch (createError) {
            const msg = getErrorMessage(createError);
            console.error(`[PreWarm] ❌ Failed to create ${walletType} for merchant ${userId}: ${msg}`);
            result.errors.push(`${walletType}:${userId} - ${msg}`);
          }
        }
      } catch (groupError) {
        const msg = getErrorMessage(groupError);
        result.errors.push(`Check ${walletType}:${userId} - ${msg}`);
      }
    }

    console.log(`[PreWarm] Complete: checked=${result.checked}, created=${result.created}, errors=${result.errors.length}`);
  } catch (error) {
    const msg = getErrorMessage(error);
    console.error(`[PreWarm] ❌ Pre-warming failed:`, msg);
    result.errors.push(msg);
  }

  return result;
};

/**
 * Retry trust line creation for RLUSD addresses stuck in PENDING_TRUSTLINE status.
 * Called periodically by the prewarm cron or a dedicated cron job.
 */
export const retryPendingTrustLines = async (): Promise<{
  retried: number;
  succeeded: number;
  errors: string[];
}> => {
  const result = { retried: 0, succeeded: 0, errors: [] as string[] };
  
  try {
    const pendingAddresses = await merchantTempAddressModel.findAll({
      where: {
        wallet_type: "RLUSD",
        status: "PENDING_TRUSTLINE",
      },
    });

    if (pendingAddresses.length === 0) return result;

    console.log(`[TrustLineRetry] Found ${pendingAddresses.length} RLUSD addresses with pending trust lines`);

    const rlusdIssuer = RLUSD_CONFIG.issuer;
    const rlusdCurrencyHex = RLUSD_CONFIG.currencyHex;

    for (const addr of pendingAddresses) {
      result.retried++;
      const walletAddress = addr.dataValues.wallet_address;
      
      try {
        // First check if account is activated
        const isActivated = await tatumApi.verifyXrpAccountActivated(walletAddress);
        if (!isActivated) {
          // Try to fund the account
          const xrpFeeWallet = process.env.XRP_FEE_WALLET || process.env.XRP;
          if (!xrpFeeWallet) {
            result.errors.push(`${walletAddress}: No XRP fee wallet configured`);
            continue;
          }

          const { adminFeeModel } = await import("../../models");
          const xrpFeeWalletRecord = await adminFeeModel.findOne({ where: { wallet_type: "XRP" } });
          if (!xrpFeeWalletRecord) {
            result.errors.push(`${walletAddress}: XRP fee wallet not found in DB`);
            continue;
          }

          const xrpFeePrivateKey = await tatumApi.decryptSymmetric(
            xrpFeeWalletRecord.dataValues.privateKey,
            process.env.TEMP_KEY_ID
          );

          await tatumApi.assetToOtherAddress({
            currency: "XRP",
            fromAddress: xrpFeeWallet,
            toAddress: walletAddress,
            privateKey: xrpFeePrivateKey,
            amount: 2,
            fee: null,
          });
          console.log(`[TrustLineRetry] Funded ${walletAddress} with 2 XRP`);
          
          // Wait for activation
          await new Promise(resolve => setTimeout(resolve, 8000));
        }

        // Check if trust line already exists
        const hasTrustLine = await tatumApi.verifyXrpTrustLine(walletAddress, rlusdIssuer, rlusdCurrencyHex);
        if (hasTrustLine) {
          console.log(`[TrustLineRetry] ✅ Trust line already exists for ${walletAddress}, marking AVAILABLE`);
          await addr.update({ status: "AVAILABLE" });
          result.succeeded++;
          continue;
        }

        // Decrypt the private key for trust line creation
        const privateKey = await tatumApi.decryptSymmetric(
          addr.dataValues.private_key,
          process.env.TEMP_KEY_ID
        );

        await tatumApi.setupXrpTrustLine(
          walletAddress,
          privateKey,
          rlusdIssuer,
          rlusdCurrencyHex,
          "999999999"
        );
        
        console.log(`[TrustLineRetry] ✅ Trust line established for ${walletAddress}`);
        await addr.update({ status: "AVAILABLE" });
        result.succeeded++;
      } catch (error) {
        const msg = getErrorMessage(error);
        console.error(`[TrustLineRetry] ❌ Failed for ${walletAddress}: ${msg}`);
        result.errors.push(`${walletAddress}: ${msg}`);
      }
    }

    console.log(`[TrustLineRetry] Complete: retried=${result.retried}, succeeded=${result.succeeded}, errors=${result.errors.length}`);
  } catch (error) {
    const msg = getErrorMessage(error);
    console.error(`[TrustLineRetry] ❌ Retry job failed:`, msg);
    result.errors.push(msg);
  }

  return result;
};
