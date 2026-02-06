#!/usr/bin/env python3
"""
Test BTC Mainnet Payment Creation
"""

import requests
import json

BASE_URL = "https://webhook-verification.preview.emergentagent.com/api"
TEST_EMAIL = "john@dyno.pt"
TEST_PASSWORD = "Katiekendra123@"

def login():
    url = f"{BASE_URL}/user/login"
    response = requests.post(url, json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    if response.status_code == 200:
        return response.json()['data']['accessToken']
    return None

def get_companies(token):
    url = f"{BASE_URL}/company/getCompany"
    response = requests.get(url, headers={"Authorization": f"Bearer {token}"})
    if response.status_code == 200:
        return response.json().get('data', [])
    return []

def create_payment_link(token, company_id):
    url = f"{BASE_URL}/pay/createPaymentLink"
    payload = {
        "company_id": company_id,
        "amount": "10",
        "currency": "USD",
        "modes": ["CRYPTO"],
        "email": "test@example.com",
        "description": "BTC Mainnet Test - $10"
    }
    response = requests.post(url, headers={"Authorization": f"Bearer {token}"}, json=payload)
    if response.status_code == 200:
        return response.json().get('data', {})
    return None

def initialize_checkout(payment_link):
    payment_url = payment_link.get('payment_link', '')
    if 'd=' in payment_url:
        unique_ref = payment_url.split('d=')[1]
    else:
        return None
    
    url = f"{BASE_URL}/pay/getData"
    response = requests.post(url, json={"data": unique_ref})
    if response.status_code == 200:
        return unique_ref
    return None

def generate_btc_address(token, unique_ref):
    url = f"{BASE_URL}/pay/createCryptoPayment"
    payload = {
        "uniqueRef": unique_ref,
        "currency": "BTC"
    }
    response = requests.post(url, headers={"Authorization": f"Bearer {token}"}, json=payload)
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        if 'data' in data:
            return data['data']
    return None

print("\n" + "="*80)
print("  BTC MAINNET PAYMENT TEST")
print("="*80)

token = login()
if not token:
    print("❌ Login failed")
    exit(1)

print("✅ Logged in")

companies = get_companies(token)
if not companies:
    print("❌ No companies")
    exit(1)

company_id = companies[0]['company_id']
print(f"✅ Using company {company_id}")

payment_data = create_payment_link(token, company_id)
if not payment_data:
    print("❌ Payment link creation failed")
    exit(1)

print(f"✅ Payment link created: {payment_data.get('link_id')}")

unique_ref = initialize_checkout(payment_data)
if not unique_ref:
    print("❌ Checkout init failed")
    exit(1)

print(f"✅ Checkout initialized")

print("\n🪙 Generating BTC address...")
crypto_data = generate_btc_address(token, unique_ref)

if crypto_data and 'address' in crypto_data:
    print("\n" + "="*80)
    print("  ✅ SUCCESS! BTC ADDRESS GENERATED")
    print("="*80)
    print(f"Address: {crypto_data['address']}")
    print(f"Amount: {crypto_data.get('amount', 'N/A')} BTC")
    print(f"USD: ${crypto_data.get('base_amount', '10')}")
    
    if crypto_data['address'].startswith(('bc1', '1', '3')):
        print(f"✅ MAINNET address confirmed!")
    else:
        print(f"⚠️  Unexpected address prefix")
    
    print("="*80)
else:
    print("\n❌ BTC address generation failed")
    print("Check backend logs for details")
