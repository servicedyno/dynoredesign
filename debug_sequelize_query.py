#!/usr/bin/env python3
"""
Direct Database Query Test
"""

import requests
import json

# Test credentials
backend_url = "https://install-helper-26.preview.emergentagent.com"
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
    
    # Get API keys and simulate the exact query logic
    api_response = requests.get(
        f"{backend_url}/api/userApi/getApi",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if api_response.status_code == 200:
        api_data = api_response.json()['data']
        
        # Find company 38 API keys
        if 'all' in api_data:
            api_list = api_data['all']
        else:
            api_list = api_data if isinstance(api_data, list) else [api_data]
        
        # Simulate the exact query: company_id = 38 AND status = 'active' ORDER BY createdAt DESC
        company_keys = [
            k for k in api_list 
            if k.get('company_id') == company_id and k.get('status') == 'active'
        ]
        
        # Sort by createdAt DESC (most recent first) - this is what findOne with order should do
        company_keys.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        
        print(f"\n🔍 Simulating Sequelize Query:")
        print(f"   WHERE company_id = {company_id} AND status = 'active'")
        print(f"   ORDER BY createdAt DESC")
        print(f"   LIMIT 1")
        
        if company_keys:
            selected_key = company_keys[0]  # This is what findOne should return
            print(f"\n👑 Selected API Key (what Sequelize should return):")
            print(f"   ID: {selected_key.get('api_id')}")
            print(f"   Name: {selected_key.get('api_name')}")
            print(f"   Currency: {selected_key.get('base_currency')}")
            print(f"   Created: {selected_key.get('createdAt')}")
            print(f"   Environment: {selected_key.get('environment')}")
            
            expected_currency = selected_key.get('base_currency')
            
            # Test dashboard
            print(f"\n🧪 Testing Dashboard (expecting {expected_currency})...")
            dashboard_response = requests.get(
                f"{backend_url}/api/dashboard",
                params={"company_id": company_id},
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if dashboard_response.status_code == 200:
                dashboard_data = dashboard_response.json()['data']
                actual_currency = dashboard_data.get('total_volume', {}).get('currency', 'N/A')
                
                print(f"📊 Dashboard Currency: {actual_currency}")
                
                if actual_currency == expected_currency:
                    print("✅ SUCCESS: Dashboard shows correct currency!")
                else:
                    print(f"❌ BUG CONFIRMED: Expected {expected_currency}, got {actual_currency}")
                    print("🐛 The dashboard controller is not selecting the correct API key!")
                    
                    # Check if it might be selecting a different key
                    for i, key in enumerate(company_keys):
                        if key.get('base_currency') == actual_currency:
                            print(f"💡 Dashboard might be using API key #{i+1}: ID {key.get('api_id')} ({key.get('base_currency')})")
                            break
            else:
                print(f"❌ Dashboard request failed: {dashboard_response.status_code}")
        else:
            print("❌ No active API keys found for company")
    else:
        print(f"❌ API keys request failed: {api_response.status_code}")
else:
    print(f"❌ Authentication failed: {auth_response.status_code}")