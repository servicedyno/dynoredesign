import requests
import json

BASE_URL = "https://install-manager-5.preview.emergentagent.com/api"

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

# Create payment link with CUSTOMER paying fees
print("\n2. Creating $10 payment link (CUSTOMER pays fees)...")
payment_data = {
    "email": "customer3@example.com",
    "amount": 10,
    "base_currency": "USD",
    "modes": ["CRYPTO"],
    "description": "Test Payment - $10 USD (Customer Pays Fees)",
    "expire": "7d",
    "fee_payer": "customer",  # Customer pays fees
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
    print("\n" + "=" * 70)
    print("✅ PAYMENT LINK CREATED SUCCESSFULLY!")
    print("=" * 70)
    
    data = result.get("data", {})
    
    print(f"\n📋 Payment Details:")
    print(f"   Amount: ${data.get('base_amount', 10)} {data.get('base_currency', 'USD')}")
    print(f"   Description: {data.get('description', 'N/A')}")
    print(f"   Company ID: {data.get('company_id', 38)}")
    print(f"   Fee Payer: {data.get('fee_payer', 'N/A')} 👈 CUSTOMER PAYS FEES")
    print(f"   Expires: {data.get('expires_at', '7d')}")
    print(f"   Status: {data.get('status', 'pending')}")
    
    payment_link = data.get('payment_link') or data.get('link') or data.get('url')
    link_id = data.get('link_id') or data.get('payment_id') or data.get('id')
    transaction_id = data.get('transaction_id')
    
    print(f"\n🔗 PAYMENT LINK:")
    print(f"   {payment_link}")
    
    print(f"\n🆔 Link ID: {link_id}")
    print(f"🆔 Transaction ID: {transaction_id}")
    
    print("\n" + "=" * 70)
else:
    print(f"\n❌ Failed to create payment link")
    print(f"Response: {payment_response.text}")
