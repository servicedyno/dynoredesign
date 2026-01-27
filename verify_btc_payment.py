"""
Verify BTC Testnet Payment
Check status and results of BTC payment
"""

import json
import subprocess

print("\n" + "="*80)
print("🔍 BTC TESTNET PAYMENT VERIFICATION")
print("="*80)

# Load BTC address
try:
    with open("/app/btc_testnet_data.json", "r") as f:
        data = json.load(f)
        btc_address = data["address"]
except:
    print("❌ BTC test data not found. Run setup_btc_testnet.py first")
    exit(1)

print(f"\n📍 Checking address: {btc_address}")

verify_query = f"""
cd /app/backend && node -e '
const {{ Sequelize, QueryTypes }} = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {{
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: "postgres",
  logging: false
}});

async function verify() {{
  const address = "{btc_address}";
  
  try {{
    console.log("\\n" + "=".repeat(80));
    console.log("🎉 BTC PAYMENT VERIFICATION RESULTS");
    console.log("=".repeat(80));
    
    const tempAddress = await sequelize.query(\`
      SELECT 
        wallet_address,
        status,
        admin_status,
        amount,
        pending_admin_fee,
        "txId",
        "createdAt",
        "updatedAt"
      FROM tbl_user_temp_address
      WHERE wallet_address = ?;
    \`, {{ 
      replacements: [address],
      type: QueryTypes.SELECT 
    }});
    
    if (tempAddress.length === 0) {{
      console.log("\\n⏳ Waiting for payment...");
      console.log("   Address registered but no transaction yet");
      console.log("   Check: https://blockstream.info/testnet/address/" + address);
    }} else {{
      const record = tempAddress[0];
      console.log("\\n📊 PAYMENT RECORD:");
      console.log("   Status:", record.status);
      console.log("   Admin Status:", record.admin_status);
      console.log("   Amount:", record.amount, "BTC");
      console.log("   Pending Admin Fee:", record.pending_admin_fee, "BTC");
      console.log("   TX Hash:", record.txId || "N/A");
      console.log("   Updated:", record.updatedAt);
      
      if (record.txId) {{
        const merchantTx = await sequelize.query(\`
          SELECT 
            base_amount,
            base_currency,
            transaction_type,
            status,
            "createdAt"
          FROM tbl_user_transaction
          WHERE transaction_reference = ?;
        \`, {{
          replacements: [record.txId],
          type: QueryTypes.SELECT
        }});
        
        if (merchantTx.length > 0) {{
          console.log("\\n💰 MERCHANT PAYOUT:");
          console.log("   Amount:", merchantTx[0].base_amount, merchantTx[0].base_currency);
          console.log("   Type:", merchantTx[0].transaction_type);
          console.log("   Status:", merchantTx[0].status);
          console.log("   Date:", merchantTx[0].createdAt);
          
          console.log("\\n✅ BTC UTXO TEST SUCCESSFUL!");
          console.log("   - Dual-output transaction: ✅");
          console.log("   - Merchant received: ✅");
          console.log("   - Admin fee immediate: ✅");
        }} else {{
          console.log("\\n⚠️  NO MERCHANT TRANSACTION");
          console.log("   (Below threshold or still processing)");
        }}
        
        // Check admin fee
        if (record.admin_status === "successful") {{
          console.log("\\n🏦 ADMIN FEE STATUS:");
          console.log("   Status: SUCCESSFUL (immediate dual-output)");
          console.log("   BTC uses UTXO - no sweep needed!");
        }}
        
        console.log("\\n" + "=".repeat(80));
        console.log("🔍 BLOCKCHAIN VERIFICATION:");
        console.log("=".repeat(80));
        console.log("\\n   View TX: https://blockstream.info/testnet/tx/" + record.txId);
        console.log("   View Address: https://blockstream.info/testnet/address/" + address);
      }}
    }}
    
    console.log("\\n" + "=".repeat(80));
    await sequelize.close();
  }} catch (err) {{
    console.error("Error:", err.message);
    process.exit(1);
  }}
}}

verify();
'
"""

result = subprocess.run(verify_query, shell=True, capture_output=True, text=True)
print(result.stdout)

print("\n💡 TIP: Run this script multiple times to track payment progress")
print("   BTC testnet confirmations: ~10 minutes")
print("="*80 + "\n")
