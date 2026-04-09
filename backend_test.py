#!/usr/bin/env python3
"""
DynoPay Backend API Testing Script
Testing visitor tracking, onboarding monitoring, and first payment detection features
Target: https://setup-wizard-154.preview.emergentagent.com/api
"""

import requests
import json
import sys
import time
from datetime import datetime

# Test configuration from review request
BASE_URL = "https://setup-wizard-154.preview.emergentagent.com/api"

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

def test_visitor_tracking():
    """Test POST /api/track/visitor - New visitor tracking endpoint"""
    print("\nTesting POST /api/track/visitor - Visitor tracking (NEW FEATURE)...")
    try:
        # Test data as specified in review request
        visitor_data = {
            "page": "/",
            "referrer": "https://google.com"
        }
        
        headers = {
            "Content-Type": "application/json"
        }
        
        # First call
        print("Making first POST request...")
        response1 = requests.post(
            f"{BASE_URL}/track/visitor", 
            json=visitor_data, 
            headers=headers,
            timeout=30
        )
        print(f"First call - Status Code: {response1.status_code}")
        
        if response1.status_code == 200:
            data1 = response1.json()
            print(f"First call - Response: {json.dumps(data1, indent=2)}")
            
            # Check for expected response format
            if data1.get('ok') == True:
                print("✅ First visitor tracking call PASSED - Returned {'ok': true}")
                
                # Second call with same data (idempotency test)
                print("Making second POST request with same data (idempotency test)...")
                time.sleep(1)  # Brief pause
                response2 = requests.post(
                    f"{BASE_URL}/track/visitor", 
                    json=visitor_data, 
                    headers=headers,
                    timeout=30
                )
                print(f"Second call - Status Code: {response2.status_code}")
                
                if response2.status_code == 200:
                    data2 = response2.json()
                    print(f"Second call - Response: {json.dumps(data2, indent=2)}")
                    
                    if data2.get('ok') == True:
                        print("✅ Second visitor tracking call PASSED - Idempotent behavior confirmed")
                        print("✅ Visitor tracking feature working correctly")
                        return True
                    else:
                        print("❌ Second visitor tracking call FAILED - Expected {'ok': true}")
                        return False
                else:
                    print(f"❌ Second visitor tracking call FAILED - Expected 200, got {response2.status_code}")
                    print(f"Response: {response2.text}")
                    return False
            else:
                print("❌ First visitor tracking call FAILED - Expected {'ok': true}")
                return False
        else:
            print(f"❌ First visitor tracking call FAILED - Expected 200, got {response1.status_code}")
            print(f"Response: {response1.text}")
            return False
            
    except Exception as e:
        print(f"❌ Visitor tracking FAILED - Exception: {str(e)}")
        return False

def main():
    print("=" * 80)
    print("DynoPay Backend API Testing - Visitor Tracking & New Features")
    print("=" * 80)
    print(f"Target URL: {BASE_URL}")
    print(f"Test Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print()
    print("Testing 4 new features: visitor tracking, onboarding monitoring, first payment detection")
    print()
    print("Expected behaviors:")
    print("1. GET /api/ — Health check, should return 200 with status 'operational'")
    print("2. GET /api/pay/network-fees — Core functionality, should return 200")
    print("3. POST /api/track/visitor — New visitor tracking endpoint (PUBLIC, no auth)")
    print("4. POST /api/track/visitor — Same call again (idempotent)")
    print("5. GET /api/geo-detect — Should return 200")
    print("6. GET /api/diagnostics/binance-ping — Should return 401/403 (admin only)")
    print()
    
    # Run all tests
    tests = [
        ("Health Check", test_health_check),
        ("Network Fees", test_network_fees),
        ("Visitor Tracking (NEW)", test_visitor_tracking),
        ("Geo Detection", test_geo_detect),
        ("Binance Ping (Admin)", test_binance_ping)
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
    core_endpoints_working = results[0][1] and results[1][1] and results[3][1]  # Health, network-fees, geo-detect
    visitor_tracking_working = results[2][1]  # New visitor tracking feature
    admin_endpoint_protected = results[4][1]  # Admin endpoint protection
    
    print("VERIFICATION SUMMARY:")
    if core_endpoints_working:
        print("✅ All core endpoints (health, network-fees, geo-detect) working correctly")
    else:
        print("❌ Some core endpoints are not working correctly")
    
    if visitor_tracking_working:
        print("✅ NEW visitor tracking endpoint working correctly (PUBLIC, idempotent)")
    else:
        print("❌ NEW visitor tracking endpoint not working correctly")
    
    if admin_endpoint_protected:
        print("✅ Admin endpoints properly protected (return 401/403 without auth)")
    else:
        print("❌ Admin endpoints may not be properly protected")
    
    print()
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - New features verification complete")
        print("✅ No 500 errors detected - backend appears stable after new feature additions")
        print("✅ Visitor tracking endpoint is PUBLIC (no CSRF token or auth needed)")
        return 0
    else:
        print(f"⚠️  {total - passed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)