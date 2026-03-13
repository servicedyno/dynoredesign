#!/usr/bin/env python3
"""
DynoPay Userless Payment Backend Test Suite

Tests the "Userless Payment" feature that allows payments with ONLY x-api-key header
(no customer JWT token required). The legacyApiAuthMiddleware auto-creates a default 
customer when no valid JWT is provided.

Backend URL: https://pod-endpoint-test.preview.emergentagent.com
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional, Tuple

# Configuration
BASE_URL = "https://pod-endpoint-test.preview.emergentagent.com"
LOGIN_EMAIL = "nomadly@moxx.co"
LOGIN_PASSWORD = "Katiekendra123@"

# Test API Keys (retrieved from database)
TEST_API_KEYS = [
    "U2FsdGVkX19E9J1xnAd9gf0Lgex40qsEBjkCHUBWlwN7NnXAfMfP91IGBTp5M3XPLFbm1yseFannbP6W/qE4KvFYz4pForxnhHZodjnqNf5ZagScI4bRT4CEPntttAx5kMuGq7xnZWJymeGhxYN/HVAwuVmrxJFZWbWVpSLJOmc=",  # Company 39, USD
    "U2FsdGVkX1/wr5lKpoRJqYrH+HK2Mc1YQTW1ht0gEVpr3pbAL9BbDQ/dr7JBSrYwF+v/OsHNi/qm2I9KS6mZbt/UA4ZyzDzdGClLux7+RJyXFHyHrHZj/avrOUoHvErL+T5g4ZxORlSAcPF7XyloPsKFEp4wg4ge7vtHJJVQupN+ju83nfseRoYRGaljgBvm",  # Company 3, USD
    "U2FsdGVkX19wZ/KjUopWgbhifn+Z4cE81ZkPeMYuRBxLY5YF7CmTyyo3fAEvWMc8PEcH31jbYhBjdfVeuWWWn5nb1e86j9maUQQEx8KJls8+Xfbyu96L/aUS1NzeBp5B07VvE12uaqS3dKnmkEfG6g==",  # Company 9, USD
]

class DynoPayTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        # Use the first available API key for testing
        self.api_key = TEST_API_KEYS[0] 
        self.customer_token = None
        
        # Test results
        self.test_results = []
        
    def log_test(self, name: str, success: bool, details: str):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {name}")
        if details:
            print(f"  Details: {details}")
        print()
        
        self.test_results.append({
            'name': name,
            'success': success,
            'details': details
        })
    
    def make_request(self, method: str, endpoint: str, headers: Dict = None, data: Dict = None, timeout: int = 30) -> Tuple[int, Dict]:
        """Make HTTP request and return status code and response data"""
        url = f"{self.base_url}{endpoint}"
        
        # Ensure Content-Type is set for JSON requests
        if headers is None:
            headers = {}
        if data is not None and "Content-Type" not in headers:
            headers["Content-Type"] = "application/json"
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=headers, timeout=timeout)
            elif method.upper() == 'POST':
                response = self.session.post(url, headers=headers, json=data, timeout=timeout)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            try:
                response_data = response.json()
            except:
                response_data = {"error": "Invalid JSON response", "text": response.text[:500]}
                
            return response.status_code, response_data
            
        except requests.exceptions.Timeout:
            return 408, {"error": "Request timeout"}
        except requests.exceptions.ConnectionError:
            return 503, {"error": "Connection error"}
        except Exception as e:
            return 500, {"error": f"Request failed: {str(e)}"}

    def get_api_key_via_login(self) -> Optional[str]:
        """
        Try to get API key by logging in first and using API management endpoints
        """
        print("🔍 Attempting to get API key via login flow...")
        
        # Step 1: Login to get access token
        login_data = {
            "email": LOGIN_EMAIL,
            "password": LOGIN_PASSWORD
        }
        
        status, response = self.make_request("POST", "/api/user/login", data=login_data)
        
        if status == 200 and response.get("success"):
            if "accessToken" in response.get("data", {}):
                token = response["data"]["accessToken"]
                print(f"✅ Login successful, got access token")
                
                # Step 2: Try to get API keys using the token
                headers = {"Authorization": f"Bearer {token}"}
                
                # Try the API management endpoint
                status, api_response = self.make_request("GET", "/api/api/getApiKeys", headers=headers)
                
                if status == 200 and api_response.get("success"):
                    api_keys = api_response.get("data", [])
                    if api_keys and len(api_keys) > 0:
                        api_key = api_keys[0].get("apiKey")
                        if api_key:
                            print(f"✅ Retrieved API key: {api_key[:20]}...")
                            return api_key
                
                print(f"⚠️  No API keys found in response: {api_response}")
                
            elif "login_otp_session" in response.get("data", {}):
                print("⚠️  Login requires OTP verification - cannot proceed with automated testing")
                return None
        else:
            print(f"❌ Login failed: Status {status}, Response: {response}")
            
        return None

    def test_api_endpoints_without_auth(self):
        """Test 1: Verify API endpoints exist and require x-api-key header"""
        print("🧪 TEST 1: API endpoints exist and require x-api-key header")
        
        endpoints = [
            "/api/user/cryptoPayment",
            "/api/user/createPayment"
        ]
        
        for endpoint in endpoints:
            # Test without any headers - should get CSRF error or API key error
            status, response = self.make_request("POST", endpoint, data={"amount": 10})
            
            # With CSRF protection, we expect either:
            # 1. 403 with CSRF error (when no x-api-key)
            # 2. 403 with API key required error
            
            success = status == 403 and (
                "csrf" in response.get("error", "").lower() or 
                "api key" in response.get("error", "").lower() or
                "api key" in response.get("message", "").lower()
            )
            
            details = f"Status: {status}, Response: {response}"
            self.log_test(f"Endpoint {endpoint} requires auth", success, details)
            
        # Additional test: endpoints should work WITH x-api-key header
        print("   Testing that endpoints work WITH x-api-key...")
        
        # Test cryptoPayment with x-api-key
        headers = {"x-api-key": self.api_key}
        status, response = self.make_request("POST", "/api/user/cryptoPayment", 
                                           headers=headers, 
                                           data={"amount": 10, "currency": "BTC", "redirect_uri": "https://example.com"})
        
        success = status == 200 and response.get("success") == True
        details = f"Status: {status}, Success: {response.get('success')}"
        self.log_test("cryptoPayment works with x-api-key", success, details)

    def test_get_supported_currency(self):
        """Test 5: Test getSupportedCurrency with x-api-key only"""
        print("🧪 TEST 5: getSupportedCurrency endpoint (requires x-api-key only)")
        
        if not self.api_key:
            self.log_test("getSupportedCurrency with API key", False, "No API key available for testing")
            return
            
        headers = {"x-api-key": self.api_key}
        status, response = self.make_request("GET", "/api/user/getSupportedCurrency", headers=headers)
        
        success = (status == 200 and 
                  response.get("success") == True and 
                  "currencies" in response.get("data", {}))
        
        details = f"Status: {status}, Success: {response.get('success')}"
        if success:
            currencies = response.get("data", {}).get("currencies", [])
            details += f", Currencies: {currencies}"
            
        self.log_test("getSupportedCurrency with x-api-key", success, details)

    def test_userless_crypto_payment(self):
        """Test 2: Test cryptoPayment with x-api-key only (userless)"""
        print("🧪 TEST 2: cryptoPayment with x-api-key only (userless payment)")
        
        if not self.api_key:
            self.log_test("Userless cryptoPayment", False, "No API key available for testing")
            return
            
        headers = {"x-api-key": self.api_key}
        payment_data = {
            "amount": 10,
            "currency": "BTC",
            "redirect_uri": "https://example.com/success"
        }
        
        status, response = self.make_request("POST", "/api/user/cryptoPayment", headers=headers, data=payment_data)
        
        success = (status == 200 and 
                  response.get("success") == True and 
                  "qr_code" in response.get("data", {}) and
                  "address" in response.get("data", {}) and
                  "transaction_id" in response.get("data", {}))
        
        details = f"Status: {status}, Success: {response.get('success')}"
        if success:
            data = response.get("data", {})
            details += f", TX ID: {data.get('transaction_id', 'N/A')[:16]}..., Address: {data.get('address', 'N/A')[:20]}..."
        else:
            details += f", Message: {response.get('message', 'N/A')}"
            
        self.log_test("Userless cryptoPayment", success, details)

    def test_userless_create_payment(self):
        """Test 3: Test createPayment with x-api-key only (userless)"""
        print("🧪 TEST 3: createPayment with x-api-key only (userless payment)")
        
        if not self.api_key:
            self.log_test("Userless createPayment", False, "No API key available for testing")
            return
            
        headers = {"x-api-key": self.api_key}
        payment_data = {
            "amount": 10,
            "redirect_uri": "https://example.com/success"
        }
        
        status, response = self.make_request("POST", "/api/user/createPayment", headers=headers, data=payment_data)
        
        success = (status == 200 and 
                  response.get("success") == True and 
                  "redirect_url" in response.get("data", {}))
        
        details = f"Status: {status}, Success: {response.get('success')}"
        if success:
            redirect_url = response.get("data", {}).get("redirect_url", "")
            details += f", Redirect URL: {redirect_url[:50]}..."
        else:
            details += f", Message: {response.get('message', 'N/A')}"
            
        self.log_test("Userless createPayment", success, details)

    def test_existing_customer_flow(self):
        """Test 4: Test existing flow WITH customer token still works"""
        print("🧪 TEST 4: Existing customer flow with JWT token")
        
        if not self.api_key:
            self.log_test("Customer token flow", False, "No API key available for testing")
            return
        
        # Step 1: Create a customer first
        headers = {"x-api-key": self.api_key}
        customer_data = {
            "name": "Test User",
            "email": f"testuser{int(time.time())}@example.com"
        }
        
        status, response = self.make_request("POST", "/api/user/createUser", headers=headers, data=customer_data)
        
        if status == 200 and response.get("success"):
            customer_token = response.get("data", {}).get("token")
            if customer_token:
                # Step 2: Use the customer token for cryptoPayment
                auth_headers = {
                    "x-api-key": self.api_key,
                    "Authorization": f"Bearer {customer_token}"
                }
                
                payment_data = {
                    "amount": 10,
                    "currency": "BTC",
                    "redirect_uri": "https://example.com/success"
                }
                
                status, payment_response = self.make_request("POST", "/api/user/cryptoPayment", 
                                                           headers=auth_headers, data=payment_data)
                
                success = (status == 200 and 
                          payment_response.get("success") == True and 
                          "transaction_id" in payment_response.get("data", {}))
                
                details = f"Customer created, Payment Status: {status}, Success: {payment_response.get('success')}"
                if success:
                    tx_id = payment_response.get("data", {}).get("transaction_id", "")
                    details += f", TX ID: {tx_id[:16]}..."
                else:
                    details += f", Message: {payment_response.get('message', 'N/A')}"
                    
                self.log_test("Customer token flow", success, details)
            else:
                self.log_test("Customer token flow", False, "Customer creation succeeded but no token returned")
        else:
            self.log_test("Customer token flow", False, f"Customer creation failed: {response.get('message', 'N/A')}")

    def test_additional_userless_endpoints(self):
        """Test additional endpoints that should support userless payment"""
        print("🧪 Additional userless endpoints testing")
        
        if not self.api_key:
            print("⚠️  No API key available - skipping additional endpoint tests")
            return
            
        headers = {"x-api-key": self.api_key}
        
        # Test getBalance
        status, response = self.make_request("GET", "/api/user/getBalance", headers=headers)
        success = status == 200 and response.get("success") == True
        details = f"Status: {status}, Success: {response.get('success')}"
        if success and "data" in response:
            wallets = response.get("data", [])
            details += f", Wallets: {len(wallets)}"
        self.log_test("Userless getBalance", success, details)
        
        # Test getTransactions
        status, response = self.make_request("GET", "/api/user/getTransactions", headers=headers)
        success = status == 200 and response.get("success") == True
        details = f"Status: {status}, Success: {response.get('success')}"
        if success:
            transactions = response.get("data", [])
            details += f", Transactions count: {len(transactions)}"
        self.log_test("Userless getTransactions", success, details)
        
        # Test addFunds endpoint
        add_funds_data = {
            "amount": 15,
            "redirect_uri": "https://example.com/success"
        }
        status, response = self.make_request("POST", "/api/user/addFunds", headers=headers, data=add_funds_data)
        success = status == 200 and response.get("success") == True and "redirect_url" in response.get("data", {})
        details = f"Status: {status}, Success: {response.get('success')}"
        if success:
            redirect_url = response.get("data", {}).get("redirect_url", "")
            details += f", Redirect URL: {redirect_url[:50]}..."
        else:
            details += f", Message: {response.get('message', 'N/A')}"
        self.log_test("Userless addFunds", success, details)

    def test_error_scenarios(self):
        """Test error scenarios for userless payments"""
        print("🧪 Error scenarios testing")
        
        if not self.api_key:
            print("⚠️  No API key available - skipping error scenario tests")
            return
            
        headers = {"x-api-key": self.api_key}
        
        # Test cryptoPayment with missing amount
        status, response = self.make_request("POST", "/api/user/cryptoPayment", 
                                           headers=headers, 
                                           data={"currency": "BTC", "redirect_uri": "https://example.com"})
        success = status == 400 and response.get("success") == False
        details = f"Status: {status}, Message: {response.get('message', 'N/A')}"
        self.log_test("cryptoPayment missing amount error", success, details)
        
        # Test createPayment with missing redirect_uri
        status, response = self.make_request("POST", "/api/user/createPayment", 
                                           headers=headers, 
                                           data={"amount": 10})
        success = status == 400 and response.get("success") == False
        details = f"Status: {status}, Message: {response.get('message', 'N/A')}"
        self.log_test("createPayment missing redirect_uri error", success, details)
        
        # Test cryptoPayment with invalid currency
        status, response = self.make_request("POST", "/api/user/cryptoPayment", 
                                           headers=headers, 
                                           data={"amount": 10, "currency": "INVALID", "redirect_uri": "https://example.com"})
        success = status == 400 and response.get("success") == False
        details = f"Status: {status}, Message: {response.get('message', 'N/A')}"
        self.log_test("cryptoPayment invalid currency error", success, details)

    def test_legacy_customer_creation(self):
        """Test that legacy customers are properly created"""
        print("🧪 Legacy customer creation testing")
        
        if not self.api_key:
            print("⚠️  No API key available - skipping legacy customer tests")
            return
            
        headers = {"x-api-key": self.api_key}
        
        # Make multiple userless payments to verify the same default customer is reused
        payment1_data = {"amount": 5, "currency": "BTC", "redirect_uri": "https://example.com/1"}
        status1, response1 = self.make_request("POST", "/api/user/cryptoPayment", headers=headers, data=payment1_data)
        
        payment2_data = {"amount": 6, "currency": "ETH", "redirect_uri": "https://example.com/2"}
        status2, response2 = self.make_request("POST", "/api/user/cryptoPayment", headers=headers, data=payment2_data)
        
        success = (status1 == 200 and status2 == 200 and 
                  response1.get("success") and response2.get("success"))
        
        details = f"Payment1: {status1}, Payment2: {status2}"
        if success:
            tx1 = response1.get("data", {}).get("transaction_id", "")[:16]
            tx2 = response2.get("data", {}).get("transaction_id", "")[:16]
            details += f", TX1: {tx1}..., TX2: {tx2}..."
        
        self.log_test("Multiple userless payments work", success, details)

    def run_all_tests(self):
        """Run all test scenarios"""
        print("🚀 Starting DynoPay Userless Payment Backend Tests")
        print("=" * 60)
        
        # We have API keys from the database
        print(f"✅ Using API key: {self.api_key[:20]}...")
        print()
        
        # Run all test scenarios
        self.test_api_endpoints_without_auth()
        self.test_get_supported_currency()
        self.test_userless_crypto_payment()
        self.test_userless_create_payment()
        self.test_existing_customer_flow()
        self.test_additional_userless_endpoints()
        self.test_error_scenarios()
        self.test_legacy_customer_creation()
        
        # Summary
        print("=" * 60)
        print("🏁 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        failed = len(self.test_results) - passed
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print()
        
        if failed > 0:
            print("Failed Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['name']}: {result['details']}")
            print()
        
        return failed == 0

if __name__ == "__main__":
    tester = DynoPayTester()
    success = tester.run_all_tests()
    
    if not success:
        sys.exit(1)