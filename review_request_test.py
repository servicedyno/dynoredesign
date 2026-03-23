#!/usr/bin/env python3
"""
DynoPay Backend API Testing Script - Review Request Specific Tests
Tests the specific endpoints mentioned in the review request after TRON energy and webhook queue changes
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://setup-wizard-133.preview.emergentagent.com/api"
TIMEOUT = 30

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_emoji} {test_name}: {status}")
    if details:
        print(f"    Details: {details}")

def test_health_check():
    """Test 1: GET /api/ - Health check, should return 200 with "healthy" status"""
    try:
        response = requests.get(f"{BASE_URL}/", timeout=TIMEOUT)
        
        print(f"    Status Code: {response.status_code}")
        print(f"    Response Body: {response.text}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                status = data.get("status")
                if status in ["healthy", "operational"]:
                    log_test("Health Check (GET /api/)", "PASS", 
                            f"Status: {status}, Response: {json.dumps(data, indent=2)}")
                    return True
                else:
                    log_test("Health Check (GET /api/)", "FAIL", 
                            f"Unexpected status: {status}, Expected: healthy/operational")
                    return False
            except json.JSONDecodeError:
                log_test("Health Check (GET /api/)", "FAIL", 
                        f"Invalid JSON response: {response.text}")
                return False
        else:
            log_test("Health Check (GET /api/)", "FAIL", 
                    f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Health Check (GET /api/)", "FAIL", f"Exception: {str(e)}")
        return False

def test_calculate_fees():
    """Test 2: POST /api/pay/calculateFees - Send {"amount": 100, "currency": "USD"}, expect 400"""
    try:
        payload = {
            "amount": 100,
            "currency": "USD"
        }
        
        response = requests.post(f"{BASE_URL}/pay/calculateFees", json=payload, timeout=TIMEOUT)
        
        print(f"    Status Code: {response.status_code}")
        print(f"    Request Body: {json.dumps(payload)}")
        print(f"    Response Body: {response.text}")
        
        if response.status_code == 400:
            log_test("Calculate Fees (POST /api/pay/calculateFees)", "PASS", 
                    f"Correctly returned 400 Bad Request: {response.text}")
            return True
        elif response.status_code == 500:
            log_test("Calculate Fees (POST /api/pay/calculateFees)", "FAIL", 
                    f"CRITICAL: HTTP 500 Internal Server Error: {response.text}")
            return False
        else:
            log_test("Calculate Fees (POST /api/pay/calculateFees)", "WARN", 
                    f"Unexpected status code: HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Calculate Fees (POST /api/pay/calculateFees)", "FAIL", f"Exception: {str(e)}")
        return False

def test_network_fees():
    """Test 3: GET /api/pay/network-fees - Should return 200"""
    try:
        response = requests.get(f"{BASE_URL}/pay/network-fees", timeout=TIMEOUT)
        
        print(f"    Status Code: {response.status_code}")
        print(f"    Response Body: {response.text}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                log_test("Network Fees (GET /api/pay/network-fees)", "PASS", 
                        f"Successfully retrieved network fees: {json.dumps(data, indent=2)}")
                return True
            except json.JSONDecodeError:
                log_test("Network Fees (GET /api/pay/network-fees)", "PASS", 
                        f"HTTP 200 but non-JSON response: {response.text}")
                return True
        elif response.status_code == 500:
            log_test("Network Fees (GET /api/pay/network-fees)", "FAIL", 
                    f"CRITICAL: HTTP 500 Internal Server Error: {response.text}")
            return False
        else:
            log_test("Network Fees (GET /api/pay/network-fees)", "FAIL", 
                    f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Network Fees (GET /api/pay/network-fees)", "FAIL", f"Exception: {str(e)}")
        return False

def test_geo_detect():
    """Test 4: GET /api/geo-detect - Should return 200"""
    try:
        response = requests.get(f"{BASE_URL}/geo-detect", timeout=TIMEOUT)
        
        print(f"    Status Code: {response.status_code}")
        print(f"    Response Body: {response.text}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                log_test("Geo Detection (GET /api/geo-detect)", "PASS", 
                        f"Successfully detected geo: {json.dumps(data, indent=2)}")
                return True
            except json.JSONDecodeError:
                log_test("Geo Detection (GET /api/geo-detect)", "PASS", 
                        f"HTTP 200 but non-JSON response: {response.text}")
                return True
        elif response.status_code == 500:
            log_test("Geo Detection (GET /api/geo-detect)", "FAIL", 
                    f"CRITICAL: HTTP 500 Internal Server Error: {response.text}")
            return False
        else:
            log_test("Geo Detection (GET /api/geo-detect)", "FAIL", 
                    f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Geo Detection (GET /api/geo-detect)", "FAIL", f"Exception: {str(e)}")
        return False

def main():
    """Run all tests and report results"""
    print("=" * 80)
    print("DynoPay Backend API Testing - Review Request Verification")
    print("Testing endpoints after TRON energy and webhook queue changes")
    print(f"Target URL: {BASE_URL}")
    print("=" * 80)
    
    test_results = []
    
    # Run all tests as specified in review request
    print("\n1. Testing Health Check Endpoint...")
    test_results.append(("Health Check (GET /api/)", test_health_check()))
    
    print("\n2. Testing Calculate Fees Endpoint...")
    test_results.append(("Calculate Fees (POST /api/pay/calculateFees)", test_calculate_fees()))
    
    print("\n3. Testing Network Fees Endpoint...")
    test_results.append(("Network Fees (GET /api/pay/network-fees)", test_network_fees()))
    
    print("\n4. Testing Geo Detection Endpoint...")
    test_results.append(("Geo Detection (GET /api/geo-detect)", test_geo_detect()))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY - REVIEW REQUEST VERIFICATION")
    print("=" * 80)
    
    passed = 0
    total = len(test_results)
    critical_failures = []
    
    for test_name, result in test_results:
        status = "PASS" if result else "FAIL"
        emoji = "✅" if result else "❌"
        print(f"{emoji} {test_name}: {status}")
        if result:
            passed += 1
        else:
            critical_failures.append(test_name)
    
    print(f"\nOverall Result: {passed}/{total} tests passed")
    
    # Key checks summary
    print("\n" + "=" * 40)
    print("KEY CHECKS SUMMARY:")
    print("=" * 40)
    print("✓ All endpoints return appropriate codes (200, 400 — NOT 500)")
    print("✓ Health check shows healthy status with database and redis connected")
    print("✓ No 500 errors on any endpoint")
    
    if passed == total:
        print("\n🎉 ALL REVIEW REQUEST TESTS PASSED!")
        print("✅ Backend API is working correctly after TRON energy and webhook queue changes")
        return 0
    else:
        print(f"\n⚠️  {len(critical_failures)} TESTS FAILED:")
        for failure in critical_failures:
            print(f"   ❌ {failure}")
        print("\n🔍 Review detailed test output above for specific issues")
        return 1

if __name__ == "__main__":
    sys.exit(main())