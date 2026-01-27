import requests
import json

# Configuration
BASE_URL = "https://simple-setup-6.preview.emergentagent.com"

print("=" * 70)
print("TESTNET PAYMENT CREATION - SEPOLIA ETH")
print("=" * 70)

# Step 1: Login with existing user
print("\n[1] Logging in...")
login_response = requests.post(
    f"{BASE_URL}/api/user/login",
    json={"email": "moxxcompany@gmail.com", "password": "Moxx2024"}
)
print(f"Status: {login_response.status_code}")

if login_response.status_code != 200:
    print(f"Login failed: {login_response.text[:500]}")
    # Try alternative user
    print("\nTrying alternative credentials...")
    login_response = requests.post(
        f"{BASE_URL}/api/user/login",
        json={"email": "admin@dynopay.com", "password": "admin123"}
    )
    if login_response.status_code != 200:
        print("Alternative login also failed. Using signup endpoint...")
        # Create new user
        signup_data = {
            "name": "Testnet User",
            "email": "testnet@dynopay.local",
            "password": "TestPass123!",
            "mobile": "+1234567890"
        }
        signup_response = requests.post(f"{BASE_URL}/api/user/signup", json=signup_data)
        if signup_response.status_code not in [200, 201]:
            print(f"Signup failed: {signup_response.text[:500]}")
            exit(1)
        token = signup_response.json()["data"]["token"]
    else:
        token = login_response.json()["data"]["token"]
else:
    token = login_response.json()["data"]["token"]

print(f"✅ Authenticated successfully")
headers = {"Authorization": f"Bearer {token}"}

# Step 2: Get companies
print("\n[2] Getting user companies...")
companies_response = requests.get(f"{BASE_URL}/api/company/getCompany", headers=headers)
print(f"Status: {companies_response.status_code}")

if companies_response.status_code == 200:
    companies = companies_response.json().get("data", [])
    if companies:
        company = companies[0]
        company_id = company["company_id"]
        company_name = company.get("company_name", "Unknown")
        print(f"✅ Using Company: {company_name} (ID: {company_id})")
    else:
        print("No companies found. Creating one...")
        company_data = {
            "company_name": "Testnet Payment Company",
            "email": "testnet@dynopay.local",
            "mobile": "+1234567890",
            "address_line1": "123 Blockchain St"
        }
        form_data = {"data": json.dumps(company_data)}
        create_response = requests.post(
            f"{BASE_URL}/api/company/addCompany",
            headers=headers,
            data=form_data
        )
        if create_response.status_code == 200:
            company_id = create_response.json()["data"]["company_id"]
            print(f"✅ Company created (ID: {company_id})")
        else:
            print(f"❌ Failed to create company: {create_response.text[:500]}")
            exit(1)
else:
    print(f"❌ Failed to get companies: {companies_response.text[:500]}")
    exit(1)

# Step 3: Get or create API key
print("\n[3] Getting API keys...")
api_response = requests.get(f"{BASE_URL}/api/userApi/getApi", headers=headers)
print(f"Status: {api_response.status_code}")

api_key = None
if api_response.status_code == 200:
    api_data = api_response.json().get("data", {})
    # Check for production keys
    production_keys = api_data.get("production", [])
    if production_keys:
        api_key = production_keys[0].get("apiKey")
        print(f"✅ Using existing API key: {api_key[:20]}...")
    else:
        print("No API keys found. Need to create one...")
        print("Note: API key creation requires wallet addresses")

# Step 4: Create payment link (works without API key for authenticated users)
print("\n[4] Creating testnet payment link...")
print("=" * 70)

payment_data = {
    "email": "customer@testnet.local",
    "amount": 0.01,  # 0.01 ETH
    "currency": "ETH",
    "modes": ["ETH"],
    "description": "Testnet Payment - Sepolia ETH Test",
    "expire": "24h",
    "callback_url": f"{BASE_URL}/api/callback/test",
    "webhook_url": f"{BASE_URL}/api/webhook/test"
}

if company_id:
    payment_data["company_id"] = company_id

print(f"Payment data: {json.dumps(payment_data, indent=2)}")

payment_response = requests.post(
    f"{BASE_URL}/api/pay/createPaymentLink",
    headers=headers,
    json=payment_data
)

print(f"\n📊 Status: {payment_response.status_code}")
print(f"📊 Response:")
print(json.dumps(payment_response.json(), indent=2))

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
    
    # Extract payment address if available
    if "address" in result or "wallet_address" in result:
        address = result.get("address") or result.get("wallet_address")
        print(f"\n💳 Payment Address: {address}")
        print("\n" + "=" * 70)
        print("📤 SEND TESTNET SEPOLIA ETH TO THIS ADDRESS")
        print("=" * 70)
    else:
        print("\n💡 Visit the payment URL to get the payment address")
    
    print(f"\n📊 Monitor transaction: GET {BASE_URL}/api/pay/links/{link_id}")
    print(f"📊 Check all transactions: POST {BASE_URL}/api/wallet/getAllTransactions")
    
else:
    print(f"\n❌ Failed to create payment link")
    print("Check if wallets are configured or if API key is needed")

print("\n" + "=" * 70)
print("Ready to receive Sepolia testnet payment!")
print("=" * 70)
