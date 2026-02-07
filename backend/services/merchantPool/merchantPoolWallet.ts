/**
 * Merchant Pool Wallet Management
 * 
 * Handles wallet creation, address generation, and pool initialization.
 */

import { Transaction } from "sequelize";
import {
  merchantWalletModel,
  merchantTempAddressModel,
  CHAIN_XPUB_MAPPING,
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
