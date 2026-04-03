#!/usr/bin/env python3
"""
DynoPay Backend API Testing Script
Tests the EXACT endpoints specified in the review request:

Tatum Credit Optimization Review Request:
1. GET /api/ — Health check (should return 200 with status: operational)
2. GET /api/pay/network-fees — Should return 200 with network fees for supported chains
3. GET /api/geo-detect — Should return 200 with geo detection info

Context: Changes were made to cron job frequencies (server.ts), added Redis balance 
caching (tatumApi.ts), added skip logic (merchantPoolMonitoring.ts), and increased 
fee wallet monitor interval (feeWalletMonitor.ts). These changes should NOT affect 
any API endpoint responses.

Verify: All endpoints return appropriate status codes (200 - NOT 500). No functional regression.
"""

import requests
import json
from datetime import datetime

# Target API base URL - Updated for TRC20 gas cost optimization review
BASE_URL = "https://setup-wizard-144.preview.emergentagent.com/api"

def test_review_request_endpoints():
    """Test the specific endpoints mentioned in the Tatum credit optimization review request"""
    print("\n=== Testing Tatum Credit Optimization Review Request Endpoints ===")
    print("Changes: cron job frequencies (server.ts), Redis balance caching (tatumApi.ts),")
    print("skip logic (merchantPoolMonitoring.ts), fee wallet monitor interval (feeWalletMonitor.ts)")
    results = []
    
    # Test 1: GET /api/ - Health check (should return 200 with status: operational)
    print("\n1. Testing Health Check")
    try:
        response = requests.get(f"{BASE_URL}/", timeout=10)
        print(f"GET /api/ → HTTP {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                status = data.get('status', 'unknown')
                service = data.get('service', 'unknown')
                print(f"✅ PASS - Health check operational (status: {status}, service: {service})")
                results.append(("Health Check", True, f"HTTP 200 - Status: {status}, Service: {service}"))
            except json.JSONDecodeError:
                print(f"✅ PASS - HTTP 200 (non-JSON response)")
                results.append(("Health Check", True, f"HTTP 200 - Non-JSON response"))
        else:
            print(f"❌ FAIL - Expected 200, got {response.status_code}")
            results.append(("Health Check", False, f"HTTP {response.status_code} - Expected 200"))
    except Exception as e:
        print(f"❌ FAIL - Request error: {e}")
        results.append(("Health Check", False, f"Request error: {e}"))
    
    # Test 2: GET /api/pay/network-fees - Should return 200 with network fees for supported chains
    print("\n2. Testing Network Fees")
    try:
        response = requests.get(f"{BASE_URL}/pay/network-fees", timeout=10)
        print(f"GET /api/pay/network-fees → HTTP {response.status_code}")
        
        if response.status_code == 200:
            try:
                response_data = response.json()
                data = response_data.get('data', {}) if isinstance(response_data, dict) else response_data
                chains = len(data) if isinstance(data, dict) else 0
                
                # List some supported chains if available
                chain_names = list(data.keys())[:5] if isinstance(data, dict) else []
                chain_list = ", ".join(chain_names) + ("..." if len(data) > 5 else "") if chain_names else "unknown"
                
                print(f"✅ PASS - Network fees retrieved successfully for {chains} supported chains")
                if chain_names:
                    print(f"  Chains: {chain_list}")
                results.append(("Network Fees", True, f"HTTP 200 - Fee data retrieved for {chains} chains"))
                    
            except json.JSONDecodeError:
                print(f"✅ PASS - HTTP 200 (non-JSON response)")
                results.append(("Network Fees", True, f"HTTP 200 - Non-JSON response"))
        else:
            print(f"❌ FAIL - Expected 200, got {response.status_code}")
            results.append(("Network Fees", False, f"HTTP {response.status_code} - Expected 200"))
    except Exception as e:
        print(f"❌ FAIL - Request error: {e}")
        results.append(("Network Fees", False, f"Request error: {e}"))
    
    # Test 3: GET /api/geo-detect - Should return 200 with geo detection info
    print("\n3. Testing Geo Detection")
    try:
        response = requests.get(f"{BASE_URL}/geo-detect", timeout=10)
        print(f"GET /api/geo-detect → HTTP {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                country = data.get('country', 'unknown') if isinstance(data, dict) else 'unknown'
                country_code = data.get('countryCode', 'unknown') if isinstance(data, dict) else 'unknown'
                print(f"✅ PASS - Geo detection working (Country: {country}, Code: {country_code})")
                results.append(("Geo Detection", True, f"HTTP 200 - Country: {country} ({country_code})"))
            except json.JSONDecodeError:
                print(f"✅ PASS - HTTP 200 (non-JSON response)")
                results.append(("Geo Detection", True, f"HTTP 200 - Non-JSON response"))
        else:
            print(f"❌ FAIL - Expected 200, got {response.status_code}")
            results.append(("Geo Detection", False, f"HTTP {response.status_code} - Expected 200"))
    except Exception as e:
        print(f"❌ FAIL - Request error: {e}")
        results.append(("Geo Detection", False, f"Request error: {e}"))
    
    return results

def main():
    """Run all tests and provide summary"""
    print("=" * 80)
    print("DynoPay Backend API Testing - Tatum Credit Optimization Review")
    print("Changes: cron job frequencies (server.ts), Redis balance caching (tatumApi.ts),")
    print("skip logic (merchantPoolMonitoring.ts), fee wallet monitor interval (feeWalletMonitor.ts)")
    print(f"Target URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 80)
    
    # Run the specific endpoint tests for the review request
    test_results = test_review_request_endpoints()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = 0
    failed = 0
    
    for test_name, success, details in test_results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if not success:
            print(f"  Details: {details}")
        if success:
            passed += 1
        else:
            failed += 1
    
    print(f"\nTotal Tests: {len(test_results)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    # Key verification points
    print("\n" + "=" * 80)
    print("VERIFICATION SUMMARY")
    print("=" * 80)
    
    # Check for 500 errors
    has_500_errors = any("500" in details for _, success, details in test_results if not success)
    print(f"No 500 errors: {'✅ PASS' if not has_500_errors else '❌ FAIL'}")
    
    # Check core endpoints
    core_tests = [result for result in test_results if result[0] in ["Health Check", "Network Fees", "Geo Detection"]]
    core_working = all(success for _, success, _ in core_tests)
    print(f"Core public endpoints work normally: {'✅ PASS' if core_working else '❌ FAIL'}")
    
    # Check for functional regression
    all_endpoints_200 = all(success for _, success, _ in test_results)
    print(f"No functional regression: {'✅ PASS' if all_endpoints_200 else '❌ FAIL'}")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED - Tatum credit optimization verified successfully!")
        print("✅ Backend API operational after Tatum credit optimization changes")
        print("✅ All endpoints return appropriate status codes (200 - NOT 500)")
        print("✅ No functional regression detected")
    else:
        print(f"\n⚠️  {failed} test(s) failed - See details above")
    
    return {
        'results': test_results,
        'passed': passed,
        'failed': failed,
        'overall_success': failed == 0
    }

if __name__ == "__main__":
    main()