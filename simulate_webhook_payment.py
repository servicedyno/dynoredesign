"""
Manual Webhook Simulation - Test Without Real Sepolia ETH
Simulates a payment by calling the webhook directly
"""

import requests
import json
import random

BASE_URL = "http://localhost:8001"
PAYMENT_ADDRESS = "0x5f9676a94a992f9f82c8d147a4c2fae5b78cd624"

print("\n" + "="*80)
print("🧪 MANUAL WEBHOOK SIMULATION TEST")
print("="*80)
print("\nThis will simulate a Sepolia payment without needing real ETH")

# Ask user which scenario to test
print("\n📊 Which scenario would you like to test?")
print("\n1. Above Threshold ($10 = 0.0034 ETH)")
print("   → Admin: $3.30 | Merchant: $6.70")
print("\n2. Below Threshold ($3 = 0.001 ETH)")
print("   → Admin: $3.00 | Merchant: $0.00")
print("\n3. Partial Payment ($5 = 0.0017 ETH - 50% of $10)")
print("   → Status: partial, waits 30 min")

choice = input("\nEnter choice (1/2/3): ").strip()

if choice == "1":
    amount_eth = "0.0034"
    amount_usd = 10
    scenario = "Above Threshold"
elif choice == "2":
    amount_eth = "0.001"
    amount_usd = 3
    scenario = "Below Threshold"
elif choice == "3":
    amount_eth = "0.0017"
    amount_usd = 5
    scenario = "Partial Payment"
else:
    print("Invalid choice, defaulting to Above Threshold")
    amount_eth = "0.0034"
    amount_usd = 10
    scenario = "Above Threshold"

print(f"\n🎯 Testing: {scenario}")
print(f"   Amount: {amount_eth} ETH (${amount_usd})")

# Generate realistic transaction hash
tx_hash = "0x" + ''.join([random.choice('0123456789abcdef') for _ in range(64)])

# Create webhook payload
webhook_payload = {
    "currency": "ETH",
    "amount": amount_eth,
    "address": PAYMENT_ADDRESS,
    "txId": tx_hash,
    "blockNumber": random.randint(5000000, 5999999),
    "asset": "ETH",
    "type": "native",
    "mempool": False,
    "confirmations": 12
}

print(f"\n📤 Sending webhook to: {BASE_URL}/api/tatum-crypto-webhook")
print(f"   TX Hash: {tx_hash}")

# Send webhook
try:
    response = requests.post(
        f"{BASE_URL}/api/tatum-crypto-webhook",
        json=webhook_payload,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"\n📨 Webhook Response:")
    print(f"   Status Code: {response.status_code}")
    
    if response.status_code == 200:
        print(f"   ✅ Webhook processed successfully!")
        try:
            print(f"   Response: {response.json()}")
        except:
            print(f"   Response: {response.text[:200]}")
    else:
        print(f"   ⚠️ Response: {response.text[:500]}")
    
    # Wait a moment for processing
    import time
    print(f"\n⏳ Waiting 3 seconds for backend processing...")
    time.sleep(3)
    
    # Now verify results
    print(f"\n🔍 Verifying results...")
    print(f"\nRun this command to check the database:")
    print(f"   python /app/verify_sepolia_payment.py")
    
    print(f"\n" + "="*80)
    print(f"📊 EXPECTED RESULTS FOR {scenario.upper()}:")
    print(f"="*80)
    
    if choice == "1":
        print(f"""
Payment: ${amount_usd} (above $5 threshold)
Expected Processing:
  ✅ Webhook received and processed
  ✅ Threshold check: ${amount_usd} >= $5
  ✅ Fee calculation: ~$3.30 (33%)
  ✅ Merchant payout: ~$6.70 (67%)
  ✅ Admin fee status: 'pending_sweep'
  ✅ Merchant transaction created
  ✅ Database updated
""")
    elif choice == "2":
        print(f"""
Payment: ${amount_usd} (below $5 threshold)
Expected Processing:
  ✅ Webhook received and processed
  ✅ Threshold check: ${amount_usd} < $5
  ✅ NO fee calculation
  ✅ Admin receives: ${amount_usd} (100%)
  ✅ Merchant receives: $0.00
  ✅ Admin fee status: 'pending_sweep'
  ✅ NO merchant transaction
  ✅ Database updated
""")
    else:
        print(f"""
Payment: ${amount_usd} (partial - 50% of expected $10)
Expected Processing:
  ✅ Webhook received and processed
  ✅ Partial payment detected
  ✅ Status set to: 'partial'
  ✅ Grace period: 30 minutes
  ✅ Waiting for remaining ${amount_usd}
  ✅ Database updated
  
If no additional payment in 30 min:
  → Process as above threshold ($5 >= $5)
  → Admin: ~$3.30 | Merchant: ~$1.70
""")
    
    print("="*80)
    
except Exception as e:
    print(f"\n❌ Error sending webhook: {str(e)}")

print(f"\n💡 TIP: Run the verification script to see actual results")
print(f"="*80 + "\n")
