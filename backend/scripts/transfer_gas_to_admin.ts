/**
 * Manual transfer from ETH fee (gas) wallet to admin fee wallet.
 * Sends a fixed amount minus explicit gas settings.
 *
 * Usage: cd /app/backend && npx ts-node --transpile-only scripts/transfer_gas_to_admin.ts
 */
import dotenv from "dotenv";
dotenv.config();

import tatumApi from "../apis/tatumApi";
import adminFeeModel from "../models/adminFeeModel";

const FROM_ADDRESS = "0x033d2bb052e3d85bfe96fbd86cf876a350ad6b1c";
const TO_ADDRESS = "0x9a7221b5e32d5f99e8da95585835442e29afb38f";
const AMOUNT_TO_SEND = 0.0151; // 0.0153 - fast gas (0.0002)

const GAS_PRICE_GWEI = 2;
const GAS_LIMIT = 100000;

async function main() {
  console.log(`\n=== Manual ETH Transfer (Gas Wallet → Admin Wallet) ===`);
  console.log(`From: ${FROM_ADDRESS}`);
  console.log(`To:   ${TO_ADDRESS}`);
  console.log(`Amount: ${AMOUNT_TO_SEND} ETH`);
  console.log(`Gas: ${GAS_PRICE_GWEI} Gwei, limit ${GAS_LIMIT}`);

  const feeWalletRecord = await adminFeeModel.findOne({ where: { wallet_type: "ETH" } });

  if (!feeWalletRecord?.dataValues?.privateKey) {
    throw new Error("ETH fee wallet private key not found in DB (tbl_admin_fee_wallet)");
  }

  const privateKey = await tatumApi.decryptSymmetric(
    feeWalletRecord.dataValues.privateKey,
    process.env.TEMP_KEY_ID
  );

  console.log("Private key decrypted successfully.");

  const result = await tatumApi.assetToOtherAddress({
    currency: "ETH",
    fromAddress: FROM_ADDRESS,
    toAddress: TO_ADDRESS,
    privateKey,
    amount: AMOUNT_TO_SEND.toString(),
    fee: {
      gasPrice: GAS_PRICE_GWEI,
      gasLimit: GAS_LIMIT,
    },
  });

  console.log("\n=== Transfer Result ===");
  console.log(JSON.stringify(result, null, 2));

  if (result?.txId) {
    console.log(`\n✅ SUCCESS! TX Hash: ${result.txId}`);
    console.log(`View on Etherscan: https://etherscan.io/tx/${result.txId}`);
  } else {
    console.error("\n❌ Transfer failed - no txId returned");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
