"""
BTC Testnet Payment Setup
Generate BTC testnet address and configure for testing
"""

import subprocess
import json
import requests

print("\n" + "="*80)
print("🪙 BTC TESTNET PAYMENT SETUP")
print("="*80)

BASE_URL = "http://localhost:8001"
TEST_USER_EMAIL = "john@dyno.pt"
TEST_USER_PASSWORD = "Katiekendra123@"

# Step 1: Login
print("\n📋 Step 1: Logging in...")
response = requests.post(
    f"{BASE_URL}/api/user/login",
    json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
)

if response.status_code != 200:
    print(f"❌ Login failed")
    exit(1)

token = response.json()["data"]["accessToken"]
user_id = response.json()["data"]["userData"]["user_id"]
print(f"✅ Logged in as user {user_id}")

# Step 2: Generate BTC address using Tatum API
print("\n📋 Step 2: Generating BTC testnet address...")

generate_btc = f"""
cd /app/backend && node -e '
const axios = require("axios");
const {{ Sequelize }} = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {{
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: "postgres",
  logging: false
}});

async function setup() {{
  try {{
    // Generate BTC wallet
    const walletRes = await axios.get("https://api.tatum.io/v3/bitcoin/wallet", {{
      headers: {{ "x-api-key": process.env.TATUM_TESTNET_KEY }}
    }});
    
    const xpub = walletRes.data.xpub;
    
    // Get first address
    const addressRes = await axios.get("https://api.tatum.io/v3/bitcoin/address/" + xpub + "/0", {{
      headers: {{ "x-api-key": process.env.TATUM_TESTNET_KEY }}
    }});
    
    const address = addressRes.data.address;
    
    console.log("\\nBTC Address:", address);
    
    // Register in database
    await sequelize.query(\`
      INSERT INTO tbl_user_temp_address 
      (wallet_address, wallet_type, user_id, status, amount, company_id, subscription_id, "createdAt", "updatedAt")
      VALUES (?, '"'"'BTC'"'"', ?, '"'"'pending'"'"', 0, 3, ?, NOW(), NOW());
    \`, {{
      replacements: [address, {user_id}, "test-btc-" + Date.now()]
    }});
    
    console.log("✅ Address registered in database");
    
    // Create webhook
    const webhookUrl = "https://api-key-enforce.preview.emergentagent.com/api/tatum-crypto-webhook";
    const subRes = await axios.post(
      "https://api.tatum.io/v3/subscription",
      {{
        type: "ADDRESS_TRANSACTION",
        attr: {{
          address: address,
          chain: "bitcoin-testnet",
          url: webhookUrl
        }}
      }},
      {{
        headers: {{ "x-api-key": process.env.TATUM_TESTNET_KEY }}
      }}
    );
    
    console.log("✅ Webhook subscription:", subRes.data.id);
    
    await sequelize.query(\`
      UPDATE tbl_user_temp_address 
      SET subscription_id = ?
      WHERE wallet_address = ?;
    \`, {{
      replacements: [subRes.data.id, address]
    }});
    
    // Setup Redis
    const redis = require("redis");
    const client = redis.createClient({{
      url: process.env.REDIS_PUBLIC_URL
    }});
    
    await client.connect();
    
    const redisData = {{
      amount: "0.0003",  // ~$10 worth of BTC
      currency: "BTC",
      user_id: {user_id},
      company_id: 3,
      adm_id: {user_id},
      ref: "crypto-" + address
    }};
    
    await client.set("crypto-" + address, JSON.stringify(redisData));
    console.log("✅ Redis configured");
    await client.quit();
    
    // Save to file
    const fs = require("fs");
    fs.writeFileSync("/app/btc_testnet_data.json", JSON.stringify({{
      address: address,
      subscription_id: subRes.data.id,
      expected_amount: "0.0003 BTC (~$10)"
    }}, null, 2));
    
    console.log("\\n" + "=".repeat(80));
    console.log("🪙 BTC TESTNET ADDRESS:");
    console.log("=".repeat(80));
    console.log("\\n   " + address);
    console.log("\\n" + "=".repeat(80));
    
    await sequelize.close();
    
  }} catch (err) {{
    console.error("Error:", err.response?.data || err.message);
    process.exit(1);
  }}
}}

setup();
'
"""

result = subprocess.run(generate_btc, shell=True, capture_output=True, text=True)
print(result.stdout)
if result.stderr and "Error" in result.stderr:
    print("Error:", result.stderr[:500])
    exit(1)

# Step 3: Load address from file
try:
    with open("/app/btc_testnet_data.json", "r") as f:
        data = json.load(f)
        btc_address = data["address"]
except:
    print("❌ Failed to load BTC address")
    exit(1)

# Step 4: Show faucet instructions
print("\n" + "="*80)
print("💰 GET FREE BTC TESTNET COINS")
print("="*80)

print("\n🚰 Working BTC Testnet Faucets:")
print("\n1. ✅ COINFAUCET (BEST - No Registration)")
print("   URL: https://coinfaucet.eu/en/btc-testnet/")
print("   Amount: 0.001 - 0.01 BTC (enough for multiple tests)")
print("   Limit: Once per day")
print("   Steps:")
print("     - Visit the site")
print(f"     - Enter address: {btc_address}")
print("     - Complete captcha")
print("     - Click 'Get Bitcoins!'")
print("     - Receive instantly!")

print("\n2. ✅ BITCOINFAUCET.UNDO.IT")
print("   URL: https://bitcoinfaucet.undo.it/")
print("   Amount: 0.001 BTC")
print("   Limit: Once per day")
print("   Steps:")
print("     - Enter your address")
print("     - Complete captcha")
print("     - Get testnet BTC")

print("\n3. ✅ TESTNET-FAUCET.COM")
print("   URL: https://testnet-faucet.com/btc-testnet/")
print("   Amount: 0.001 - 0.01 BTC")
print("   Limit: Once per 24 hours")

print("\n4. ✅ KUTTLER BTC FAUCET")
print("   URL: https://kuttler.eu/en/bitcoin/btc/faucet/")
print("   Amount: Small amounts")
print("   Limit: Multiple times")

print("\n" + "="*80)
print("📍 YOUR BTC TESTNET ADDRESS:")
print("="*80)
print(f"\n   {btc_address}")
print("\n" + "="*80)

print("\n💡 TIPS:")
print("   - BTC testnet faucets are MORE reliable than Sepolia!")
print("   - Use faucet #1 (coinfaucet.eu) - it works best")
print("   - You only need 0.001 BTC for testing")
print("   - Transaction confirms in ~10 minutes")

print("\n📊 TEST SCENARIOS:")
print("   - Send 0.0003 BTC (~$10): Tests UTXO dual-output")
print("   - Send 0.0001 BTC (~$3): Tests below threshold")
print("   - BTC uses immediate payout (no delayed sweep!)")

print("\n" + "="*80)
print("✅ SETUP COMPLETE!")
print("="*80)
print("\n📝 NEXT STEPS:")
print("   1. Visit: https://coinfaucet.eu/en/btc-testnet/")
print(f"   2. Enter: {btc_address}")
print("   3. Get testnet BTC (instant!)")
print("   4. Run: python /app/verify_btc_payment.py")
print("\n" + "="*80 + "\n")
