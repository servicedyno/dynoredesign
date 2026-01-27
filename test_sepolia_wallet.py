import requests
import json

# Configuration
BASE_URL = "https://simple-setup-6.preview.emergentagent.com"
TEST_USER = "nomadly@moxx.co"
TEST_PASSWORD = "Password123!"

print("=" * 60)
print("SEPOLIA TESTNET WALLET ADDITION TEST")
print("=" * 60)

# Step 1: Login
print("\n[1] Authenticating user...")
login_response = requests.post(
    f"{BASE_URL}/api/user/login",
    json={"email": TEST_USER, "password": TEST_PASSWORD}
)
print(f"Status: {login_response.status_code}")

if login_response.status_code != 200:
    print(f"Login failed: {login_response.text}")
    exit(1)

token = login_response.json()["data"]["token"]
print(f"✅ Authenticated successfully")

headers = {"Authorization": f"Bearer {token}"}

# Step 2: Get user companies
print("\n[2] Getting user companies...")
companies_response = requests.get(f"{BASE_URL}/api/company/getCompany", headers=headers)
print(f"Status: {companies_response.status_code}")

if companies_response.status_code == 200:
    companies = companies_response.json().get("data", [])
    if companies:
        company_id = companies[0]["company_id"]
        company_name = companies[0].get("company_name", "Unknown")
        print(f"✅ Using Company: {company_name} (ID: {company_id})")
    else:
        print("❌ No companies found. Creating test company...")
        # Create company
        company_data = {
            "company_name": "Sepolia Test Company",
            "email": TEST_USER,
            "mobile": "+1234567890",
            "address_line1": "123 Test St"
        }
        create_company_response = requests.post(
            f"{BASE_URL}/api/company/addCompany",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            data=json.dumps({"data": json.dumps(company_data)})
        )
        print(f"Create company status: {create_company_response.status_code}")
        print(f"Response: {create_company_response.text[:500]}")
        
        if create_company_response.status_code == 200:
            company_id = create_company_response.json()["data"]["company_id"]
            print(f"✅ Company created with ID: {company_id}")
        else:
            print("❌ Failed to create company")
            exit(1)
else:
    print(f"❌ Failed to get companies: {companies_response.text}")
    exit(1)

# Step 3: Try to add Sepolia ETH address
print("\n[3] Adding Sepolia ETH testnet address...")
print("Testing with Sepolia address: 0x742d35Cc6634C0532925a3b8D4C9db96590c6C87")

wallet_data = {
    "wallet_address": "0x742d35Cc6634C0532925a3b8D4C9db96590c6C87",
    "currency": "ETH",
    "wallet_name": "Sepolia Test Wallet",
    "company_id": company_id
}

validate_response = requests.post(
    f"{BASE_URL}/api/wallet/validateWallet",
    headers=headers,
    json=wallet_data
)

print(f"Status: {validate_response.status_code}")
print(f"Response: {json.dumps(validate_response.json(), indent=2)}")

if validate_response.status_code == 200:
    print("\n✅ Wallet validation successful! OTP should be sent to email.")
    print("\n[4] Check your email for OTP and use it to verify the wallet")
    print(f"Use POST {BASE_URL}/api/wallet/verifyOtp with:")
    print(json.dumps({
        "otp": "YOUR_OTP_HERE",
        "wallet_address": wallet_data["wallet_address"],
        "currency": wallet_data["currency"],
        "wallet_name": wallet_data["wallet_name"],
        "company_id": company_id
    }, indent=2))
else:
    print(f"\n❌ Wallet validation failed")
    print("Check the backend logs above for detailed error information")

print("\n" + "=" * 60)
