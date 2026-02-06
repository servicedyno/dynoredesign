#!/usr/bin/env python3
"""
Debug NEW format payment link creation
"""

import requests
import json

# Get backend URL
backend_url = "https://setup-deps-5.preview.emergentagent.com"

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
    
    # Test NEW format with all required fields
    print("\n=== Testing NEW format (base_amount/base_currency) with all fields ===")
    new_format_data = {
        "base_amount": 100.00,
        "base_currency": "USD",
        "company_id": 3,
        "description": "Test with base_amount field",
        "expire": "24h",
        "email": "test@example.com",
        "modes": ["CRYPTO", "CARD"]
    }
    
    response = requests.post(
        f"{backend_url}/api/pay/createPaymentLink",
        json=new_format_data,
        headers=headers,
        timeout=15
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    # Test NEW format with amount field added (maybe it needs both)
    print("\n=== Testing NEW format with both amount and base_amount ===")
    new_format_data_both = {
        "amount": 100.00,  # Add legacy field
        "base_amount": 100.00,
        "base_currency": "USD",
        "company_id": 3,
        "description": "Test with base_amount field",
        "expire": "24h",
        "email": "test@example.com",
        "modes": ["CRYPTO", "CARD"]
    }
    
    response = requests.post(
        f"{backend_url}/api/pay/createPaymentLink",
        json=new_format_data_both,
        headers=headers,
        timeout=15
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
else:
    print(f"❌ Authentication failed: {login_response.status_code} - {login_response.text}")