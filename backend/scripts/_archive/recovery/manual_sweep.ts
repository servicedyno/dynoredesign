/**
 * Manual sweep for stuck pool address - bypasses Tatum's cached ghost TX
 * by using direct ethBlockchainTransfer with explicit gas settings
 */
import dotenv from "dotenv";
dotenv.config();

import tatumApi from "../apis/tatumApi";
import axios from "axios";
import { Sequelize, QueryTypes } from "sequelize";

const POOL_ADDR = "0xa1d597e69a9e4da3a75bdae530b5cc19d8807a45";
const ADMIN_WALLET = process.env.ETH_ADMIN_WALLET || "0x033d2bb052e3d85bfe96fbd86cf876a350ad6b1c";
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
  console.log(`Manual sweep: ${POOL_ADDR} → ${ADMIN_WALLET}`);

  // 1. Get balance
  const balResp = await axios.get(
    `https://api.tatum.io/v3/ethereum/account/balance/${POOL_ADDR}`,
    { headers: { "x-api-key": TATUM_KEY } }
  );
  const ethBalance = parseFloat(balResp.data.balance);
  console.log(`Balance: ${ethBalance} ETH`);

  // 2. Get private key
  const addrRows = await sequelize.query<{ private_key: string; temp_address_id: number }>(
    `SELECT private_key, temp_address_id FROM tbl_merchant_temp_address WHERE wallet_address = $1`,
    { bind: [POOL_ADDR], type: QueryTypes.SELECT }
  );
  const privateKey = await tatumApi.decryptSymmetric(
    addrRows[0].private_key,
    process.env.TEMP_KEY_ID
  );
  console.log("Private key decrypted.");

  // 3. Use 1 Gwei gas price (proven to work from manual transfer)
  const gasPriceGwei = 1;
  const gasLimit = 21000;
  const gasFeeETH = (gasPriceGwei * 1e9 * gasLimit) / 1e18;

  // 4. Calculate amount with safety buffer
  let amountToSend = ethBalance - (gasFeeETH * 1.1);
  amountToSend = Math.floor(amountToSend * 1e8) / 1e8;
  console.log(`Sending: ${amountToSend} ETH (gas: ${gasFeeETH})`);

  // 5. Get current nonce to force-replace any pending TX
  const nonceResp = await axios.get(
    `https://api.tatum.io/v3/ethereum/transaction/count/${POOL_ADDR}`,
    { headers: { "x-api-key": TATUM_KEY } }
  );
  console.log(`Current nonce: ${nonceResp.data}`);

  // 6. Send via Tatum with explicit nonce and gas
  const result = await tatumApi.assetToOtherAddress({
    currency: "ETH",
    fromAddress: POOL_ADDR,
    toAddress: ADMIN_WALLET,
    privateKey,
    amount: amountToSend.toString(),
    fee: {
      gasPrice: gasPriceGwei,
      gasLimit: gasLimit,
    },
    nonce: nonceResp.data,
  });

  console.log("Result:", JSON.stringify(result, null, 2));

  if (result?.txId) {
    console.log(`\nTX Hash: ${result.txId}`);

    // Wait for confirmation
    console.log("Waiting for confirmation...");
    const conf = await tatumApi.waitForTransactionConfirmation(result.txId, "ETH", 120000);
    if (conf.confirmed) {
      console.log(`✅ CONFIRMED in block ${conf.blockNumber}`);

      // Update DB
      await sequelize.query(
        `UPDATE tbl_merchant_temp_address SET status = 'AVAILABLE', admin_fee_balance = 0, last_swept_at = NOW() WHERE temp_address_id = $1`,
        { bind: [addrRows[0].temp_address_id], type: QueryTypes.UPDATE }
      );
      console.log("DB updated: address released");
    } else {
      console.log("❌ NOT confirmed within timeout");
    }
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error("Fatal:", err.message || err);
  process.exit(1);
});
