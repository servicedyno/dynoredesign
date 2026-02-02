"""
Below-Threshold Payment Test - BTC on Sepolia
Using BTC since it's in allowed currencies list
"""

import requests
import json
import random

BASE_URL = "http://localhost:8001"
TEST_USER_EMAIL = "john@dyno.pt"
TEST_USER_PASSWORD = "Katiekendra123@"

print("\n" + "="*80)
print("🧪 BELOW-THRESHOLD PAYMENT TEST - BTC")
print("="*80)

# Step 1: Login
print("\n📋 Step 1: Login")
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

# Step 2: Create payment link with BTC (allowed currency, amount $10)
print("\n📋 Step 2: Create BTC payment link ($10 = ~$3.44 admin fee)")

payload = {
    "email": "belowtest@example.com",
    "amount": 10,  # $10 USD, will result in ~$3.44 admin fee (below $5)
    "currency": "BTC",
    "modes": ["CRYPTO"]
}

headers = {"Authorization": f"Bearer {token}"}
response = requests.post(
    f"{BASE_URL}/api/pay/createPaymentLink",
    json=payload,
    headers=headers
)

print(f"Status: {response.status_code}")

if response.status_code == 200:
    data = response.json().get("data", {})
    link_id = data.get("link_id")
    transaction_id = data.get("transaction_id")
    
    print(f"✅ Payment link created!")
    print(f"   Link ID: {link_id}")
    print(f"   Transaction ID: {transaction_id}")
    
    # Step 3: Get payment link
    print("\n📋 Step 3: Get payment link details")
    response = requests.get(
        f"{BASE_URL}/api/pay/links/{link_id}",
        headers=headers
    )
    
    if response.status_code == 200:
        link_data = response.json().get("data", {})
        print(f"   Amount: ${link_data.get('base_amount')} {link_data.get('base_currency')}")
        print(f"   Payment link: {link_data.get('payment_link')}")
    
    # Step 4: Try to initiate crypto payment
    print("\n📋 Step 4: Check payment flow")
    print(f"\n   For crypto payment generation, the checkout flow would:")
    print(f"   1. Customer visits checkout page")
    print(f"   2. Selects BTC as payment method")
    print(f"   3. System generates BTC address via createCryptoPayment")
    print(f"   4. Customer sends BTC to generated address")
    print(f"   5. Tatum webhook triggers on payment received")
    
    # Step 5: Calculate expected fees
    print("\n📋 Step 5: Expected Fee Calculation")
    payment_usd = 10.00
    platform_fee = payment_usd * 0.02  # 2%
    fixed_fee = 3.00
    buffer_fee = payment_usd * 0.01  # 1%
    total_fee = platform_fee + fixed_fee + buffer_fee
    merchant_receives = payment_usd - total_fee
    
    print(f"   Payment: ${payment_usd}")
    print(f"   Platform Fee (2%): ${platform_fee:.2f}")
    print(f"   Fixed Fee: ${fixed_fee:.2f}")
    print(f"   Buffer (1%): ${buffer_fee:.2f}")
    print(f"   Total Admin Fee: ${total_fee:.2f}")
    print(f"   Merchant Receives: ${merchant_receives:.2f}")
    print(f"\n   ⚠️ Admin Fee ${total_fee:.2f} < $5 threshold")
    print(f"   Expected admin_status: 'pending' (NOT 'pending_sweep')")
    
    # Step 6: Database verification queries
    print("\n📋 Step 6: Verification Queries (Run After Payment)")
    print(f"""
# After customer sends BTC and webhook processes:

# 1. Check transaction status
SELECT 
  transaction_id, 
  status, 
  base_amount, 
  base_currency,
  usd_value
FROM tbl_transactions 
WHERE transaction_id = '{transaction_id}';

# 2. Check admin fee status (CRITICAL)
SELECT 
  wallet_address,
  admin_status,  -- Should be 'pending' NOT 'pending_sweep'
  admin_fee,
  usd_value,     -- Should be < $5
  adminTxId
FROM tbl_user_temp_address 
WHERE transaction_id = '{transaction_id}';

# 3. Verify NO sweep occurred
SELECT COUNT(*) as sweep_count
FROM tbl_admin_fee_transaction 
WHERE transaction_id = '{transaction_id}';
-- Expected: 0 (no sweep for below-threshold)

# 4. Check merchant payout
SELECT 
  balance
FROM tbl_user_wallet 
WHERE user_id = {user_id} AND wallet_type = 'BTC';
""")
    
    print("\n✅ Test Setup Complete!")
    print("\n📊 Test Summary:")
    print("   Payment Link: CREATED ✅")
    print("   Amount: $10 USD")
    print("   Expected Admin Fee: $3.44 (< $5)")
    print("   Expected Status: 'pending'")
    print("   Expected Sweep: NO")
    
    print("\n🎯 Next Steps:")
    print("   1. Complete payment via checkout (send BTC)")
    print("   2. Wait for webhook processing")
    print("   3. Run verification queries above")
    print("   4. Confirm admin_status = 'pending'")
    print("   5. Verify no sweep in tbl_admin_fee_transaction")
    
    print("\n📋 Comparison with Above-Threshold Test:")
    print("   ┌─────────────────────┬──────────────────┬───────────────────┐")
    print("   │ Aspect              │ Above ($145.83)  │ Below ($10)       │")
    print("   ├─────────────────────┼──────────────────┼───────────────────┤")
    print("   │ Admin Fee           │ $6.08            │ $3.44             │")
    print("   │ admin_status        │ 'pending_sweep'  │ 'pending'         │")
    print("   │ Swept by Cron?      │ YES (15 min)     │ NO                │")
    print("   │ Sweep TX            │ 0x406abb34...    │ None              │")
    print("   └─────────────────────┴──────────────────┴───────────────────┘")

else:
    print(f"❌ Failed: {response.text[:500]}")

print("\n" + "="*80)
print("📝 NOTE: This creates the payment link setup.")
print("    Actual payment requires customer to send BTC via checkout.")
print("    Webhook simulation would need a valid temp address in database.")
print("="*80 + "\n")
