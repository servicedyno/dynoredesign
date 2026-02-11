#!/usr/bin/env python3
"""
Test API Key Selection Logic
"""

import requests
import json

# Test credentials
backend_url = "https://dependency-manager-1.preview.emergentagent.com"
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
    
    # Get API keys for company 38
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
            
        company_keys = [k for k in api_list if k.get('company_id') == company_id and k.get('status') == 'active']
        
        print(f"\n🏢 Company {company_id} Active API Keys (sorted by creation date):")
        # Sort by createdAt DESC (most recent first)
        company_keys.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        
        for i, key in enumerate(company_keys):
            marker = "👑 SHOULD BE SELECTED" if i == 0 else ""
            print(f"  {i+1}. ID: {key.get('api_id')}, Currency: {key.get('base_currency')}, Created: {key.get('createdAt')}, Env: {key.get('environment')} {marker}")
        
        if company_keys:
            expected_currency = company_keys[0].get('base_currency')
            print(f"\n🎯 Expected Currency: {expected_currency}")
            
            # Test dashboard
            print(f"\n🧪 Testing Dashboard...")
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
                    print(f"❌ FAILURE: Expected {expected_currency}, got {actual_currency}")
                    
                    # Let's check if it's using production vs development keys
                    production_keys = [k for k in company_keys if k.get('environment') == 'production']
                    if production_keys:
                        production_keys.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
                        prod_currency = production_keys[0].get('base_currency')
                        print(f"🏭 Most recent PRODUCTION key currency: {prod_currency}")
                        
                        if actual_currency == prod_currency:
                            print("💡 Dashboard might be filtering by production environment only")
            else:
                print(f"❌ Dashboard request failed: {dashboard_response.status_code}")
        else:
            print("❌ No active API keys found for company")
    else:
        print(f"❌ API keys request failed: {api_response.status_code}")
else:
    print(f"❌ Authentication failed: {auth_response.status_code}")