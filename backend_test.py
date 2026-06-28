#!/usr/bin/env python3
"""
Backend API Testing Script for DynoPay
Tests the backend API endpoints after TypeScript compilation fix
"""

import requests
import json
from datetime import datetime

# Target URL from test_result.md
BASE_URL = "https://blockchain-checkout-5.preview.emergentagent.com"

def test_health_check():
    """Test GET /api/ - Health check endpoint"""
    print("\n" + "="*60)
    print("TEST 1: Health Check - GET /api/")
    print("="*60)
    
    try:
        url = f"{BASE_URL}/api/"
        print(f"Request: GET {url}")
        
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"Response Body: {json.dumps(data, indent=2)}")
                
                # Verify expected fields
                if data.get('status') == 'operational':
                    print("✅ PASS: Health check returned status 'operational'")
                    return True
                else:
                    print(f"❌ FAIL: Expected status 'operational', got '{data.get('status')}'")
                    return False
            except json.JSONDecodeError as e:
                print(f"❌ FAIL: Invalid JSON response: {e}")
                print(f"Raw response: {response.text[:500]}")
                return False
        else:
            print(f"❌ FAIL: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAIL: Request failed with error: {e}")
        return False

def test_network_fees():
    """Test GET /api/pay/network-fees - Network fees endpoint"""
    print("\n" + "="*60)
    print("TEST 2: Network Fees - GET /api/pay/network-fees")
    print("="*60)
    
    try:
        url = f"{BASE_URL}/api/pay/network-fees"
        print(f"Request: GET {url}")
        
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"Response Body: {json.dumps(data, indent=2)}")
                
                # Verify response structure
                if 'data' in data or 'message' in data:
                    print("✅ PASS: Network fees endpoint returned valid data structure")
                    return True
                else:
                    print(f"❌ FAIL: Response missing expected 'data' or 'message' field")
                    return False
            except json.JSONDecodeError as e:
                print(f"❌ FAIL: Invalid JSON response: {e}")
                print(f"Raw response: {response.text[:500]}")
                return False
        else:
            print(f"❌ FAIL: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAIL: Request failed with error: {e}")
        return False

def main():
    """Run all backend tests"""
    print("\n" + "="*60)
    print("DYNOPAY BACKEND API TESTING")
    print(f"Target: {BASE_URL}")
    print(f"Test Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("Context: Quick verification after TypeScript compilation fix")
    print("="*60)
    
    results = []
    
    # Run tests
    results.append(("Health Check (GET /api/)", test_health_check()))
    results.append(("Network Fees (GET /api/pay/network-fees)", test_network_fees()))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Backend API is operational")
        return 0
    else:
        print(f"\n⚠️ {total - passed} test(s) failed - Backend API has issues")
        return 1

if __name__ == "__main__":
    exit(main())
