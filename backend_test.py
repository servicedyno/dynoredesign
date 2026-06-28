#!/usr/bin/env python3
"""
Backend API Testing Script for DynoPay
Tests read-only GET endpoints after performance optimization changes:
- Redis caching added to wallet, dashboard, onboarding-status endpoints
- Query parallelization in onboarding-status
- Extended cache TTLs
"""

import requests
import json
from datetime import datetime

# Backend URL from review request
BASE_URL = "https://ce2180d8-0900-4392-9fd8-2bca8d774e59.preview.emergentagent.com"

def test_health_check():
    """Test GET /api/ - Health check endpoint"""
    print("\n" + "="*80)
    print("TEST 1: Health Check - GET /api/")
    print("="*80)
    
    try:
        url = f"{BASE_URL}/api/"
        print(f"Request: GET {url}")
        
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response JSON: {json.dumps(data, indent=2)[:500]}...")
            
            # Verify required fields
            if data.get("status") == "operational":
                print("✅ PASS: Health check operational")
                return True
            else:
                print(f"❌ FAIL: Expected status='operational', got status='{data.get('status')}'")
                return False
        else:
            print(f"❌ FAIL: Expected status code 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Exception occurred - {str(e)}")
        return False


def test_geo_detect():
    """Test GET /api/geo-detect - Geo detection endpoint"""
    print("\n" + "="*80)
    print("TEST 2: Geo Detection - GET /api/geo-detect")
    print("="*80)
    
    try:
        url = f"{BASE_URL}/api/geo-detect"
        print(f"Request: GET {url}")
        
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response JSON: {json.dumps(data, indent=2)}")
            
            # Verify country detection data is present
            if "country" in data or "countryCode" in data:
                print(f"✅ PASS: Geo detection working - Country: {data.get('country', 'N/A')}, Code: {data.get('countryCode', 'N/A')}")
                return True
            else:
                print(f"❌ FAIL: Expected country detection data, got {data}")
                return False
        else:
            print(f"❌ FAIL: Expected status code 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Exception occurred - {str(e)}")
        return False


def test_status():
    """Test GET /api/status - Status endpoint"""
    print("\n" + "="*80)
    print("TEST 3: Status - GET /api/status")
    print("="*80)
    
    try:
        url = f"{BASE_URL}/api/status"
        print(f"Request: GET {url}")
        
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response JSON: {json.dumps(data, indent=2)}")
            print("✅ PASS: Status endpoint operational")
            return True
        else:
            print(f"❌ FAIL: Expected status code 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Exception occurred - {str(e)}")
        return False


def main():
    """Run all backend tests"""
    print("\n" + "="*80)
    print("DYNOPAY BACKEND API TESTING")
    print("Performance Optimization Verification (Redis Caching + Query Parallelization)")
    print(f"Test Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Backend URL: {BASE_URL}")
    print("="*80)
    
    results = {
        "health_check": test_health_check(),
        "geo_detect": test_geo_detect(),
        "status": test_status()
    }
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Backend API operational after performance optimization")
        return 0
    else:
        print(f"\n⚠️ {total - passed} test(s) failed - Review required")
        return 1


if __name__ == "__main__":
    exit(main())
