"""
Monitor BTC Payment - Watch for webhook and processing
"""

import time
import subprocess
import json

btc_address = "tb1qtxavl3new95c5l3468dl5u00f26pgtvc3ukyxk"

print("\n" + "="*80)
print("👁️  MONITORING BTC TESTNET PAYMENT")
print("="*80)
print(f"\nAddress: {btc_address}")
print("\n⏳ Waiting for blockchain confirmation...")
print("   This typically takes 10-15 minutes")
print("   Checking every 30 seconds...\n")

check_count = 0
max_checks = 40  # 20 minutes total

while check_count < max_checks:
    check_count += 1
    print(f"[{time.strftime('%H:%M:%S')}] Check #{check_count}/40...", end=" ")
    
    # Query database
    query = f"""
cd /app/backend && node -e '
const {{ Sequelize, QueryTypes }} = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {{
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: "postgres",
  logging: false
}});

(async () => {{
  try {{
    const record = await sequelize.query(\`
      SELECT status, amount, admin_status, "txId"
      FROM tbl_user_temp_address
      WHERE wallet_address = '"'"'{btc_address}'"'"';
    \`, {{ type: QueryTypes.SELECT }});
    
    if (record.length > 0 && record[0].txId) {{
      console.log(JSON.stringify(record[0]));
    }} else {{
      console.log("pending");
    }}
    await sequelize.close();
  }} catch (err) {{
    console.log("error");
  }}
}})();
'
"""
    
    result = subprocess.run(query, shell=True, capture_output=True, text=True)
    output = result.stdout.strip()
    
    if output and output != "pending" and output != "error":
        try:
            data = json.loads(output)
            print("\n\n" + "="*80)
            print("🎉 PAYMENT RECEIVED!")
            print("="*80)
            print(f"\nStatus: {data['status']}")
            print(f"Amount: {data['amount']} BTC")
            print(f"Admin Status: {data.get('admin_status', 'N/A')}")
            print(f"TX Hash: {data.get('txId', 'N/A')}")
            print("\n✅ Running full verification...")
            print("="*80 + "\n")
            
            # Run full verification
            subprocess.run(["python", "/app/verify_btc_payment.py"])
            break
        except:
            print("Pending...")
    else:
        print("Pending...")
    
    time.sleep(30)  # Wait 30 seconds

if check_count >= max_checks:
    print("\n⏰ Monitoring timeout (20 minutes)")
    print("   Run manually: python /app/verify_btc_payment.py")

print("\n" + "="*80)
