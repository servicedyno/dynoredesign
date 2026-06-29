#!/usr/bin/env python3
"""
DynoPay Phone Onboarding Backend Health Check
After Telnyx Verify Profile Configuration Fix

CRITICAL: This test sends ONE REAL SMS to 18022100479 (costs Telnyx credit)
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://crypto-payment-hub-20.preview.emergentagent.com/api"
TEST_PHONE = "18022100479"

def log_test(test_name, status, details):
    """Log test result"""
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"\n{'='*80}")
    print(f"[{timestamp}] {test_name}")
    print(f"Status: {status}")
    print(f"Details: {json.dumps(details, indent=2)}")
    print(f"{'='*80}")
    return details

def test_health_check():
    """Test 1: GET /api/ - Health check"""
    try:
        response = requests.get(f"{BASE_URL}/", timeout=10)
        details = {
            "http_status": response.status_code,
            "response": response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text[:200]
        }
        
        if response.status_code == 200:
            status = "✅ PASS"
        else:
            status = "❌ FAIL"
        
        return log_test("Test 1: Health Check (GET /api/)", status, details)
    except Exception as e:
        return log_test("Test 1: Health Check (GET /api/)", "❌ ERROR", {"error": str(e)})

def test_phone_type_check():
    """Test 2: POST /api/user/phone-type-check - Validation endpoint (NO SMS)"""
    try:
        response = requests.post(
            f"{BASE_URL}/user/phone-type-check",
            json={"phone": f"+{TEST_PHONE}"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        details = {
            "http_status": response.status_code,
            "request_body": {"phone": f"+{TEST_PHONE}"},
            "response": response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text[:200]
        }
        
        # Accept 200 or 400 (validation), but NOT 500
        if response.status_code in [200, 400]:
            status = "✅ PASS"
        elif response.status_code == 500:
            status = "❌ FAIL - Server Error"
        else:
            status = f"⚠️ UNEXPECTED - HTTP {response.status_code}"
        
        return log_test("Test 2: Phone Type Check (POST /api/user/phone-type-check)", status, details)
    except Exception as e:
        return log_test("Test 2: Phone Type Check (POST /api/user/phone-type-check)", "❌ ERROR", {"error": str(e)})

def test_register_phone_real():
    """Test 3: POST /api/user/registerPhone - REAL SMS SEND (ONE TIME ONLY)"""
    print("\n" + "!"*80)
    print("⚠️  WARNING: About to send REAL SMS to test number (costs Telnyx credit)")
    print("!"*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/user/registerPhone",
            json={"mobile": TEST_PHONE},
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        
        details = {
            "http_status": response.status_code,
            "request_body": {"mobile": TEST_PHONE},
            "response": response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text[:500]
        }
        
        # Accept 200 (success) or 400 (already registered)
        # Reject 503 (Telnyx send failure)
        if response.status_code == 200:
            response_data = details.get("response", {})
            if isinstance(response_data, dict):
                message = response_data.get("message", "")
                if "Verification code sent" in message or "sent to your phone" in message:
                    status = "✅ PASS - SMS Send Path Healthy"
                else:
                    status = f"⚠️ UNEXPECTED MESSAGE - {message}"
            else:
                status = "✅ PASS - HTTP 200"
        elif response.status_code == 400:
            response_data = details.get("response", {})
            if isinstance(response_data, dict):
                message = response_data.get("message", "")
                if "already registered" in message.lower():
                    status = "✅ PASS - Already Registered (Acceptable)"
                else:
                    status = f"⚠️ VALIDATION ERROR - {message}"
            else:
                status = "⚠️ HTTP 400"
        elif response.status_code == 503:
            status = "❌ FAIL - Telnyx Send Failure (503)"
        elif response.status_code == 500:
            status = "❌ FAIL - Server Error (500)"
        else:
            status = f"⚠️ UNEXPECTED - HTTP {response.status_code}"
        
        return log_test("Test 3: Register Phone - REAL SMS (POST /api/user/registerPhone)", status, details)
    except Exception as e:
        return log_test("Test 3: Register Phone - REAL SMS (POST /api/user/registerPhone)", "❌ ERROR", {"error": str(e)})

def test_register_phone_validation():
    """Test 4: POST /api/user/registerPhone - Validation (empty body, NO SMS)"""
    try:
        response = requests.post(
            f"{BASE_URL}/user/registerPhone",
            json={},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        details = {
            "http_status": response.status_code,
            "request_body": {},
            "response": response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text[:200]
        }
        
        # Expect 400 with "Mobile number is required"
        if response.status_code == 400:
            response_data = details.get("response", {})
            if isinstance(response_data, dict):
                message = response_data.get("message", "")
                if "mobile" in message.lower() and "required" in message.lower():
                    status = "✅ PASS - Validation Working"
                else:
                    status = f"⚠️ UNEXPECTED MESSAGE - {message}"
            else:
                status = "✅ PASS - HTTP 400"
        elif response.status_code == 500:
            status = "❌ FAIL - Server Error"
        else:
            status = f"⚠️ UNEXPECTED - HTTP {response.status_code}"
        
        return log_test("Test 4: Register Phone Validation (POST /api/user/registerPhone empty body)", status, details)
    except Exception as e:
        return log_test("Test 4: Register Phone Validation (POST /api/user/registerPhone empty body)", "❌ ERROR", {"error": str(e)})

def main():
    print("\n" + "="*80)
    print("DynoPay Phone Onboarding Backend Health Check")
    print("After Telnyx Verify Profile Configuration Fix")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Phone: {TEST_PHONE}")
    print(f"Test Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("="*80)
    
    results = []
    
    # Test 1: Health check
    results.append(test_health_check())
    
    # Test 2: Phone type check (no SMS)
    results.append(test_phone_type_check())
    
    # Test 3: Register phone with real number (ONE TIME ONLY - sends SMS)
    results.append(test_register_phone_real())
    
    # Test 4: Register phone validation (no SMS)
    results.append(test_register_phone_validation())
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for i, result in enumerate(results, 1):
        status = result.get("http_status", "ERROR")
        print(f"Test {i}: HTTP {status}")
    
    # Check for any 500 errors
    has_500 = any(r.get("http_status") == 500 for r in results)
    if has_500:
        print("\n❌ CRITICAL: One or more endpoints returned HTTP 500")
    else:
        print("\n✅ No HTTP 500 errors detected")
    
    print("="*80)

if __name__ == "__main__":
    main()
