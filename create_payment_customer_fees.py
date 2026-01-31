import requests
import json

BASE_URL = "https://depend-installer-2.preview.emergentagent.com/api"

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
print("\n2. Creating $10 payment link (CUSTOMER pays ALL fees)...")
payment_data = {
    "email": "customer_fees_test@example.com",
    "amount": 10,
    "base_currency": "USD",
    "modes": ["CRYPTO"],
    "description": "Test Payment - Customer Pays Fees ($10 + fees)",
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
    data = result.get("data", {})
    
    print("\n" + "=" * 70)
    print("✅ PAYMENT LINK CREATED SUCCESSFULLY!")
    print("=" * 70)
    
    print(f"\n📋 Payment Configuration:")
    print(f"   Base Amount: ${data.get('base_amount', 10)} {data.get('base_currency', 'USD')}")
    print(f"   Fee Payer: {data.get('fee_payer', 'N/A')} 👈 CUSTOMER PAYS ALL FEES")
    print(f"   Description: {data.get('description', 'N/A')}")
    print(f"   Company ID: {data.get('company_id', 38)}")
    print(f"   Expires: {data.get('expires_at', '7d')}")
    
    payment_link = data.get('payment_link') or data.get('link') or data.get('url')
    link_id = data.get('link_id') or data.get('payment_id') or data.get('id')
    transaction_id = data.get('transaction_id')
    
    print(f"\n🔗 PAYMENT LINK:")
    print(f"   {payment_link}")
    
    print(f"\n🆔 Link ID: {link_id}")
    print(f"🆔 Transaction ID: {transaction_id}")
    
    # Now let's also show what the customer will actually pay
    print("\n" + "-" * 70)
    print("💰 FEE BREAKDOWN (What customer will pay):")
    print("-" * 70)
    
    # Get currency rates with fee_payer=customer to show actual amounts
    rates_response = requests.post(
        f"{BASE_URL}/pay/getCurrencyRates",
        json={
            "source": "USD",
            "amount": 10,
            "currencyList": ["BTC", "ETH", "USDT", "LTC", "TRX"],
            "fixedDecimal": False,
            "fee_payer": "customer"
        },
        headers=headers
    )
    
    if rates_response.status_code == 200:
        rates_data = rates_response.json().get("data", [])
        print(f"\n   Base Amount: $10.00 USD")
        print(f"\n   Customer pays (including fees):")
        for rate in rates_data:
            currency = rate.get('currency', 'N/A')
            base_amount = rate.get('amount', 0)
            total_amount = rate.get('total_amount', base_amount)
            fees = rate.get('fees', {})
            
            print(f"\n   📍 {currency}:")
            print(f"      Base crypto: {base_amount:.8f} {currency}")
            print(f"      Total (with fees): {total_amount:.8f} {currency}")
            if fees:
                print(f"      Fees breakdown:")
                print(f"        - Transaction fee: ${fees.get('transaction_fee_usd', 0):.2f}")
                print(f"        - Fixed fee: ${fees.get('fixed_fee_usd', 0):.2f}")
                print(f"        - Network fee: ${fees.get('network_fee_usd', 0):.2f}")
                print(f"        - Buffer: ${fees.get('buffer_fee_usd', 0):.2f}")
    
    print("\n" + "=" * 70)
    print("📝 NOTE: Customer will pay $10 + all fees = total amount shown above")
    print("         Merchant receives exactly $10 worth of crypto")
    print("=" * 70)
else:
    print(f"\n❌ Failed to create payment link")
    print(f"Response: {payment_response.text}")
