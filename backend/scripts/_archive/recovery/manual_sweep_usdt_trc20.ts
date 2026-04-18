/**
 * Manual Sweep Script: Transfer USDT-TRC20 from pool address to admin wallet
 * 
 * Target: TAoyePonm5YS5Liwjfcaw6wKHVqcPcaBqe (temp_address_id: 58)
 * Amount: 116.302530 USDT (full balance)
 * Destination: TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR (admin wallet)
 * 
 * Steps:
 * 1. Decrypt pool address private key via GCP KMS
 * 2. Fund TRX gas from fee wallet
 * 3. Wait for TRX confirmation
 * 4. Transfer USDT to admin wallet
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import tatumApi from "../apis/tatumApi";
import { adminFeeModel } from "../models";

const POOL_ADDRESS = "TAoyePonm5YS5Liwjfcaw6wKHVqcPcaBqe";
const ADMIN_WALLET = "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR";
const ENCRYPTED_PRIVATE_KEY = process.env.USDT_TRC20_ENCRYPTED_KEY || "";
const TRX_FEE_WALLET = process.env.TRX_FEE_WALLET || "";
const USDT_AMOUNT = "116.30253"; // Full balance from on-chain

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("=== Manual USDT-TRC20 Sweep ===");
  console.log(`From: ${POOL_ADDRESS}`);
  console.log(`To:   ${ADMIN_WALLET}`);
  console.log(`Amount: ${USDT_AMOUNT} USDT`);
  console.log("");

  // Step 1: Decrypt pool address private key
  console.log("[Step 1] Decrypting pool address private key...");
  let poolPrivateKey: string;
  try {
    poolPrivateKey = await tatumApi.decryptSymmetric(
      ENCRYPTED_PRIVATE_KEY,
      process.env.TEMP_KEY_ID
    );
    console.log("[Step 1] ✅ Private key decrypted successfully");
  } catch (err) {
    console.error("[Step 1] ❌ Failed to decrypt private key:", err);
    process.exit(1);
  }

  // Step 2: Check if pool address has TRX for gas
  console.log("\n[Step 2] Checking TRX balance on pool address...");
  let hasTrx = false;
  try {
    const trxBalance = await tatumApi.getAddressBalance(POOL_ADDRESS, "TRX");
    const trxAmount = Number(trxBalance?.balance || 0) / 1e6;
    console.log(`[Step 2] TRX balance: ${trxAmount} TRX`);
    hasTrx = trxAmount >= 15; // Need ~15 TRX for TRC20 transfer energy
  } catch (e: any) {
    if (e.message?.includes("account.not.found")) {
      console.log("[Step 2] Account not activated (no TRX) - need to fund gas");
      hasTrx = false;
    } else {
      throw e;
    }
  }

  // Step 3: Fund TRX gas if needed
  if (!hasTrx) {
    console.log("\n[Step 3] Funding TRX gas to pool address...");
    
    // Get fee wallet private key
    const feeWallet = await adminFeeModel.findOne({
      where: { wallet_type: "TRX" },
    });

    if (!feeWallet) {
      console.error("[Step 3] ❌ TRX fee wallet not found in tbl_admin_fee_wallet");
      process.exit(1);
    }

    const feeWalletPrivateKey = await tatumApi.decryptSymmetric(
      feeWallet.dataValues.privateKey,
      process.env.TEMP_KEY_ID
    );

    // Send 20 TRX for gas (enough for TRC20 transfer + buffer)
    const gasAmount = 20;
    console.log(`[Step 3] Sending ${gasAmount} TRX from fee wallet ${TRX_FEE_WALLET}...`);
    
    const gasTx = await tatumApi.assetToOtherAddress({
      currency: "TRX",
      fromAddress: TRX_FEE_WALLET,
      toAddress: POOL_ADDRESS,
      privateKey: feeWalletPrivateKey,
      amount: gasAmount.toString(),
      fee: null,
    });

    console.log(`[Step 3] ✅ TRX gas funded! TX: ${gasTx?.txId}`);
    
    // Wait for confirmation
    console.log("[Step 3] Waiting 10 seconds for TRX confirmation...");
    await sleep(10000);
    
    // Verify TRX arrived
    try {
      const newBalance = await tatumApi.getAddressBalance(POOL_ADDRESS, "TRX");
      const newTrx = Number(newBalance?.balance || 0) / 1e6;
      console.log(`[Step 3] TRX balance after funding: ${newTrx} TRX`);
    } catch (e) {
      console.log("[Step 3] ⚠️ Could not verify TRX balance yet, proceeding anyway...");
    }
  } else {
    console.log("\n[Step 3] Skipped - sufficient TRX already present");
  }

  // Step 4: Transfer USDT to admin wallet
  console.log("\n[Step 4] Transferring USDT to admin wallet...");
  console.log(`[Step 4] Amount: ${USDT_AMOUNT} USDT → ${ADMIN_WALLET}`);
  
  try {
    const transferResult = await tatumApi.assetToOtherAddress({
      currency: "USDT-TRC20",
      fromAddress: POOL_ADDRESS,
      toAddress: ADMIN_WALLET,
      privateKey: poolPrivateKey,
      amount: USDT_AMOUNT,
      fee: null,
    });

    console.log(`\n[Step 4] ✅ USDT TRANSFER SUCCESSFUL!`);
    console.log(`TX ID: ${transferResult?.txId}`);
    console.log(`Verify: https://tronscan.org/#/transaction/${transferResult?.txId}`);
  } catch (err) {
    console.error("[Step 4] ❌ USDT transfer failed:", err);
    process.exit(1);
  }

  console.log("\n=== Sweep Complete ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
