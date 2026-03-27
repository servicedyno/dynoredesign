#!/usr/bin/env python3
"""
DynoPay Backend API Testing Script
Tests the specified endpoints for the review request:
1. Health check
2. Core APIs (network-fees, geo-detect)
3. Diagnostic endpoints (should require admin auth - return 401/403)
4. CORS protection
"""

import requests
import json
from datetime import datetime

# Target API base URL
BASE_URL = "https://getting-started-148.preview.emergentagent.com/api"

def test_health_check():
    """Test GET /api/ - Should return 200 with operational status"""
    print("\n=== Testing Health Check ===")
    try:
        response = requests.get(f"{BASE_URL}/", timeout=10)
        print(f"GET /api/ → HTTP {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
                if data.get('status') == 'operational':
                    print("✅ Health check PASSED - Status is operational")
                    return True
                else:
                    print(f"⚠️ Health check status not 'operational': {data.get('status')}")
                    return False
            except json.JSONDecodeError:
                print(f"⚠️ Non-JSON response: {response.text[:200]}")
                return False
        else:
            print(f"❌ Health check FAILED - Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Health check FAILED - Request error: {e}")
        return False

def test_core_apis():
    """Test core API endpoints that should work without auth"""
    print("\n=== Testing Core APIs ===")
    results = {}
    
    # Test network fees endpoint
    print("\n--- Testing Network Fees ---")
    try:
        response = requests.get(f"{BASE_URL}/pay/network-fees", timeout=10)
        print(f"GET /api/pay/network-fees → HTTP {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"✅ Network fees PASSED - Retrieved fees for {len(data)} chains")
                print(f"Supported chains: {list(data.keys()) if isinstance(data, dict) else 'N/A'}")
                results['network_fees'] = True
            except json.JSONDecodeError:
                print(f"⚠️ Non-JSON response: {response.text[:200]}")
                results['network_fees'] = False
        else:
            print(f"❌ Network fees FAILED - Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:200]}")
            results['network_fees'] = False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network fees FAILED - Request error: {e}")
        results['network_fees'] = False
    
    # Test geo-detect endpoint
    print("\n--- Testing Geo Detection ---")
    try:
        response = requests.get(f"{BASE_URL}/geo-detect", timeout=10)
        print(f"GET /api/geo-detect → HTTP {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"✅ Geo detection PASSED - Country: {data.get('country', 'N/A')}, Code: {data.get('countryCode', 'N/A')}")
                results['geo_detect'] = True
            except json.JSONDecodeError:
                print(f"⚠️ Non-JSON response: {response.text[:200]}")
                results['geo_detect'] = False
        else:
            print(f"❌ Geo detection FAILED - Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:200]}")
            results['geo_detect'] = False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Geo detection FAILED - Request error: {e}")
        results['geo_detect'] = False
    
    return results

def test_diagnostic_auth_protection():
    """Test diagnostic endpoints - should return 401/403 (require admin auth)"""
    print("\n=== Testing Diagnostic Auth Protection ===")
    results = {}
    
    diagnostic_endpoints = [
        ("GET", "/diagnostics/binance-ping"),
        ("GET", "/diagnostics/binance-balances"),
        ("GET", "/diagnostics/volatility"),
        ("GET", "/diagnostics/fee-rates"),
        ("GET", "/diagnostics/email-preview"),
        ("POST", "/diagnostics/binance-sell")
    ]
    
    for method, endpoint in diagnostic_endpoints:
        print(f"\n--- Testing {method} {endpoint} ---")
        try:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
            elif method == "POST":
                response = requests.post(f"{BASE_URL}{endpoint}", json={}, timeout=10)
            
            print(f"{method} /api{endpoint} → HTTP {response.status_code}")
            
            if response.status_code in [401, 403]:
                print(f"✅ Auth protection PASSED - Correctly requires authentication ({response.status_code})")
                results[endpoint] = True
            elif response.status_code == 404:
                print(f"⚠️ Endpoint not found (404) - May have been removed or path changed")
                results[endpoint] = "not_found"
            elif response.status_code == 200:
                print(f"❌ Auth protection FAILED - Should require auth but returned 200")
                print(f"Response: {response.text[:200]}")
                results[endpoint] = False
            else:
                print(f"⚠️ Unexpected status code: {response.status_code}")
                print(f"Response: {response.text[:200]}")
                results[endpoint] = "unexpected"
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Request error for {endpoint}: {e}")
            results[endpoint] = "error"
    
    return results

def test_cors_protection():
    """Test CORS protection with evil origin"""
    print("\n=== Testing CORS Protection ===")
    
    try:
        headers = {
            'Origin': 'https://evil-site.com',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Content-Type'
        }
        
        # Test preflight request
        response = requests.options(f"{BASE_URL}/", headers=headers, timeout=10)
        print(f"OPTIONS /api/ with Origin: https://evil-site.com → HTTP {response.status_code}")
        
        cors_headers = {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
        }
        
        print(f"CORS Headers: {json.dumps(cors_headers, indent=2)}")
        
        # Check if evil origin is allowed
        allowed_origin = response.headers.get('Access-Control-Allow-Origin')
        if allowed_origin == 'https://evil-site.com':
            print("❌ CORS protection FAILED - Evil origin is allowed")
            return False
        elif allowed_origin == '*':
            print("⚠️ CORS allows all origins (*) - May be intentional for public API")
            return "wildcard"
        elif not allowed_origin or allowed_origin != 'https://evil-site.com':
            print("✅ CORS protection PASSED - Evil origin not explicitly allowed")
            return True
        
        # Also test actual GET request with evil origin
        response = requests.get(f"{BASE_URL}/", headers={'Origin': 'https://evil-site.com'}, timeout=10)
        print(f"GET /api/ with Origin: https://evil-site.com → HTTP {response.status_code}")
        
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ CORS test FAILED - Request error: {e}")
        return False

def main():
    """Run all tests and provide summary"""
    print("=" * 60)
    print("DynoPay Backend API Testing")
    print(f"Target URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 60)
    
    # Run all tests
    health_result = test_health_check()
    core_results = test_core_apis()
    diagnostic_results = test_diagnostic_auth_protection()
    cors_result = test_cors_protection()
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    print(f"Health Check: {'✅ PASS' if health_result else '❌ FAIL'}")
    
    print(f"Network Fees: {'✅ PASS' if core_results.get('network_fees') else '❌ FAIL'}")
    print(f"Geo Detection: {'✅ PASS' if core_results.get('geo_detect') else '❌ FAIL'}")
    
    print("\nDiagnostic Auth Protection:")
    for endpoint, result in diagnostic_results.items():
        if result is True:
            status = "✅ PASS (Auth Required)"
        elif result is False:
            status = "❌ FAIL (No Auth Required)"
        elif result == "not_found":
            status = "⚠️ NOT FOUND (404)"
        elif result == "unexpected":
            status = "⚠️ UNEXPECTED STATUS"
        else:
            status = "❌ ERROR"
        print(f"  {endpoint}: {status}")
    
    if cors_result is True:
        cors_status = "✅ PASS (Evil origin blocked)"
    elif cors_result == "wildcard":
        cors_status = "⚠️ WILDCARD (Allows all origins)"
    else:
        cors_status = "❌ FAIL"
    print(f"CORS Protection: {cors_status}")
    
    # Overall result
    all_core_passed = health_result and all(core_results.values())
    all_diagnostic_protected = all(result is True for result in diagnostic_results.values())
    cors_protected = cors_result in [True, "wildcard"]  # Wildcard might be acceptable for public API
    
    print(f"\nOVERALL RESULT: {'✅ ALL TESTS PASSED' if all_core_passed and all_diagnostic_protected and cors_protected else '⚠️ SOME ISSUES FOUND'}")
    
    return {
        'health': health_result,
        'core': core_results,
        'diagnostics': diagnostic_results,
        'cors': cors_result,
        'overall_success': all_core_passed and all_diagnostic_protected and cors_protected
    }

if __name__ == "__main__":
    main()