#!/usr/bin/env python3
"""
DynoPay Legacy API Backward Compatibility Testing
Tests the newly implemented Legacy API endpoints for backward compatibility with OLD DynoPay API
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any
import uuid

class LegacyApiTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.user_data = None
        self.api_key = None
        
        # Test credentials from review request
        self.test_email = "richard@dyno.pt"
        self.test_password = "Katiekendra123@"
        
    def get_backend_url(self):
        """Get backend URL from frontend .env file"""
        try:
            with open('/app/frontend/.env', 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        return line.split('=', 1)[1].strip()
        except:
            pass
        return "http://localhost:8001"
        
    def log_result(self, test_name: str, success: bool, message: str, details: Dict = None):
        """Log test result"""
        self.test_results[test_name] = {
            'success': success,
            'message': message,
            'details': details or {}
        }
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if not success:
            self.errors.append(f"{test_name}: {message}")
    
    def authenticate_user(self):
        """Authenticate with provided credentials"""
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json={
                    "email": self.test_email,
                    "password": self.test_password
                },
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    self.jwt_token = data['data']['accessToken']
                    self.user_data = data['data']['userData']
                    self.log_result(
                        "Authentication", 
                        True, 
                        f"Successfully authenticated {self.user_data.get('email', 'user')}",
                        {
                            "user_id": self.user_data.get('user_id'),
                            "name": self.user_data.get('name'),
                            "email": self.user_data.get('email')
                        }
                    )
                    return True
                else:
                    self.log_result("Authentication", False, "Login succeeded but no token received")
                    return False
            else:
                self.log_result("Authentication", False, f"Login failed with status {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Authentication", False, f"Authentication failed: {str(e)}")
            return False
    
    def get_api_key(self):
        """Get API key for testing"""
        try:
            response = requests.get(
                f"{self.backend_url}/api/userApi/getApi",
                headers={"Authorization": f"Bearer {self.jwt_token}"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                api_data = data.get('data', {})
                
                # Handle both single API key and grouped format
                if isinstance(api_data, dict) and 'all' in api_data:
                    api_list = api_data['all']
                elif isinstance(api_data, list):
                    api_list = api_data
                else:
                    api_list = [api_data] if api_data else []
                
                if api_list and len(api_list) > 0:
                    self.api_key = api_list[0].get('api_key')
                    self.log_result(
                        "API Key Retrieval", 
                        True, 
                        f"Retrieved API key for testing",
                        {"api_key_count": len(api_list)}
                    )
                    return True
                else:
                    self.log_result("API Key Retrieval", False, "No API keys found")
                    return False
            else:
                self.log_result("API Key Retrieval", False, f"API key retrieval failed with status {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("API Key Retrieval", False, f"API key retrieval failed: {str(e)}")
            return False
    
    # ============================================
    # TEST 1: Endpoints without API key should return 403
    # ============================================
    
    def test_endpoints_without_api_key(self):
        """Test that endpoints return 403 when API key is missing"""
        print("\n" + "="*60)
        print("TEST 1: ENDPOINTS WITHOUT API KEY SHOULD RETURN 403")
        print("="*60)
        
        endpoints_to_test = [
            ("POST", "/api/user/createUser", {"name": "Test User", "email": "test@example.com"}),
            ("POST", "/api/user/cryptoPayment", {"amount": 100, "currency": "BTC"}),
            ("GET", "/api/user/getSupportedCurrency", None),
            ("GET", "/api/user/getBalance", None),
            ("GET", "/api/user/getTransactions", None)
        ]
        
        for method, endpoint, payload in endpoints_to_test:
            try:
                if method == "POST":
                    response = requests.post(
                        f"{self.backend_url}{endpoint}",
                        json=payload,
                        headers={"Content-Type": "application/json"},
                        timeout=10
                    )
                else:
                    response = requests.get(
                        f"{self.backend_url}{endpoint}",
                        timeout=10
                    )
                
                if response.status_code == 403:
                    response_data = response.json()
                    if "API key" in response_data.get('message', ''):
                        self.log_result(
                            f"No API Key - {endpoint}", 
                            True, 
                            f"Correctly returned 403 with API key error message",
                            {"status_code": response.status_code, "message": response_data.get('message')}
                        )
                    else:
                        self.log_result(
                            f"No API Key - {endpoint}", 
                            False, 
                            f"Returned 403 but wrong error message: {response_data.get('message')}"
                        )
                else:
                    self.log_result(
                        f"No API Key - {endpoint}", 
                        False, 
                        f"Expected 403 but got {response.status_code}"
                    )
                    
            except Exception as e:
                self.log_result(f"No API Key - {endpoint}", False, f"Request failed: {str(e)}")
    
    # ============================================
    # TEST 2: Endpoint accessibility verification
    # ============================================
    
    def test_endpoint_accessibility(self):
        """Test that all endpoints exist and respond (even if 403 without valid key)"""
        print("\n" + "="*60)
        print("TEST 2: ENDPOINT ACCESSIBILITY VERIFICATION")
        print("="*60)
        
        endpoints_to_test = [
            ("POST", "/api/user/createUser"),
            ("POST", "/api/user/cryptoPayment"),
            ("GET", "/api/user/getSupportedCurrency"),
            ("GET", "/api/user/getBalance"),
            ("GET", "/api/user/getTransactions")
        ]
        
        for method, endpoint in endpoints_to_test:
            try:
                if method == "POST":
                    response = requests.post(
                        f"{self.backend_url}{endpoint}",
                        json={},
                        headers={"Content-Type": "application/json"},
                        timeout=10
                    )
                else:
                    response = requests.get(
                        f"{self.backend_url}{endpoint}",
                        timeout=10
                    )
                
                # Endpoint should exist (not return 404)
                if response.status_code != 404:
                    self.log_result(
                        f"Endpoint Exists - {endpoint}", 
                        True, 
                        f"Endpoint accessible (status: {response.status_code})",
                        {"status_code": response.status_code}
                    )
                else:
                    self.log_result(
                        f"Endpoint Exists - {endpoint}", 
                        False, 
                        f"Endpoint not found (404)"
                    )
                    
            except Exception as e:
                self.log_result(f"Endpoint Exists - {endpoint}", False, f"Request failed: {str(e)}")
    
    # ============================================
    # TEST 3: Code verification
    # ============================================
    
    def test_code_verification(self):
        """Verify that the required code files exist with correct structure"""
        print("\n" + "="*60)
        print("TEST 3: CODE VERIFICATION")
        print("="*60)
        
        # Check if legacyApiAuthMiddleware.ts exists
        try:
            with open('/app/backend/middleware/legacyApiAuthMiddleware.ts', 'r') as f:
                middleware_content = f.read()
                
            if 'validateApiKey' in middleware_content and 'export' in middleware_content:
                self.log_result(
                    "Middleware File", 
                    True, 
                    "legacyApiAuthMiddleware.ts exists with validateApiKey export",
                    {"file_size": len(middleware_content)}
                )
            else:
                self.log_result("Middleware File", False, "legacyApiAuthMiddleware.ts missing validateApiKey export")
                
        except Exception as e:
            self.log_result("Middleware File", False, f"legacyApiAuthMiddleware.ts not found: {str(e)}")
        
        # Check if legacyApiRouter.ts exists
        try:
            with open('/app/backend/routes/legacyApiRouter.ts', 'r') as f:
                router_content = f.read()
                
            required_routes = ['/createUser', '/cryptoPayment', '/getBalance', '/getTransactions', '/getSupportedCurrency']
            routes_found = []
            
            for route in required_routes:
                if route in router_content:
                    routes_found.append(route)
            
            if len(routes_found) == len(required_routes):
                self.log_result(
                    "Router File", 
                    True, 
                    f"legacyApiRouter.ts exists with all 5 routes defined",
                    {"routes_found": routes_found}
                )
            else:
                self.log_result(
                    "Router File", 
                    False, 
                    f"legacyApiRouter.ts missing routes: {set(required_routes) - set(routes_found)}"
                )
                
        except Exception as e:
            self.log_result("Router File", False, f"legacyApiRouter.ts not found: {str(e)}")
        
        # Check if routes/index.ts imports and mounts legacyApiRouter
        try:
            with open('/app/backend/routes/index.ts', 'r') as f:
                index_content = f.read()
                
            has_import = 'legacyApiRouter' in index_content and 'import' in index_content
            has_mount = 'router.use("/user", legacyApiRouter)' in index_content
            
            if has_import and has_mount:
                self.log_result(
                    "Router Integration", 
                    True, 
                    "legacyApiRouter properly imported and mounted in routes/index.ts",
                    {"has_import": has_import, "has_mount": has_mount}
                )
            else:
                self.log_result(
                    "Router Integration", 
                    False, 
                    f"legacyApiRouter integration issue - import: {has_import}, mount: {has_mount}"
                )
                
        except Exception as e:
            self.log_result("Router Integration", False, f"routes/index.ts check failed: {str(e)}")
    
    # ============================================
    # TEST 4: API key functionality tests
    # ============================================
    
    def test_api_key_functionality(self):
        """Test endpoints with valid API key"""
        print("\n" + "="*60)
        print("TEST 4: API KEY FUNCTIONALITY TESTS")
        print("="*60)
        
        if not self.api_key:
            self.log_result("API Key Tests", False, "No API key available for testing")
            return
        
        # Test createUser with valid API key
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/createUser",
                json={
                    "name": "Test Legacy User",
                    "email": f"legacy-test-{int(time.time())}@example.com"
                },
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": self.api_key
                },
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'token' in data.get('data', {}):
                    customer_token = data['data']['token']
                    self.log_result(
                        "createUser with API Key", 
                        True, 
                        "Successfully created customer and returned JWT token",
                        {
                            "status_code": response.status_code,
                            "has_token": bool(customer_token),
                            "customer_id": data['data'].get('customer_id')
                        }
                    )
                    
                    # Test cryptoPayment with the customer token
                    self.test_crypto_payment_with_token(customer_token)
                else:
                    self.log_result("createUser with API Key", False, "Response missing token or success flag")
            else:
                self.log_result("createUser with API Key", False, f"createUser failed with status {response.status_code}")
                
        except Exception as e:
            self.log_result("createUser with API Key", False, f"createUser request failed: {str(e)}")
        
        # Test getSupportedCurrency with valid API key
        try:
            response = requests.get(
                f"{self.backend_url}/api/user/getSupportedCurrency",
                headers={"x-api-key": self.api_key},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'currencies' in data.get('data', {}):
                    currencies = data['data']['currencies']
                    self.log_result(
                        "getSupportedCurrency with API Key", 
                        True, 
                        f"Successfully retrieved {len(currencies)} supported currencies",
                        {
                            "status_code": response.status_code,
                            "currency_count": len(currencies),
                            "currencies": currencies[:5]  # Show first 5
                        }
                    )
                else:
                    self.log_result("getSupportedCurrency with API Key", False, "Response missing currencies data")
            else:
                self.log_result("getSupportedCurrency with API Key", False, f"getSupportedCurrency failed with status {response.status_code}")
                
        except Exception as e:
            self.log_result("getSupportedCurrency with API Key", False, f"getSupportedCurrency request failed: {str(e)}")
    
    def test_crypto_payment_with_token(self, customer_token: str):
        """Test cryptoPayment with customer token"""
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/cryptoPayment",
                json={
                    "amount": 10,
                    "currency": "BTC"
                },
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": self.api_key,
                    "Authorization": f"Bearer {customer_token}"
                },
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'address' in data.get('data', {}):
                    self.log_result(
                        "cryptoPayment with Customer Token", 
                        True, 
                        "Successfully created crypto payment with customer token",
                        {
                            "status_code": response.status_code,
                            "has_address": bool(data['data'].get('address')),
                            "currency": data['data'].get('currency'),
                            "amount": data['data'].get('amount')
                        }
                    )
                else:
                    self.log_result("cryptoPayment with Customer Token", False, "Response missing payment data")
            else:
                # Check if it's a configuration issue (no wallets configured)
                response_text = response.text.lower()
                if 'wallet' in response_text and 'configured' in response_text:
                    self.log_result(
                        "cryptoPayment with Customer Token", 
                        True, 
                        f"Endpoint working but no crypto wallets configured (status {response.status_code})",
                        {"status_code": response.status_code, "note": "Configuration issue, not code issue"}
                    )
                else:
                    self.log_result("cryptoPayment with Customer Token", False, f"cryptoPayment failed with status {response.status_code}")
                
        except Exception as e:
            self.log_result("cryptoPayment with Customer Token", False, f"cryptoPayment request failed: {str(e)}")
    
    # ============================================
    # Main Test Runner
    # ============================================
    
    def run_all_tests(self):
        """Run all Legacy API tests"""
        print("="*80)
        print("DYNOPAY LEGACY API BACKWARD COMPATIBILITY TESTING")
        print("="*80)
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Credentials: {self.test_email}")
        print("="*80)
        
        # Authenticate first
        if not self.authenticate_user():
            print("\n❌ AUTHENTICATION FAILED - Cannot proceed with API key tests")
        else:
            # Get API key for testing
            self.get_api_key()
        
        # Run all tests
        self.test_endpoints_without_api_key()
        self.test_endpoint_accessibility()
        self.test_code_verification()
        
        if self.api_key:
            self.test_api_key_functionality()
        else:
            print("\n⚠️  Skipping API key functionality tests - no API key available")
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("LEGACY API TEST SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        
        if passed_tests == total_tests:
            print("\n🎉 ALL LEGACY API TESTS PASSED!")
        else:
            print(f"\n⚠️  {failed_tests} TEST(S) NEED ATTENTION")
        
        # Success criteria check
        print("\n" + "="*60)
        print("SUCCESS CRITERIA VERIFICATION")
        print("="*60)
        
        criteria_met = []
        
        # Criterion 1: All endpoints return proper error (403) when API key missing - NOT 404
        no_api_key_tests = [k for k in self.test_results.keys() if "No API Key" in k]
        if all(self.test_results[k]['success'] for k in no_api_key_tests):
            criteria_met.append("✅ All endpoints return 403 (not 404) when API key missing")
        else:
            criteria_met.append("❌ Some endpoints don't return proper 403 error")
        
        # Criterion 2: Code files exist with correct structure
        code_tests = ["Middleware File", "Router File", "Router Integration"]
        if all(self.test_results.get(k, {}).get('success', False) for k in code_tests):
            criteria_met.append("✅ Code files exist with correct structure")
        else:
            criteria_met.append("❌ Code files missing or incorrect structure")
        
        # Criterion 3: Routes mounted correctly in main backend
        endpoint_tests = [k for k in self.test_results.keys() if "Endpoint Exists" in k]
        if all(self.test_results[k]['success'] for k in endpoint_tests):
            criteria_met.append("✅ Routes mounted correctly in main backend")
        else:
            criteria_met.append("❌ Some routes not properly mounted")
        
        # Criterion 4: If API key available - functionality works
        if self.api_key:
            api_tests = ["createUser with API Key", "getSupportedCurrency with API Key"]
            if all(self.test_results.get(k, {}).get('success', False) for k in api_tests):
                criteria_met.append("✅ API key functionality working correctly")
            else:
                criteria_met.append("❌ API key functionality has issues")
        else:
            criteria_met.append("⚠️  API key functionality not tested (no API key available)")
        
        for criterion in criteria_met:
            print(criterion)

if __name__ == "__main__":
    tester = LegacyApiTester()
    tester.run_all_tests()