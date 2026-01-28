#!/usr/bin/env python3
"""
Create Direct ETH Payment Address using API Service
Returns ETH address directly without payment link
"""

import requests
import json

# Configuration
BACKEND_URL = "http://localhost:8001"
API_SERVICE_URL = "http://localhost:3301"
EMAIL = "john@dyno.pt"
PASSWORD = "Katiekendra123@"

def create_direct_eth_payment():
    print("=" * 80)
    print("DIRECT ETH PAYMENT ADDRESS GENERATION")
    print("=" * 80)
    print()
    
    # Step 1: Login as merchant
    print("Step 1: Authenticating merchant...")
    login_response = requests.post(
        f"{BACKEND_URL}/api/user/login",
        json={"email": EMAIL, "password": PASSWORD}
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.text}")
        return
    
    login_data = login_response.json()
    merchant_token = login_data["data"]["accessToken"]
    user_id = login_data["data"]["userData"]["user_id"]
    print(f"✅ Authenticated as user_id: {user_id}")
    print()
    
    # Step 2: Get company
    print("Step 2: Getting company info...")
    headers = {"Authorization": f"Bearer {merchant_token}"}
    company_response = requests.get(
        f"{BACKEND_URL}/api/company/getCompany",
        headers=headers
    )
    
    companies = company_response.json()["data"]
    company_id = companies[0]["company_id"]
    company_name = companies[0]["company_name"]
    print(f"✅ Company: {company_name} (ID: {company_id})")
    print()
    
    # Step 3: Get API keys
    print("Step 3: Retrieving API keys...")
    api_response = requests.get(
        f"{BACKEND_URL}/api/userApi/getApi",
        headers=headers,
        params={"company_id": company_id}
    )
    
    if api_response.status_code != 200:
        print(f"❌ Failed to get API keys: {api_response.text}")
        return
    
    api_data = api_response.json()
    if "data" in api_data and api_data["data"]:
        if "all" in api_data["data"]:
            all_keys = api_data["data"]["all"]
        else:
            all_keys = api_data["data"]
        
        if all_keys:
            api_key = all_keys[0].get("apiKey") or all_keys[0].get("api_key")
            print(f"✅ API Key: {api_key[:20]}...")
            print()
        else:
            print("❌ No API keys found")
            return
    else:
        print("❌ No API keys found")
        return
    
    # Step 4: Create customer (if needed) or use existing
    print("Step 4: Creating/Getting customer...")
    
    # For testing, let's create a test customer
    customer_email = "test@customer.com"
    customer_response = requests.post(
        f"{API_SERVICE_URL}/user/createUser",
        json={
            "apiKey": api_key,
            "email": customer_email,
            "name": "Test Customer"
        }
    )
    
    if customer_response.status_code == 200:
        customer_data = customer_response.json()
        customer_token = customer_data["data"]["token"]
        print(f"✅ Customer created/retrieved: {customer_email}")
        print(f"   Token: {customer_token[:30]}...")
    else:
        # Customer might already exist, try to get existing
        print(f"⚠️  Customer creation response: {customer_response.status_code}")
        print(f"   Trying with existing customer...")
        # For now, we'll need to handle this differently
        # Let's assume we have a customer token
        customer_token = None
    
    print()
    
    # Step 5: Create direct crypto payment
    print("Step 5: Creating direct ETH payment...")
    print("-" * 80)
    
    if not customer_token:
        print("⚠️  Need customer token to proceed")
        print()
        print("ALTERNATIVE: Let me try calling the endpoint directly")
        print()
    
    # Try with API key auth
    crypto_payment_response = requests.post(
        f"{API_SERVICE_URL}/user/cryptoPayment",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        json={
            "apiKey": api_key,
            "amount": 10,
            "currency": "ETH",
            "fee_payer": "company",
            "meta_data": {
                "description": "Test $10 ETH payment"
            }
        }
    )
    
    print(f"Response Status: {crypto_payment_response.status_code}")
    print(f"Response: {crypto_payment_response.text[:500]}")
    print()
    
    if crypto_payment_response.status_code == 200:
        payment_data = crypto_payment_response.json()
        
        print("=" * 80)
        print("✅ ETH PAYMENT ADDRESS GENERATED!")
        print("=" * 80)
        print()
        print("💰 PAYMENT DETAILS:")
        print(f"   Transaction ID: {payment_data['data']['transaction_id']}")
        print(f"   Amount: $10.00 USD")
        print(f"   Crypto Amount: {payment_data['data']['crypto_amount']} ETH")
        print()
        print("📍 PAYMENT ADDRESS:")
        print(f"   {payment_data['data']['address']}")
        print()
        print("📱 QR CODE:")
        print(f"   {payment_data['data']['qr_code']}")
        print()
        print("=" * 80)
        print("🎯 SEND ETH TO THIS ADDRESS TO COMPLETE PAYMENT")
        print("=" * 80)
        print()
        
        return payment_data['data']
    else:
        print(f"❌ Failed to create payment: {crypto_payment_response.text}")
        return None

if __name__ == "__main__":
    result = create_direct_eth_payment()
    
    if result:
        print("\n📋 Payment Summary:")
        print(json.dumps(result, indent=2))
