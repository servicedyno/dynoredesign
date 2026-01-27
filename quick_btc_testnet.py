"""
Quick BTC Testnet Address Generator
Generates a testnet BTC address using Tatum API directly
"""

import requests
import json

print("\n" + "="*80)
print("🪙 BTC TESTNET ADDRESS GENERATOR (Quick Method)")
print("="*80)

TATUM_TESTNET_KEY = "t-6706960c3810b72fabd57312-0b90f3309efe42c593331b11"

# Step 1: Generate wallet
print("\n📋 Step 1: Generating BTC testnet wallet...")
wallet_response = requests.get(
    "https://api.tatum.io/v3/bitcoin/wallet",
    headers={"x-api-key": TATUM_TESTNET_KEY}
)

if wallet_response.status_code != 200:
    print(f"❌ Failed to generate wallet: {wallet_response.text}")
    exit(1)

wallet_data = wallet_response.json()
xpub = wallet_data.get('xpub')
mnemonic = wallet_data.get('mnemonic')

print(f"✅ Wallet generated")
print(f"   XPUB: {xpub[:20]}...")
print(f"   Type: {'TESTNET (tpub)' if xpub.startswith('tpub') else 'Check prefix'}")

# Step 2: Generate first address
print("\n📋 Step 2: Generating testnet address...")
address_response = requests.get(
    f"https://api.tatum.io/v3/bitcoin/address/{xpub}/0",
    headers={"x-api-key": TATUM_TESTNET_KEY}
)

if address_response.status_code != 200:
    print(f"❌ Failed to generate address: {address_response.text}")
    exit(1)

address_data = address_response.json()
btc_address = address_data.get('address')

print(f"✅ Address generated")
print(f"   Address: {btc_address}")
print(f"   Type: {'TESTNET' if btc_address.startswith(('tb1', 'm', 'n', '2')) else 'UNKNOWN'}")

# Step 3: Create webhook subscription
print("\n📋 Step 3: Creating Tatum webhook...")
webhook_url = "https://new-setup.preview.emergentagent.com/api/tatum-crypto-webhook"

webhook_response = requests.post(
    "https://api.tatum.io/v3/subscription",
    headers={
        "x-api-key": TATUM_TESTNET_KEY,
        "Content-Type": "application/json"
    },
    json={
        "type": "ADDRESS_TRANSACTION",
        "attr": {
            "address": btc_address,
            "chain": "bitcoin-testnet",
            "url": webhook_url
        }
    }
)

if webhook_response.status_code in [200, 201]:
    subscription = webhook_response.json()
    subscription_id = subscription.get('id')
    print(f"✅ Webhook created: {subscription_id}")
else:
    print(f"⚠️  Webhook creation failed (not critical): {webhook_response.text[:100]}")
    subscription_id = None

# Save data
data = {
    "address": btc_address,
    "xpub": xpub,
    "subscription_id": subscription_id,
    "expected_amount": "0.0001 BTC (~$10)",
    "network": "bitcoin-testnet"
}

with open("/app/btc_testnet_quick.json", "w") as f:
    json.dump(data, f, indent=2)

print("\n" + "="*80)
print("🎯 BTC TESTNET ADDRESS GENERATED!")
print("="*80)
print(f"\n💰 SEND TESTNET BTC TO:")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print(f"   {btc_address}")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

print("\n📍 GET TESTNET BTC FROM:")
print("   1. https://coinfaucet.eu/en/btc-testnet/ (BEST - instant)")
print("   2. https://testnet-faucet.mempool.co/")
print("   3. https://bitcoinfaucet.undo.it/")

print("\n🔍 MONITOR PAYMENT:")
print(f"   tail -f /var/log/supervisor/backend.out.log | grep '{btc_address}'")

print("\n✅ Data saved to: /app/btc_testnet_quick.json")
print("="*80 + "\n")
