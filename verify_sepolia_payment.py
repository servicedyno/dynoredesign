"""
Verify Real Sepolia Payment
Check the status and results of the real payment
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8001"

print("\n" + "="*80)
print("🔍 REAL SEPOLIA PAYMENT VERIFICATION")
print("="*80)

# Load test data
try:
    with open("/app/real_sepolia_test_data.json", "r") as f:
        test_data = json.load(f)
except FileNotFoundError:
    print("❌ Test data not found. Run setup_real_sepolia_test.py first")
    exit(1)

print(f"\n📋 Test Information:")
print(f"   Address: {test_data['payment_address']}")
print(f"   Expected: ${test_data.get('expected_amount_usd', 10)} USD")

# Query database to check status
print(f"\n🔍 Checking payment status...")

check_query = f"""
cd /app/backend && node -e "
const {{ Sequelize, QueryTypes }} = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {{
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false
}});

(async () => {{
  try {{
    // Check temp address
    const tempAddress = await sequelize.query(\`
      SELECT 
        wallet_address,
        status,
        admin_status,
        amount,
        pending_admin_fee,
        \\"txId\\",
        adminTxId,
        partial_payment_timestamp,
        \\"createdAt\\",
        \\"updatedAt\\"
      FROM tbl_user_temp_address
      WHERE wallet_address = '{test_data['payment_address']}';
    \`, {{ type: QueryTypes.SELECT }});
    
    if (tempAddress.length === 0) {{
      console.log('⏳ Payment address found but no transaction yet');
      console.log('   Waiting for blockchain confirmation...');
    }} else {{
      console.log('\\n📊 TEMP ADDRESS STATUS:');
      console.log(JSON.stringify(tempAddress[0], null, 2));
      
      // Check for merchant transaction
      if (tempAddress[0].txId) {{
        const merchantTx = await sequelize.query(\`
          SELECT 
            base_amount,
            base_currency,
            transaction_type,
            status,
            \\"createdAt\\"
          FROM tbl_user_transaction
          WHERE transaction_reference = ?;
        \`, {{ 
          replacements: [tempAddress[0].txId],
          type: QueryTypes.SELECT 
        }});
        
        if (merchantTx.length > 0) {{
          console.log('\\n💰 MERCHANT TRANSACTION:');
          console.log(JSON.stringify(merchantTx[0], null, 2));
        }} else {{
          console.log('\\n⚠️  No merchant transaction found (may be below threshold)');
        }}
      }}
      
      // Check admin fee transactions
      const adminFeeTx = await sequelize.query(\`
        SELECT 
          transaction_type,
          amount,
          currency,
          usd_value,
          tx_hash,
          status,
          \\"createdAt\\"
        FROM tbl_admin_fee_transaction
        WHERE tx_hash = ? OR tx_hash LIKE ?;
      \`, {{ 
        replacements: [tempAddress[0].adminTxId, '%' + (tempAddress[0].txId || '') + '%'],
        type: QueryTypes.SELECT 
      }});
      
      if (adminFeeTx.length > 0) {{
        console.log('\\n🏦 ADMIN FEE TRANSACTION:');
        console.log(JSON.stringify(adminFeeTx, null, 2));
      }}
    }}
    
    await sequelize.close();
  }} catch (err) {{
    console.error('❌ Error:', err.message);
    process.exit(1);
  }}
}})();
"
"""

import subprocess
result = subprocess.run(check_query, shell=True, capture_output=True, text=True)
print(result.stdout)
if result.stderr:
    print(result.stderr)

# Check backend logs
print(f"\n📋 Recent Backend Logs (last 50 lines):")
print(f"="*80)

import subprocess
result = subprocess.run(
    "tail -50 /var/log/supervisor/backend.out.log | grep -E 'cryptoVerification|webhook|payment|threshold' || echo 'No recent payment logs'",
    shell=True,
    capture_output=True,
    text=True
)
print(result.stdout)

print(f"\n{'='*80}")
print(f"📊 ANALYSIS:")
print(f"{'='*80}")

print(f"""
Check the results above:

1. TEMP ADDRESS STATUS:
   - status: Should show 'pending', 'completed', or 'partial'
   - admin_status: 'pending_sweep', 'successful', or 'pending'
   - amount: Received amount in ETH
   - txId: Blockchain transaction hash

2. MERCHANT TRANSACTION:
   - If above threshold: Should have transaction record
   - If below threshold: No merchant transaction (or $0)

3. ADMIN FEE:
   - Above threshold: Fee amount calculated
   - Below threshold: Entire amount goes to admin

4. THRESHOLD LOGIC:
   - ETH_THRESHOLD = $5 USD
   - If payment >= $5: Split between admin fee and merchant
   - If payment < $5: Entire amount to admin

{'='*80}
""")

# Offer to run again
print(f"\n💡 TIP: Run this script multiple times to track payment progress")
print(f"        python /app/verify_sepolia_payment.py")
print(f"\n{'='*80}")
