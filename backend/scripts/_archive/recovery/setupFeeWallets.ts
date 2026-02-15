/**
 * Setup Fee Wallets for SmartGas System
 * 
 * Generates XRP and POLYGON fee wallets via Tatum, encrypts private keys
 * via Google Cloud KMS, and inserts records into tbl_admin_fee_wallet.
 * 
 * Usage: cd /app/backend && npx ts-node --transpile-only scripts/setupFeeWallets.ts
 */

import dotenv from "dotenv";
dotenv.config();

import tatumApi from "../apis/tatumApi";
import adminFeeModel from "../models/adminFeeModel";
import sequelize from "../utils/dbInstance";

const WALLETS_TO_CREATE = ["XRP", "POLYGON"];

async function main() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Check what already exists
    const existing = await adminFeeModel.findAll({
      attributes: ["fee_wallet_id", "wallet_type", "wallet_address"],
    });
    console.log("\n📋 Existing fee wallets:");
    existing.forEach((w: any) =>
      console.log(`   ${w.dataValues.wallet_type}: ${w.dataValues.wallet_address} (id=${w.dataValues.fee_wallet_id})`)
    );

    const existingTypes = existing.map((w: any) => w.dataValues.wallet_type);

    for (const currency of WALLETS_TO_CREATE) {
      if (existingTypes.includes(currency)) {
        console.log(`\n⏭️  ${currency} fee wallet already exists — skipping`);
        continue;
      }

      console.log(`\n🔧 Creating ${currency} fee wallet...`);

      // Step 1: Generate wallet via Tatum
      console.log(`   1️⃣  Generating ${currency} wallet via Tatum SDK...`);
      const wallet = await tatumApi.generateWallet(currency);

      if (!wallet || !wallet.address || !wallet.privateKey) {
        console.error(`   ❌ Failed to generate ${currency} wallet — no address or private key returned`);
        continue;
      }

      console.log(`   ✅ ${currency} address: ${wallet.address}`);

      // Step 2: Encrypt private key via Google Cloud KMS
      console.log(`   2️⃣  Encrypting private key via KMS (TEMP_KEY_ID=${process.env.TEMP_KEY_ID})...`);
      const encryptedKey = await tatumApi.encryptSymmetric(
        wallet.privateKey,
        process.env.TEMP_KEY_ID
      );

      if (!encryptedKey) {
        console.error(`   ❌ KMS encryption failed for ${currency}`);
        continue;
      }
      console.log(`   ✅ Private key encrypted (${encryptedKey.length} chars)`);

      // Step 3: Verify decryption roundtrip
      console.log(`   3️⃣  Verifying decrypt roundtrip...`);
      const decrypted = await tatumApi.decryptSymmetric(
        encryptedKey,
        process.env.TEMP_KEY_ID
      );
      if (decrypted !== wallet.privateKey) {
        console.error(`   ❌ Decrypt roundtrip FAILED for ${currency} — aborting`);
        continue;
      }
      console.log(`   ✅ Decrypt roundtrip verified`);

      // Step 4: Insert into tbl_admin_fee_wallet
      console.log(`   4️⃣  Inserting into tbl_admin_fee_wallet...`);
      const record = await adminFeeModel.create({
        wallet_type: currency,
        wallet_address: wallet.address,
        privateKey: encryptedKey,
        xpub: wallet.xpub || null,
        mnemonic: wallet.mnemonic
          ? await tatumApi.encryptSymmetric(wallet.mnemonic, process.env.TEMP_KEY_ID)
          : null,
        amount: 0,
        feeLimit: 100,
        alert_duration: 12,
      });

      console.log(`   ✅ Inserted fee_wallet_id=${(record as any).dataValues.fee_wallet_id}`);

      // Step 5: Print .env update instruction
      console.log(`\n   📝 UPDATE .env:`);
      console.log(`   ${currency}_FEE_WALLET=${wallet.address}`);
    }

    // Final state
    console.log("\n\n========================================");
    console.log("📋 Final fee wallet state:");
    console.log("========================================");
    const final = await adminFeeModel.findAll({
      attributes: ["fee_wallet_id", "wallet_type", "wallet_address", "amount"],
    });
    final.forEach((w: any) =>
      console.log(`   ${w.dataValues.wallet_type}: ${w.dataValues.wallet_address} (id=${w.dataValues.fee_wallet_id}, balance=${w.dataValues.amount})`)
    );

    console.log("\n⚠️  IMPORTANT: You must fund these wallets before SmartGas can work:");
    console.log("   - XRP fee wallet: Send ≥3 XRP (covers 1 XRP reserve + 0.2 trust line + gas for RLUSD transfers)");
    console.log("   - POLYGON fee wallet: Send ≥0.5 POL (covers gas for USDT-POLYGON transfers)");
    console.log("\n✅ Done!");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
