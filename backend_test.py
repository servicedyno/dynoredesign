#!/usr/bin/env python3

import requests
import json
import sys

def test_dynopay_backend_endpoints():
    """
    Test DynoPay backend API endpoints for the following features:
    1. Backend Health
    2. Email Verification API Endpoints
    3. Webhook Management API Endpoints  
    4. Knowledge Base API Endpoints
    5. Frontend Serving
    """
    results = []
    
    # Use localhost:8001 as per review request
    backend_url = "http://localhost:8001"
    
    print("="*80)
    print("DYNOPAY BACKEND API ENDPOINTS TESTING")
    print("="*80)
    print(f"Backend URL: {backend_url}")
    print()
    
    # TEST 1: Backend Health
    print("TEST 1: Backend Health Check")
    try:
        response = requests.get(f"{backend_url}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                results.append(("TEST 1 - Backend Health", "✅ PASSED", f"Status: {data.get('status')}"))
                print(f"✅ PASSED - Status: {data.get('status')}")
            else:
                results.append(("TEST 1 - Backend Health", "❌ FAILED", f"Status: {data.get('status')}"))
                print(f"❌ FAILED - Status: {data.get('status')}")
        else:
            results.append(("TEST 1 - Backend Health", "❌ FAILED", f"HTTP {response.status_code}"))
            print(f"❌ FAILED - HTTP {response.status_code}")
    except Exception as e:
        results.append(("TEST 1 - Backend Health", "❌ FAILED", str(e)))
        print(f"❌ FAILED - {str(e)}")
    
    # TEST 2: Email Verification API Endpoints
    print("\nTEST 2: Email Verification API Endpoints")
    
    # Test 2a: POST /api/user/verify-email (should return 403 without auth, NOT 404)
    print("  TEST 2a: POST /api/user/verify-email endpoint exists")
    try:
        response = requests.post(
            f"{backend_url}/api/user/verify-email",
            headers={"Content-Type": "application/json"},
            json={"otp": "123456"},
            timeout=10
        )
        if response.status_code in [401, 403]:
            results.append(("TEST 2a - verify-email endpoint", "✅ PASSED", f"HTTP {response.status_code} (endpoint exists, auth required)"))
            print(f"  ✅ PASSED - HTTP {response.status_code} (endpoint exists, auth required)")
        elif response.status_code == 404:
            results.append(("TEST 2a - verify-email endpoint", "❌ FAILED", "HTTP 404 (endpoint missing)"))
            print(f"  ❌ FAILED - HTTP 404 (endpoint missing)")
        else:
            results.append(("TEST 2a - verify-email endpoint", "⚠️ WARNING", f"HTTP {response.status_code} (unexpected response)"))
            print(f"  ⚠️ WARNING - HTTP {response.status_code} (unexpected response)")
    except Exception as e:
        results.append(("TEST 2a - verify-email endpoint", "❌ FAILED", str(e)))
        print(f"  ❌ FAILED - {str(e)}")
    
    # Test 2b: POST /api/user/resend-verification (should return 403 without auth, NOT 404)
    print("  TEST 2b: POST /api/user/resend-verification endpoint exists")
    try:
        response = requests.post(
            f"{backend_url}/api/user/resend-verification",
            headers={"Content-Type": "application/json"},
            json={},
            timeout=10
        )
        if response.status_code in [401, 403]:
            results.append(("TEST 2b - resend-verification endpoint", "✅ PASSED", f"HTTP {response.status_code} (endpoint exists, auth required)"))
            print(f"  ✅ PASSED - HTTP {response.status_code} (endpoint exists, auth required)")
        elif response.status_code == 404:
            results.append(("TEST 2b - resend-verification endpoint", "❌ FAILED", "HTTP 404 (endpoint missing)"))
            print(f"  ❌ FAILED - HTTP 404 (endpoint missing)")
        else:
            results.append(("TEST 2b - resend-verification endpoint", "⚠️ WARNING", f"HTTP {response.status_code} (unexpected response)"))
            print(f"  ⚠️ WARNING - HTTP {response.status_code} (unexpected response)")
    except Exception as e:
        results.append(("TEST 2b - resend-verification endpoint", "❌ FAILED", str(e)))
        print(f"  ❌ FAILED - {str(e)}")
    
    # TEST 3: Webhook Management API Endpoints  
    print("\nTEST 3: Webhook Management API Endpoints")
    test_company_id = "test-id"
    
    # Test 3a: GET /api/company/webhook-settings/test-id
    print("  TEST 3a: GET /api/company/webhook-settings/test-id endpoint exists")
    try:
        response = requests.get(f"{backend_url}/api/company/webhook-settings/{test_company_id}", timeout=10)
        if response.status_code in [401, 403]:
            results.append(("TEST 3a - webhook-settings GET", "✅ PASSED", f"HTTP {response.status_code} (endpoint exists, auth required)"))
            print(f"  ✅ PASSED - HTTP {response.status_code} (endpoint exists, auth required)")
        elif response.status_code == 404:
            results.append(("TEST 3a - webhook-settings GET", "❌ FAILED", "HTTP 404 (endpoint missing)"))
            print(f"  ❌ FAILED - HTTP 404 (endpoint missing)")
        else:
            results.append(("TEST 3a - webhook-settings GET", "⚠️ WARNING", f"HTTP {response.status_code} (unexpected response)"))
            print(f"  ⚠️ WARNING - HTTP {response.status_code} (unexpected response)")
    except Exception as e:
        results.append(("TEST 3a - webhook-settings GET", "❌ FAILED", str(e)))
        print(f"  ❌ FAILED - {str(e)}")
    
    # Test 3b: PUT /api/company/webhook-settings/test-id
    print("  TEST 3b: PUT /api/company/webhook-settings/test-id endpoint exists")
    try:
        response = requests.put(
            f"{backend_url}/api/company/webhook-settings/{test_company_id}",
            headers={"Content-Type": "application/json"},
            json={"webhook_url": "https://test.example.com/webhook"},
            timeout=10
        )
        if response.status_code in [401, 403]:
            results.append(("TEST 3b - webhook-settings PUT", "✅ PASSED", f"HTTP {response.status_code} (endpoint exists, auth required)"))
            print(f"  ✅ PASSED - HTTP {response.status_code} (endpoint exists, auth required)")
        elif response.status_code == 404:
            results.append(("TEST 3b - webhook-settings PUT", "❌ FAILED", "HTTP 404 (endpoint missing)"))
            print(f"  ❌ FAILED - HTTP 404 (endpoint missing)")
        else:
            results.append(("TEST 3b - webhook-settings PUT", "⚠️ WARNING", f"HTTP {response.status_code} (unexpected response)"))
            print(f"  ⚠️ WARNING - HTTP {response.status_code} (unexpected response)")
    except Exception as e:
        results.append(("TEST 3b - webhook-settings PUT", "❌ FAILED", str(e)))
        print(f"  ❌ FAILED - {str(e)}")
    
    # Test 3c: POST /api/company/webhook-test/test-id
    print("  TEST 3c: POST /api/company/webhook-test/test-id endpoint exists")
    try:
        response = requests.post(
            f"{backend_url}/api/company/webhook-test/{test_company_id}",
            headers={"Content-Type": "application/json"},
            json={},
            timeout=10
        )
        if response.status_code in [401, 403]:
            results.append(("TEST 3c - webhook-test POST", "✅ PASSED", f"HTTP {response.status_code} (endpoint exists, auth required)"))
            print(f"  ✅ PASSED - HTTP {response.status_code} (endpoint exists, auth required)")
        elif response.status_code == 404:
            results.append(("TEST 3c - webhook-test POST", "❌ FAILED", "HTTP 404 (endpoint missing)"))
            print(f"  ❌ FAILED - HTTP 404 (endpoint missing)")
        else:
            results.append(("TEST 3c - webhook-test POST", "⚠️ WARNING", f"HTTP {response.status_code} (unexpected response)"))
            print(f"  ⚠️ WARNING - HTTP {response.status_code} (unexpected response)")
    except Exception as e:
        results.append(("TEST 3c - webhook-test POST", "❌ FAILED", str(e)))
        print(f"  ❌ FAILED - {str(e)}")
    
    # Test 3d: GET /api/company/webhook-history/test-id
    print("  TEST 3d: GET /api/company/webhook-history/test-id endpoint exists")
    try:
        response = requests.get(f"{backend_url}/api/company/webhook-history/{test_company_id}", timeout=10)
        if response.status_code in [401, 403]:
            results.append(("TEST 3d - webhook-history GET", "✅ PASSED", f"HTTP {response.status_code} (endpoint exists, auth required)"))
            print(f"  ✅ PASSED - HTTP {response.status_code} (endpoint exists, auth required)")
        elif response.status_code == 404:
            results.append(("TEST 3d - webhook-history GET", "❌ FAILED", "HTTP 404 (endpoint missing)"))
            print(f"  ❌ FAILED - HTTP 404 (endpoint missing)")
        else:
            results.append(("TEST 3d - webhook-history GET", "⚠️ WARNING", f"HTTP {response.status_code} (unexpected response)"))
            print(f"  ⚠️ WARNING - HTTP {response.status_code} (unexpected response)")
    except Exception as e:
        results.append(("TEST 3d - webhook-history GET", "❌ FAILED", str(e)))
        print(f"  ❌ FAILED - {str(e)}")
    
    # TEST 4: Knowledge Base API Endpoints
    print("\nTEST 4: Knowledge Base API Endpoints")
    
    # Test 4a: GET /api/kb/categories
    print("  TEST 4a: GET /api/kb/categories endpoint")
    try:
        response = requests.get(f"{backend_url}/api/kb/categories", timeout=10)
        if response.status_code == 200:
            data = response.json()
            results.append(("TEST 4a - kb categories", "✅ PASSED", f"HTTP 200 - {data.get('message', 'Success')}"))
            print(f"  ✅ PASSED - HTTP 200 - {data.get('message', 'Success')}")
        else:
            results.append(("TEST 4a - kb categories", "❌ FAILED", f"HTTP {response.status_code}"))
            print(f"  ❌ FAILED - HTTP {response.status_code}")
    except Exception as e:
        results.append(("TEST 4a - kb categories", "❌ FAILED", str(e)))
        print(f"  ❌ FAILED - {str(e)}")
    
    # Test 4b: GET /api/kb/articles
    print("  TEST 4b: GET /api/kb/articles endpoint")
    try:
        response = requests.get(f"{backend_url}/api/kb/articles", timeout=10)
        if response.status_code == 200:
            data = response.json()
            results.append(("TEST 4b - kb articles", "✅ PASSED", f"HTTP 200 - {data.get('message', 'Success')}"))
            print(f"  ✅ PASSED - HTTP 200 - {data.get('message', 'Success')}")
        else:
            results.append(("TEST 4b - kb articles", "❌ FAILED", f"HTTP {response.status_code}"))
            print(f"  ❌ FAILED - HTTP {response.status_code}")
    except Exception as e:
        results.append(("TEST 4b - kb articles", "❌ FAILED", str(e)))
        print(f"  ❌ FAILED - {str(e)}")
    
    # Test 4c: GET /api/kb/articles?limit=5
    print("  TEST 4c: GET /api/kb/articles?limit=5 endpoint")
    try:
        response = requests.get(f"{backend_url}/api/kb/articles?limit=5", timeout=10)
        if response.status_code == 200:
            data = response.json()
            results.append(("TEST 4c - kb articles limit", "✅ PASSED", f"HTTP 200 - {data.get('message', 'Success')}"))
            print(f"  ✅ PASSED - HTTP 200 - {data.get('message', 'Success')}")
        else:
            results.append(("TEST 4c - kb articles limit", "❌ FAILED", f"HTTP {response.status_code}"))
            print(f"  ❌ FAILED - HTTP {response.status_code}")
    except Exception as e:
        results.append(("TEST 4c - kb articles limit", "❌ FAILED", str(e)))
        print(f"  ❌ FAILED - {str(e)}")
    
    # Test 4d: GET /api/kb/search?q=test
    print("  TEST 4d: GET /api/kb/search?q=test endpoint")
    try:
        response = requests.get(f"{backend_url}/api/kb/search?q=test", timeout=10)
        if response.status_code == 200:
            data = response.json()
            results.append(("TEST 4d - kb search", "✅ PASSED", f"HTTP 200 - {data.get('message', 'Success')}"))
            print(f"  ✅ PASSED - HTTP 200 - {data.get('message', 'Success')}")
        else:
            results.append(("TEST 4d - kb search", "❌ FAILED", f"HTTP {response.status_code}"))
            print(f"  ❌ FAILED - HTTP {response.status_code}")
    except Exception as e:
        results.append(("TEST 4d - kb search", "❌ FAILED", str(e)))
        print(f"  ❌ FAILED - {str(e)}")
    
    # Test 4e: GET /api/kb/popular
    print("  TEST 4e: GET /api/kb/popular endpoint")
    try:
        response = requests.get(f"{backend_url}/api/kb/popular", timeout=10)
        if response.status_code == 200:
            data = response.json()
            results.append(("TEST 4e - kb popular", "✅ PASSED", f"HTTP 200 - {data.get('message', 'Success')}"))
            print(f"  ✅ PASSED - HTTP 200 - {data.get('message', 'Success')}")
        else:
            results.append(("TEST 4e - kb popular", "❌ FAILED", f"HTTP {response.status_code}"))
            print(f"  ❌ FAILED - HTTP {response.status_code}")
    except Exception as e:
        results.append(("TEST 4e - kb popular", "❌ FAILED", str(e)))
        print(f"  ❌ FAILED - {str(e)}")
    
    # TEST 5: Frontend Serving (Note: Should NOT test frontend per instructions, but included for completeness)
    print("\nTEST 5: Frontend Serving (Note: Frontend testing not performed per instructions)")
    results.append(("TEST 5 - Frontend serving", "⚠️ SKIPPED", "Frontend testing not performed per system instructions"))
    print("  ⚠️ SKIPPED - Frontend testing not performed per system instructions")
    
    # Summary
    print("\n" + "="*80)
    print("DYNOPAY BACKEND API ENDPOINTS TESTING SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, status, _ in results if status == "✅ PASSED")
    failed = sum(1 for _, status, _ in results if status == "❌ FAILED")
    warnings = sum(1 for _, status, _ in results if status in ["⚠️ WARNING", "⚠️ SKIPPED"])
    total = len(results)
    
    for test_name, status, details in results:
        print(f"{status} {test_name}: {details}")
    
    print(f"\nOVERALL RESULTS: {passed}/{total-1} tests passed (excluding skipped frontend test)")
    if warnings > 0:
        print(f"⚠️ {warnings} warnings/skipped")
    
    # Calculate success rate excluding skipped tests
    testable_total = total - sum(1 for _, status, _ in results if status == "⚠️ SKIPPED")
    success_rate = (passed / testable_total) * 100 if testable_total > 0 else 0
    print(f"Success Rate: {success_rate:.1f}%")
    
    if failed == 0:
        print("\n🎉 ALL BACKEND API ENDPOINT TESTS PASSED!")
        return True
    else:
        print(f"\n⚠️ {failed} TEST(S) FAILED - Review implementation")
        return False

if __name__ == "__main__":
    success = test_dynopay_backend_endpoints()
    sys.exit(0 if success else 1)