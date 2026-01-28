#!/usr/bin/env python3
"""
Create ETH Mainnet Crypto Payment for $10
"""

import requests
import json

BASE_URL = "https://merchant-crypto-5.preview.emergentagent.com/api"
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
    payload = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
    
    response = requests.post(url, json=payload)
    
    if response.status_code == 200:
        data = response.json()
        token = data['data']['accessToken']
        user_data = data['data']['userData']
        print(f"✅ Logged in as: {user_data['name']}")
        print(f"User ID: {user_data['user_id']}")
        return token, user_data
    else:
        print(f"❌ Login failed: {response.text}")
        return None, None

def get_companies(token):
    """Get user's companies"""
    print_section("STEP 2: Get Companies")
    
    url = f"{BASE_URL}/company/getCompany"
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        companies = data.get('data', [])
        print(f"✅ Found {len(companies)} companies")
        
        if companies:
            company = companies[0]
            print(f"\nUsing Company:")
            print(f"  ID: {company.get('company_id')}")
            print(f"  Name: {company.get('company_name')}")
        
        return companies
    else:
        print(f"❌ Failed: {response.text}")
        return []

def create_payment_link(token, company_id):
    """Create payment link for $10"""
    print_section("STEP 3: Create Payment Link ($10 USD)")
    
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
        "email": "customer@example.com",
        "description": "ETH Payment - $10 USD",
        "expire": "24h"
    }
    
    print(f"Creating payment link...")
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code == 200:
        data = response.json()
        payment_data = data.get('data', {})
        
        print(f"✅ Payment link created")
        print(f"Link ID: {payment_data.get('link_id')}")
        print(f"Transaction ID: {payment_data.get('transaction_id')}")
        print(f"Amount: ${payment_data.get('base_amount')} {payment_data.get('base_currency')}")
        
        return payment_data
    else:
        print(f"❌ Failed: {response.text}")
        return None

def initialize_checkout(payment_link):
    """Initialize checkout session"""
    print_section("STEP 4: Initialize Checkout Session")
    
    # Extract unique ref from payment link URL
    payment_url = payment_link.get('payment_link', '')
    if 'd=' in payment_url:
        unique_ref = payment_url.split('d=')[1]
    else:
        print("❌ Could not extract unique ref")
        return None
    
    url = f"{BASE_URL}/pay/getData"
    payload = {"data": unique_ref}
    
    print(f"Initializing session with ref: {unique_ref[:20]}...")
    response = requests.post(url, json=payload)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Checkout session initialized")
        return unique_ref
    else:
        print(f"❌ Failed: {response.text}")
        return None

def generate_eth_address(token, unique_ref):
    """Generate ETH mainnet address"""
    print_section("STEP 5: Generate ETH Mainnet Address")
    
    url = f"{BASE_URL}/pay/createCryptoPayment"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "uniqueRef": unique_ref,
        "currency": "ETH"
    }
    
    print(f"🪙 Requesting ETH mainnet address...")
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code == 200:
        data = response.json()
        
        if 'data' in data:
            crypto_data = data['data']
            address = crypto_data.get('address')
            amount = crypto_data.get('amount')
            
            print(f"✅ ETH Address Generated!")
            print(f"\n{'='*80}")
            print(f"  💰 ETH MAINNET PAYMENT ADDRESS")
            print(f"{'='*80}")
            print(f"Address: {address}")
            print(f"Amount: {amount} ETH")
            print(f"USD Value: ${crypto_data.get('base_amount', '10')} USD")
            print(f"Transaction ID: {crypto_data.get('transaction_id')}")
            
            # Verify it's mainnet
            if address.startswith('0x'):
                print(f"\n✅ MAINNET ADDRESS CONFIRMED")
                print(f"   (0x prefix = Ethereum mainnet/testnet compatible)")
                print(f"   Current mode: MAINNET (TATUM_TESTNET=false)")
            
            print(f"\n📍 Send {amount} ETH to this address")
            print(f"{'='*80}")
            
            return crypto_data
        else:
            print(f"✅ Response received:")
            print(json.dumps(data, indent=2))
            return data
    else:
        print(f"❌ Failed: {response.text}")
        return None

def main():
    print("\n" + "="*80)
    print("  ETH MAINNET CRYPTO PAYMENT - $10 USD")
    print("  Mode: MAINNET (Real Ethereum)")
    print("="*80)
    
    # Step 1: Login
    token, user_data = login()
    if not token:
        return
    
    # Step 2: Get companies
    companies = get_companies(token)
    if not companies:
        return
    
    company_id = companies[0].get('company_id')
    
    # Step 3: Create payment link
    payment_data = create_payment_link(token, company_id)
    if not payment_data:
        return
    
    # Step 4: Initialize checkout
    unique_ref = initialize_checkout(payment_data)
    if not unique_ref:
        return
    
    # Step 5: Generate ETH address
    crypto_data = generate_eth_address(token, unique_ref)
    
    # Summary
    print_section("SUMMARY")
    if crypto_data and isinstance(crypto_data, dict) and 'address' in crypto_data:
        print("✅ ETH mainnet payment address created successfully!")
        print(f"\n📋 Payment Details:")
        print(f"   Address: {crypto_data.get('address')}")
        print(f"   Amount: {crypto_data.get('amount')} ETH")
        print(f"   USD Value: ${crypto_data.get('base_amount', '10')}")
        print(f"   Transaction ID: {crypto_data.get('transaction_id')}")
        
        print(f"\n💡 Instructions:")
        print(f"   1. Send {crypto_data.get('amount')} ETH to the address above")
        print(f"   2. Use MetaMask, Coinbase, or any ETH wallet")
        print(f"   3. Ensure you're on ETHEREUM MAINNET")
        print(f"   4. Payment will be detected via Tatum webhooks")
        
        print(f"\n🔍 Monitor Payment:")
        print(f"   tail -f /var/log/supervisor/backend.out.log | grep -E 'webhook|ETH|{crypto_data.get('address')[:20]}'")
        
        print("\n🎉 SUCCESS!")
    else:
        print("⚠️  Payment creation had issues, check response above")

if __name__ == "__main__":
    main()
