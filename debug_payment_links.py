#!/usr/bin/env python3
"""
Debug Payment Link Creation Issues
"""

import requests
import json

# Get backend URL
backend_url = "https://depend-installer-2.preview.emergentagent.com"

# Authenticate first
login_response = requests.post(
    f"{backend_url}/api/user/login",
    json={
        "email": "nomadly@moxx.co",
        "password": "Katiekendra123@"
    },
    headers={"Content-Type": "application/json"},
    timeout=15
)

if login_response.status_code == 200:
    login_data = login_response.json()
    jwt_token = login_data['data']['accessToken']
    print(f"✅ Authenticated successfully")
    
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json"
    }
    
    # Test 1: NEW format
    print("\n=== Testing NEW format (base_amount/base_currency) ===")
    new_format_data = {
        "base_amount": 100.00,
        "base_currency": "USD",
        "company_id": 1,
        "description": "Test with base_amount field",
        "expire": "24h"
    }
    
    response = requests.post(
        f"{backend_url}/api/pay/createPaymentLink",
        json=new_format_data,
        headers=headers,
        timeout=15
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    # Test 2: LEGACY format
    print("\n=== Testing LEGACY format (amount/currency) ===")
    legacy_format_data = {
        "amount": 200.00,
        "currency": "EUR",
        "company_id": 1,
        "description": "Test with amount field",
        "expire": "7d",
        "email": "test@example.com",
        "modes": ["crypto", "card"]
    }
    
    response = requests.post(
        f"{backend_url}/api/pay/createPaymentLink",
        json=legacy_format_data,
        headers=headers,
        timeout=15
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    # Test 3: Check what companies exist for this user
    print("\n=== Checking user companies ===")
    response = requests.get(
        f"{backend_url}/api/company/getCompany",
        headers=headers,
        timeout=15
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
else:
    print(f"❌ Authentication failed: {login_response.status_code} - {login_response.text}")