"""
Real Sepolia ETH Payment Test
User will send actual Sepolia ETH to test the complete flow
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8001"
TEST_USER_EMAIL = "john@dyno.pt"
TEST_USER_PASSWORD = "Katiekendra123@"

print("\n" + "="*80)
print("🧪 REAL SEPOLIA ETH PAYMENT TEST")
print("="*80)

# Step 1: Login
print("\n📋 Step 1: Authenticating...")
response = requests.post(
    f"{BASE_URL}/api/user/login",
    json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
)

if response.status_code != 200:
    print(f"❌ Login failed: {response.text}")
    exit(1)

data = response.json()
token = data["data"]["accessToken"]
user_id = data["data"]["userData"]["user_id"]
print(f"✅ Logged in as user {user_id}")

# Step 2: Create payment link
print("\n📋 Step 2: Creating payment link...")

# Default to above threshold test
print("\n💰 Creating payment link for $10 USD (above $5 threshold)")
print("   You can send any amount to test different scenarios:")
print("   - Send $10+ worth: Tests above threshold (fee split)")
print("   - Send $3-4 worth: Tests below threshold (all to admin)")
print("   - Send partial: Tests partial payment logic")

amount = 10
description = "Real Sepolia Test - Above Threshold"

headers = {"Authorization": f"Bearer {token}"}
response = requests.post(
    f"{BASE_URL}/api/pay/createPaymentLink",
    json={
        "email": "real-sepolia-test@example.com",
        "amount": amount,
        "currency": "USD",
        "modes": ["CRYPTO"],
        "description": description
    },
    headers=headers
)

if response.status_code != 200:
    print(f"❌ Payment link creation failed: {response.text[:500]}")
    exit(1)

link_data = response.json()["data"]
link_id = link_data["link_id"]
transaction_id = link_data["transaction_id"]
payment_link = link_data.get("payment_link", "N/A")

print(f"✅ Payment link created!")
print(f"   Link ID: {link_id}")
print(f"   Transaction ID: {transaction_id}")
print(f"   Payment Link: {payment_link}")

# Step 3: Get payment data
print("\n📋 Step 3: Getting payment data...")
response = requests.post(
    f"{BASE_URL}/api/pay/getData",
    json={"data": transaction_id},
    headers=headers
)

if response.status_code != 200:
    print(f"⚠️ getData failed: {response.text[:200]}")
    print(f"Continuing anyway...")
else:
    print(f"✅ Payment data retrieved")

# Step 4: Generate crypto address
print("\n📋 Step 4: Generating ETH Sepolia address...")
response = requests.post(
    f"{BASE_URL}/api/pay/createCryptoPayment",
    json={
        "link_id": link_id,
        "transaction_id": transaction_id,
        "currency": "ETH"
    },
    headers=headers
)

if response.status_code != 200:
    print(f"❌ Address generation failed: {response.text[:500]}")
    exit(1)

crypto_data = response.json()["data"]
payment_address = crypto_data.get("address")
expected_amount = crypto_data.get("amount")

print(f"\n{'='*80}")
print(f"✅ PAYMENT ADDRESS GENERATED")
print(f"{'='*80}")
print(f"\n💰 Payment Details:")
print(f"   Amount (USD): ${amount}")
print(f"   Amount (ETH): {expected_amount} ETH")
print(f"   Network: Ethereum Sepolia Testnet")
print(f"   Address: {payment_address}")
print(f"\n{'='*80}")
print(f"📤 SEND SEPOLIA ETH TO THIS ADDRESS:")
print(f"{'='*80}")
print(f"\n   {payment_address}")
print(f"\n{'='*80}")
print(f"\n⚠️  IMPORTANT:")
print(f"   - Use Sepolia Testnet ONLY")
print(f"   - Send approximately {expected_amount} ETH")
print(f"   - Or send any amount to test partial/threshold logic")
print(f"\n{'='*80}")

# Step 5: Save test data
test_data = {
    "test_date": datetime.now().isoformat(),
    "link_id": link_id,
    "transaction_id": transaction_id,
    "payment_address": payment_address,
    "expected_amount_usd": amount,
    "expected_amount_eth": expected_amount,
    "payment_link": payment_link
}

with open("/app/real_sepolia_test_data.json", "w") as f:
    json.dump(test_data, f, indent=2)

print(f"\n📄 Test data saved to: /app/real_sepolia_test_data.json")

# Step 6: Instructions
print(f"\n📋 NEXT STEPS:")
print(f"1. Send Sepolia ETH to the address above")
print(f"2. Wait for transaction confirmation (~30 seconds)")
print(f"3. Run the verification script: python /app/verify_sepolia_payment.py")
print(f"4. Check results in database")

print(f"\n✅ Setup complete! Waiting for your payment...")
print(f"="*80)
