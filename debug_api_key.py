#!/usr/bin/env python3
"""
Debug API Key Response Structure
"""

import requests
import json

def debug_api_key_response():
    backend_url = "https://install-deps-8.preview.emergentagent.com"
    
    # First authenticate
    auth_response = requests.post(
        f"{backend_url}/api/user/login",
        json={
            "email": "richard@dyno.pt",
            "password": "Katiekendra123@"
        },
        headers={"Content-Type": "application/json"},
        timeout=15
    )
    
    if auth_response.status_code == 200:
        auth_data = auth_response.json()
        jwt_token = auth_data['data']['accessToken']
        print(f"✅ Authentication successful")
        
        # Get API key
        api_response = requests.get(
            f"{backend_url}/api/userApi/getApi",
            headers={"Authorization": f"Bearer {jwt_token}"},
            timeout=15
        )
        
        print(f"\nAPI Response Status: {api_response.status_code}")
        print(f"API Response Headers: {dict(api_response.headers)}")
        print(f"API Response Body:")
        print(json.dumps(api_response.json(), indent=2))
        
    else:
        print(f"❌ Authentication failed: {auth_response.status_code}")

if __name__ == "__main__":
    debug_api_key_response()