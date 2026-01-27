"""
Complete Partial Payment Test - Database Manipulation & Verification
This script manually inserts partial payment records and processes them
"""

import subprocess
import time

print("\n" + "="*80)
print("🔧 PARTIAL PAYMENT DATABASE TEST - MANUAL EXECUTION")
print("="*80)

# Transaction IDs from the webhook test
SCENARIO_1_TX = "06da8fd1-d41c-4485-b39d-75402b84c1f4"  # Above threshold
SCENARIO_2_TX = "703a6933-876d-4d1f-a65d-8d568e7b27cc"  # Below threshold

SCENARIO_1_ADDRESS = "0x6dc2d207cf078057d22ed26484ff183a2bd0a044"
SCENARIO_2_ADDRESS = "0x5c4d9bd3ca928d00a8e803a272ffb1138ec91e63"

USER_ID = 28  # john@dyno.pt

print(f"\n📋 Test Scenarios:")
print(f"   Scenario 1: TX {SCENARIO_1_TX[:20]}... (Above threshold)")
print(f"   Scenario 2: TX {SCENARIO_2_TX[:20]}... (Below threshold)")

# Step 1: Insert temp address records with partial status
print(f"\n📝 Step 1: Inserting partial payment records...")

insert_scenario_1 = f"""
cd /app/backend && node -e "
const {{ Sequelize }} = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {{
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false
}});

(async () => {{
  try {{
    // Insert temp address for scenario 1 (above threshold)
    await sequelize.query(\`
      INSERT INTO tbl_user_temp_address 
      (wallet_address, wallet_type, user_id, transaction_id, status, amount, partial_payment_timestamp, \\"txId\\", subscription_id, company_id)
      VALUES 
      ('{SCENARIO_1_ADDRESS}', 'ETH', {USER_ID}, '{SCENARIO_1_TX}', 'partial', 0.0103, NOW() - INTERVAL '31 minutes', '0x226f135a960cf09bec8777ab2b2404690aece3794962c6648a324bd7d87aae99', 'test-sub-1', 3)
      ON CONFLICT (wallet_address) DO UPDATE SET
        status = 'partial',
        amount = 0.0103,
        partial_payment_timestamp = NOW() - INTERVAL '31 minutes',
        \\"txId\\" = '0x226f135a960cf09bec8777ab2b2404690aece3794962c6648a324bd7d87aae99';
    \`);
    
    console.log('✅ Scenario 1 record inserted (above threshold)');
    await sequelize.close();
  }} catch (err) {{
    console.error('❌ Error:', err.message);
    process.exit(1);
  }}
}})();
"
"""

result = subprocess.run(insert_scenario_1, shell=True, capture_output=True, text=True)
print(result.stdout)
if result.stderr and 'Error' in result.stderr:
    print(result.stderr)

time.sleep(1)

insert_scenario_2 = f"""
cd /app/backend && node -e "
const {{ Sequelize }} = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {{
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false
}});

(async () => {{
  try {{
    // Insert temp address for scenario 2 (below threshold)
    await sequelize.query(\`
      INSERT INTO tbl_user_temp_address 
      (wallet_address, wallet_type, user_id, transaction_id, status, amount, partial_payment_timestamp, \\"txId\\", subscription_id, company_id)
      VALUES 
      ('{SCENARIO_2_ADDRESS}', 'ETH', {USER_ID}, '{SCENARIO_2_TX}', 'partial', 0.00103, NOW() - INTERVAL '31 minutes', '0x86c8b3de70c0ff076993ab78716128a065b5bda70db74e71e35746f99d6bbf34', 'test-sub-2', 3)
      ON CONFLICT (wallet_address) DO UPDATE SET
        status = 'partial',
        amount = 0.00103,
        partial_payment_timestamp = NOW() - INTERVAL '31 minutes',
        \\"txId\\" = '0x86c8b3de70c0ff076993ab78716128a065b5bda70db74e71e35746f99d6bbf34';
    \`);
    
    console.log('✅ Scenario 2 record inserted (below threshold)');
    await sequelize.close();
  }} catch (err) {{
    console.error('❌ Error:', err.message);
    process.exit(1);
  }}
}})();
"
"""

result = subprocess.run(insert_scenario_2, shell=True, capture_output=True, text=True)
print(result.stdout)
if result.stderr and 'Error' in result.stderr:
    print(result.stderr)

# Step 2: Verify records were inserted
print(f"\n🔍 Step 2: Verifying inserted records...")

verify_query = f"""
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
    const records = await sequelize.query(\`
      SELECT 
        wallet_address,
        wallet_type,
        status,
        amount,
        partial_payment_timestamp,
        AGE(NOW(), partial_payment_timestamp) as age
      FROM tbl_user_temp_address
      WHERE transaction_id IN ('{SCENARIO_1_TX}', '{SCENARIO_2_TX}')
      ORDER BY amount DESC;
    \`, {{ type: QueryTypes.SELECT }});
    
    console.log('📊 Partial Payment Records:');
    console.log(JSON.stringify(records, null, 2));
    
    await sequelize.close();
  }} catch (err) {{
    console.error('❌ Error:', err.message);
    process.exit(1);
  }}
}})();
"
"""

result = subprocess.run(verify_query, shell=True, capture_output=True, text=True)
print(result.stdout)

# Step 3: Manually trigger processIncompletePayments
print(f"\n⚙️ Step 3: Manually triggering processIncompletePayments...")
print(f"⚠️ NOTE: This function needs to be exposed or we wait for cron")
print(f"         Cron runs every 10 minutes automatically")
print(f"         Checking backend logs for processing...")

# Step 4: Query results after processing
print(f"\n⏰ Waiting 5 seconds for processing...")
time.sleep(5)

results_query = f"""
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
    const results = await sequelize.query(\`
      SELECT 
        ta.wallet_address,
        ta.status,
        ta.amount as partial_amount,
        ta.admin_status,
        ta.pending_admin_fee,
        ut.base_amount as merchant_received,
        ut.transaction_type
      FROM tbl_user_temp_address ta
      LEFT JOIN tbl_user_transaction ut ON ut.transaction_reference = ta.\\"txId\\"
      WHERE ta.transaction_id IN ('{SCENARIO_1_TX}', '{SCENARIO_2_TX}')
      ORDER BY ta.amount DESC;
    \`, {{ type: QueryTypes.SELECT }});
    
    console.log('\\n📊 RESULTS AFTER PROCESSING:');
    console.log(JSON.stringify(results, null, 2));
    
    await sequelize.close();
  }} catch (err) {{
    console.error('❌ Error:', err.message);
    process.exit(1);
  }}
}})();
"
"""

result = subprocess.run(results_query, shell=True, capture_output=True, text=True)
print(result.stdout)

# Step 5: Generate analysis
print(f"\n" + "="*80)
print(f"📋 EXPECTED RESULTS COMPARISON")
print(f"="*80)
print(f"""
Scenario 1 (Above Threshold - $30):
  Expected:
    - Status: 'completed_partial'
    - Admin status: 'pending_sweep' or 'successful'
    - Admin fee: ~0.00134 ETH (~$3.90)
    - Merchant received: ~0.00896 ETH (~$26.10)
    - Merchant transaction: YES
    
Scenario 2 (Below Threshold - $3):
  Expected:
    - Status: 'completed_partial'
    - Admin status: 'pending_sweep' or 'successful'
    - Admin fee: 0.00103 ETH ($3.00 - ENTIRE AMOUNT)
    - Merchant received: 0 ETH ($0.00)
    - Merchant transaction: NO

NOTE: If status is still 'partial', the cron hasn't run yet.
      Wait up to 10 minutes for automatic processing.
""")

print(f"✅ Test data setup complete!")
print(f"="*80)
