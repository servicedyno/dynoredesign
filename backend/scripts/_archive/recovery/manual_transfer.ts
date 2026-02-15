/**
 * Manual ETH transfer from pool address to specified wallet.
 * Usage: cd /app/backend && npx ts-node --transpile-only scripts/manual_transfer.ts
 */
import dotenv from "dotenv";
dotenv.config();

import tatumApi from "../apis/tatumApi";
import { Sequelize, QueryTypes } from "sequelize";

const FROM_ADDRESS = "0xdb0c01c41879d877654050002e6e6f283841c9c3";
const TO_ADDRESS = "0x9a7221b5e32d5f99e8da95585835442e29afb38f";
const CURRENCY = "ETH";

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
  console.log(`\n=== Manual ETH Transfer ===`);
  console.log(`From: ${FROM_ADDRESS}`);
  console.log(`To:   ${TO_ADDRESS}`);
  console.log(`Currency: ${CURRENCY}\n`);

  // Step 1: Get on-chain balance
  console.log("Step 1: Checking on-chain balance...");
  const balanceData = await tatumApi.getAddressBalance(FROM_ADDRESS, CURRENCY);
  const ethBalance = parseFloat(balanceData?.balance || "0");
  console.log(`Balance: ${ethBalance} ETH`);

  if (ethBalance <= 0) {
    console.error("No ETH balance to transfer!");
    process.exit(1);
  }

  // Step 2: Get private key from DB
  console.log("\nStep 2: Retrieving private key...");
  const addrRows = await sequelize.query<{ private_key: string }>(
    `SELECT private_key FROM tbl_merchant_temp_address WHERE wallet_address = $1`,
    { bind: [FROM_ADDRESS], type: QueryTypes.SELECT }
  );

  if (!addrRows.length || !addrRows[0].private_key) {
    console.error("Private key not found in database!");
    process.exit(1);
  }

  const privateKey = await tatumApi.decryptSymmetric(
    addrRows[0].private_key,
    process.env.TEMP_KEY_ID
  );
  console.log("Private key decrypted successfully.");

  // Step 3: Estimate gas fees
  console.log("\nStep 3: Estimating gas fees...");
  const feeData = await tatumApi.feeEstimation(
    CURRENCY,
    FROM_ADDRESS,
    TO_ADDRESS,
    ethBalance.toString()
  );
  console.log("Fee estimate:", JSON.stringify(feeData, null, 2));

  const gasFee = parseFloat(feeData?.slow || feeData?.fast || "0");
  console.log(`Gas fee (slow): ${gasFee} ETH`);

  // Step 4: Calculate amount to send (balance - gas)
  let amountToSend = ethBalance - gasFee;
  // Round down to 8 decimal places
  amountToSend = Math.floor(amountToSend * 100000000) / 100000000;

  console.log(`\nAmount to send: ${ethBalance} - ${gasFee} = ${amountToSend} ETH`);

  if (amountToSend <= 0) {
    console.error("Amount to send is <= 0 after gas deduction!");
    process.exit(1);
  }

  // Step 5: Execute transfer
  console.log("\nStep 5: Executing transfer...");
  const result = await tatumApi.assetToOtherAddress({
    currency: CURRENCY,
    fromAddress: FROM_ADDRESS,
    toAddress: TO_ADDRESS,
    privateKey,
    amount: amountToSend.toString(),
    fee: feeData,
  });

  console.log("\n=== Transfer Result ===");
  console.log(JSON.stringify(result, null, 2));

  if (result?.txId) {
    console.log(`\n✅ SUCCESS! TX Hash: ${result.txId}`);
    console.log(`View on Etherscan: https://etherscan.io/tx/${result.txId}`);
  } else {
    console.error("\n❌ Transfer failed - no txId returned");
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
