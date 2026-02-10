/**
 * Recovery script for WXRP (XRP-ERC20) stuck at RLUSD-ERC20 payment address
 * Run from /app/backend: node scripts/recover-wxrp-erc20.js
 */
require("dotenv").config({ path: "/app/backend/.env" });
const axios = require("axios");

const PAYMENT_ADDRESS = "0xc5c6de98f48067c9a9a8c8eefc71239d7ff9a9dc";
const ADMIN_WALLET = process.env.ETH || "0x9a7221b5e32d5f99e8da95585835442e29afb38f";
const WXRP_CONTRACT = "0x39fbbabf11738317a448031930706cd3e612e1b9";
const WXRP_AMOUNT = "8.34057243"; // From on-chain balanceOf
const TATUM_KEY = process.env.TATUM_KEY;

async function getRpcGasPrice(chain) {
  const endpoint = chain === "ETH" 
    ? `https://api.tatum.io/v3/ethereum/web3/${TATUM_KEY}`
    : `https://api.tatum.io/v3/polygon/web3/${TATUM_KEY}`;
  const resp = await axios.post(endpoint, 
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

  console.log("=== WXRP (XRP-ERC20) Recovery Script ===");
  console.log(`Payment address: ${PAYMENT_ADDRESS}`);
  console.log(`Admin wallet: ${ADMIN_WALLET}`);
  console.log(`WXRP contract: ${WXRP_CONTRACT}`);
  console.log(`Amount: ${WXRP_AMOUNT} WXRP`);

  // Step 1: Get payment address private key
  const [rows] = await sequelize.query(
    `SELECT private_key FROM tbl_merchant_temp_address WHERE wallet_address = '${PAYMENT_ADDRESS}'`
  );
  const privateKey = await tatumApi.decryptSymmetric(rows[0].private_key, process.env.TEMP_KEY_ID);
  console.log("\nStep 1: Decrypted payment address key");

  // Step 2: Check ETH balance for gas
  const ethBalance = await tatumApi.getAddressBalance(PAYMENT_ADDRESS, "ETH");
  console.log(`Step 2: ETH balance: ${ethBalance?.balance || 0} ETH`);

  // Step 3: Get current gas price
  const gasPriceWei = await getRpcGasPrice("ETH");
  const gasPriceGwei = gasPriceWei / 1e9;
  const safeGasPrice = Math.max(Math.ceil(gasPriceGwei * 1.5), 1); // At least 1 Gwei with 50% buffer
  const gasLimit = 65000;
  const requiredEth = (safeGasPrice * gasLimit) / 1e9;
  console.log(`Step 3: Gas price: ${gasPriceGwei.toFixed(4)} Gwei, using: ${safeGasPrice} Gwei, need: ${requiredEth.toFixed(8)} ETH`);

  // Step 4: Fund gas if needed
  const currentEth = Number(ethBalance?.balance || 0);
  if (currentEth < requiredEth) {
    console.log(`\nStep 4: Need gas funding. Have ${currentEth} ETH, need ${requiredEth.toFixed(8)} ETH`);
    
    const [feeRows] = await sequelize.query(
      `SELECT "privateKey" FROM tbl_admin_fee_wallet WHERE wallet_type = 'ETH'`
    );
    const feeWalletKey = await tatumApi.decryptSymmetric(feeRows[0].privateKey, process.env.TEMP_KEY_ID);
    const feeWallet = "0x033d2bb052e3d85bfe96fbd86cf876a350ad6b1c";
    const gasAmount = requiredEth * 3; // Fund 3x

    console.log(`Funding ${gasAmount.toFixed(8)} ETH from fee wallet...`);
    const fundTx = await tatumApi.assetToOtherAddress({
      currency: "ETH",
      fromAddress: feeWallet,
      toAddress: PAYMENT_ADDRESS,
      privateKey: feeWalletKey,
      amount: gasAmount,
      fee: { gasPrice: safeGasPrice, gasLimit: 21000 },
    });
    console.log(`Gas TX: ${fundTx?.txId}`);

    console.log("Waiting for gas funding confirmation...");
    const conf = await tatumApi.waitForTransactionConfirmation(fundTx?.txId, "ETH", 120000);
    if (conf.confirmed) {
      console.log(`Gas funded in block ${conf.blockNumber}`);
    } else {
      console.log("Gas not confirmed in 120s, waiting more...");
      await new Promise(r => setTimeout(r, 30000));
    }
  } else {
    console.log("Step 4: Sufficient ETH for gas");
  }

  // Step 5: Transfer WXRP using ERC20 transfer (same as USDT-ERC20 / RLUSD-ERC20)
  console.log(`\nStep 5: Transferring ${WXRP_AMOUNT} WXRP to ${ADMIN_WALLET}...`);
  
  // Use Tatum's smart contract invocation for ERC20 transfer
  const transferResult = await axios.post(
    `https://api.tatum.io/v3/ethereum/smartcontract`,
    {
      contractAddress: WXRP_CONTRACT,
      methodName: "transfer",
      methodABI: {
        inputs: [
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" }
        ],
        name: "transfer",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function"
      },
      params: [
        ADMIN_WALLET,
        BigInt(Math.round(Number(WXRP_AMOUNT) * 1e18)).toString()
      ],
      fromPrivateKey: privateKey,
      fee: {
        gasPrice: String(safeGasPrice),
        gasLimit: String(gasLimit)
      }
    },
    { headers: { "x-api-key": TATUM_KEY } }
  );

  const txId = transferResult.data?.txId || transferResult.data?.transactionHash;
  console.log(`TX: ${txId}`);

  // Step 6: Wait for confirmation
  console.log("Waiting for confirmation (120s)...");
  const txConf = await tatumApi.waitForTransactionConfirmation(txId, "ETH", 120000);

  if (txConf.confirmed) {
    console.log(`\nRECOVERY SUCCESSFUL!`);
    console.log(`Confirmed in block ${txConf.blockNumber}`);
    console.log(`${WXRP_AMOUNT} WXRP transferred to ${ADMIN_WALLET}`);
  } else {
    console.log(`TX submitted but not confirmed: ${txId}`);
    console.log("https://etherscan.io/tx/" + txId);
  }

  await sequelize.close();
}

main().catch(err => {
  console.error("Failed:", err?.response?.data || err?.message || err);
  process.exit(1);
});
