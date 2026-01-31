#!/usr/bin/env python3
"""
Tax Debug Test - Detailed debugging of tax integration
"""

import requests
import json
import os

# Get backend URL
BACKEND_URL = "https://install-deps-5.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

def authenticate():
    """Authenticate and get JWT token"""
    response = requests.post(f"{API_BASE}/user/login", json={
        "email": "john@dyno.pt",
        "password": "Katiekendra123@"
    })
    
    if response.status_code == 200:
        data = response.json()
        if 'data' in data and 'accessToken' in data['data']:
            return data['data']['accessToken']
    return None

def test_tax_flow():
    """Test the complete tax flow with detailed logging"""
    
    # Step 1: Authenticate
    token = authenticate()
    if not token:
        print("❌ Authentication failed")
        return
    
    print("✅ Authentication successful")
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'X-Forwarded-For': '85.240.1.1',  # Portuguese IP
        'X-Real-IP': '85.240.1.1',
        'CF-IPCountry': 'PT'
    }
    
    # Step 2: Create payment link with tax
    print("\n📝 Creating payment link with tax...")
    payment_payload = {
        "amount": 100,
        "currency": "EUR", 
        "modes": ["CRYPTO"],
        "company_id": 38,
        "description": "Test product with tax",
        "apply_tax": True
    }
    
    response = requests.post(f"{API_BASE}/pay/createPaymentLink", 
                           json=payment_payload, headers=headers)
    
    if response.status_code != 200:
        print(f"❌ Payment link creation failed: {response.status_code}")
        print(response.text)
        return
    
    data = response.json()
    print(f"✅ Payment link created: {json.dumps(data, indent=2)}")
    
    # Extract reference
    if 'data' in data and 'payment_link' in data['data']:
        payment_link = data['data']['payment_link']
        if '?d=' in payment_link:
            reference = payment_link.split('?d=')[1]
        else:
            print("❌ Could not extract reference from payment link")
            return
    else:
        print("❌ Invalid payment link response structure")
        return
    
    print(f"📋 Payment reference: {reference}")
    
    # Step 3: Get payment data
    print("\n📊 Getting payment data...")
    response = requests.post(f"{API_BASE}/pay/getData", 
                           json={"data": reference}, headers=headers)
    
    if response.status_code != 200:
        print(f"❌ Get payment data failed: {response.status_code}")
        print(response.text)
        return
    
    payment_data = response.json()
    print(f"✅ Payment data: {json.dumps(payment_data, indent=2)}")
    
    # Step 4: Create crypto payment
    print("\n💰 Creating crypto payment...")
    response = requests.post(f"{API_BASE}/pay/createCryptoPayment",
                           json={"uniqueRef": reference, "currency": "ETH"},
                           headers=headers)
    
    if response.status_code != 200:
        print(f"❌ Crypto payment creation failed: {response.status_code}")
        print(response.text)
        return
    
    crypto_data = response.json()
    print(f"✅ Crypto payment data: {json.dumps(crypto_data, indent=2)}")
    
    # Analysis
    print("\n🔍 ANALYSIS:")
    
    # Check if tax info is in payment data
    if 'data' in payment_data:
        payment_info = payment_data['data']
        if 'tax_info' in payment_info:
            tax_info = payment_info['tax_info']
            print(f"✅ Tax info found in payment data:")
            print(f"   - Tax rate: {tax_info.get('tax_rate')}%")
            print(f"   - Tax amount: {tax_info.get('tax_amount')}")
            print(f"   - Total: {tax_info.get('total')}")
        else:
            print("❌ No tax_info in payment data")
    
    # Check crypto payment amounts
    if 'data' in crypto_data:
        crypto_info = crypto_data['data']
        print(f"💰 Crypto payment amounts:")
        print(f"   - Amount: {crypto_info.get('amount')}")
        print(f"   - Merchant amount: {crypto_info.get('merchant_amount')}")
        print(f"   - Has tax_info: {'tax_info' in crypto_info}")

if __name__ == "__main__":
    test_tax_flow()