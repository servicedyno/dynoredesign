#!/usr/bin/env python3
"""
Test BCH Payment Creation for john@dyno.pt
Creates a $10 BCH payment using the merchant pool system
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8001"
EMAIL = "john@dyno.pt"
PASSWORD = "Katiekendra123@"

def test_bch_payment():
    print("=" * 60)
    print("BCH PAYMENT CREATION TEST")
    print("=" * 60)
    print(f"Testing with user: {EMAIL}")
    print(f"Amount: $10 USD")
    print(f"Currency: BCH")
    print()
    
    # Step 1: Login
    print("Step 1: Authenticating...")
    login_response = requests.post(
        f"{BASE_URL}/api/user/login",
        json={
            "email": EMAIL,
            "password": PASSWORD
        }
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.text}")
        return
    
    login_data = login_response.json()
    token = login_data["data"]["accessToken"]
    user_id = login_data["data"]["userData"]["user_id"]
    print(f"✅ Authenticated as user_id: {user_id}")
    print()
    
    # Step 2: Get Company
    print("Step 2: Getting company...")
    headers = {"Authorization": f"Bearer {token}"}
    company_response = requests.get(
        f"{BASE_URL}/api/company/getCompany",
        headers=headers
    )
    
    if company_response.status_code != 200:
        print(f"❌ Failed to get company: {company_response.text}")
        return
    
    companies = company_response.json()["data"]
    if not companies:
        print("❌ No companies found")
        return
    
    company_id = companies[0]["company_id"]
    company_name = companies[0]["company_name"]
    print(f"✅ Using company: {company_name} (ID: {company_id})")
    print()
    
    # Step 3: Check configured currencies
    print("Step 3: Checking configured currencies...")
    currencies_response = requests.get(
        f"{BASE_URL}/api/wallet/configured-currencies",
        headers=headers,
        params={"company_id": company_id}
    )
    
    if currencies_response.status_code == 200:
        currencies_data = currencies_response.json()
        configured = currencies_data.get("data", {}).get("configured_currencies", [])
        print(f"✅ Configured currencies: {', '.join([c['currency'] for c in configured])}")
        
        # Check if BCH is configured
        bch_configured = any(c['currency'] == 'BCH' for c in configured)
        if not bch_configured:
            print("⚠️  BCH not in configured currencies - merchant pool will create on-demand")
        print()
    
    # Step 4: Get API Key (needed for payment creation)
    print("Step 4: Getting API key...")
    api_response = requests.get(
        f"{BASE_URL}/api/userApi/getApi",
        headers=headers,
        params={"company_id": company_id}
    )
    
    if api_response.status_code != 200:
        print(f"❌ Failed to get API key: {api_response.text}")
        return
    
    api_data = api_response.json()
    if "data" in api_data and api_data["data"]:
        # Check if it's grouped format or array
        if "all" in api_data["data"]:
            all_keys = api_data["data"]["all"]
        else:
            all_keys = api_data["data"]
        
        if all_keys:
            api_key = all_keys[0].get("apiKey") or all_keys[0].get("api_key")
            admin_token = all_keys[0].get("adminToken") or all_keys[0].get("admin_token")
            print(f"✅ API Key found: {api_key[:20]}...")
            print()
        else:
            print("❌ No API keys found - please create one first")
            return
    else:
        print("❌ No API keys found - please create one first")
        return
    
    # Step 5: Create Payment Link (using merchant API)
    print("Step 5: Creating payment link with BCH support...")
    # Using the merchant API to create a payment link
    payment_link_response = requests.post(
        f"{BASE_URL}/api/pay/createPaymentLink",
        json={
            "apiKey": api_key,
            "adminToken": admin_token,
            "amount": 10,
            "currency": "USD",
            "email": "customer@test.com",
            "description": "Test BCH Payment - $10",
            "availableCurrencies": ["BCH"]  # Only BCH
        }
    )
    
    if payment_link_response.status_code != 200:
        print(f"❌ Payment link creation failed: {payment_link_response.text}")
        # Try alternative approach - direct Redis payment data
        print("\nTrying alternative approach...")
        return create_payment_alternative(headers, company_id)
    
    payment_link_data = payment_link_response.json()
    print(f"✅ Payment link created:")
    print(f"   Reference: {payment_link_data.get('data', {}).get('uniqueRef', 'N/A')}")
    print(f"   Link: {payment_link_data.get('data', {}).get('paymentLink', 'N/A')}")
    print()
    
    # Step 6: Select BCH currency (this triggers address generation)
    unique_ref = payment_link_data.get("data", {}).get("uniqueRef")
    if unique_ref:
        print("Step 6: Selecting BCH currency (triggers merchant pool address generation)...")
        crypto_response = requests.post(
            f"{BASE_URL}/api/pay/createCryptoPayment",
            json={
                "uniqueRef": unique_ref,
                "currency": "BCH"
            }
        )
        
        if crypto_response.status_code == 200:
            crypto_data = crypto_response.json()
            print(f"✅ BCH payment address generated:")
            print(f"   Address: {crypto_data.get('data', {}).get('cryptoAddress', 'N/A')}")
            print(f"   Amount (BCH): {crypto_data.get('data', {}).get('crypto_amount', 'N/A')}")
            print(f"   Amount (USD): ${crypto_data.get('data', {}).get('base_amount', 10)}")
            print()
            print("=" * 60)
            print("✅ BCH PAYMENT CREATED SUCCESSFULLY!")
            print("=" * 60)
            return crypto_data
        else:
            print(f"❌ BCH address generation failed: {crypto_response.text}")
    
    return None

def create_payment_alternative(headers, company_id):
    """Alternative approach if payment link API doesn't work"""
    print("\nAlternative: Using wallet endpoint to check BCH support...")
    
    # Check wallets
    wallet_response = requests.get(
        f"{BASE_URL}/api/wallet/getWallet",
        headers=headers,
        params={"company_id": company_id}
    )
    
    if wallet_response.status_code == 200:
        wallets = wallet_response.json().get("data", [])
        bch_wallet = next((w for w in wallets if w.get("wallet_type") == "BCH"), None)
        
        if bch_wallet:
            print(f"✅ BCH wallet found:")
            print(f"   Type: {bch_wallet.get('wallet_type')}")
            print(f"   Balance: {bch_wallet.get('balance', 0)} BCH")
            print("\n⚠️  Note: Direct BCH payment creation requires payment link flow")
            print("   The merchant pool will generate BCH address on-demand when payment is created")
        else:
            print("❌ No BCH wallet found")
            print("   Merchant pool will create BCH wallet on first use")
    
    return None

if __name__ == "__main__":
    result = test_bch_payment()
    
    if result:
        print("\n📊 Payment Summary:")
        print(json.dumps(result, indent=2))
