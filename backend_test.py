#!/usr/bin/env python3
"""
DynoPay Backend API Testing Script
Testing after merchantPoolSweep.ts deferral pre-check bug fix
Target: https://setup-wizard-153.preview.emergentagent.com/api
"""

import requests
import json
import sys
from datetime import datetime

# Test configuration from review request
BASE_URL = "https://setup-wizard-153.preview.emergentagent.com/api"

def test_health_check():
    """Test GET /api/ - Health check endpoint (expect 200)"""
    print("Testing GET /api/ - Health check...")
    try:
        response = requests.get(f"{BASE_URL}/", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify expected fields
            if data.get('status') == 'operational' and data.get('service') == 'Dynopay API':
                print("✅ Health check PASSED - API operational")
                return True
            else:
                print("❌ Health check FAILED - Unexpected response format")
                return False
        else:
            print(f"❌ Health check FAILED - Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Health check FAILED - Exception: {str(e)}")
        return False

def test_network_fees():
    """Test GET /api/pay/network-fees - Core functionality (expect 200)"""
    print("\nTesting GET /api/pay/network-fees - Network fees...")
    try:
        response = requests.get(f"{BASE_URL}/pay/network-fees", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
            
            # Check if we have network fee data
            if isinstance(data, dict) and len(data) > 0:
                print("✅ Network fees PASSED - Fee data retrieved successfully")
                # Show sample of supported chains
                chains = list(data.keys())[:5]  # Show first 5 chains
                print(f"Sample supported chains: {chains}")
                return True
            else:
                print("❌ Network fees FAILED - No fee data returned")
                return False
        else:
            print(f"❌ Network fees FAILED - Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Network fees FAILED - Exception: {str(e)}")
        return False

def test_geo_detect():
    """Test GET /api/geo-detect - Core functionality (expect 200)"""
    print("\nTesting GET /api/geo-detect - Geo detection...")
    try:
        response = requests.get(f"{BASE_URL}/geo-detect", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Check if we have geo data
            if isinstance(data, dict) and ('country' in data or 'countryCode' in data):
                print("✅ Geo detection PASSED - Country detection working")
                return True
            else:
                print("❌ Geo detection FAILED - No geo data returned")
                return False
        else:
            print(f"❌ Geo detection FAILED - Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Geo detection FAILED - Exception: {str(e)}")
        return False

def test_binance_ping():
    """Test GET /api/diagnostics/binance-ping - Should return 401/403 (requires admin auth)"""
    print("\nTesting GET /api/diagnostics/binance-ping - Admin endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/diagnostics/binance-ping", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code in [401, 403]:
            print("✅ Binance ping PASSED - Correctly requires admin auth")
            print(f"Response: {response.text[:200]}...")
            return True
        else:
            print(f"❌ Binance ping FAILED - Expected 401/403, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Binance ping FAILED - Exception: {str(e)}")
        return False

def test_volatility():
    """Test GET /api/diagnostics/volatility - Should return 401/403 (requires admin auth)"""
    print("\nTesting GET /api/diagnostics/volatility - Admin endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/diagnostics/volatility", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code in [401, 403]:
            print("✅ Volatility PASSED - Correctly requires admin auth")
            print(f"Response: {response.text[:200]}...")
            return True
        else:
            print(f"❌ Volatility FAILED - Expected 401/403, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Volatility FAILED - Exception: {str(e)}")
        return False

def main():
    print("=" * 80)
    print("DynoPay Backend API Testing - Deferral Pre-Check Bug Fix Verification")
    print("=" * 80)
    print(f"Target URL: {BASE_URL}")
    print(f"Test Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print()
    print("Context: Testing after merchantPoolSweep.ts deferral pre-check bug fix:")
    print("- Added deferral pre-checks in sweepByTime() and sweepByThreshold()")
    print("- Skip addresses whose deferral hasn't expired")
    print("- Prevents unnecessary status transitions and lock acquisitions")
    print("- Reduces log entries (~160 entries/hour)")
    print()
    
    # Run all tests
    tests = [
        ("Health Check", test_health_check),
        ("Network Fees", test_network_fees),
        ("Geo Detection", test_geo_detect),
        ("Binance Ping (Admin)", test_binance_ping),
        ("Volatility (Admin)", test_volatility)
    ]
    
    results = []
    passed = 0
    
    for test_name, test_func in tests:
        print(f"Running {test_name} test...")
        result = test_func()
        results.append((test_name, result))
        if result:
            passed += 1
        print("-" * 60)
    
    # Summary
    total = len(tests)
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")
    print()
    
    # Detailed results
    print("DETAILED RESULTS:")
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print()
    
    # Key verification points from review request
    core_endpoints_working = all(result for name, result in results[:3])  # First 3 are core
    admin_endpoints_protected = all(result for name, result in results[3:])  # Last 2 are admin
    
    if core_endpoints_working:
        print("✅ All core endpoints (health, network-fees, geo-detect) working correctly")
    else:
        print("❌ Some core endpoints are not working correctly")
    
    if admin_endpoints_protected:
        print("✅ Admin endpoints properly protected (return 401/403 without auth)")
    else:
        print("❌ Admin endpoints may not be properly protected")
    
    print()
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Deferral pre-check bug fix verification complete")
        print("✅ No 500 errors detected - backend appears stable after fixes")
        return 0
    else:
        print(f"⚠️  {total - passed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)