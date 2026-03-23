#!/usr/bin/env python3
"""
DynoPay Backend API Testing Script
Tests trial link removal and core functionality
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://dynopay-fix-1.preview.emergentagent.com/api"
TIMEOUT = 30

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_emoji} {test_name}: {status}")
    if details:
        print(f"    Details: {details}")

def test_health_check():
    """Test 1: Health check endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/", timeout=TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "operational":
                log_test("Health Check", "PASS", f"Status: {data.get('status')}, Service: {data.get('service')}")
                return True
            else:
                log_test("Health Check", "FAIL", f"Unexpected status: {data.get('status')}")
                return False
        else:
            log_test("Health Check", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Health Check", "FAIL", f"Exception: {str(e)}")
        return False

def test_trial_endpoints_removed():
    """Test 2: Verify trial endpoints are removed/blocked"""
    results = []
    
    # Test 1: POST /api/public/create-trial-link
    try:
        payload = {
            "amount": "10",
            "currency": "USD", 
            "email": "test@test.com"
        }
        response = requests.post(
            f"{BASE_URL}/public/create-trial-link", 
            json=payload, 
            timeout=TIMEOUT
        )
        
        if response.status_code in [403, 404]:
            log_test("Trial Link Creation (POST /public/create-trial-link)", "PASS", 
                    f"Correctly blocked with HTTP {response.status_code}")
            results.append(True)
        elif response.status_code == 201:
            log_test("Trial Link Creation (POST /public/create-trial-link)", "FAIL", 
                    "ERROR: Trial endpoint still active! Returns 201 Created")
            results.append(False)
        else:
            log_test("Trial Link Creation (POST /public/create-trial-link)", "PASS", 
                    f"Blocked with HTTP {response.status_code} (acceptable)")
            results.append(True)
            
    except Exception as e:
        log_test("Trial Link Creation (POST /public/create-trial-link)", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test 2: GET /api/public/trial/test-slug
    try:
        response = requests.get(f"{BASE_URL}/public/trial/test-slug", timeout=TIMEOUT)
        
        if response.status_code == 404:
            log_test("Trial Link Access (GET /public/trial/test-slug)", "PASS", 
                    "Correctly returns 404 Not Found")
            results.append(True)
        else:
            log_test("Trial Link Access (GET /public/trial/test-slug)", "FAIL", 
                    f"Unexpected response: HTTP {response.status_code}")
            results.append(False)
            
    except Exception as e:
        log_test("Trial Link Access (GET /public/trial/test-slug)", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test 3: GET /api/public/trial-links
    try:
        response = requests.get(f"{BASE_URL}/public/trial-links", timeout=TIMEOUT)
        
        if response.status_code == 404:
            log_test("Trial Links List (GET /public/trial-links)", "PASS", 
                    "Correctly returns 404 Not Found")
            results.append(True)
        else:
            log_test("Trial Links List (GET /public/trial-links)", "FAIL", 
                    f"Unexpected response: HTTP {response.status_code}")
            results.append(False)
            
    except Exception as e:
        log_test("Trial Links List (GET /public/trial-links)", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    return all(results)

def test_core_functionality():
    """Test 3: Verify core API functionality still works"""
    results = []
    
    # Test 1: POST /api/pay/calculateFees (correct method based on router)
    try:
        payload = {
            "amount": 100,
            "cryptocurrency": "BTC"
        }
        response = requests.post(f"{BASE_URL}/pay/calculateFees", json=payload, timeout=TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            log_test("Fee Calculation (POST /pay/calculateFees)", "PASS", 
                    f"Successfully calculated fees: {data}")
            results.append(True)
        else:
            log_test("Fee Calculation (POST /pay/calculateFees)", "FAIL", 
                    f"HTTP {response.status_code}: {response.text}")
            results.append(False)
            
    except Exception as e:
        log_test("Fee Calculation", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test 2: GET /api/pay/network-fees (public endpoint)
    try:
        response = requests.get(f"{BASE_URL}/pay/network-fees", timeout=TIMEOUT)
        
        if response.status_code == 200:
            log_test("Network Fees (GET /pay/network-fees)", "PASS", "Successfully retrieved network fees")
            results.append(True)
        else:
            log_test("Network Fees (GET /pay/network-fees)", "FAIL", 
                    f"HTTP {response.status_code}: {response.text}")
            results.append(False)
            
    except Exception as e:
        log_test("Network Fees", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test 3: GET /api/geo-detect (public endpoint)
    try:
        response = requests.get(f"{BASE_URL}/geo-detect", timeout=TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            log_test("Geo Detection (GET /geo-detect)", "PASS", 
                    f"Country: {data.get('country', 'Unknown')}")
            results.append(True)
        else:
            log_test("Geo Detection (GET /geo-detect)", "FAIL", 
                    f"HTTP {response.status_code}: {response.text}")
            results.append(False)
            
    except Exception as e:
        log_test("Geo Detection", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    return all(results)

def test_no_500_errors():
    """Test 4: Verify no 500 errors on common endpoints"""
    endpoints_to_test = [
        "/",
        "/status",
        "/pay/network-fees",
        "/geo-detect"
    ]
    
    results = []
    for endpoint in endpoints_to_test:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", timeout=TIMEOUT)
            
            if response.status_code != 500:
                log_test(f"No 500 Error Check ({endpoint})", "PASS", 
                        f"HTTP {response.status_code} (not 500)")
                results.append(True)
            else:
                log_test(f"No 500 Error Check ({endpoint})", "FAIL", 
                        f"HTTP 500 Internal Server Error: {response.text}")
                results.append(False)
                
        except Exception as e:
            log_test(f"No 500 Error Check ({endpoint})", "FAIL", f"Exception: {str(e)}")
            results.append(False)
    
    return all(results)

def main():
    """Run all tests and report results"""
    print("=" * 80)
    print("DynoPay Backend API Testing - Trial Link Removal Verification")
    print(f"Target URL: {BASE_URL}")
    print("=" * 80)
    
    test_results = []
    
    # Run all tests
    test_results.append(("Health Check", test_health_check()))
    test_results.append(("Trial Endpoints Removed", test_trial_endpoints_removed()))
    test_results.append(("Core Functionality", test_core_functionality()))
    test_results.append(("No 500 Errors", test_no_500_errors()))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "PASS" if result else "FAIL"
        emoji = "✅" if result else "❌"
        print(f"{emoji} {test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nOverall Result: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Trial link removal successful!")
        return 0
    else:
        print("⚠️  SOME TESTS FAILED - Review results above")
        return 1

if __name__ == "__main__":
    sys.exit(main())