/**
 * Recovery script for stuck USDT-POLYGON transfer (v2 - uses RPC gas price)
 * Run from /app/backend: node scripts/recover-usdt-polygon-v2.js
 */
require("dotenv").config({ path: "/app/backend/.env" });
const axios = require("axios");

const PAYMENT_ADDRESS = "0x929f94a441b3c1e9dfa3e1efc9db00a73379cd2f";
const ADMIN_WALLET = process.env.USDT_POLYGON || "0x9a7221b5e32d5f99e8da95585835442e29afb38f";
const USDT_CONTRACT = process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
const MERCHANT_AMOUNT = "7.6021";
const TATUM_KEY = process.env.TATUM_KEY;

async function getRpcGasPrice() {
  const resp = await axios.post(
    `https://api.tatum.io/v3/polygon/web3/${TATUM_KEY}`,
    { jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 1 }
  );
  return parseInt(resp.data.result, 16);
}

async function main() {
  const tatumApi = require("../dist/apis/tatumApi").default;
  const { Sequelize } = require("sequelize");

  const sequelize = new Sequelize(
    process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD,
    { host: process.env.HOST, port: parseInt(process.env.DB_PORT || "5432"), dialect: "postgres", logging: false }
  );

  console.log("=== USDT-POLYGON Recovery v2 (RPC gas price) ===");

  // Step 1: Get keys
  const [rows] = await sequelize.query(
    `SELECT private_key FROM tbl_merchant_temp_address WHERE wallet_address = '${PAYMENT_ADDRESS}'`
  );
  const privateKey = await tatumApi.decryptSymmetric(rows[0].private_key, process.env.TEMP_KEY_ID);
  console.log("Step 1: Decrypted payment key");

  // Step 2: Get REAL gas price from RPC
  const gasPriceWei = await getRpcGasPrice();
  const gasPriceGwei = gasPriceWei / 1e9;
  const safeGasPrice = Math.ceil(gasPriceGwei * 1.25); // 25% buffer
  console.log(`Step 2: RPC gas price: ${gasPriceGwei.toFixed(2)} Gwei, using: ${safeGasPrice} Gwei`);

  // Step 3: Check if we have enough POL
  const polBalance = await tatumApi.getAddressBalance(PAYMENT_ADDRESS, "POLYGON");
  const currentPol = Number(polBalance?.balance || 0);
  const gasLimit = 65000; // ERC20 transfer
  const requiredPol = (safeGasPrice * gasLimit) / 1e9;
  console.log(`Step 3: POL balance: ${currentPol}, required: ${requiredPol.toFixed(6)}`);

  if (currentPol < requiredPol) {
    console.log(`\nNeed more gas. Funding...`);
    
    const [feeRows] = await sequelize.query(
      `SELECT "privateKey" FROM tbl_admin_fee_wallet WHERE wallet_type = 'POLYGON'`
    );
    const feeWalletKey = await tatumApi.decryptSymmetric(feeRows[0].privateKey, process.env.TEMP_KEY_ID);
    const feeWallet = process.env.POLYGON_FEE_WALLET;
    const gasAmount = requiredPol * 2.5; // Fund 2.5x

    console.log(`Funding ${gasAmount.toFixed(6)} POL from fee wallet...`);

    const fundTx = await tatumApi.assetToOtherAddress({
      currency: "POLYGON",
      fromAddress: feeWallet,
      toAddress: PAYMENT_ADDRESS,
      privateKey: feeWalletKey,
      amount: gasAmount,
      fee: { gasPrice: safeGasPrice, gasLimit: 21000 },
    });
    console.log(`Gas TX: ${fundTx?.txId}`);

    console.log("Waiting for confirmation...");
    const conf = await tatumApi.waitForTransactionConfirmation(fundTx?.txId, "POLYGON", 60000);
    if (conf.confirmed) {
      console.log(`Gas funded in block ${conf.blockNumber}`);
    } else {
      console.log("Gas not confirmed in 60s, waiting 20s more...");
      await new Promise(r => setTimeout(r, 20000));
    }
  }

  // Step 4: Submit replacement USDT transfer
  const fee = { gasPrice: safeGasPrice, gasLimit: gasLimit };
  console.log(`\nStep 4: Submitting USDT transfer at ${safeGasPrice} Gwei...`);

  const transferResult = await tatumApi.assetToOtherAddress({
    currency: "USDT-POLYGON",
    fromAddress: PAYMENT_ADDRESS,
    toAddress: ADMIN_WALLET,
    privateKey: privateKey,
    amount: Number(MERCHANT_AMOUNT),
    fee: fee,
  });

  console.log(`TX: ${transferResult?.txId}`);

  // Step 5: Wait for confirmation
  console.log("Waiting for confirmation (120s)...");
  const txConf = await tatumApi.waitForTransactionConfirmation(transferResult?.txId, "POLYGON", 120000);

  if (txConf.confirmed) {
    console.log(`\nRECOVERY SUCCESSFUL!`);
    console.log(`Confirmed in block ${txConf.blockNumber}`);
    
    await sequelize.query(
      `UPDATE tbl_merchant_pool_transaction SET merchant_tx_id = '${transferResult?.txId}', updated_at = NOW() WHERE temp_address_id = 159`
    );
    await sequelize.query(
      `UPDATE tbl_customer_transaction SET status = 'successful' WHERE paid_currency = 'USDT-POLYGON' AND status = 'processing' AND transaction_id = '679'`
    );
    await sequelize.query(
      `UPDATE tbl_merchant_temp_address SET status = 'AVAILABLE', admin_fee_balance = 0, gas_balance = 0, received_amount = 0, current_payment_id = NULL WHERE temp_address_id = 159`
    );
    console.log("DB updated");
  } else {
    console.log(`TX submitted but not confirmed: ${transferResult?.txId}`);
    console.log("https://polygonscan.com/tx/" + transferResult?.txId);
  }

  await sequelize.close();
}

main().catch(err => {
  console.error("Failed:", err?.message || err);
  process.exit(1);
});
