import requests
import json

# Configuration
BASE_URL = "https://simple-setup-6.preview.emergentagent.com"
USER_EMAIL = "nomadly@moxx.co"
USER_PASSWORD = "Katiekendra123@"

print("=" * 70)
print("SEPOLIA TESTNET PAYMENT LINK CREATION")
print("=" * 70)

# Step 1: Login
print("\n[1] Logging in as nomadly@moxx.co...")
login_response = requests.post(
    f"{BASE_URL}/api/user/login",
    json={"email": USER_EMAIL, "password": USER_PASSWORD}
)
print(f"Status: {login_response.status_code}")

if login_response.status_code != 200:
    print(f"❌ Login failed: {login_response.text}")
    exit(1)

token = login_response.json()["data"]["token"]
print(f"✅ Authenticated successfully")
headers = {"Authorization": f"Bearer {token}"}

# Step 2: Get companies
print("\n[2] Getting user companies...")
companies_response = requests.get(f"{BASE_URL}/api/company/getCompany", headers=headers)
print(f"Status: {companies_response.status_code}")

company_id = None
if companies_response.status_code == 200:
    companies = companies_response.json().get("data", [])
    if companies:
        company = companies[0]
        company_id = company["company_id"]
        company_name = company.get("company_name", "Unknown")
        print(f"✅ Using Company: {company_name} (ID: {company_id})")

# Step 3: Check wallets
print("\n[3] Checking wallet configuration...")
wallet_response = requests.get(f"{BASE_URL}/api/wallet/getWallet", headers=headers)
if wallet_response.status_code == 200:
    wallets = wallet_response.json().get("data", [])
    print(f"   Total wallets: {len(wallets)}")
    eth_wallets = [w for w in wallets if w.get('wallet_type') == 'ETH']
    if eth_wallets:
        print(f"   ✅ ETH wallets: {len(eth_wallets)}")

# Step 4: Create payment link
print("\n[4] Creating Sepolia testnet payment link...")
print("=" * 70)

payment_data = {
    "email": "customer@testnet.local",
    "amount": 0.01,  # 0.01 ETH (~$30 USD at current prices)
    "modes": ["ETH"],
    "description": "🧪 Sepolia Testnet Payment - Flow Monitoring Test",
    "expire": "24h"
}

if company_id:
    payment_data["company_id"] = company_id

print(f"Creating payment with data:")
print(json.dumps(payment_data, indent=2))

payment_response = requests.post(
    f"{BASE_URL}/api/pay/createPaymentLink",
    headers=headers,
    json=payment_data
)

print(f"\n📊 Status: {payment_response.status_code}")

if payment_response.status_code == 200:
    result = payment_response.json()["data"]
    
    payment_url = result.get("payment_link") or result.get("paymentLink")
    link_id = result.get("link_id") or result.get("transaction_id")
    
    print("\n" + "=" * 70)
    print("✅ PAYMENT LINK CREATED SUCCESSFULLY!")
    print("=" * 70)
    print(f"\n🔗 Payment URL: {payment_url}")
    print(f"🆔 Link ID: {link_id}")
    print(f"💰 Amount: 0.01 ETH (Sepolia Testnet)")
    print(f"📝 Description: {payment_data['description']}")
    
    # Get detailed payment link info
    print("\n[5] Getting payment address...")
    details_response = requests.get(
        f"{BASE_URL}/api/pay/links/{link_id}",
        headers=headers
    )
    
    if details_response.status_code == 200:
        details = details_response.json()["data"]
        
        print("\n" + "=" * 70)
        print("📍 PAYMENT ADDRESS INFORMATION")
        print("=" * 70)
        
        # Try to get the payment address from the details
        payment_address = details.get("payment_address") or details.get("address") or details.get("wallet_address")
        
        if payment_address:
            print(f"\n💳 Send Sepolia ETH to: {payment_address}")
        else:
            print(f"\nFull payment details:")
            print(json.dumps(details, indent=2))
    
    print("\n" + "=" * 70)
    print("🎯 READY FOR TESTING")
    print("=" * 70)
    print(f"\n1️⃣  Send Sepolia testnet ETH to the payment address above")
    print(f"2️⃣  I will monitor logs to track:")
    print(f"    - Payment detection")
    print(f"    - Payment confirmation")
    print(f"    - Fund distribution to merchant")
    print(f"    - Admin sweep (if threshold > $5 USD)")
    print(f"    - Webhook callbacks")
    print(f"\n3️⃣  Monitor endpoints:")
    print(f"    GET {BASE_URL}/api/pay/links/{link_id}")
    print(f"    POST {BASE_URL}/api/wallet/getAllTransactions")
    
else:
    print(f"\n❌ Failed to create payment link")
    print(f"Response: {payment_response.text}")

print("\n" + "=" * 70)
print("Waiting for your Sepolia payment...")
print("=" * 70)
