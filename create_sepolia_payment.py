import requests
import json

# Configuration
BASE_URL = "https://simple-setup-6.preview.emergentagent.com"
USER_EMAIL = "john@dyno.pt"
USER_PASSWORD = "Katiekendra123@"

print("=" * 70)
print("SEPOLIA TESTNET PAYMENT LINK CREATION")
print("=" * 70)

# Step 1: Login
print("\n[1] Logging in as john@dyno.pt...")
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
        print(f"   Company Details: {json.dumps(company, indent=2)}")

# Step 3: Check wallet configuration
print("\n[3] Checking wallet configuration...")
wallet_response = requests.get(f"{BASE_URL}/api/wallet/getWallet", headers=headers)
if wallet_response.status_code == 200:
    wallets = wallet_response.json().get("data", [])
    print(f"   Found {len(wallets)} wallets")
    eth_wallets = [w for w in wallets if w.get('wallet_type') == 'ETH']
    if eth_wallets:
        print(f"   ✅ ETH wallets configured: {len(eth_wallets)}")
        for w in eth_wallets[:3]:
            addr = w.get('wallet_address', 'N/A')
            print(f"      - {addr[:10]}...{addr[-8:]}")

# Step 4: Create payment link
print("\n[4] Creating Sepolia testnet payment link...")
print("=" * 70)

payment_data = {
    "email": "customer@testnet.local",
    "amount": 0.01,  # 0.01 ETH
    "modes": ["ETH"],
    "description": "Sepolia Testnet Payment - Monitor Test",
    "expire": "24h",
    "callback_url": f"{BASE_URL}/api/callback/test",
    "webhook_url": f"{BASE_URL}/api/webhook/test"
}

if company_id:
    payment_data["company_id"] = company_id

print(f"Request: {json.dumps(payment_data, indent=2)}")

payment_response = requests.post(
    f"{BASE_URL}/api/pay/createPaymentLink",
    headers=headers,
    json=payment_data
)

print(f"\n📊 Status: {payment_response.status_code}")

if payment_response.status_code == 200:
    result = payment_response.json()["data"]
    print(f"📊 Response: {json.dumps(result, indent=2)}")
    
    payment_url = result.get("payment_link") or result.get("paymentLink")
    link_id = result.get("link_id") or result.get("transaction_id")
    
    print("\n" + "=" * 70)
    print("✅ PAYMENT LINK CREATED SUCCESSFULLY!")
    print("=" * 70)
    print(f"\n🔗 Payment URL: {payment_url}")
    print(f"🆔 Link ID: {link_id}")
    print(f"💰 Amount: 0.01 ETH (Sepolia Testnet)")
    
    # Get payment details
    print("\n[5] Getting payment link details...")
    details_response = requests.get(
        f"{BASE_URL}/api/pay/links/{link_id}",
        headers=headers
    )
    if details_response.status_code == 200:
        details = details_response.json()["data"]
        print(f"Payment Details: {json.dumps(details, indent=2)}")
    
    print("\n" + "=" * 70)
    print("📤 READY TO RECEIVE SEPOLIA ETH")
    print("=" * 70)
    print("\n💡 Send Sepolia testnet ETH to the payment address")
    print("💡 I will monitor the backend logs for confirmation")
    print(f"💡 Check status: GET {BASE_URL}/api/pay/links/{link_id}")
    
else:
    print(f"\n❌ Failed to create payment link")
    print(f"Response: {payment_response.text}")

print("\n" + "=" * 70)
