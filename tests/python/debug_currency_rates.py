#!/usr/bin/env python3
"""
Debug currency rates response structure
"""

import requests
import json
from urllib.parse import urlparse, parse_qs

def debug_currency_rates():
    backend_url = "https://rlusd-xrpl-fix.preview.emergentagent.com"
    
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
                    "description": "Currency Rates Test"
                },
                headers=headers,
                timeout=15
            )
            
            if payment_response.status_code == 200:
                payment_data = payment_response.json()
                payment_url = payment_data['data']['payment_link']
                
                # Extract reference and get customer token
                parsed_url = urlparse(payment_url)
                query_params = parse_qs(parsed_url.query)
                reference = query_params['d'][0]
                
                # Get payment data to get customer token
                get_data_response = requests.post(
                    f"{backend_url}/api/pay/getData",
                    json={"data": reference},
                    headers={"Content-Type": "application/json"},
                    timeout=15
                )
                
                if get_data_response.status_code == 200:
                    get_data = get_data_response.json()
                    customer_token = get_data['data']['token']
                    
                    print(f"Customer token: {customer_token}")
                    
                    # Test currency rates
                    rates_data = {
                        "source": "USD",
                        "amount": 50,
                        "currencyList": ["BTC", "ETH", "USDT"],
                        "fee_payer": "company"
                    }
                    
                    headers = {
                        "Authorization": f"Bearer {customer_token}",
                        "Content-Type": "application/json"
                    }
                    
                    response = requests.post(
                        f"{backend_url}/api/pay/getCurrencyRates",
                        json=rates_data,
                        headers=headers,
                        timeout=15
                    )
                    
                    print(f"\nCurrency Rates Response:")
                    print(f"Status: {response.status_code}")
                    try:
                        response_data = response.json()
                        print(f"Full Response: {json.dumps(response_data, indent=2)}")
                        
                        if 'data' in response_data and response_data['data']:
                            print(f"\nFirst Rate Entry Structure:")
                            first_rate = response_data['data'][0]
                            print(f"Fields: {list(first_rate.keys())}")
                            print(f"Sample: {json.dumps(first_rate, indent=2)}")
                    except:
                        print(f"Response (text): {response.text}")

if __name__ == "__main__":
    debug_currency_rates()