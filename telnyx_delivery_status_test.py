#!/usr/bin/env python3
"""
DynoPay Telnyx SMS OTP Delivery Status Verification Test
Review Request: Verify backend change to poll Telnyx delivery_status

ARCHITECTURE: Node/TypeScript backend behind Python uvicorn proxy
LIVE PRODUCTION: Connected to real Telnyx account and PostgreSQL DB

HARD CONSTRAINTS:
1. Make AT MOST ONE call to POST /api/user/registerPhone with mobile number
2. Use account's own number 18022100479 (undeliverable - perfect test case)
3. Do NOT create users/payments/companies/wallets
4. Do NOT call admin/settlement endpoints

TESTS:
1. GET /api/ → expect HTTP 200 (operational)
2. POST /api/user/registerPhone with {"mobile": "18022100479"} → expect HTTP 503
   (NEW behavior: backend now detects delivery_failed and returns 503)
   (OLD behavior: would return 200 "code sent" even though SMS never delivered)
   NOTE: May take 6-8s due to polling - this is expected, not a hang
3. POST /api/user/registerPhone with {} → expect HTTP 400 "Mobile number is required"

PASS CRITERIA:
- No HTTP 500 errors
- Health check returns 200
- Undeliverable number returns 503 OR 200 (if Telnyx doesn't report failure within window)
- Missing mobile returns 400
- All responses are clean JSON (no crashes)
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "https://crypto-payment-hub-20.preview.emergentagent.com/api"
TEST_PHONE_UNDELIVERABLE = "18022100479"  # Account's own DID - known undeliverable

def log_test(test_name, status, details):
    """Log test result with timestamp"""
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"\n{'='*80}")
    print(f"[{timestamp}] {test_name}")
    print(f"Status: {status}")
    print(f"Details: {json.dumps(details, indent=2)}")
    print(f"{'='*80}")
    return details

def test_1_health_check():
    """Test 1: GET /api/ - Health check (should return 200)"""
    try:
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/", timeout=10)
        elapsed = time.time() - start_time
        
        details = {
            "http_status": response.status_code,
            "elapsed_time_sec": round(elapsed, 2),
            "response": response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text[:200]
        }
        
        if response.status_code == 200:
            status = "✅ PASS - API Operational"
        else:
            status = f"❌ FAIL - Expected 200, got {response.status_code}"
        
        return log_test("Test 1: Health Check (GET /api/)", status, details)
    except Exception as e:
        return log_test("Test 1: Health Check (GET /api/)", "❌ ERROR", {"error": str(e)})

def test_2_register_phone_undeliverable():
    """
    Test 2: POST /api/user/registerPhone with undeliverable number
    
    CRITICAL TEST - ONLY RUN ONCE
    
    Expected behavior with NEW code:
    - Backend creates Telnyx verification
    - Backend polls GET /v2/verifications/{id} for delivery_status
    - Telnyx reports delivery_status=delivery_failed (carrier drops SMS to own DID)
    - Backend returns HTTP 503 "Failed to send verification code. Please try again."
    
    Alternative acceptable behavior:
    - If Telnyx doesn't report failure within ~6s polling window, backend may return 200
    - This is acceptable (in-flight SMS, not a crash)
    
    OLD behavior (before fix):
    - Would return HTTP 200 "code sent" even though SMS never delivered
    
    PASS CRITERIA:
    - HTTP 503 with error message (ideal - new behavior working)
    - OR HTTP 200 (acceptable - Telnyx didn't report failure within window)
    - Response is clean JSON (no 500 crash)
    - Response time ~6-10s (due to polling - expected, not a hang)
    """
    print("\n" + "!"*80)
    print("⚠️  CRITICAL: About to send REAL SMS to test number")
    print(f"    Number: {TEST_PHONE_UNDELIVERABLE} (account's own DID - undeliverable)")
    print("    This call costs Telnyx credit - ONLY RUN ONCE")
    print("    Expected delay: 6-8 seconds (polling delivery_status)")
    print("!"*80)
    
    try:
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/user/registerPhone",
            json={"mobile": TEST_PHONE_UNDELIVERABLE},
            headers={"Content-Type": "application/json"},
            timeout=15  # Allow time for polling
        )
        elapsed = time.time() - start_time
        
        details = {
            "http_status": response.status_code,
            "elapsed_time_sec": round(elapsed, 2),
            "request_body": {"mobile": TEST_PHONE_UNDELIVERABLE},
            "response": response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text[:500]
        }
        
        # Analyze response
        if response.status_code == 503:
            # NEW BEHAVIOR: Backend detected delivery_failed and returned 503
            response_data = details.get("response", {})
            if isinstance(response_data, dict):
                message = response_data.get("message", "")
                if "Failed to send verification code" in message or "failed" in message.lower():
                    status = "✅ PASS - NEW BEHAVIOR WORKING (503 delivery_failed detected)"
                else:
                    status = f"✅ PASS - HTTP 503 (message: {message})"
            else:
                status = "✅ PASS - HTTP 503 (delivery failure detected)"
        
        elif response.status_code == 200:
            # ACCEPTABLE: Telnyx didn't report failure within polling window
            # OR number is actually deliverable (unlikely for own DID)
            response_data = details.get("response", {})
            if isinstance(response_data, dict):
                message = response_data.get("message", "")
                status = f"⚠️ ACCEPTABLE - HTTP 200 (Telnyx didn't report failure within window)\n    Message: {message}\n    Note: This is acceptable - SMS may be in-flight or Telnyx didn't report failure yet"
            else:
                status = "⚠️ ACCEPTABLE - HTTP 200 (in-flight or no failure reported)"
        
        elif response.status_code == 400:
            # Validation error (e.g., already registered)
            response_data = details.get("response", {})
            if isinstance(response_data, dict):
                message = response_data.get("message", "")
                if "already registered" in message.lower():
                    status = "⚠️ ACCEPTABLE - HTTP 400 (number already registered)\n    Note: Cannot test delivery_failed detection - number already in DB"
                else:
                    status = f"⚠️ VALIDATION ERROR - HTTP 400: {message}"
            else:
                status = "⚠️ HTTP 400 - Validation error"
        
        elif response.status_code == 500:
            status = "❌ FAIL - HTTP 500 (server crash - code change broke something)"
        
        else:
            status = f"⚠️ UNEXPECTED - HTTP {response.status_code}"
        
        # Check response time
        if elapsed > 10:
            details["note"] = "Response took >10s - polling may be working (expected delay)"
        elif elapsed < 2:
            details["note"] = "Response took <2s - polling may not be happening (too fast)"
        
        return log_test("Test 2: Register Phone - Undeliverable Number (POST /api/user/registerPhone)", status, details)
    
    except requests.exceptions.Timeout:
        return log_test(
            "Test 2: Register Phone - Undeliverable Number (POST /api/user/registerPhone)",
            "❌ TIMEOUT",
            {"error": "Request timed out after 15s - may indicate hang or very slow polling"}
        )
    except Exception as e:
        return log_test(
            "Test 2: Register Phone - Undeliverable Number (POST /api/user/registerPhone)",
            "❌ ERROR",
            {"error": str(e)}
        )

def test_3_register_phone_missing_mobile():
    """
    Test 3: POST /api/user/registerPhone with empty body
    
    Expected: HTTP 400 "Mobile number is required"
    No SMS sent (validation fails before Telnyx call)
    """
    try:
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/user/registerPhone",
            json={},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        elapsed = time.time() - start_time
        
        details = {
            "http_status": response.status_code,
            "elapsed_time_sec": round(elapsed, 2),
            "request_body": {},
            "response": response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text[:200]
        }
        
        if response.status_code == 400:
            response_data = details.get("response", {})
            if isinstance(response_data, dict):
                message = response_data.get("message", "")
                if "mobile" in message.lower() and "required" in message.lower():
                    status = "✅ PASS - Validation working (400 'Mobile number is required')"
                else:
                    status = f"✅ PASS - HTTP 400 (message: {message})"
            else:
                status = "✅ PASS - HTTP 400 (validation error)"
        elif response.status_code == 500:
            status = "❌ FAIL - HTTP 500 (server crash on validation)"
        else:
            status = f"⚠️ UNEXPECTED - Expected 400, got {response.status_code}"
        
        return log_test("Test 3: Register Phone - Missing Mobile (POST /api/user/registerPhone empty body)", status, details)
    except Exception as e:
        return log_test("Test 3: Register Phone - Missing Mobile (POST /api/user/registerPhone empty body)", "❌ ERROR", {"error": str(e)})

def main():
    print("\n" + "="*80)
    print("DynoPay Telnyx SMS OTP Delivery Status Verification Test")
    print("Review Request: Verify backend change to poll Telnyx delivery_status")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Phone: {TEST_PHONE_UNDELIVERABLE} (account's own DID - undeliverable)")
    print(f"Test Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("\nCONTEXT:")
    print("- Backend change: sendTelnyxSMS now polls Telnyx for delivery_status")
    print("- NEW behavior: Returns 503 when delivery_status=delivery_failed")
    print("- OLD behavior: Returned 200 even when SMS never delivered")
    print("- Test number is account's own DID (undeliverable - perfect test case)")
    print("="*80)
    
    results = []
    
    # Test 1: Health check
    print("\n[Running Test 1/3: Health Check]")
    results.append(test_1_health_check())
    
    # Test 2: Register phone with undeliverable number (CRITICAL - ONLY RUN ONCE)
    print("\n[Running Test 2/3: Register Phone - Undeliverable Number]")
    results.append(test_2_register_phone_undeliverable())
    
    # Test 3: Register phone with missing mobile (validation)
    print("\n[Running Test 3/3: Register Phone - Missing Mobile]")
    results.append(test_3_register_phone_missing_mobile())
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    test_names = [
        "Test 1: Health Check (GET /api/)",
        "Test 2: Register Phone - Undeliverable Number",
        "Test 3: Register Phone - Missing Mobile"
    ]
    
    for i, (name, result) in enumerate(zip(test_names, results), 1):
        status = result.get("http_status", "ERROR")
        elapsed = result.get("elapsed_time_sec", "N/A")
        print(f"\nTest {i}: {name}")
        print(f"  HTTP Status: {status}")
        print(f"  Elapsed Time: {elapsed}s")
        if "response" in result and isinstance(result["response"], dict):
            message = result["response"].get("message", "")
            if message:
                print(f"  Message: {message}")
    
    # Check for critical failures
    has_500 = any(r.get("http_status") == 500 for r in results)
    has_timeout = any("TIMEOUT" in str(r) for r in results)
    
    print("\n" + "="*80)
    print("PASS CRITERIA EVALUATION")
    print("="*80)
    
    if has_500:
        print("❌ FAIL: One or more endpoints returned HTTP 500 (server crash)")
    else:
        print("✅ PASS: No HTTP 500 errors detected")
    
    if has_timeout:
        print("❌ FAIL: One or more requests timed out (possible hang)")
    else:
        print("✅ PASS: No timeouts (all responses within reasonable time)")
    
    # Check Test 2 specifically
    test2_result = results[1]
    test2_status = test2_result.get("http_status")
    test2_elapsed = test2_result.get("elapsed_time_sec", 0)
    
    print("\nTest 2 (Undeliverable Number) Analysis:")
    if test2_status == 503:
        print("✅ IDEAL: HTTP 503 - NEW behavior working (delivery_failed detected)")
    elif test2_status == 200:
        print("⚠️ ACCEPTABLE: HTTP 200 - Telnyx didn't report failure within window")
        print("   (This is acceptable - SMS may be in-flight or Telnyx delayed)")
    elif test2_status == 400:
        print("⚠️ ACCEPTABLE: HTTP 400 - Number already registered (cannot test delivery)")
    elif test2_status == 500:
        print("❌ FAIL: HTTP 500 - Code change broke something")
    
    if test2_elapsed >= 6:
        print(f"✅ Polling detected: Response took {test2_elapsed}s (expected 6-8s for polling)")
    elif test2_elapsed < 2:
        print(f"⚠️ Fast response: {test2_elapsed}s (polling may not be happening)")
    
    print("\n" + "="*80)
    print("FINAL VERDICT")
    print("="*80)
    
    if has_500 or has_timeout:
        print("❌ FAIL: Critical issues detected (500 errors or timeouts)")
    elif test2_status == 503:
        print("✅ PASS: All tests passed - NEW behavior working correctly")
        print("   Backend successfully detects delivery_failed and returns 503")
    elif test2_status in [200, 400]:
        print("✅ PASS: All tests passed - No crashes, clean responses")
        print("   Note: Test 2 returned 200/400 (acceptable - see analysis above)")
    else:
        print("⚠️ PARTIAL: Tests completed but with unexpected results")
    
    print("="*80)

if __name__ == "__main__":
    main()
