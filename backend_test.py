#!/usr/bin/env python3
"""
DynoPay Backend API Testing Script
Testing after bot protection enhancement:
- Middleware now blocks ALL .php requests and MCP/SSE probes
- Bot protection should not interfere with legitimate /api/* traffic
- All API endpoints should return their normal status codes (no 500 errors)

Target: https://setup-guide-95.preview.emergentagent.com/api
"""

import requests
import json
import sys
import time
from datetime import datetime

# Test configuration from review request
BASE_URL = "https://setup-guide-95.preview.emergentagent.com/api"

# Test credentials from review request
ADMIN_CREDENTIALS = {
    "email": "admin@dynopay.io",
    "password": "Admin123!@#"
}

TEST_CREDENTIALS = {
    "email": "user@dynopay.io", 
    "password": "User123!@#"
}

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

def test_diagnostics_volatility():
    """Test GET /api/diagnostics/volatility - Should return 401/403 (requires admin auth)"""
    print("\nTesting GET /api/diagnostics/volatility - Admin endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/diagnostics/volatility", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code in [401, 403]:
            print("✅ Diagnostics volatility PASSED - Correctly requires admin auth")
            print(f"Response: {response.text[:200]}...")
            return True
        else:
            print(f"❌ Diagnostics volatility FAILED - Expected 401/403, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Diagnostics volatility FAILED - Exception: {str(e)}")
        return False

def test_send_payment_link_email():
    """Test POST /api/test/send-payment-link-email - Should return 401/403 (now requires auth)"""
    print("\nTesting POST /api/test/send-payment-link-email - Auth required endpoint...")
    try:
        # Test without authentication
        response = requests.post(f"{BASE_URL}/test/send-payment-link-email", 
                               json={}, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code in [401, 403]:
            print("✅ Send payment link email PASSED - Correctly requires auth")
            print(f"Response: {response.text[:200]}...")
            return True
        else:
            print(f"❌ Send payment link email FAILED - Expected 401/403, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Send payment link email FAILED - Exception: {str(e)}")
        return False

def main():
    print("=" * 80)
    print("DynoPay Backend API Testing - Bot Protection Enhancement Verification")
    print("=" * 80)
    print(f"Target URL: {BASE_URL}")
    print(f"Test Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print()
    print("Testing after bot protection enhancement:")
    print("- Middleware now blocks ALL .php requests and MCP/SSE probes")
    print("- Bot protection should not interfere with legitimate /api/* traffic")
    print("- All API endpoints should return their normal status codes (no 500 errors)")
    print()
    print("Expected behaviors:")
    print("1. GET /api/ — Health check, should return 200 with status 'operational'")
    print("2. GET /api/pay/network-fees — Should return 200 with network fees data")
    print("3. GET /api/geo-detect — Should return 200 with geolocation data")
    print("4. GET /api/diagnostics/binance-ping — Should return 401/403 (requires admin auth)")
    print("5. GET /api/diagnostics/volatility — Should return 401/403 (requires admin auth)")
    print("6. POST /api/test/send-payment-link-email — Should return 401/403 (requires auth)")
    print()
    
    # Run tests as specified in review request
    tests = [
        ("Health Check", test_health_check),
        ("Network Fees", test_network_fees),
        ("Geo Detection", test_geo_detect),
        ("Binance Ping (Admin)", test_binance_ping),
        ("Diagnostics Volatility (Admin)", test_diagnostics_volatility),
        ("Send Payment Link Email (Auth)", test_send_payment_link_email)
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
    core_tests = results[:3]  # Health, Network Fees, Geo Detection
    auth_tests = results[3:]  # Admin and auth-protected endpoints
    
    all_core_working = all(result[1] for result in core_tests)
    all_auth_working = all(result[1] for result in auth_tests)
    
    print("VERIFICATION SUMMARY:")
    if all_core_working:
        print("✅ All core endpoints (health, network-fees, geo-detect) working correctly")
        print("✅ Core payment and fee functionality unaffected by code changes")
    else:
        print("❌ Some core endpoints are not working correctly")
        print("❌ Code changes may have introduced regressions in core functionality")
    
    if all_auth_working:
        print("✅ All admin/auth endpoints properly secured (return 401/403)")
        print("✅ Security measures working correctly")
    else:
        print("❌ Some admin/auth endpoints are not properly secured")
        print("❌ Security configuration may need attention")
    
    if all_core_working and all_auth_working:
        print("✅ No 500 errors detected - backend appears stable after bot protection enhancement")
        print("✅ Bot protection enhancement appears successful")
        print("✅ Core functionality unaffected by bot protection middleware changes")
    
    print()
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Bot protection enhancement verification complete")
        print("✅ Backend API fully operational after bot protection enhancement")
        print("✅ Existing endpoints still work after bot protection middleware changes")
        return 0
    else:
        print(f"⚠️  {total - passed} TEST(S) FAILED")
        print("❌ Bot protection enhancement may have introduced issues that need attention")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)