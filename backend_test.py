#!/usr/bin/env python3
"""
SmartGas Integration Tests for DynoPay Backend
Tests merchant token transfers with SmartGas functionality
"""

import requests
import json
import sys
from typing import Dict, Any

BASE_URL = "https://dependency-setup-11.preview.emergentagent.com"
CREDENTIALS = {
    "email": "richard@dyno.pt",
    "password": "Katiekendra123@"
}

class TestFailedException(Exception):
    pass

def log_test(message: str):
    print(f"[TEST] {message}")

def log_success(message: str):
    print(f"[✅] {message}")

def log_failure(message: str):
    print(f"[❌] {message}")

def authenticate() -> str:
    """Login and get JWT token"""
    log_test("Authenticating...")
    
    response = requests.post(
        f"{BASE_URL}/api/user/login",
        json=CREDENTIALS,
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code != 200:
        raise TestFailedException(f"Authentication failed: {response.status_code} - {response.text}")
    
    data = response.json()
    if not data.get("data", {}).get("accessToken"):
        raise TestFailedException(f"No access token in response: {data}")
    
    token = data["data"]["accessToken"]
    log_success(f"Authentication successful")
    return token

def get_api_keys(token: str) -> Dict[str, Any]:
    """Get API keys for company_id 38 (Bozzmail)"""
    log_test("Getting API keys...")
    
    response = requests.get(
        f"{BASE_URL}/api/userApi/getApi",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    )
    
    if response.status_code != 200:
        raise TestFailedException(f"Failed to get API keys: {response.status_code} - {response.text}")
    
    data = response.json()
    api_keys = data.get("data", [])
    
    # Find API key for company_id 38 (Bozzmail)
    target_key = None
    for key in api_keys:
        if key.get("company_id") == 38:
            target_key = key
            break
    
    if not target_key:
        raise TestFailedException(f"No API key found for company_id 38. Available keys: {[k.get('company_id') for k in api_keys]}")
    
    encrypted_key = target_key.get("encrypted_key")
    if not encrypted_key:
        raise TestFailedException(f"No encrypted_key in API key: {target_key}")
    
    log_success(f"Found API key for company_id 38: {target_key.get('key_name', 'N/A')}")
    return target_key

def create_customer(api_key: str, token: str) -> Dict[str, Any]:
    """Create test customer via Direct API"""
    log_test("Creating test customer...")
    
    customer_data = {
        "name": "SmartGas Test",
        "email": "smartgas-test@bozzmail.pt"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/user/createUser",
        json=customer_data,
        headers={
            "x-api-key": api_key,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    )
    
    if response.status_code != 200:
        raise TestFailedException(f"Customer creation failed: {response.status_code} - {response.text}")
    
    data = response.json()
    customer = data.get("data")
    if not customer:
        raise TestFailedException(f"No customer data in response: {data}")
    
    log_success(f"Customer created: {customer.get('customer_id', 'N/A')}")
    return customer

def create_usdt_trc20_payment(api_key: str, token: str) -> Dict[str, Any]:
    """Create USDT-TRC20 payment via Direct API"""
    log_test("Creating USDT-TRC20 payment...")
    
    payment_data = {
        "amount": 10,
        "currency": "USDT-TRC20"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/user/cryptoPayment",
        json=payment_data,
        headers={
            "x-api-key": api_key,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    )
    
    if response.status_code != 200:
        raise TestFailedException(f"Payment creation failed: {response.status_code} - {response.text}")
    
    data = response.json()
    payment = data.get("data")
    if not payment:
        raise TestFailedException(f"No payment data in response: {data}")
    
    # Verify required fields
    required_fields = ["temp_address", "crypto_amount", "currency"]
    missing_fields = [field for field in required_fields if not payment.get(field)]
    if missing_fields:
        raise TestFailedException(f"Missing required fields in payment response: {missing_fields}")
    
    if payment.get("currency") != "USDT-TRC20":
        raise TestFailedException(f"Expected currency USDT-TRC20, got: {payment.get('currency')}")
    
    log_success(f"USDT-TRC20 payment created:")
    log_success(f"  - Address: {payment.get('temp_address')}")
    log_success(f"  - Amount: {payment.get('crypto_amount')} {payment.get('currency')}")
    
    return payment

def run_tests():
    """Run all SmartGas integration tests"""
    print("="*60)
    print("SMARTGAS INTEGRATION TESTS FOR DYNOPAY BACKEND")
    print("="*60)
    
    try:
        # 1. Authenticate
        token = authenticate()
        
        # 2. Get API keys
        api_key_data = get_api_keys(token)
        encrypted_key = api_key_data["encrypted_key"]
        
        # 3. Create customer
        customer = create_customer(encrypted_key, token)
        
        # 4. Create USDT-TRC20 payment
        payment = create_usdt_trc20_payment(encrypted_key, token)
        
        print("\n" + "="*60)
        log_success("ALL SMARTGAS INTEGRATION TESTS PASSED")
        print("="*60)
        
        return True
        
    except TestFailedException as e:
        log_failure(f"Test failed: {e}")
        return False
    except Exception as e:
        log_failure(f"Unexpected error: {e}")
        return False

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)