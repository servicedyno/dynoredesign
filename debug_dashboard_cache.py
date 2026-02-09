#!/usr/bin/env python3
"""
Debug Dashboard Currency Issue - Direct API Test
"""

import requests
import json
import time

# Test credentials
backend_url = "https://init-install-1.preview.emergentagent.com"
test_email = "richard@dyno.pt"
test_password = "Katiekendra123@"
company_id = 38

# Authenticate
auth_response = requests.post(
    f"{backend_url}/api/user/login",
    json={"email": test_email, "password": test_password},
    headers={"Content-Type": "application/json"}
)

if auth_response.status_code == 200:
    token = auth_response.json()['data']['accessToken']
    print("✅ Authentication successful")
    
    # Wait a bit to ensure cache expires
    print("⏳ Waiting 35 seconds for cache to expire...")
    time.sleep(35)
    
    # Test dashboard multiple times to see if currency changes
    for i in range(3):
        print(f"\n🧪 Test {i+1}: Dashboard with company_id={company_id}")
        
        dashboard_response = requests.get(
            f"{backend_url}/api/dashboard",
            params={"company_id": company_id},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if dashboard_response.status_code == 200:
            dashboard_data = dashboard_response.json()['data']
            currency = dashboard_data.get('total_volume', {}).get('currency', 'N/A')
            amount = dashboard_data.get('total_volume', {}).get('amount', 0)
            
            print(f"  📊 Currency: {currency}, Amount: {amount}")
        else:
            print(f"  ❌ Failed: {dashboard_response.status_code}")
        
        time.sleep(2)
    
    # Test without company_id
    print(f"\n🧪 Test: Dashboard without company_id")
    dashboard_response = requests.get(
        f"{backend_url}/api/dashboard",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if dashboard_response.status_code == 200:
        dashboard_data = dashboard_response.json()['data']
        currency = dashboard_data.get('total_volume', {}).get('currency', 'N/A')
        amount = dashboard_data.get('total_volume', {}).get('amount', 0)
        
        print(f"  📊 Currency: {currency}, Amount: {amount}")
    else:
        print(f"  ❌ Failed: {dashboard_response.status_code}")
        
else:
    print(f"❌ Authentication failed: {auth_response.status_code}")