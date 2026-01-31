#!/usr/bin/env python3
"""
Debug DynoPay Checkout API - Check actual response structures
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

def debug_authentication():
    backend_url = get_backend_url()
    print(f"Backend URL: {backend_url}")
    
    # Test authentication
    print("\n=== Debug Authentication ===")
    response = requests.post(
        f"{backend_url}/api/user/login",
        json={
            "email": "john@dyno.pt",
            "password": "Katiekendra123@"
        },
        headers={"Content-Type": "application/json"},
        timeout=15
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 200:
        data = response.json()
        jwt_token = data.get('data', {}).get('accessToken')
        
        if jwt_token:
            print(f"\n=== Debug Payment Link Creation ===")
            
            # Try different payment link creation formats
            payment_formats = [
                {
                    "amount": 50,
                    "currency": "USD", 
                    "company_id": 38,
                    "modes": ["CRYPTO"],
                    "description": "Checkout API Test"
                },
                {
                    "base_amount": 50,
                    "base_currency": "USD",
                    "company_id": 38,
                    "modes": ["CRYPTO"],
                    "description": "Checkout API Test"
                },
                {
                    "amount": 50,
                    "currency": "USD",
                    "modes": ["CRYPTO"],
                    "description": "Checkout API Test",
                    "email": "test@example.com"
                }
            ]
            
            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }
            
            for i, payment_data in enumerate(payment_formats, 1):
                print(f"\n--- Format {i} ---")
                print(f"Request: {json.dumps(payment_data, indent=2)}")
                
                response = requests.post(
                    f"{backend_url}/api/pay/createPaymentLink",
                    json=payment_data,
                    headers=headers,
                    timeout=15
                )
                
                print(f"Status: {response.status_code}")
                try:
                    print(f"Response: {json.dumps(response.json(), indent=2)}")
                except:
                    print(f"Response (text): {response.text}")
                
                if response.status_code == 200:
                    break

if __name__ == "__main__":
    debug_authentication()