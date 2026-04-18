/**
 * Generate New XRP Gas Wallet
 * 
 * Creates a new XRP address for gas funding purposes.
 * Updates the existing XRP record in tbl_admin_fee_wallet with the new address.
 * 
 * Usage: cd /app/backend && npx ts-node --transpile-only scripts/generateXrpGasWallet.ts
 */

import dotenv from "dotenv";
dotenv.config();

import tatumApi from "../apis/tatumApi";
import adminFeeModel from "../models/adminFeeModel";
import sequelize from "../utils/dbInstance";

async function main() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Show current state
    const existing = await adminFeeModel.findAll({
      attributes: ["fee_wallet_id", "wallet_type", "wallet_address", "amount"],
    });
    console.log("\n📋 Current fee wallets:");
    existing.forEach((w: any) =>
      console.log(`   ${w.dataValues.wallet_type}: ${w.dataValues.wallet_address} (id=${w.dataValues.fee_wallet_id}, balance=${w.dataValues.amount})`)
    );

    // Step 1: Generate new XRP wallet via Tatum
    console.log("\n🔧 Generating NEW XRP gas wallet via Tatum SDK...");
    const wallet = await tatumApi.generateWallet("XRP");

    if (!wallet || !wallet.address || !wallet.privateKey) {
      console.error("❌ Failed to generate XRP wallet — no address or private key returned");
      console.log("Wallet response:", JSON.stringify(wallet, null, 2));
      process.exit(1);
    }

    console.log(`✅ New XRP gas wallet address: ${wallet.address}`);

    // Step 2: Encrypt private key via Google Cloud KMS
    console.log("🔐 Encrypting private key via KMS...");
    const encryptedKey = await tatumApi.encryptSymmetric(
      wallet.privateKey,
      process.env.TEMP_KEY_ID
    );

    if (!encryptedKey) {
      console.error("❌ KMS encryption failed");
      process.exit(1);
    }
    console.log(`✅ Private key encrypted (${encryptedKey.length} chars)`);

    // Step 3: Verify decryption roundtrip
    console.log("🔄 Verifying decrypt roundtrip...");
    const decrypted = await tatumApi.decryptSymmetric(
      encryptedKey,
      process.env.TEMP_KEY_ID
    );
    if (decrypted !== wallet.privateKey) {
      console.error("❌ Decrypt roundtrip FAILED — aborting");
      process.exit(1);
    }
    console.log("✅ Decrypt roundtrip verified");

    // Step 4: Update the existing XRP record in tbl_admin_fee_wallet
    const xrpRecord = existing.find((w: any) => w.dataValues.wallet_type === "XRP");
    if (xrpRecord) {
      console.log(`\n📝 Updating existing XRP record (id=${(xrpRecord as any).dataValues.fee_wallet_id})...`);
      await adminFeeModel.update(
        {
          wallet_address: wallet.address,
          privateKey: encryptedKey,
          xpub: `NON_HD_XRP_${wallet.address.substring(0, 8)}`,
          mnemonic: null,
          amount: 0,
          feeLimit: 30,         // Match TRX/ETH settings
          alert_duration: 1,    // Match TRX/ETH settings
        },
        {
          where: { fee_wallet_id: (xrpRecord as any).dataValues.fee_wallet_id },
        }
      );
      console.log("✅ Updated XRP fee wallet record");
    } else {
      console.log("\n📝 Inserting new XRP record...");
      await adminFeeModel.create({
        wallet_type: "XRP",
        wallet_address: wallet.address,
        privateKey: encryptedKey,
        xpub: `NON_HD_XRP_${wallet.address.substring(0, 8)}`,
        mnemonic: null,
        amount: 0,
        feeLimit: 30,
        alert_duration: 1,
      });
      console.log("✅ Inserted new XRP fee wallet record");
    }

    // Step 5: Also update POLYGON alert settings to match TRX/ETH
    const polygonRecord = existing.find((w: any) => w.dataValues.wallet_type === "POLYGON");
    if (polygonRecord) {
      console.log(`\n📝 Updating POLYGON alert settings (id=${(polygonRecord as any).dataValues.fee_wallet_id})...`);
      await adminFeeModel.update(
        {
          feeLimit: 30,         // Match TRX/ETH
          alert_duration: 1,    // Match TRX/ETH
        },
        {
          where: { fee_wallet_id: (polygonRecord as any).dataValues.fee_wallet_id },
        }
      );
      console.log("✅ Updated POLYGON alert settings");
    }

    // Final state
    console.log("\n\n========================================");
    console.log("📋 Final fee wallet state:");
    console.log("========================================");
    const final = await adminFeeModel.findAll({
      attributes: ["fee_wallet_id", "wallet_type", "wallet_address", "amount", "feeLimit", "alert_duration"],
    });
    final.forEach((w: any) =>
      console.log(`   ${w.dataValues.wallet_type}: ${w.dataValues.wallet_address} (id=${w.dataValues.fee_wallet_id}, balance=${w.dataValues.amount}, limit=$${w.dataValues.feeLimit}, alert=${w.dataValues.alert_duration}h)`)
    );

    console.log("\n\n========================================");
    console.log("📝 .env UPDATES NEEDED:");
    console.log("========================================");
    console.log(`\n# Rename old XRP_FEE_WALLET to XRP_MASTER_WALLET:`);
    console.log(`XRP_MASTER_WALLET=${process.env.XRP_FEE_WALLET}`);
    console.log(`\n# Set new XRP_FEE_WALLET to the gas wallet:`);
    console.log(`XRP_FEE_WALLET=${wallet.address}`);
    console.log(`\n⚠️  IMPORTANT: Fund the new XRP gas wallet with ≥12 XRP:`);
    console.log(`   - 10 XRP base reserve`);
    console.log(`   - 2 XRP for safety margin`);
    console.log(`   Address: ${wallet.address}`);

    console.log("\n✅ Done!");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
