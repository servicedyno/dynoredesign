#!/usr/bin/env python3
"""
Debug getData endpoint - check what endpoints are available
"""

import requests
import json

def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except:
        pass
    return "http://localhost:8001"

def debug_get_data():
    backend_url = get_backend_url()
    
    # First authenticate
    response = requests.post(
        f"{backend_url}/api/user/login",
        json={
            "email": "john@dyno.pt",
            "password": "Katiekendra123@"
        },
        headers={"Content-Type": "application/json"},
        timeout=15
    )
    
    if response.status_code == 200:
        data = response.json()
        jwt_token = data.get('data', {}).get('accessToken')
        
        if jwt_token:
            # Create payment link
            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }
            
            payment_response = requests.post(
                f"{backend_url}/api/pay/createPaymentLink",
                json={
                    "amount": 50,
                    "currency": "USD",
                    "company_id": 38,
                    "modes": ["CRYPTO"],
                    "description": "Debug Test"
                },
                headers=headers,
                timeout=15
            )
            
            if payment_response.status_code == 200:
                payment_data = payment_response.json()
                payment_url = payment_data['data']['payment_link']
                
                # Extract reference
                from urllib.parse import urlparse, parse_qs
                parsed_url = urlparse(payment_url)
                query_params = parse_qs(parsed_url.query)
                reference = query_params['d'][0]
                
                print(f"Payment URL: {payment_url}")
                print(f"Reference: {reference}")
                
                # Try different getData endpoints
                endpoints_to_try = [
                    "/api/pay/getData",
                    "/api/payment/getData", 
                    "/api/checkout/getData",
                    "/api/pay/getPaymentData"
                ]
                
                for endpoint in endpoints_to_try:
                    print(f"\n--- Testing {endpoint} ---")
                    
                    # Try POST
                    response = requests.post(
                        f"{backend_url}{endpoint}",
                        json={"d": reference},
                        headers={"Content-Type": "application/json"},
                        timeout=15
                    )
                    
                    print(f"POST Status: {response.status_code}")
                    if response.status_code != 404:
                        try:
                            print(f"POST Response: {json.dumps(response.json(), indent=2)}")
                        except:
                            print(f"POST Response (text): {response.text}")
                    
                    # Try GET with query param
                    response = requests.get(
                        f"{backend_url}{endpoint}?d={reference}",
                        timeout=15
                    )
                    
                    print(f"GET Status: {response.status_code}")
                    if response.status_code != 404:
                        try:
                            print(f"GET Response: {json.dumps(response.json(), indent=2)}")
                        except:
                            print(f"GET Response (text): {response.text}")

if __name__ == "__main__":
    debug_get_data()