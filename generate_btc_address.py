#!/usr/bin/env python3
"""
Generate BTC Testnet Address for Payment
Simulates checkout flow and generates crypto address
"""

import requests
import json
import hashlib
import time

# Configuration
BASE_URL = "https://finance-backend-5.preview.emergentagent.com/api"
TEST_EMAIL = "john@dyno.pt"
TEST_PASSWORD = "Katiekendra123@"
TRANSACTION_ID = "ac550fea-3303-4bd2-b874-b2d47e957b41"
LINK_ID = 163

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def login():
    """Login and get JWT token"""
    url = f"{BASE_URL}/user/login"
    payload = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
    response = requests.post(url, json=payload)
    
    if response.status_code == 200:
        data = response.json()
        return data['data']['accessToken']
    return None

def get_payment_link_details(token):
    """Get payment link details"""
    print_section("Step 1: Get Payment Link Details")
    
    url = f"{BASE_URL}/pay/links/{LINK_ID}"
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(url, headers=headers)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        link_data = data.get('data', {})
        print(f"✅ Payment Link Retrieved")
        print(f"Transaction ID: {link_data.get('transaction_id')}")
        print(f"Amount: ${link_data.get('base_amount')} {link_data.get('base_currency')}")
        print(f"Email: {link_data.get('email')}")
        print(f"Company ID: {link_data.get('company_id')}")
        print(f"Status: {link_data.get('status')}")
        return link_data
    else:
        print(f"❌ Failed: {response.text}")
        return None

def extract_unique_ref_from_url(payment_link):
    """Extract unique reference from payment link URL"""
    # URL format: https://...//pay?d=<hash>
    if 'd=' in payment_link:
        return payment_link.split('d=')[1]
    return None

def get_payment_data(unique_ref):
    """Get payment data using unique reference (simulates checkout page load)"""
    print_section("Step 2: Initialize Checkout Session")
    
    url = f"{BASE_URL}/pay/getData"
    payload = {"data": unique_ref}
    
    print(f"Unique Ref: {unique_ref}")
    response = requests.post(url, json=payload)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Checkout Session Initialized")
        print(json.dumps(data, indent=2))
        return data
    else:
        print(f"❌ Failed: {response.text}")
        return None

def generate_crypto_address(token, transaction_id, unique_ref):
    """Generate BTC testnet address"""
    print_section("Step 3: Generate BTC Testnet Address")
    
    url = f"{BASE_URL}/pay/createCryptoPayment"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "uniqueRef": unique_ref,
        "currency": "BTC"
    }
    
    print(f"🪙 Requesting BTC testnet address...")
    print(f"Transaction ID: {transaction_id}")
    print(f"Unique Ref: {unique_ref}")
    
    response = requests.post(url, headers=headers, json=payload)
    print(f"Status: {response.status_code}")
    
    if response.status_code in [200, 201]:
        data = response.json()
        print(f"✅ BTC Address Generated!")
        print(json.dumps(data, indent=2))
        
        if 'address' in data:
            address = data['address']
            amount_btc = data.get('amount', 'N/A')
            
            print(f"\n{'='*80}")
            print(f"  🎯 BTC TESTNET PAYMENT ADDRESS")
            print(f"{'='*80}")
            print(f"Address: {address}")
            print(f"Amount: {amount_btc} BTC")
            print(f"USD Value: ${data.get('base_amount', '10')} USD")
            
            # Verify it's testnet
            if address.startswith(('m', 'n', 'tb1', '2')):
                print(f"\n✅ CONFIRMED: This is a Bitcoin Testnet address")
                print(f"   (Address prefix: {address[:4]})")
            else:
                print(f"\n⚠️  Warning: Address doesn't look like testnet")
            
            print(f"\n📍 You can send testnet BTC to this address")
            print(f"   Get testnet BTC from: https://testnet-faucet.mempool.co/")
            
            return data
        return data
    else:
        print(f"❌ Failed: {response.text}")
        return None

def main():
    print("\n" + "="*80)
    print("  BTC TESTNET ADDRESS GENERATOR")
    print("  Payment Link ID: 163")
    print("  Transaction ID: ac550fea-3303-4bd2-b874-b2d47e957b41")
    print("="*80)
    
    # Login
    print_section("Authentication")
    token = login()
    if not token:
        print("❌ Failed to login")
        return
    print(f"✅ Logged in successfully")
    print(f"Token: {token[:50]}...")
    
    # Get payment link details
    link_data = get_payment_link_details(token)
    if not link_data:
        print("❌ Failed to get payment link details")
        return
    
    # Extract unique ref from payment link
    payment_link = link_data.get('payment_link')
    unique_ref = extract_unique_ref_from_url(payment_link)
    
    if not unique_ref:
        print("❌ Could not extract unique reference from URL")
        return
    
    # Initialize checkout session (this sets up Redis data)
    checkout_data = get_payment_data(unique_ref)
    if not checkout_data:
        print("❌ Failed to initialize checkout session")
        return
    
    # Generate crypto address
    crypto_data = generate_crypto_address(token, TRANSACTION_ID, unique_ref)
    
    if crypto_data and 'address' in crypto_data:
        print_section("✅ SUCCESS - Ready for Payment")
        print(f"Send testnet BTC to: {crypto_data['address']}")
        print(f"Amount: {crypto_data.get('amount')} BTC")
        print(f"\nMonitor logs with:")
        print(f"  tail -f /var/log/supervisor/backend.out.log | grep -E 'webhook|payment|BTC'")

if __name__ == "__main__":
    main()
