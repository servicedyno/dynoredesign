#!/usr/bin/env python3
"""
Debug Dashboard Currency Issue
"""

import requests
import json

# Test credentials
backend_url = "https://dependency-installer-4.preview.emergentagent.com"
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
    
    # Get API keys
    api_response = requests.get(
        f"{backend_url}/api/userApi/getApi",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if api_response.status_code == 200:
        api_data = api_response.json()['data']
        print(f"\n📋 API Keys Data Structure:")
        print(json.dumps(api_data, indent=2))
        
        # Find company 38 API keys
        if 'all' in api_data:
            api_list = api_data['all']
        else:
            api_list = api_data if isinstance(api_data, list) else [api_data]
            
        company_keys = [k for k in api_list if k.get('company_id') == company_id]
        print(f"\n🏢 Company {company_id} API Keys:")
        for key in company_keys:
            print(f"  - ID: {key.get('api_id')}, Name: {key.get('api_name')}, Currency: {key.get('base_currency')}, Status: {key.get('status')}")
    
    # Clear cache first
    print(f"\n🧹 Clearing dashboard cache...")
    
    # Get dashboard with company filter
    dashboard_response = requests.get(
        f"{backend_url}/api/dashboard",
        params={"company_id": company_id},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if dashboard_response.status_code == 200:
        dashboard_data = dashboard_response.json()['data']
        print(f"\n📊 Dashboard with Company Filter:")
        print(f"  - Total Volume Currency: {dashboard_data.get('total_volume', {}).get('currency', 'N/A')}")
        print(f"  - Total Volume Amount: {dashboard_data.get('total_volume', {}).get('amount', 'N/A')}")
        print(f"  - Current Month: {dashboard_data.get('total_volume', {}).get('current_month', 'N/A')}")
    else:
        print(f"❌ Dashboard request failed: {dashboard_response.status_code}")
        print(dashboard_response.text)
        
else:
    print(f"❌ Authentication failed: {auth_response.status_code}")
    print(auth_response.text)