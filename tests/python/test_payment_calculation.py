import requests
import json

BASE_URL = "https://sweep-nonce-fix.preview.emergentagent.com/api"

# First get payment data
print("1. Getting payment data...")
get_data_response = requests.post(f"{BASE_URL}/pay/getData", json={
    "d": "0a1983c581195e5d49cbd69c244f26dd34227a3b061b620f"
})

data = get_data_response.json()
print(f"Payment Data:")
print(json.dumps(data, indent=2))

# Get the token from the response
token = data.get("data", {}).get("token")
fee_payer = data.get("data", {}).get("fee_payer")
base_amount = data.get("data", {}).get("amount")

print(f"\n📋 Base Amount: ${base_amount}")
print(f"📋 Fee Payer: {fee_payer}")

if token:
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get currency rates
    print("\n2. Getting currency rates...")
    rates_response = requests.post(f"{BASE_URL}/pay/getCurrencyRates", 
        json={"amount": base_amount},
        headers=headers
    )
    
    rates_data = rates_response.json()
    print(f"\nCurrency Rates Response:")
    print(json.dumps(rates_data, indent=2))
    
    # Check configured currencies
    print("\n3. Getting configured currencies...")
    currencies_response = requests.get(f"{BASE_URL}/pay/configured-currencies", headers=headers)
    print(f"Configured currencies: {currencies_response.json()}")
