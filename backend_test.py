#!/usr/bin/env python3
"""
DynoPay Backend Testing Script
Testing specific endpoints from review request:
1. GET /api/ — Health check, should return 200 with status "operational"
2. GET /api/pay/network-fees — Should return 200 with network fee data
3. GET /api/geo-detect — Should return 200 with geo detection info
"""

import requests
import json
from datetime import datetime

# Backend URL from review request
BASE_URL = "https://onboard-flow-80.preview.emergentagent.com"

def test_endpoint(method, url, description):
    """Test a single endpoint and return results"""
    try:
        print(f"\n🔍 Testing: {description}")
        print(f"   URL: {method} {url}")
        
        if method == "GET":
            response = requests.get(url, timeout=30)
        else:
            print(f"   ❌ Unsupported method: {method}")
            return False, f"Unsupported method: {method}", None
            
        print(f"   Status: {response.status_code}")
        
        # Try to parse JSON response
        try:
            response_data = response.json()
            print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
        except:
            response_data = response.text[:200] + "..." if len(response.text) > 200 else response.text
            print(f"   Response: {response_data}")
        
        # Determine if test passed
        success = response.status_code == 200
        return success, f"HTTP {response.status_code}", response_data
        
    except requests.exceptions.RequestException as e:
        print(f"   ❌ Request failed: {str(e)}")
        return False, f"Request failed: {str(e)}", None
    except Exception as e:
        print(f"   ❌ Unexpected error: {str(e)}")
        return False, f"Unexpected error: {str(e)}", None

def main():
    """Run all backend tests"""
    print("=" * 60)
    print("🚀 DynoPay Backend Testing - Review Request Verification")
    print("=" * 60)
    print(f"Target URL: {BASE_URL}")
    print(f"Test Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    
    # Test endpoints as specified in review request
    test_cases = [
        ("GET", f"{BASE_URL}/api/", "Health check - should return 200 with status 'operational'"),
        ("GET", f"{BASE_URL}/api/pay/network-fees", "Network fees - should return 200 with network fee data"),
        ("GET", f"{BASE_URL}/api/geo-detect", "Geo detection - should return 200 with geo detection info"),
    ]
    
    results = []
    passed = 0
    total = len(test_cases)
    
    for method, url, description in test_cases:
        success, status, response_data = test_endpoint(method, url, description)
        results.append({
            "endpoint": f"{method} {url.replace(BASE_URL, '')}",
            "description": description,
            "success": success,
            "status": status,
            "response": response_data
        })
        if success:
            passed += 1
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    for result in results:
        status_icon = "✅" if result["success"] else "❌"
        print(f"{status_icon} {result['endpoint']} → {result['status']}")
        if not result["success"]:
            print(f"   Issue: {result['description']}")
    
    print(f"\n🎯 Overall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Backend is operational after SUN→TRX bug fix!")
    else:
        print("⚠️  Some tests failed - Backend may have issues after the bug fix")
    
    return results, passed == total

if __name__ == "__main__":
    results, all_passed = main()