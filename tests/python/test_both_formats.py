#!/usr/bin/env python3
"""
Test both parameter formats for getData
"""

import requests
import json
from urllib.parse import urlparse, parse_qs

def test_both_formats():
    backend_url = "https://rlusd-erc20-deploy.preview.emergentagent.com"
    
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
                    "description": "Parameter Test"
                },
                headers=headers,
                timeout=15
            )
            
            if payment_response.status_code == 200:
                payment_data = payment_response.json()
                payment_url = payment_data['data']['payment_link']
                
                # Extract reference
                parsed_url = urlparse(payment_url)
                query_params = parse_qs(parsed_url.query)
                reference = query_params['d'][0]
                
                print(f"Payment URL: {payment_url}")
                print(f"Reference: {reference}")
                
                # Test with 'd' parameter
                print(f"\n--- Testing with 'd' parameter ---")
                response = requests.post(
                    f"{backend_url}/api/pay/getData",
                    json={"d": reference},
                    headers={"Content-Type": "application/json"},
                    timeout=15
                )
                
                print(f"Status: {response.status_code}")
                try:
                    print(f"Response: {json.dumps(response.json(), indent=2)}")
                except:
                    print(f"Response (text): {response.text}")
                
                # Test with 'data' parameter
                print(f"\n--- Testing with 'data' parameter ---")
                response = requests.post(
                    f"{backend_url}/api/pay/getData",
                    json={"data": reference},
                    headers={"Content-Type": "application/json"},
                    timeout=15
                )
                
                print(f"Status: {response.status_code}")
                try:
                    print(f"Response: {json.dumps(response.json(), indent=2)}")
                except:
                    print(f"Response (text): {response.text}")

if __name__ == "__main__":
    test_both_formats()