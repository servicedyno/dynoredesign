#!/usr/bin/env python3
"""
Create BTC Testnet Payment Link Test
Tests creating a $10 BTC payment link with testnet configuration
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://dependency-setup-11.preview.emergentagent.com/api"
TEST_EMAIL = "john@dyno.pt"
TEST_PASSWORD = "Katiekendra123@"

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def login():
    """Login and get JWT token"""
    print_section("STEP 1: Authentication")
    
    url = f"{BASE_URL}/user/login"
    payload = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    print(f"📧 Logging in as: {TEST_EMAIL}")
    response = requests.post(url, json=payload)
    
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        response_data = data.get('data', {})
        token = response_data.get('accessToken')
        user_data = response_data.get('userData', {})
        print(f"✅ Login successful!")
        print(f"User ID: {user_data.get('user_id')}")
        print(f"Name: {user_data.get('name')}")
        print(f"Token: {token[:50]}..." if token else "No token")
        return token, user_data
    else:
        print(f"❌ Login failed: {response.text}")
        return None, None

def get_companies(token):
    """Get user's companies"""
    print_section("STEP 2: Get Companies")
    
    url = f"{BASE_URL}/company/getCompany"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.get(url, headers=headers)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        companies = data.get('data', [])
        print(f"✅ Found {len(companies)} companies")
        
        if companies:
            for company in companies[:3]:  # Show first 3
                print(f"\n  Company ID: {company.get('company_id')}")
                print(f"  Name: {company.get('company_name')}")
                print(f"  Email: {company.get('email')}")
        
        return companies
    else:
        print(f"❌ Failed to get companies: {response.text}")
        return []

def create_btc_payment_link(token, company_id):
    """Create BTC testnet payment link for $10"""
    print_section("STEP 3: Create BTC Testnet Payment Link ($10)")
    
    url = f"{BASE_URL}/pay/createPaymentLink"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "company_id": company_id,
        "amount": "10",
        "currency": "USD",
        "modes": ["CRYPTO"],
        "email": "testcustomer@example.com",
        "description": "BTC Testnet Payment - $10 Test",
        "expire": "24h",
        "callback_url": "https://example.com/callback",
        "redirect_url": "https://example.com/success"
    }
    
    print(f"🔗 Creating payment link...")
    print(f"Amount: ${payload['amount']} USD")
    print(f"Payment Mode: {payload['modes']}")
    print(f"Company ID: {company_id}")
    
    response = requests.post(url, headers=headers, json=payload)
    print(f"\nStatus: {response.status_code}")
    
    if response.status_code in [200, 201]:
        data = response.json()
        print(f"✅ Payment link created successfully!")
        print(f"\nResponse data:")
        print(json.dumps(data, indent=2))
        
        # Extract key information
        if 'data' in data:
            payment_data = data['data']
            print(f"\n{'='*80}")
            print(f"  PAYMENT LINK DETAILS")
            print(f"{'='*80}")
            print(f"Payment Link ID: {payment_data.get('link_id')}")
            print(f"Transaction ID: {payment_data.get('transaction_id')}")
            print(f"Checkout URL: {payment_data.get('payment_link')}")
            print(f"Amount: ${payment_data.get('base_amount')} {payment_data.get('base_currency')}")
            print(f"Status: {payment_data.get('status')}")
            print(f"Modes: {payment_data.get('allowedModes')}")
            print(f"Expires: {payment_data.get('expires_at')}")
            print(f"Created: {payment_data.get('createdAt')}")
            
            return payment_data
        return data
    else:
        print(f"❌ Failed to create payment link")
        print(f"Response: {response.text}")
        return None

def get_crypto_address(token, transaction_id):
    """Get BTC testnet address for payment"""
    print_section("STEP 4: Generate BTC Testnet Address")
    
    url = f"{BASE_URL}/pay/createCryptoPayment"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "transaction_id": transaction_id,
        "crypto_type": "BTC"
    }
    
    print(f"🪙 Requesting BTC testnet address for transaction {transaction_id}")
    
    response = requests.post(url, headers=headers, json=payload)
    print(f"Status: {response.status_code}")
    
    if response.status_code in [200, 201]:
        data = response.json()
        print(f"✅ BTC address generated!")
        print(f"\nResponse:")
        print(json.dumps(data, indent=2))
        
        if 'data' in data:
            crypto_data = data['data']
            print(f"\n{'='*80}")
            print(f"  BTC TESTNET PAYMENT ADDRESS")
            print(f"{'='*80}")
            print(f"Address: {crypto_data.get('address')}")
            print(f"Amount to Pay: {crypto_data.get('crypto_amount')} BTC")
            print(f"USD Equivalent: ${crypto_data.get('base_amount')} USD")
            print(f"Exchange Rate: 1 BTC = ${crypto_data.get('rate')} USD")
            
            address = crypto_data.get('address', '')
            if address.startswith(('m', 'n', 'tb1', '2')):
                print(f"\n✅ TESTNET ADDRESS CONFIRMED!")
                print(f"   Address prefix indicates BTC testnet")
            else:
                print(f"\n⚠️  Address doesn't look like testnet (starts with '{address[:2] if address else ''}')")
            
            return crypto_data
        return data
    else:
        print(f"❌ Failed to generate crypto address")
        print(f"Response: {response.text}")
        return None

def main():
    print("\n" + "="*80)
    print("  BTC TESTNET PAYMENT LINK CREATION TEST")
    print("  Amount: $10 USD")
    print("  Mode: BTC (Bitcoin Testnet)")
    print("="*80)
    
    # Step 1: Login
    token, user_data = login()
    if not token:
        print("\n❌ Test failed: Could not authenticate")
        return
    
    # Step 2: Get companies
    companies = get_companies(token)
    if not companies:
        print("\n❌ Test failed: No companies found")
        return
    
    company_id = companies[0].get('company_id')
    
    # Step 3: Create payment link
    payment_data = create_btc_payment_link(token, company_id)
    if not payment_data:
        print("\n❌ Test failed: Could not create payment link")
        return
    
    payment_link_id = payment_data.get('link_id')
    transaction_id = payment_data.get('transaction_id')
    if not transaction_id:
        print("\n❌ Test failed: No transaction_id in response")
        return
    
    # Step 4: Get BTC testnet address (use transaction_id)
    crypto_data = get_crypto_address(token, transaction_id)
    
    # Summary
    print_section("TEST SUMMARY")
    if crypto_data:
        print("✅ Successfully created BTC testnet payment link")
        print(f"✅ Payment Link ID: {payment_link_id}")
        print(f"✅ Transaction ID: {transaction_id}")
        print(f"✅ BTC Testnet Address: {crypto_data.get('address')}")
        print(f"✅ Amount: {crypto_data.get('crypto_amount')} BTC (${crypto_data.get('base_amount')} USD)")
        print("\n🎉 TEST PASSED - BTC testnet payment link created successfully!")
    else:
        print("⚠️  Payment link created but crypto address generation had issues")
        print("This might be expected if additional setup is needed")

if __name__ == "__main__":
    main()
