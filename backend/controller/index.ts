import {
  feesModel,
} from "../models";
import { getRedisItem, setRedisItem } from "../utils/redisInstance";
import apiController from "./apiController";
import companyController from "./companyController";
import paymentController from "./paymentController";
import userController from "./userController";
import walletController from "./walletController";
import { getBlockchainThreshold, getTransactionFeePercent, getFeeTiers } from "../utils/feeConfigUtils";

export const getTransactionFee = async () => {
  const envFee = getTransactionFeePercent();
  if (envFee) return envFee;

  const admin_fee = await getRedisItem("admin_fee");
  let transaction_fee;
  if (!admin_fee?.transaction_fee) {
    const { fee } = await (
      await feesModel.findOne({
        where: {
          feeType: "TRANSACTION_FEE",
        },
      })
    ).dataValues;
    transaction_fee = fee;
    await setRedisItem("admin_fee", { transaction_fee });
  } else {
    transaction_fee = admin_fee?.transaction_fee;
  }
  return transaction_fee;
};

export const getBlockchainFee = async () => {
  const admin_fee = await getRedisItem("admin_fee");
  let blockchain_fee;
  if (!admin_fee?.blockchain_fee) {
    const { fee } = await (
      await feesModel.findOne({
        where: {
          feeType: "BLOCKCHAIN_FEE",
        },
      })
    ).dataValues;
    blockchain_fee = fee;
    await setRedisItem("admin_fee", { blockchain_fee });
  } else {
    blockchain_fee = admin_fee?.blockchain_fee;
  }
  return blockchain_fee;
};

export const getBlockchainConfig = async (blockchain: string) => {
  const threshold = getBlockchainThreshold(blockchain);
  const tiers = getFeeTiers();

  if (threshold !== undefined && tiers.length > 0) {
    return {
      blockchain,
      min_forwarding_amount: threshold,
      transaction_fee_percent: getTransactionFeePercent(),
      tiers: tiers.map(t => ({
        min_amount: t.min,
        max_amount: t.max,
        fixed_fee: t.fixed,
        blockchain_buffer_percent: t.buffer
      }))
    };
  }
};

export const calculateTransactionFees = async (
  blockchain: string,
  amount: number
) => {
  const config: any = await getBlockchainConfig(blockchain);
  if (!config) {
    throw new Error(`Blockchain ${blockchain} configuration not found`);
  }

  // Find the matching tier based on amount
  const tiers = config.tiers || [];
  const matchingTier = tiers.find(
    (tier: any) =>
      amount >= tier.min_amount &&
      (tier.max_amount === null || amount <= tier.max_amount)
  );

  if (!matchingTier) {
    throw new Error(`No fee tier found for amount ${amount}`);
  }

  // Calculate fees directly in native currency
  const fixedFee = matchingTier.fixed_fee;
  const transactionFee = (amount * config.transaction_fee_percent) / 100;
  const blockchainBuffer =
    (amount * matchingTier.blockchain_buffer_percent) / 100;

  const totalDeduction = fixedFee + transactionFee + blockchainBuffer;
  const userReceives = amount - totalDeduction;

  return {
    fixedFee,
    transactionFee,
    blockchainBuffer,
    totalDeduction,
    userReceives,
    tierId: matchingTier.id || 0,
    minForwarding: config.min_forwarding_amount,
  };
};

export {
  userController,
  companyController,
  paymentController,
  walletController,
  apiController,
};
