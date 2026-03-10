const axios = require("axios");
const { Sequelize } = require("sequelize");
const redis = require("redis");
const fs = require("fs");
require("dotenv").config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: "postgres",
  logging: false
});

async function setup() {
  try {
    console.log("\n🔧 Generating BTC testnet address...");
    
    // Generate BTC wallet
    const walletRes = await axios.get("https://api.tatum.io/v3/bitcoin/wallet", {
      headers: { "x-api-key": process.env.TATUM_TESTNET_KEY }
    });
    
    const xpub = walletRes.data.xpub;
    
    // Get first address
    const addressRes = await axios.get(`https://api.tatum.io/v3/bitcoin/address/${xpub}/0`, {
      headers: { "x-api-key": process.env.TATUM_TESTNET_KEY }
    });
    
    const address = addressRes.data.address;
    const userId = 28;
    
    console.log("✅ BTC Address generated:", address);
    
    // Register in database
    await sequelize.query(`
      INSERT INTO tbl_user_temp_address 
      (wallet_address, wallet_type, user_id, status, amount, company_id, subscription_id, "createdAt", "updatedAt")
      VALUES (?, 'BTC', ?, 'pending', 0, 3, ?, NOW(), NOW());
    `, {
      replacements: [address, userId, "test-btc-" + Date.now()]
    });
    
    console.log("✅ Address registered in database");
    
    // Create webhook
    const webhookUrl = "https://current-pod-config-2.preview.emergentagent.com/api/tatum-crypto-webhook";
    const subRes = await axios.post(
      "https://api.tatum.io/v3/subscription",
      {
        type: "ADDRESS_TRANSACTION",
        attr: {
          address: address,
          chain: "bitcoin-testnet",
          url: webhookUrl
        }
      },
      {
        headers: { "x-api-key": process.env.TATUM_TESTNET_KEY }
      }
    );
    
    const subId = subRes.data.id;
    console.log("✅ Webhook subscription:", subId);
    
    await sequelize.query(`
      UPDATE tbl_user_temp_address 
      SET subscription_id = ?
      WHERE wallet_address = ?;
    `, {
      replacements: [subId, address]
    });
    
    // Setup Redis
    const client = redis.createClient({
      url: process.env.REDIS_PUBLIC_URL
    });
    
    await client.connect();
    
    const redisData = {
      amount: "0.0003",  // ~$10 worth of BTC
      currency: "BTC",
      user_id: userId,
      company_id: 3,
      adm_id: userId,
      ref: "crypto-" + address
    };
    
    await client.set("crypto-" + address, JSON.stringify(redisData));
    console.log("✅ Redis configured");
    await client.quit();
    
    // Save to file
    fs.writeFileSync("/app/btc_testnet_data.json", JSON.stringify({
      address: address,
      subscription_id: subId,
      expected_amount: "0.0003 BTC (~$10)"
    }, null, 2));
    
    console.log("\n" + "=".repeat(80));
    console.log("🪙 BTC TESTNET ADDRESS:");
    console.log("=".repeat(80));
    console.log("\n   " + address);
    console.log("\n" + "=".repeat(80));
    console.log("\n💰 GET FREE BTC TESTNET:");
    console.log("=".repeat(80));
    console.log("\n1. ✅ COINFAUCET (BEST)");
    console.log("   https://coinfaucet.eu/en/btc-testnet/");
    console.log("   - Enter address above");
    console.log("   - Complete captcha");
    console.log("   - Get 0.001-0.01 BTC instantly!");
    console.log("\n2. ✅ BITCOINFAUCET");
    console.log("   https://bitcoinfaucet.undo.it/");
    console.log("\n3. ✅ TESTNET-FAUCET");
    console.log("   https://testnet-faucet.com/btc-testnet/");
    console.log("\n" + "=".repeat(80));
    console.log("\n✅ SETUP COMPLETE!");
    console.log("\n📝 NEXT STEPS:");
    console.log("   1. Visit: https://coinfaucet.eu/en/btc-testnet/");
    console.log("   2. Enter: " + address);
    console.log("   3. Get testnet BTC (works reliably!)");
    console.log("   4. Run: python /app/verify_btc_payment.py");
    console.log("\n💡 BTC testnet faucets work better than ETH!");
    console.log("=".repeat(80) + "\n");
    
    await sequelize.close();
    
  } catch (err) {
    console.error("\n❌ Error:", err.response?.data || err.message);
    process.exit(1);
  }
}

setup();
