"""
Below-Threshold Payment Test - Use Existing Small Transaction
Test webhook simulation for an existing below-threshold payment
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8001"
TEST_USER_EMAIL = "john@dyno.pt"
TEST_USER_PASSWORD = "Katiekendra123@"

print("\n" + "="*80)
print("🧪 BELOW-THRESHOLD WEBHOOK SIMULATION TEST")
print("="*80)

# Step 1: Login
print("\n📋 Step 1: Login")
response = requests.post(
    f"{BASE_URL}/api/user/login",
    json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
)

if response.status_code != 200:
    print(f"❌ Login failed: {response.text}")
    exit(1)

token = response.json()["data"]["accessToken"]
user_id = response.json()["data"]["userData"]["user_id"]
print(f"✅ Logged in as user {user_id}")

# Step 2: Query database for existing small transactions
print("\n📋 Step 2: Check for existing below-threshold transactions")
print("Run this SQL query to find candidates:")
print("""
SELECT 
  t.transaction_id,
  t.base_amount,
  t.base_currency,
  t.usd_value,
  t.status,
  ta.wallet_address,
  ta.admin_status,
  ta.admin_fee
FROM tbl_transactions t
LEFT JOIN tbl_user_temp_address ta ON t.transaction_id = ta.transaction_id
WHERE t.usd_value > 10 AND t.usd_value < 20
  AND t.base_currency = 'ETH'
ORDER BY t.created_at DESC
LIMIT 5;
""")

# Step 3: Create NEW crypto payment with proper format
print("\n📋 Step 3: Create crypto payment link")

# Use format that works based on validation
payload = {
    "email": "belowtest@example.com",
    "base_amount": "0.005",  # String format, ~$14.58
    "base_currency": "ETH",
    "modes": ["CRYPTO"],
    "description": "Below threshold test"
}

headers = {"Authorization": f"Bearer {token}"}
response = requests.post(
    f"{BASE_URL}/api/pay/createPaymentLink",
    json=payload,
    headers=headers
)

print(f"Status: {response.status_code}")
print(f"Response: {response.text[:500]}")

if response.status_code == 200:
    data = response.json().get("data", {})
    link_id = data.get("link_id")
    transaction_id = data.get("transaction_id")
    
    print(f"\n✅ Payment link created!")
    print(f"   Link ID: {link_id}")
    print(f"   Transaction ID: {transaction_id}")
    
    # Step 4: Get payment link to see checkout URL
    print("\n📋 Step 4: Get payment link details")
    response = requests.get(
        f"{BASE_URL}/api/pay/links/{link_id}",
        headers=headers
    )
    
    if response.status_code == 200:
        link_data = response.json().get("data", {})
        print(f"   Payment link: {link_data.get('payment_link')}")
        print(f"   Amount: {link_data.get('base_amount')} {link_data.get('base_currency')}")
        print(f"   Status: {link_data.get('status')}")
    
    # Step 5: Simulate crypto payment initiation
    print("\n📋 Step 5: Initiate crypto payment (generate address)")
    
    # Get the link data from Redis
    response = requests.post(
        f"{BASE_URL}/api/pay/getData",
        json={"data": transaction_id},
        headers=headers
    )
    
    print(f"getData Status: {response.status_code}")
    print(f"getData Response: {response.text[:300]}")
    
    if response.status_code == 200:
        # Now call createCryptoPayment
        crypto_payload = {
            "link_id": link_id,
            "transaction_id": transaction_id,
            "currency": "ETH"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pay/createCryptoPayment",
            json=crypto_payload,
            headers=headers
        )
        
        print(f"\ncreateCryptoPayment Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            crypto_data = response.json().get("data", {})
            payment_address = crypto_data.get("address")
            
            print(f"\n✅ Crypto payment address generated!")
            print(f"   Address: {payment_address}")
            print(f"   Amount to send: 0.005 ETH")
            
            # Step 6: Simulate webhook
            print("\n📋 Step 6: Simulate Tatum webhook")
            
            import random
            tx_hash = '0x' + ''.join([random.choice('0123456789abcdef') for _ in range(64)])
            
            webhook_payload = {
                "currency": "ETH",
                "amount": "0.005",
                "address": payment_address,
                "txId": tx_hash,
                "blockNumber": 5234567,
                "asset": "ETH",
                "type": "native",
                "mempool": False,
                "confirmations": 12
            }
            
            print(f"Webhook payload:")
            print(json.dumps(webhook_payload, indent=2))
            
            response = requests.post(
                f"{BASE_URL}/api/tatum-crypto-webhook",
                json=webhook_payload
            )
            
            print(f"\nWebhook Status: {response.status_code}")
            print(f"Webhook Response: {response.text[:500]}")
            
            # Step 7: Check transaction status
            print("\n📋 Step 7: Verify transaction processing")
            print(f"\nCheck database with these queries:")
            print(f"""
-- Transaction status
SELECT status, usd_value, base_amount 
FROM tbl_transactions 
WHERE transaction_id = '{transaction_id}';

-- Admin fee status
SELECT wallet_address, admin_status, admin_fee, usd_value
FROM tbl_user_temp_address 
WHERE wallet_address = '{payment_address}';

-- Check if swept
SELECT * FROM tbl_admin_fee_transaction 
WHERE transaction_id = '{transaction_id}';
""")
            
            print("\n✅ Test simulation complete!")
            print("\n📊 Expected Results:")
            print("   - Transaction status: 'successful'")
            print("   - Admin fee: ~$3.44 (< $5 threshold)")
            print("   - admin_status: 'pending' (NOT 'pending_sweep')")
            print("   - No sweep record in tbl_admin_fee_transaction")
            
else:
    print(f"\n❌ Payment link creation failed: {response.text}")
    print("\nPossible reasons:")
    print("1. Validation error - check required fields")
    print("2. Company_id required - try adding company_id")
    print("3. API changes - review createPaymentLink endpoint")

print("\n" + "="*80)
