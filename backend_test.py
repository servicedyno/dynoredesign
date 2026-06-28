#!/usr/bin/env python3
"""
Backend API Testing Script for DynoPay
Tests backend endpoints to verify no regression after frontend-only Redux fix
"""

import requests
import json
from datetime import datetime

# Target URL
BASE_URL = "https://payment-config-stage.preview.emergentagent.com"

def print_separator():
    print("\n" + "="*80 + "\n")

def test_health_check():
    """Test GET /api/ - Health check endpoint"""
    print("TEST 1: Health Check (GET /api/)")
    print("-" * 80)
    
    try:
        url = f"{BASE_URL}/api/"
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response Body: {json.dumps(data, indent=2)}")
            
            # Verify expected fields
            if data.get('status') == 'operational':
                print("✅ PASS: Health check operational")
                return True, "Health check operational with status: operational"
            else:
                print(f"❌ FAIL: Expected status 'operational', got '{data.get('status')}'")
                return False, f"Expected status 'operational', got '{data.get('status')}'"
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False, f"Expected 200, got {response.status_code}"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def test_network_fees():
    """Test GET /api/pay/network-fees - Network fees endpoint"""
    print("TEST 2: Network Fees (GET /api/pay/network-fees)")
    print("-" * 80)
    
    try:
        url = f"{BASE_URL}/api/pay/network-fees"
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response Body (truncated): {json.dumps(data, indent=2)[:500]}...")
            
            # Verify expected structure (data can be array or object)
            if 'data' in data:
                if isinstance(data['data'], list):
                    chains = [item.get('chain') for item in data['data']]
                    print(f"Chains found: {chains}")
                    print("✅ PASS: Network fees retrieved successfully")
                    return True, f"Network fees retrieved with {len(chains)} chains: {', '.join(chains)}"
                elif isinstance(data['data'], dict):
                    chains = list(data['data'].keys())
                    print(f"Chains found: {chains}")
                    print("✅ PASS: Network fees retrieved successfully")
                    return True, f"Network fees retrieved with {len(chains)} chains: {', '.join(chains)}"
                else:
                    print(f"❌ FAIL: Expected 'data' to be array or object")
                    return False, "Expected 'data' to be array or object"
            else:
                print(f"❌ FAIL: Expected 'data' field in response")
                return False, "Expected 'data' field in response"
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False, f"Expected 200, got {response.status_code}"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def test_geo_detect():
    """Test GET /api/geo-detect - Geo detection endpoint"""
    print("TEST 3: Geo Detection (GET /api/geo-detect)")
    print("-" * 80)
    
    try:
        url = f"{BASE_URL}/api/geo-detect"
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response Body: {json.dumps(data, indent=2)}")
            
            # Verify expected fields
            if 'country' in data or 'countryCode' in data:
                country = data.get('country', 'N/A')
                country_code = data.get('countryCode', 'N/A')
                print(f"✅ PASS: Geo detection working - Country: {country}, Code: {country_code}")
                return True, f"Geo detection working - Country: {country}, Code: {country_code}"
            else:
                print(f"❌ FAIL: Expected 'country' or 'countryCode' in response")
                return False, "Expected 'country' or 'countryCode' in response"
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False, f"Expected 200, got {response.status_code}"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def test_binance_ping():
    """Test GET /api/diagnostics/binance-ping - Should require admin auth (401/403)"""
    print("TEST 4: Binance Ping (GET /api/diagnostics/binance-ping)")
    print("-" * 80)
    
    try:
        url = f"{BASE_URL}/api/diagnostics/binance-ping"
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code in [401, 403]:
            print(f"✅ PASS: Auth protection working (returned {response.status_code})")
            return True, f"Auth protection working - returned {response.status_code} as expected"
        else:
            print(f"❌ FAIL: Expected 401/403, got {response.status_code}")
            return False, f"Expected 401/403, got {response.status_code}"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def test_volatility():
    """Test GET /api/diagnostics/volatility - Should require admin auth (401/403)"""
    print("TEST 5: Volatility (GET /api/diagnostics/volatility)")
    print("-" * 80)
    
    try:
        url = f"{BASE_URL}/api/diagnostics/volatility"
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code in [401, 403]:
            print(f"✅ PASS: Auth protection working (returned {response.status_code})")
            return True, f"Auth protection working - returned {response.status_code} as expected"
        else:
            print(f"❌ FAIL: Expected 401/403, got {response.status_code}")
            return False, f"Expected 401/403, got {response.status_code}"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def main():
    print("="*80)
    print("DynoPay Backend API Testing")
    print("Testing after frontend-only Redux fix (DASHBOARD_FETCH_ALL)")
    print(f"Target URL: {BASE_URL}")
    print(f"Test Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print("="*80)
    
    results = []
    
    # Run all tests
    print_separator()
    result = test_health_check()
    results.append(("Health Check", result))
    
    print_separator()
    result = test_network_fees()
    results.append(("Network Fees", result))
    
    print_separator()
    result = test_geo_detect()
    results.append(("Geo Detection", result))
    
    print_separator()
    result = test_binance_ping()
    results.append(("Binance Ping", result))
    
    print_separator()
    result = test_volatility()
    results.append(("Volatility", result))
    
    # Summary
    print_separator()
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, (success, _) in results if success)
    total = len(results)
    
    for test_name, (success, message) in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
    
    print("-" * 80)
    print(f"Total: {passed}/{total} tests passed ({passed/total*100:.1f}% success rate)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - No regression detected after frontend Redux fix")
    else:
        print(f"\n⚠️ {total - passed} test(s) failed - Investigation required")
    
    print("="*80)

if __name__ == "__main__":
    main()
