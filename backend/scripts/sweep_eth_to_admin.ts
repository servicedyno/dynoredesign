/**
 * One-time script: Sweep ETH from merchant pool address to admin wallet
 * 
 * Source: 0xdb0c01c41879d877654050002e6e6f283841c9c3 (temp_address_id=3)
 * Destination: Admin ETH wallet from .env (ETH=0x9a7221b5e32d5f99e8da95585835442e29afb38f)
 */
import dotenv from "dotenv";
dotenv.config();

import tatumApi from "../apis/tatumApi";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

const SOURCE_ADDRESS = "0xdb0c01c41879d877654050002e6e6f283841c9c3";
const TEMP_ADDRESS_ID = 3;
const ADMIN_ETH_WALLET = process.env.ETH || "";

async function main() {
  console.log("=== ETH Sweep Script ===");
  console.log(`Source: ${SOURCE_ADDRESS}`);
  console.log(`Destination: ${ADMIN_ETH_WALLET}`);

  if (!ADMIN_ETH_WALLET) {
    console.error("ERROR: ETH admin wallet not configured in .env");
    process.exit(1);
  }

  // 1. Check on-chain balance
  console.log("\n[1] Checking on-chain balance...");
  const balanceResult = await tatumApi.getAddressBalance(SOURCE_ADDRESS, "ETH");
  const balance = Number(balanceResult?.balance ?? 0);
  console.log(`Balance: ${balance} ETH`);

  if (balance <= 0) {
    console.error("ERROR: No balance to sweep");
    process.exit(1);
  }

  // 2. Estimate gas
  console.log("\n[2] Estimating gas fee...");
  const fees = await tatumApi.feeEstimation(
    "ETH",
    SOURCE_ADDRESS,
    ADMIN_ETH_WALLET,
    balance
  );
  const gasFee = Number(fees?.fast ?? fees?.slow ?? 0);
  console.log(`Gas fee (fast): ${gasFee} ETH`);
  console.log(`Gas details:`, JSON.stringify(fees, null, 2));

  // 3. Calculate send amount
  const sendAmount = Number((balance - gasFee).toFixed(8));
  console.log(`\nSend amount: ${sendAmount} ETH (${balance} - ${gasFee})`);

  if (sendAmount <= 0) {
    console.error("ERROR: Balance too low after gas. Cannot sweep.");
    process.exit(1);
  }

  // 4. Decrypt private key
  console.log("\n[3] Decrypting private key...");
  const dbRecord = await sequelize.query(
    `SELECT private_key FROM tbl_merchant_temp_address WHERE temp_address_id = $1`,
    { bind: [TEMP_ADDRESS_ID], type: QueryTypes.SELECT }
  ) as Array<{ private_key: string }>;

  if (!dbRecord.length) {
    console.error("ERROR: Address not found in DB");
    process.exit(1);
  }

  const privateKey = await tatumApi.decryptSymmetric(
    dbRecord[0].private_key,
    process.env.TEMP_KEY_ID
  );
  console.log("Private key decrypted successfully");

  // 5. Execute transfer
  console.log(`\n[4] Transferring ${sendAmount} ETH → ${ADMIN_ETH_WALLET}...`);
  const txResult = await tatumApi.assetToOtherAddress({
    amount: sendAmount,
    currency: "ETH",
    fee: fees,
    fromAddress: SOURCE_ADDRESS,
    privateKey: privateKey,
    toAddress: ADMIN_ETH_WALLET,
  });

  console.log("\n✅ Transaction submitted!");
  console.log(`TX Hash: ${txResult?.txId}`);

  // 6. Update DB record
  console.log("\n[5] Updating database...");
  await sequelize.query(
    `UPDATE tbl_merchant_temp_address 
     SET admin_fee_balance = 0, 
         last_swept_at = NOW(), 
         updated_at = NOW(),
         last_payment_context = 'Manual sweep: ${sendAmount} ETH to admin wallet. TX: ' || $1
     WHERE temp_address_id = $2`,
    { bind: [txResult?.txId || 'unknown', TEMP_ADDRESS_ID] }
  );
  console.log("DB updated: admin_fee_balance=0, last_swept_at=NOW()");

  console.log("\n=== Sweep Complete ===");
  console.log(`Sent: ${sendAmount} ETH`);
  console.log(`Gas: ${gasFee} ETH`);
  console.log(`TX: ${txResult?.txId}`);
  console.log(`From: ${SOURCE_ADDRESS}`);
  console.log(`To: ${ADMIN_ETH_WALLET}`);

  await sequelize.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
