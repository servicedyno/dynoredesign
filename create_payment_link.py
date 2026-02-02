import requests
import json

BASE_URL = "https://dep-setup-5.preview.emergentagent.com/api"

# Login
print("1. Logging in as john@dyno.pt...")
login_response = requests.post(f"{BASE_URL}/user/login", json={
    "email": "john@dyno.pt",
    "password": "Katiekendra123@"
})

login_data = login_response.json()
token = login_data.get("data", {}).get("accessToken")

if not token:
    print(f"❌ Login failed: {login_response.text}")
    exit(1)

print("✅ Logged in successfully")

headers = {"Authorization": f"Bearer {token}"}

# Create payment link
print("\n2. Creating $10 payment link...")
payment_data = {
    "email": "customer@example.com",
    "amount": 10,
    "base_currency": "USD",
    "modes": ["CRYPTO"],
    "description": "Test Payment - $10 USD",
    "expire": "7d",
    "fee_payer": "customer",
    "company_id": 38
}

payment_response = requests.post(
    f"{BASE_URL}/pay/createPaymentLink",
    json=payment_data,
    headers=headers
)

print(f"   Status: {payment_response.status_code}")

if payment_response.status_code == 200:
    result = payment_response.json()
    print("\n✅ Payment Link Created Successfully!")
    print("=" * 60)
    
    data = result.get("data", {})
    
    print(f"\n📋 Payment Details:")
    print(f"   Amount: ${data.get('amount', 10)} {data.get('base_currency', 'USD')}")
    print(f"   Description: {data.get('description', 'N/A')}")
    print(f"   Company ID: {data.get('company_id', 38)}")
    print(f"   Fee Payer: {data.get('fee_payer', 'customer')}")
    print(f"   Expires: {data.get('expire', '7d')}")
    
    payment_link = data.get('payment_link') or data.get('link') or data.get('url')
    payment_id = data.get('payment_id') or data.get('id') or data.get('link_id')
    
    print(f"\n🔗 Payment Link:")
    print(f"   {payment_link}")
    
    print(f"\n🆔 Payment ID: {payment_id}")
    
    print("\n" + "=" * 60)
    print("Full Response:")
    print(json.dumps(result, indent=2))
else:
    print(f"\n❌ Failed to create payment link")
    print(f"Response: {payment_response.text}")
