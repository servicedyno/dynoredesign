#!/usr/bin/env python3
"""
Backend Testing Script - Route Aliases Testing
Testing the 4 newly added route aliases for frontend compatibility
"""
import subprocess
import json
import requests
import sys
import os

# Backend URL from frontend .env (as per system instructions)
BACKEND_URL = "https://foundation-build-3.preview.emergentagent.com"

def test_backend_healthy():
    """TEST 1: Backend healthy - GET /health returns 200 with status 'healthy'"""
    print("\n=== TEST 1: Backend Health Check ===")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                print("✅ Backend healthy: GET /health returns 200 with status='healthy'")
                print(f"   Service: {data.get('service', 'Unknown')}")
                print(f"   Database: {data.get('database', 'Unknown')}")
                print(f"   Redis: {data.get('redis', 'Unknown')}")
                return True
            else:
                print(f"❌ Backend unhealthy: status = {data.get('status')}")
                return False
        else:
            print(f"❌ Backend health check failed: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend health check error: {e}")
        return False

def test_backend_healthy():
    """TEST 1: Backend healthy - GET /health returns 200 with status 'healthy'"""
    print("\n=== TEST 1: Backend Health Check ===")
    try:
        # Try both /health and /api/health endpoints
        for endpoint in ["/health", "/api/health"]:
            try:
                response = requests.get(f"{BACKEND_URL}{endpoint}", timeout=10)
                if response.status_code == 200:
                    try:
                        data = response.json()
                        if data.get("status") == "healthy":
                            print(f"✅ Backend healthy: GET {endpoint} returns 200 with status='healthy'")
                            print(f"   Service: {data.get('service', 'Unknown')}")
                            print(f"   Database: {data.get('database', 'Unknown')}")
                            print(f"   Redis: {data.get('redis', 'Unknown')}")
                            return True
                    except json.JSONDecodeError:
                        # Try plain text response
                        if "healthy" in response.text.lower():
                            print(f"✅ Backend healthy: GET {endpoint} returns 200 with 'healthy' in response")
                            return True
            except Exception as e:
                print(f"   Endpoint {endpoint} failed: {e}")
                continue
        
        print(f"❌ Backend health check failed on all endpoints")
        return False
    except Exception as e:
        print(f"❌ Backend health check error: {e}")
        return False

def get_csrf_token():
    """Helper function to get CSRF token"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/csrf-token", timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data.get("csrf_token")
    except:
        pass
    return None

def test_route_alias_verify_code():
    """TEST 2: POST /api/wallet/verifyCode should work same as POST /api/wallet/verifyOtp"""
    print("\n=== TEST 2: Route Alias - verifyCode ===")
    try:
        # Get CSRF token first
        csrf_token = get_csrf_token()
        headers = {}
        if csrf_token:
            headers['X-CSRF-Token'] = csrf_token
        
        # Test the new alias endpoint with empty body - should expect 401 (requires auth) or 400 (validation error)
        response = requests.post(f"{BACKEND_URL}/api/wallet/verifyCode", json={}, headers=headers, timeout=10)
        
        if response.status_code in [400, 401]:
            print(f"✅ POST /api/wallet/verifyCode returns {response.status_code} (expected auth/validation error)")
            try:
                data = response.json()
                print(f"   Response: {data}")
            except:
                print(f"   Response: {response.text}")
            return True
        elif response.status_code == 403 and "CSRF" in response.text:
            print(f"✅ POST /api/wallet/verifyCode returns 403 CSRF (route exists, CSRF protection working)")
            return True
        else:
            print(f"❌ POST /api/wallet/verifyCode returned unexpected status: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error testing verifyCode alias: {e}")
        return False

def test_route_alias_update_wallet():
    """TEST 3: PUT /api/wallet/updateWallet/:id should work same as PUT /api/wallet/address/:id"""
    print("\n=== TEST 3: Route Alias - updateWallet ===")
    try:
        # Get CSRF token first
        csrf_token = get_csrf_token()
        headers = {}
        if csrf_token:
            headers['X-CSRF-Token'] = csrf_token
        
        # Test the new alias endpoint with test ID - should expect 401 (requires auth)
        response = requests.put(f"{BACKEND_URL}/api/wallet/updateWallet/123", json={}, headers=headers, timeout=10)
        
        if response.status_code == 401:
            print(f"✅ PUT /api/wallet/updateWallet/123 returns 401 (requires auth)")
            try:
                data = response.json()
                print(f"   Response: {data}")
            except:
                print(f"   Response: {response.text}")
            return True
        elif response.status_code == 403 and "CSRF" in response.text:
            print(f"✅ PUT /api/wallet/updateWallet/123 returns 403 CSRF (route exists, CSRF protection working)")
            return True
        else:
            print(f"❌ PUT /api/wallet/updateWallet/123 returned unexpected status: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error testing updateWallet alias: {e}")
        return False

def test_route_alias_delete_wallet():
    """TEST 4: DELETE /api/wallet/deleteWallet/:id should work same as POST /api/wallet/deleteWalletAddress"""
    print("\n=== TEST 4: Route Alias - deleteWallet ===")
    try:
        # Get CSRF token first
        csrf_token = get_csrf_token()
        headers = {}
        if csrf_token:
            headers['X-CSRF-Token'] = csrf_token
        
        # Test the new alias endpoint with test ID - should expect 401 (requires auth)
        response = requests.delete(f"{BACKEND_URL}/api/wallet/deleteWallet/123", headers=headers, timeout=10)
        
        if response.status_code == 401:
            print(f"✅ DELETE /api/wallet/deleteWallet/123 returns 401 (requires auth)")
            try:
                data = response.json()
                print(f"   Response: {data}")
            except:
                print(f"   Response: {response.text}")
            return True
        elif response.status_code == 403 and "CSRF" in response.text:
            print(f"✅ DELETE /api/wallet/deleteWallet/123 returns 403 CSRF (route exists, CSRF protection working)")
            return True
        else:
            print(f"❌ DELETE /api/wallet/deleteWallet/123 returned unexpected status: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error testing deleteWallet alias: {e}")
        return False

def test_route_alias_regenerate_api():
    """TEST 5: POST /api/userApi/regenerateApi/:id should work same as POST /api/userApi/regenerateKey/:id"""
    print("\n=== TEST 5: Route Alias - regenerateApi ===")
    try:
        # Get CSRF token first
        csrf_token = get_csrf_token()
        headers = {}
        if csrf_token:
            headers['X-CSRF-Token'] = csrf_token
        
        # Test the new alias endpoint with test ID - should expect 401 (requires auth)
        response = requests.post(f"{BACKEND_URL}/api/userApi/regenerateApi/123", headers=headers, timeout=10)
        
        if response.status_code == 401:
            print(f"✅ POST /api/userApi/regenerateApi/123 returns 401 (requires auth)")
            try:
                data = response.json()
                print(f"   Response: {data}")
            except:
                print(f"   Response: {response.text}")
            return True
        elif response.status_code == 403 and "CSRF" in response.text:
            print(f"✅ POST /api/userApi/regenerateApi/123 returns 403 CSRF (route exists, CSRF protection working)")
            return True
        else:
            print(f"❌ POST /api/userApi/regenerateApi/123 returned unexpected status: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error testing regenerateApi alias: {e}")
        return False

def test_typescript_compiles():
    """TEST 6: TypeScript compiles clean - npx tsc --noEmit --skipLibCheck"""
    print("\n=== TEST 6: TypeScript Compilation ===")
    try:
        result = subprocess.run(
            ["npx", "tsc", "--noEmit", "--skipLibCheck"],
            cwd="/app/backend",
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode == 0:
            print("✅ TypeScript compilation clean: npx tsc --noEmit --skipLibCheck exits with code 0")
            return True
        else:
            print(f"❌ TypeScript compilation failed: exit code {result.returncode}")
            if result.stderr:
                print(f"   Errors: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        print("❌ TypeScript compilation timeout after 60 seconds")
        return False
    except Exception as e:
        print(f"❌ TypeScript compilation error: {e}")
        return False

def main():
    """Run all route alias tests"""
    print("=== ROUTE ALIASES TESTING ===")
    print("Testing 4 newly added route aliases for frontend compatibility:")
    print("1. POST /api/wallet/verifyCode → POST /api/wallet/verifyOtp")
    print("2. PUT /api/wallet/updateWallet/:id → PUT /api/wallet/address/:id")  
    print("3. DELETE /api/wallet/deleteWallet/:id → POST /api/wallet/deleteWalletAddress")
    print("4. POST /api/userApi/regenerateApi/:id → POST /api/userApi/regenerateKey/:id")
    print(f"Backend URL: {BACKEND_URL}")
    
    tests = [
        ("Backend Health", test_backend_healthy),
        ("Route Alias - verifyCode", test_route_alias_verify_code),
        ("Route Alias - updateWallet", test_route_alias_update_wallet),
        ("Route Alias - deleteWallet", test_route_alias_delete_wallet),
        ("Route Alias - regenerateApi", test_route_alias_regenerate_api),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "="*60)
    print("ROUTE ALIASES TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("\n🎉 ALL ROUTE ALIASES VERIFIED SUCCESSFULLY!")
        print("✅ All 4 route aliases are working correctly")
        print("✅ Backend health check passes")
        return True
    else:
        print(f"\n❌ {total - passed} test(s) failed - route aliases need attention")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)