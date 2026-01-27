import requests
import json
import time

# Configuration
BASE_URL = "https://simple-setup-6.preview.emergentagent.com"
TEST_EMAIL = f"sepolia.test.{int(time.time())}@example.com"
TEST_PASSWORD = "TestPass123!"
TEST_NAME = "Sepolia Tester"

print("=" * 60)
print("SEPOLIA TESTNET WALLET ADDITION TEST")
print("=" * 60)

# Step 1: Register new user
print("\n[1] Registering new test user...")
print(f"Email: {TEST_EMAIL}")

register_response = requests.post(
    f"{BASE_URL}/api/user/register",
    json={
        "name": TEST_NAME,
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "mobile": "+1234567890"
    }
)
print(f"Status: {register_response.status_code}")
print(f"Response: {register_response.text[:200]}")

if register_response.status_code not in [200, 201]:
    print(f"❌ Registration failed")
    exit(1)

token = register_response.json()["data"]["token"]
print(f"✅ User registered successfully")

headers = {"Authorization": f"Bearer {token}"}

# Step 2: Create a company
print("\n[2] Creating test company...")
company_data = {
    "company_name": "Sepolia Testnet Company",
    "email": TEST_EMAIL,
    "mobile": "+1234567890",
    "address_line1": "123 Sepolia Street"
}

# Use multipart form-data format
form_data = {"data": json.dumps(company_data)}
create_company_response = requests.post(
    f"{BASE_URL}/api/company/addCompany",
    headers={"Authorization": f"Bearer {token}"},
    data=form_data
)
print(f"Status: {create_company_response.status_code}")
print(f"Response: {create_company_response.text[:500]}")

if create_company_response.status_code == 200:
    company_id = create_company_response.json()["data"]["company_id"]
    print(f"✅ Company created with ID: {company_id}")
else:
    print("❌ Failed to create company")
    exit(1)

# Step 3: Try to add Sepolia ETH address
print("\n[3] Adding Sepolia ETH testnet address...")
print("=" * 60)
print("🔍 WATCH THE BACKEND LOGS NOW!")
print("=" * 60)
print("\nTesting with Sepolia address: 0x742d35Cc6634C0532925a3b8D4C9db96590c6C87")

wallet_data = {
    "wallet_address": "0x742d35Cc6634C0532925a3b8D4C9db96590c6C87",
    "currency": "ETH",
    "wallet_name": "Sepolia Test Wallet",
    "company_id": company_id
}

print(f"\nSending request to: {BASE_URL}/api/wallet/validateWallet")
print(f"Request body: {json.dumps(wallet_data, indent=2)}")

validate_response = requests.post(
    f"{BASE_URL}/api/wallet/validateWallet",
    headers=headers,
    json=wallet_data
)

print(f"\n📊 Response Status: {validate_response.status_code}")
print(f"📊 Response Body:")
print(json.dumps(validate_response.json(), indent=2))

if validate_response.status_code == 200:
    print("\n✅ SUCCESS! Wallet validation passed!")
    print("\n[4] OTP sent to email. To complete wallet addition, use:")
    print(f"POST {BASE_URL}/api/wallet/verifyOtp")
    print("Body:")
    print(json.dumps({
        "otp": "CHECK_EMAIL_FOR_OTP",
        "wallet_address": wallet_data["wallet_address"],
        "currency": wallet_data["currency"],
        "wallet_name": wallet_data["wallet_name"],
        "company_id": company_id
    }, indent=2))
else:
    print(f"\n❌ FAILED! Wallet validation error")
    print("\n💡 Check backend logs above for detailed error trace")

print("\n" + "=" * 60)
print("Test completed. Review backend logs for validation details.")
print("=" * 60)
