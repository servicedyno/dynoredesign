/**
 * Recovery script for stuck USDT-POLYGON transfer
 * 
 * Problem: Transaction 0xd5067d... was submitted with nonce 0 at gasPrice 100 Gwei
 * but never mined (Polygon gas was 846+ Gwei at the time).
 * 
 * This script:
 * 1. Decrypts the private key for the payment address
 * 2. Gets current gas pricing
 * 3. Replaces the stuck tx with a proper USDT transfer at nonce 0
 */

import dotenv from "dotenv";
dotenv.config({ path: "/app/backend/.env" });

async function main() {
  // Import from compiled dist
  const tatumApi = require("../dist/apis/tatumApi");
  
  const PAYMENT_ADDRESS = "0x929f94a441b3c1e9dfa3e1efc9db00a73379cd2f";
  const ADMIN_WALLET = process.env.USDT_POLYGON || "0x9a7221b5e32d5f99e8da95585835442e29afb38f";
  const USDT_CONTRACT = process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
  const MERCHANT_AMOUNT = "7.6021"; // userAmount from the pool_transaction record
  
  console.log("=== USDT-POLYGON Recovery Script ===");
  console.log(`Payment address: ${PAYMENT_ADDRESS}`);
  console.log(`Admin wallet: ${ADMIN_WALLET}`);
  console.log(`Amount to transfer: ${MERCHANT_AMOUNT} USDT`);

  // Step 1: Get encrypted private key from DB
  const { Sequelize: SequelizeLib } = require("sequelize");
  const sequelize = new SequelizeLib(
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

  const [rows] = await sequelize.query(
    `SELECT private_key FROM tbl_merchant_temp_address WHERE wallet_address = '${PAYMENT_ADDRESS}'`
  );
  
  if (!rows || rows.length === 0) {
    console.error("Payment address not found in DB");
    process.exit(1);
  }

  const encryptedKey = (rows[0] as any).private_key;
  console.log("\nStep 1: Retrieved encrypted private key from DB");

  // Step 2: Decrypt the private key
  const privateKey = await tatumApi.decryptSymmetric(encryptedKey, process.env.TEMP_KEY_ID);
  console.log("Step 2: Decrypted private key successfully");

  // Step 3: Check current balances
  const polBalance = await tatumApi.getAddressBalance(PAYMENT_ADDRESS, "POLYGON");
  console.log(`\nCurrent POL balance: ${polBalance?.balance} POL`);

  // Step 4: Get current gas price
  const feeEstimate = await tatumApi.feeEstimation(
    "USDT-POLYGON",
    PAYMENT_ADDRESS,
    ADMIN_WALLET,
    Number(MERCHANT_AMOUNT),
    USDT_CONTRACT
  );
  console.log(`\nStep 4: Fee estimation:`, JSON.stringify(feeEstimate, null, 2));
  console.log(`Gas price: ${feeEstimate?.gasPrice} Gwei, Gas limit: ${feeEstimate?.gasLimit}`);

  // Step 5: Check if we have enough POL for gas
  const requiredGas = Number(feeEstimate?.fast || 0);
  const currentPol = Number(polBalance?.balance || 0);
  
  if (currentPol < requiredGas) {
    console.log(`\n⚠️ Insufficient POL for gas. Have: ${currentPol}, need: ~${requiredGas}`);
    console.log("Will need to fund gas first...");
    
    // Fund gas from fee wallet
    const { merchantPoolSweep } = require("../dist/services/merchantPool/merchantPoolSweep");
    // Use the SmartGas function via tatumApi.assetToOtherAddress for gas funding
    const feeWalletAddress = process.env.POLYGON_FEE_WALLET;
    if (!feeWalletAddress) {
      console.error("POLYGON_FEE_WALLET not configured");
      process.exit(1);
    }
    
    // Get fee wallet private key
    const [feeRows] = await sequelize.query(
      `SELECT "privateKey" FROM tbl_admin_fee_wallet WHERE wallet_type = 'POLYGON'`
    );
    if (!feeRows || feeRows.length === 0) {
      console.error("Fee wallet not found");
      process.exit(1);
    }
    const feeWalletKey = await tatumApi.decryptSymmetric((feeRows[0] as any).privateKey, process.env.TEMP_KEY_ID);
    
    const gasAmount = Math.max(requiredGas * 1.5, 0.01); // Fund 1.5x required
    console.log(`Funding ${gasAmount} POL from fee wallet ${feeWalletAddress}...`);
    
    const gasFees = await tatumApi.feeEstimation("POLYGON", feeWalletAddress, PAYMENT_ADDRESS, gasAmount);
    const fundTx = await tatumApi.assetToOtherAddress({
      currency: "POLYGON",
      fromAddress: feeWalletAddress,
      toAddress: PAYMENT_ADDRESS,
      privateKey: feeWalletKey,
      amount: gasAmount,
      fee: gasFees,
    });
    console.log(`Gas funding TX: ${fundTx?.txId}`);
    
    // Wait for gas funding confirmation
    console.log("Waiting for gas funding confirmation...");
    const confirmation = await tatumApi.waitForTransactionConfirmation(fundTx?.txId, "POLYGON", 60000);
    if (!confirmation.confirmed) {
      console.error("Gas funding not confirmed within 60s");
      process.exit(1);
    }
    console.log(`Gas funded confirmed in block ${confirmation.blockNumber}`);
  }

  // Step 6: Submit the USDT transfer (nonce 0, replacing stuck tx)
  console.log(`\nStep 6: Submitting USDT transfer: ${MERCHANT_AMOUNT} USDT → ${ADMIN_WALLET}`);
  
  const transferResult = await tatumApi.assetToOtherAddress({
    currency: "USDT-POLYGON",
    fromAddress: PAYMENT_ADDRESS,
    toAddress: ADMIN_WALLET,
    privateKey: privateKey,
    amount: Number(MERCHANT_AMOUNT),
    fee: feeEstimate,
  });

  console.log(`\n✅ Transfer TX submitted: ${transferResult?.txId}`);

  // Step 7: Wait for confirmation
  console.log("Waiting for transfer confirmation...");
  const txConfirmation = await tatumApi.waitForTransactionConfirmation(
    transferResult?.txId,
    "POLYGON",
    60000
  );

  if (txConfirmation.confirmed) {
    console.log(`\n✅ RECOVERY SUCCESSFUL!`);
    console.log(`TX confirmed in block ${txConfirmation.blockNumber}`);
    console.log(`${MERCHANT_AMOUNT} USDT transferred to ${ADMIN_WALLET}`);
    
    // Update DB: merchant_pool_transaction with new tx id
    await sequelize.query(
      `UPDATE tbl_merchant_pool_transaction SET merchant_tx_id = '${transferResult?.txId}', status = 'completed', updated_at = NOW() WHERE temp_address_id = 159 AND wallet_type = 'USDT-POLYGON'`
    );
    
    // Update customer_transaction status
    await sequelize.query(
      `UPDATE tbl_customer_transaction SET status = 'successful' WHERE paid_currency = 'USDT-POLYGON' AND status = 'processing' AND transaction_id = '679'`
    );
    
    // Update temp address status
    await sequelize.query(
      `UPDATE tbl_merchant_temp_address SET status = 'AVAILABLE', admin_fee_balance = 0, gas_balance = 0 WHERE temp_address_id = 159`
    );
    
    console.log("DB records updated");
  } else {
    console.log(`\n⚠️ Transfer TX submitted but not confirmed within 60s`);
    console.log(`TX hash: ${transferResult?.txId}`);
    console.log("Check on Polygonscan manually");
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error("Recovery script failed:", err);
  process.exit(1);
});
