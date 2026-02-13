/**
 * Retry ETH transfer with corrected gas buffer
 */
import dotenv from "dotenv";
dotenv.config();

import tatumApi from "../apis/tatumApi";
import axios from "axios";
import { Sequelize, QueryTypes } from "sequelize";

const FROM = "0xdb0c01c41879d877654050002e6e6f283841c9c3";
const TO = "0x9a7221b5e32d5f99e8da95585835442e29afb38f";
const TATUM_KEY = process.env.TATUM_KEY!;

const sequelize = new Sequelize(
  process.env.DB_NAME!,
  process.env.USER_NAME!,
  process.env.PASSWORD!,
  {
    host: process.env.HOST,
    port: parseInt(process.env.DB_PORT || "5432"),
    dialect: "postgres",
    logging: false,
  }
);

async function main() {
  // Step 1: Get balance
  const balResp = await axios.get(
    `https://api.tatum.io/v3/ethereum/account/balance/${FROM}`,
    { headers: { "x-api-key": TATUM_KEY } }
  );
  const ethBalance = parseFloat(balResp.data.balance);
  console.log(`Balance: ${ethBalance} ETH`);

  // Step 2: Tatum enforces minimum 1 Gwei internally, so use 1 Gwei for calculation
  // For simple ETH transfer: gasLimit = 21000
  const gasPriceGwei = 1; // Tatum minimum
  const gasLimit = 21000;
  const gasFeeETH = (gasPriceGwei * 1e9 * gasLimit) / 1e18; // = 0.000021 ETH
  console.log(`Gas fee (1 Gwei * 21000): ${gasFeeETH} ETH`);

  // Extra safety buffer of 10%
  const safeGasFee = gasFeeETH * 1.1;
  let amountToSend = ethBalance - safeGasFee;
  amountToSend = Math.floor(amountToSend * 1e8) / 1e8;
  console.log(`Amount to send: ${ethBalance} - ${safeGasFee.toFixed(10)} = ${amountToSend} ETH`);

  if (amountToSend <= 0) {
    console.error("Not enough balance after gas!");
    process.exit(1);
  }

  // Step 3: Get private key
  const addrRows = await sequelize.query<{ private_key: string }>(
    `SELECT private_key FROM tbl_merchant_temp_address WHERE wallet_address = $1`,
    { bind: [FROM], type: QueryTypes.SELECT }
  );
  const privateKey = await tatumApi.decryptSymmetric(
    addrRows[0].private_key,
    process.env.TEMP_KEY_ID
  );
  console.log("Private key decrypted.");

  // Step 4: Transfer with gasPrice = 1 Gwei (Tatum minimum)
  console.log("\nExecuting transfer...");
  const result = await tatumApi.assetToOtherAddress({
    currency: "ETH",
    fromAddress: FROM,
    toAddress: TO,
    privateKey,
    amount: amountToSend.toString(),
    fee: {
      gasPrice: gasPriceGwei,
      gasLimit: gasLimit,
    },
  });

  console.log("\nResult:", JSON.stringify(result, null, 2));
  if (result?.txId) {
    console.log(`\n✅ TX Hash: ${result.txId}`);
    console.log(`Etherscan: https://etherscan.io/tx/${result.txId}`);
  } else {
    console.error("\n❌ Transfer failed");
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
