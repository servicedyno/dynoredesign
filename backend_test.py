#!/usr/bin/env python3
"""
Backend Test Suite for Token Expiry Task
Tests the 5 specified tests for JWT token extension to 365 days
"""

import requests
import json
import sys
from datetime import datetime, timezone
import jwt

# Configuration
BASE_URL = "https://install-manager-5.preview.emergentagent.com"
VALID_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyOCwibmFtZSI6IkR5bm90ZWNoIExEQSIsImVtYWlsIjoicmljaGFyZEBkeW5vLnB0IiwidXNlcm5hbWUiOiJkeW5vdGVjaCIsIm1vYmlsZSI6IjM1MTkxMjM0NTY3OSIsInBob3RvIjoiaHR0cHM6Ly9mNTAwNmZjNC01Y2FkLTQ4MGUtODU1Mi05MGZkMTcxZjg3NjAucHJldmlldy5lbWVyZ2VudGFnZW50LmNvbWltYWdlcy91c2VyXzNvN3MzeWZ1eW9mLnBuZyIsImxvZ2luX3R5cGUiOiJFTUFJTCIsImN1c3RvbWVyX2lkIjpudWxsLCJleHRlcm5hbF9pZCI6bnVsbCwic3RhdHVzIjoiYWN0aXZlIiwiY3JlYXRlZEF0IjoiMjAyNi0wMS0yNVQxODoxNzo0Ny4wMDhaIiwidXBkYXRlZEF0IjoiMjAyNi0wMi0xMFQwNDoxMzozOS4zODZaIiwidmVyaWZpZWRfb3RwIjoiOTg4NTczIiwib3RwX2V4cGlyZWQiOiIyMDI2LTAyLTA2VDEyOjMzOjMyLjIzMVoiLCJvdHBfY3VycmVuY3kiOiJMVEMiLCJyZXNldF90b2tlbiI6ImE1NzZiY2QyOTFjYzM3MDFkZWY4NDdlNTYwNGU2MjA0YWFhZTE5MGI5MTE2NDJjNWZiNGYzYmI3YTNhNGU2OWEiLCJyZXNldF90b2tlbl9leHBpcnkiOiIyMDI2LTAxLTMxVDAyOjQ2OjQzLjU3NFoiLCJnb29nbGVfaWQiOm51bGwsIndhbGxldF9yZW1pbmRlcl9zZW50IjpmYWxzZSwicmVmZXJyYWxfY29kZSI6bnVsbCwicmVmZXJyYWxfY291bnQiOjAsInJlZmVycmFsX2JvbnVzX2Vhcm5lZCI6IjAuMDAiLCJyZWZlcnJlZF9ieV9jb2RlIjpudWxsLCJyZWZlcnJlZF9ieV9yZWZlcmVlX2NvZGUiOm51bGwsImZlZV9kaXNjb3VudF9wZXJjZW50IjoiMC4wMCIsImZlZV9kaXNjb3VudF9leHBpcmVzX2F0IjpudWxsLCJmZWVfZGlzY291bnRfcmVhc29uIjpudWxsLCJsYXN0X2xvZ2luX2lwIjoiOjpmZmZmOjEyNy4wLjAuMSIsImlhdCI6MTc3MDcyNzk0NSwiZXhwIjoxODAyMjYzOTQ1fQ.TKWaZgBrcamGK51o3M5IQBlTmrz55ZsoAktH6X27Fk0"
EXPIRED_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyOCwiZXhwIjoxNjAwMDAwMDAwfQ.invalid"

def print_separator(text):
    """Print a separator with text"""
    print(f"\n{'='*60}")
    print(f" {text}")
    print('='*60)

def test_health_check():
    """TEST 1: Backend health check"""
    print_separator("TEST 1: Backend Health Check")
    
    try:
        response = requests.get(f"{BASE_URL}/api/status/health", timeout=10)
        print(f"URL: {BASE_URL}/api/status/health")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ TEST 1 PASSED: Backend is healthy")
            return True
        else:
            print("❌ TEST 1 FAILED: Backend health check failed")
            return False
            
    except Exception as e:
        print(f"❌ TEST 1 FAILED: Exception occurred - {str(e)}")
        return False

def test_payment_link_bozzmail():
    """TEST 2: Payment link creation for Bozzmail (company_id: 38)"""
    print_separator("TEST 2: Payment Link Creation - Bozzmail (ID: 38)")
    
    headers = {
        'Authorization': f'Bearer {VALID_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        "amount": 10,
        "company_id": 38
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/pay/createPaymentLink", 
            headers=headers,
            json=payload,
            timeout=30
        )
        
        print(f"URL: {BASE_URL}/api/pay/createPaymentLink")
        print(f"Headers: {headers}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        print(f"Response: {response.text[:500]}...")  # First 500 chars
        
        if response.status_code == 200:
            response_data = response.json()
            if "Payment link created successfully" in response.text or response_data.get('success'):
                print("✅ TEST 2 PASSED: Payment link created successfully for Bozzmail")
                
                # Check for token expiry header
                expires_header = response.headers.get('X-Token-Expires-In-Days')
                if expires_header:
                    print(f"📅 Token expires in: {expires_header} days")
                    return True, expires_header
                else:
                    print("⚠️ No X-Token-Expires-In-Days header found")
                    return True, None
            else:
                print("❌ TEST 2 FAILED: Unexpected response content")
                return False, None
        else:
            print("❌ TEST 2 FAILED: Payment link creation failed")
            return False, None
            
    except Exception as e:
        print(f"❌ TEST 2 FAILED: Exception occurred - {str(e)}")
        return False, None

def test_payment_link_nameword():
    """TEST 3: Payment link creation for Nameword (company_id: 39)"""
    print_separator("TEST 3: Payment Link Creation - Nameword (ID: 39)")
    
    headers = {
        'Authorization': f'Bearer {VALID_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        "amount": 25,
        "company_id": 39
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/pay/createPaymentLink", 
            headers=headers,
            json=payload,
            timeout=30
        )
        
        print(f"URL: {BASE_URL}/api/pay/createPaymentLink")
        print(f"Headers: {headers}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        print(f"Response: {response.text[:500]}...")  # First 500 chars
        
        if response.status_code == 200:
            response_data = response.json()
            if "Payment link created successfully" in response.text or response_data.get('success'):
                print("✅ TEST 3 PASSED: Payment link created successfully for Nameword")
                
                # Check for token expiry header
                expires_header = response.headers.get('X-Token-Expires-In-Days')
                if expires_header:
                    print(f"📅 Token expires in: {expires_header} days")
                    return True, expires_header
                else:
                    print("⚠️ No X-Token-Expires-In-Days header found")
                    return True, None
            else:
                print("❌ TEST 3 FAILED: Unexpected response content")
                return False, None
        else:
            print("❌ TEST 3 FAILED: Payment link creation failed")
            return False, None
            
    except Exception as e:
        print(f"❌ TEST 3 FAILED: Exception occurred - {str(e)}")
        return False, None

def test_token_expiry_header(expires_header):
    """TEST 4: Check X-Token-Expires-In-Days header is >= 364"""
    print_separator("TEST 4: Token Expiry Header Verification")
    
    if expires_header is None:
        print("❌ TEST 4 FAILED: No X-Token-Expires-In-Days header found in previous tests")
        return False
    
    try:
        expires_days = int(expires_header)
        print(f"Token expires in: {expires_days} days")
        
        if expires_days >= 364:
            print(f"✅ TEST 4 PASSED: Token expiry is {expires_days} days (>= 364 required)")
            return True
        else:
            print(f"❌ TEST 4 FAILED: Token expiry is {expires_days} days (< 364 required)")
            return False
            
    except ValueError:
        print(f"❌ TEST 4 FAILED: Invalid expiry header value: {expires_header}")
        return False

def test_expired_token():
    """TEST 5: Expired token should return 401"""
    print_separator("TEST 5: Expired Token Verification")
    
    headers = {
        'Authorization': f'Bearer {EXPIRED_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        "amount": 10,
        "company_id": 38
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/pay/createPaymentLink", 
            headers=headers,
            json=payload,
            timeout=10
        )
        
        print(f"URL: {BASE_URL}/api/pay/createPaymentLink")
        print(f"Headers: {headers}")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 401:
            print("✅ TEST 5 PASSED: Expired token correctly returns 401")
            return True
        else:
            print(f"❌ TEST 5 FAILED: Expected 401, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ TEST 5 FAILED: Exception occurred - {str(e)}")
        return False

def decode_token_info():
    """Decode token information for debugging"""
    print_separator("TOKEN INFORMATION")
    
    try:
        # Decode without verification to see content
        decoded = jwt.decode(VALID_TOKEN, options={"verify_signature": False})
        
        print("Token Payload:")
        for key, value in decoded.items():
            if key in ['iat', 'exp']:
                # Convert timestamps to readable dates
                dt = datetime.fromtimestamp(value, tz=timezone.utc)
                print(f"  {key}: {value} ({dt.strftime('%Y-%m-%d %H:%M:%S UTC')})")
            else:
                print(f"  {key}: {value}")
        
        # Calculate days until expiry
        if 'exp' in decoded and 'iat' in decoded:
            exp_time = decoded['exp']
            iat_time = decoded['iat']
            duration_seconds = exp_time - iat_time
            duration_days = duration_seconds / (24 * 60 * 60)
            print(f"\nToken Duration: {duration_days:.1f} days")
            
            # Check if still valid
            now = datetime.now(tz=timezone.utc).timestamp()
            if exp_time > now:
                remaining_days = (exp_time - now) / (24 * 60 * 60)
                print(f"Remaining Time: {remaining_days:.1f} days")
            else:
                print("Token Status: EXPIRED")
                
    except Exception as e:
        print(f"Error decoding token: {str(e)}")

def main():
    """Run all tests"""
    print("🧪 BACKEND TOKEN EXPIRY TESTING SUITE")
    print(f"Base URL: {BASE_URL}")
    print(f"Testing Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Decode token info first
    decode_token_info()
    
    # Track results
    results = []
    expires_header = None
    
    # Run all tests
    results.append(test_health_check())
    
    success2, header2 = test_payment_link_bozzmail()
    results.append(success2)
    if header2:
        expires_header = header2
    
    success3, header3 = test_payment_link_nameword()
    results.append(success3)
    if header3 and not expires_header:
        expires_header = header3
    
    results.append(test_token_expiry_header(expires_header))
    results.append(test_expired_token())
    
    # Summary
    print_separator("TEST SUMMARY")
    passed = sum(results)
    total = len(results)
    
    print(f"Tests Passed: {passed}/{total}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED!")
        return 0
    else:
        print("❌ SOME TESTS FAILED!")
        return 1

if __name__ == "__main__":
    sys.exit(main())