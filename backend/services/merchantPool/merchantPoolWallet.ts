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
import { POOL_CONFIG } from "./merchantPoolConfig";

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
 */
export const addAddressToMerchantPool = async (
  userId: number,
  walletType: string,
  transaction?: Transaction
): Promise<unknown> => {
  try {
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
      try {
        const rlusdIssuer = process.env.RLUSD_ISSUER || "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
        const rlusdCurrencyHex = process.env.RLUSD_CURRENCY_HEX || "524C555344000000000000000000000000000000";
        
        // First, fund the XRP address with enough XRP for account reserve + trust line reserve + tx fees
        // XRP account needs 10 XRP reserve + 2 XRP per trust line + ~0.00001 XRP tx fee
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
            // Fund with 13 XRP (10 base reserve + 2 trust line reserve + 1 buffer)
            await tatumApi.assetToOtherAddress({
              currency: "XRP",
              fromAddress: xrpFeeWallet,
              toAddress: addressData.address,
              privateKey: xrpFeePrivateKey,
              amount: 13,
              fee: null,
            });
            console.log(`[MerchantPool] ✅ Funded ${addressData.address} with 13 XRP for RLUSD trust line`);
            
            // Wait a moment for the funding to confirm
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Now set up the trust line
            await tatumApi.setupXrpTrustLine(
              addressData.address,
              addressData.privateKey,
              rlusdIssuer,
              rlusdCurrencyHex,
              "999999999"
            );
            console.log(`[MerchantPool] ✅ RLUSD trust line established for ${addressData.address}`);
          }
        }
      } catch (trustLineError) {
        console.error(`[MerchantPool] ⚠️ RLUSD trust line setup failed (non-critical, can retry):`, getErrorMessage(trustLineError));
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
