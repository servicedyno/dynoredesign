#!/usr/bin/env python3
"""
DynoPay Backend API Regression Testing
Testing after hardening /diagnostics/recover-stuck-payment endpoint
Target: https://config-hub-36.preview.emergentagent.com
"""

import requests
import json
import sys
from datetime import datetime

# Test configuration
BASE_URL = "https://config-hub-36.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def test_health_check():
    """Test GET /api/ - Health check endpoint"""
    print("Testing GET /api/ - Health check...")
    try:
        response = requests.get(f"{API_BASE}/", timeout=30)
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
    """Test GET /api/pay/network-fees - Core functionality"""
    print("\nTesting GET /api/pay/network-fees - Network fees...")
    try:
        response = requests.get(f"{API_BASE}/pay/network-fees", timeout=30)
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
    """Test GET /api/geo-detect - Core functionality"""
    print("\nTesting GET /api/geo-detect - Geo detection...")
    try:
        response = requests.get(f"{API_BASE}/geo-detect", timeout=30)
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

def main():
    """Run all regression tests"""
    print("=" * 60)
    print("DynoPay Backend API Regression Testing")
    print("After hardening /diagnostics/recover-stuck-payment endpoint")
    print(f"Target URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 60)
    
    # Run all tests
    tests = [
        ("Health Check", test_health_check),
        ("Network Fees", test_network_fees),
        ("Geo Detection", test_geo_detect)
    ]
    
    results = []
    for test_name, test_func in tests:
        result = test_func()
        results.append((test_name, result))
    
    # Summary
    print("\n" + "=" * 60)
    print("REGRESSION TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print(f"\nTotal: {len(results)} tests")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED - Backend API fully operational after diagnostics endpoint hardening")
        print("No 500 errors detected - /diagnostics/recover-stuck-payment hardening did not break core functionality")
        return 0
    else:
        print(f"\n⚠️  {failed} TEST(S) FAILED - Backend issues detected")
        return 1

if __name__ == "__main__":
    sys.exit(main())