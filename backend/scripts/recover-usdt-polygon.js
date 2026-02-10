/**
 * Recovery script for stuck USDT-POLYGON transfer
 * Run from /app/backend: node scripts/recover-usdt-polygon.js
 */
require("dotenv").config({ path: "/app/backend/.env" });

const PAYMENT_ADDRESS = "0x929f94a441b3c1e9dfa3e1efc9db00a73379cd2f";
const ADMIN_WALLET = process.env.USDT_POLYGON || "0x9a7221b5e32d5f99e8da95585835442e29afb38f";
const USDT_CONTRACT = process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
const MERCHANT_AMOUNT = "7.6021";

async function main() {
  const tatumApi = require("../dist/apis/tatumApi").default;
  const { Sequelize } = require("sequelize");

  const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.USER_NAME,
    process.env.PASSWORD,
    {
      host: process.env.HOST,
      port: parseInt(process.env.DB_PORT || "5432"),
      dialect: "postgres",
      logging: false,
    }
  );

  console.log("=== USDT-POLYGON Recovery Script ===");
  console.log(`Payment address: ${PAYMENT_ADDRESS}`);
  console.log(`Admin wallet: ${ADMIN_WALLET}`);
  console.log(`Amount to transfer: ${MERCHANT_AMOUNT} USDT`);

  // Step 1: Get encrypted private key
  const [rows] = await sequelize.query(
    `SELECT private_key FROM tbl_merchant_temp_address WHERE wallet_address = '${PAYMENT_ADDRESS}'`
  );
  if (!rows || rows.length === 0) {
    throw new Error("Payment address not found");
  }
  console.log("\nStep 1: Got encrypted key from DB");

  // Step 2: Decrypt
  const privateKey = await tatumApi.decryptSymmetric(rows[0].private_key, process.env.TEMP_KEY_ID);
  console.log("Step 2: Decrypted private key ✅");

  // Step 3: Check balances
  const polBalance = await tatumApi.getAddressBalance(PAYMENT_ADDRESS, "POLYGON");
  console.log(`\nCurrent POL balance: ${polBalance?.balance} POL`);

  // Step 4: Get fee estimate
  const feeEstimate = await tatumApi.feeEstimation(
    "USDT-POLYGON", PAYMENT_ADDRESS, ADMIN_WALLET,
    Number(MERCHANT_AMOUNT), USDT_CONTRACT
  );
  console.log(`Fee estimate: gasPrice=${feeEstimate?.gasPrice} Gwei, gasLimit=${feeEstimate?.gasLimit}`);
  console.log(`Estimated cost: ${feeEstimate?.fast} POL`);

  // Step 5: Check if we need more gas
  const currentPol = Number(polBalance?.balance || 0);
  const requiredGas = Number(feeEstimate?.fast || 0);

  if (currentPol < requiredGas * 1.2) {
    console.log(`\n⚠️ Need more gas. Have: ${currentPol} POL, need: ~${requiredGas} POL`);

    // Fund from fee wallet
    const [feeRows] = await sequelize.query(
      `SELECT "privateKey" FROM tbl_admin_fee_wallet WHERE wallet_type = 'POLYGON'`
    );
    if (!feeRows.length) throw new Error("Fee wallet not found");

    const feeWalletKey = await tatumApi.decryptSymmetric(feeRows[0].privateKey, process.env.TEMP_KEY_ID);
    const feeWallet = process.env.POLYGON_FEE_WALLET;
    const gasAmount = Math.max(requiredGas * 2, 0.02);

    console.log(`Funding ${gasAmount.toFixed(6)} POL from ${feeWallet}...`);

    const gasFees = await tatumApi.feeEstimation("POLYGON", feeWallet, PAYMENT_ADDRESS, gasAmount);
    const fundTx = await tatumApi.assetToOtherAddress({
      currency: "POLYGON",
      fromAddress: feeWallet,
      toAddress: PAYMENT_ADDRESS,
      privateKey: feeWalletKey,
      amount: gasAmount,
      fee: gasFees,
    });
    console.log(`Gas funding TX: ${fundTx?.txId}`);

    // Wait for confirmation
    console.log("Waiting for gas funding confirmation (60s timeout)...");
    const conf = await tatumApi.waitForTransactionConfirmation(fundTx?.txId, "POLYGON", 60000);
    if (conf.confirmed) {
      console.log(`✅ Gas funded, confirmed in block ${conf.blockNumber}`);
    } else {
      console.log("⚠️ Gas not confirmed within 60s, but proceeding...");
      // Wait a bit longer
      await new Promise(r => setTimeout(r, 10000));
    }
  } else {
    console.log(`✅ Sufficient gas: ${currentPol} POL (need ~${requiredGas})`);
  }

  // Step 6: Submit the USDT transfer with HIGHER gas price to replace stuck tx
  // The stuck tx used gasPrice=100 Gwei. We need at least 10% more to replace it.
  const replacementFee = {
    ...feeEstimate,
    gasPrice: Math.max(Number(feeEstimate?.gasPrice || 100) * 1.5, 150), // At least 150 Gwei
    gasLimit: feeEstimate?.gasLimit || 65000,
  };
  console.log(`\nStep 6: Submitting REPLACEMENT USDT transfer with gasPrice=${replacementFee.gasPrice} Gwei`);
  console.log(`${MERCHANT_AMOUNT} USDT → ${ADMIN_WALLET}`);

  const transferResult = await tatumApi.assetToOtherAddress({
    currency: "USDT-POLYGON",
    fromAddress: PAYMENT_ADDRESS,
    toAddress: ADMIN_WALLET,
    privateKey: privateKey,
    amount: Number(MERCHANT_AMOUNT),
    fee: replacementFee,
  });

  console.log(`\n✅ Transfer TX: ${transferResult?.txId}`);

  // Step 7: Wait for confirmation
  console.log("Waiting for transfer confirmation (90s timeout)...");
  const txConf = await tatumApi.waitForTransactionConfirmation(transferResult?.txId, "POLYGON", 90000);

  if (txConf.confirmed) {
    console.log(`\n🎉 RECOVERY SUCCESSFUL!`);
    console.log(`TX confirmed in block ${txConf.blockNumber}`);
    console.log(`${MERCHANT_AMOUNT} USDT transferred to ${ADMIN_WALLET}`);

    // Update DB
    await sequelize.query(
      `UPDATE tbl_merchant_pool_transaction SET merchant_tx_id = '${transferResult?.txId}', updated_at = NOW() WHERE temp_address_id = 159 AND wallet_type = 'USDT-POLYGON'`
    );
    await sequelize.query(
      `UPDATE tbl_customer_transaction SET status = 'successful' WHERE paid_currency = 'USDT-POLYGON' AND status = 'processing' AND transaction_id = '679'`
    );
    await sequelize.query(
      `UPDATE tbl_merchant_temp_address SET status = 'AVAILABLE', admin_fee_balance = 0, gas_balance = 0, received_amount = 0, current_payment_id = NULL WHERE temp_address_id = 159`
    );
    console.log("DB records updated ✅");
  } else {
    console.log(`\n⚠️ TX submitted but not confirmed within 90s`);
    console.log(`TX: ${transferResult?.txId}`);
    console.log("Check on Polygonscan: https://polygonscan.com/tx/" + transferResult?.txId);
  }

  await sequelize.close();
}

main().catch(err => {
  console.error("Recovery failed:", err?.message || err);
  process.exit(1);
});
