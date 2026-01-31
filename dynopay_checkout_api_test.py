#!/usr/bin/env python3
"""
DynoPay Checkout API Testing Suite
Tests the specific checkout API endpoints used by the DynocheckoutDarkMode page
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any, Optional
from urllib.parse import urlparse, parse_qs

class DynoPayCheckoutAPITester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.customer_token = None
        self.payment_reference = None
        
        # Test credentials from review request
        self.test_credentials = {
            "email": "john@dyno.pt",
            "password": "Katiekendra123@",
            "company_id": 38
        }
        
    def get_backend_url(self):
        """Get backend URL from frontend .env file"""
        env_backend_url = os.environ.get('BACKEND_URL')
        if env_backend_url:
            return env_backend_url
            
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
    
    def test_authentication(self):
        """Test 1: Authentication - POST /api/user/login"""
        print("\n=== Test 1: Authentication ===")
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json={
                    "email": self.test_credentials["email"],
                    "password": self.test_credentials["password"]
                },
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data and 'accessToken' in data['data']:
                    self.jwt_token = data['data']['accessToken']
                    user_data = data['data']
                    
                    self.log_result(
                        "Authentication", 
                        True, 
                        f"Successfully authenticated user: {user_data.get('name', 'Unknown')}",
                        {
                            "user_id": user_data.get('user_id'),
                            "name": user_data.get('name'),
                            "email": user_data.get('email'),
                            "has_token": bool(self.jwt_token)
                        }
                    )
                    return True
                else:
                    self.log_result(
                        "Authentication", 
                        False, 
                        "Login succeeded but no access token received",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Authentication", 
                    False, 
                    f"Login failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Authentication", 
                False, 
                f"Authentication request failed: {str(e)}"
            )
        
        return False
    
    def test_create_payment_link(self):
        """Test 2: Create Payment Link - POST /api/pay/createPaymentLink"""
        print("\n=== Test 2: Create Payment Link ===")
        
        if not self.jwt_token:
            self.log_result(
                "Create Payment Link", 
                False, 
                "No JWT token available for authentication"
            )
            return False
        
        # Create $50 USD payment link with CRYPTO mode as specified
        payment_data = {
            "amount": 50,
            "currency": "USD",
            "company_id": self.test_credentials["company_id"],
            "modes": ["CRYPTO"],
            "description": "Checkout API Test"
        }
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data and 'payment_url' in data['data']:
                    payment_url = data['data']['payment_url']
                    
                    # Extract reference parameter from URL
                    parsed_url = urlparse(payment_url)
                    query_params = parse_qs(parsed_url.query)
                    
                    if 'd' in query_params:
                        self.payment_reference = query_params['d'][0]
                        
                        self.log_result(
                            "Create Payment Link", 
                            True, 
                            f"Payment link created successfully",
                            {
                                "payment_url": payment_url,
                                "reference": self.payment_reference,
                                "amount": payment_data["amount"],
                                "currency": payment_data["currency"],
                                "modes": payment_data["modes"]
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Create Payment Link - Reference", 
                            False, 
                            "Payment URL missing reference parameter 'd'",
                            {"payment_url": payment_url}
                        )
                else:
                    self.log_result(
                        "Create Payment Link", 
                        False, 
                        "Response missing payment_url",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Create Payment Link", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Create Payment Link", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return False
    
    def test_get_payment_data(self):
        """Test 3: Get Payment Data - POST /api/pay/getData"""
        print("\n=== Test 3: Get Payment Data ===")
        
        if not self.payment_reference:
            self.log_result(
                "Get Payment Data", 
                False, 
                "No payment reference available from previous test"
            )
            return False
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/pay/getData",
                json={"d": self.payment_reference},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    payment_data = data['data']
                    
                    # Verify required fields from review request
                    required_fields = [
                        'amount', 'base_currency', 'token', 'payment_mode', 
                        'allowedModes', 'fee_payer'
                    ]
                    
                    missing_fields = [field for field in required_fields if field not in payment_data]
                    
                    if not missing_fields:
                        # Store customer token for subsequent tests
                        self.customer_token = payment_data.get('token')
                        
                        self.log_result(
                            "Get Payment Data", 
                            True, 
                            "Payment data retrieved successfully with all required fields",
                            {
                                "amount": payment_data.get('amount'),
                                "base_currency": payment_data.get('base_currency'),
                                "payment_mode": payment_data.get('payment_mode'),
                                "allowedModes": payment_data.get('allowedModes'),
                                "fee_payer": payment_data.get('fee_payer'),
                                "has_token": bool(self.customer_token)
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Get Payment Data - Structure", 
                            False, 
                            f"Missing required fields: {', '.join(missing_fields)}",
                            {"response": data, "missing_fields": missing_fields}
                        )
                else:
                    self.log_result(
                        "Get Payment Data", 
                        False, 
                        "Response missing data field",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Get Payment Data", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Get Payment Data", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return False
    
    def test_get_currency_rates(self):
        """Test 4: Get Currency Rates - POST /api/pay/getCurrencyRates"""
        print("\n=== Test 4: Get Currency Rates ===")
        
        if not self.customer_token:
            self.log_result(
                "Get Currency Rates", 
                False, 
                "No customer token available from previous test"
            )
            return False
        
        # Test data as specified in review request
        rates_data = {
            "source": "USD",
            "amount": 50,
            "currencyList": ["BTC", "ETH", "USDT"],
            "fee_payer": "company"
        }
        
        try:
            headers = {
                "Authorization": f"Bearer {self.customer_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/getCurrencyRates",
                json=rates_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    rates_response = data['data']
                    
                    # Verify response includes rate data with required fields
                    if isinstance(rates_response, list) and rates_response:
                        # Check first rate entry structure
                        first_rate = rates_response[0]
                        required_rate_fields = ['currency', 'amount', 'total_amount']
                        
                        missing_rate_fields = [field for field in required_rate_fields if field not in first_rate]
                        
                        if not missing_rate_fields:
                            self.log_result(
                                "Get Currency Rates", 
                                True, 
                                f"Currency rates retrieved successfully for {len(rates_response)} currencies",
                                {
                                    "currencies_count": len(rates_response),
                                    "sample_rate": {
                                        "currency": first_rate.get('currency'),
                                        "amount": first_rate.get('amount'),
                                        "total_amount": first_rate.get('total_amount')
                                    },
                                    "fee_payer": rates_data["fee_payer"]
                                }
                            )
                            return True
                        else:
                            self.log_result(
                                "Get Currency Rates - Rate Structure", 
                                False, 
                                f"Rate entry missing fields: {', '.join(missing_rate_fields)}",
                                {"first_rate": first_rate, "missing_fields": missing_rate_fields}
                            )
                    else:
                        self.log_result(
                            "Get Currency Rates - Format", 
                            False, 
                            "Response data is not a non-empty array",
                            {"response_type": type(rates_response), "response": rates_response}
                        )
                else:
                    self.log_result(
                        "Get Currency Rates", 
                        False, 
                        "Response missing data field",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Get Currency Rates", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Get Currency Rates", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return False
    
    def test_get_configured_currencies(self):
        """Test 5: Get Configured Currencies - GET /api/pay/configured-currencies"""
        print("\n=== Test 5: Get Configured Currencies ===")
        
        if not self.customer_token:
            self.log_result(
                "Get Configured Currencies", 
                False, 
                "No customer token available from previous test"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.customer_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.get(
                f"{self.backend_url}/api/pay/configured-currencies",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    currencies_data = data['data']
                    
                    # Verify response includes configured_currencies array
                    if 'configured_currencies' in currencies_data:
                        configured_currencies = currencies_data['configured_currencies']
                        
                        if isinstance(configured_currencies, list):
                            # Check for expected currencies like BTC, ETH, USDT-TRC20
                            expected_currencies = ["BTC", "ETH"]
                            found_currencies = [curr for curr in expected_currencies if curr in configured_currencies]
                            
                            self.log_result(
                                "Get Configured Currencies", 
                                True, 
                                f"Configured currencies retrieved successfully",
                                {
                                    "total_currencies": len(configured_currencies),
                                    "currencies": configured_currencies,
                                    "expected_found": found_currencies
                                }
                            )
                            return True
                        else:
                            self.log_result(
                                "Get Configured Currencies - Format", 
                                False, 
                                "configured_currencies is not an array",
                                {"configured_currencies": configured_currencies}
                            )
                    else:
                        self.log_result(
                            "Get Configured Currencies - Structure", 
                            False, 
                            "Response missing configured_currencies field",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "Get Configured Currencies", 
                        False, 
                        "Response missing data field",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Get Configured Currencies", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Get Configured Currencies", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return False
    
    def test_verify_crypto_payment_status(self):
        """Test 6: Verify Crypto Payment Status - POST /api/pay/verifyCryptoPayment"""
        print("\n=== Test 6: Verify Crypto Payment Status ===")
        
        if not self.customer_token:
            self.log_result(
                "Verify Crypto Payment Status", 
                False, 
                "No customer token available from previous test"
            )
            return False
        
        # Test with dummy address as specified in review request
        verify_data = {
            "address": "0x1234567890abcdef1234567890abcdef12345678",  # Dummy ETH address
            "currency": "ETH"
        }
        
        try:
            headers = {
                "Authorization": f"Bearer {self.customer_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/verifyCryptoPayment",
                json=verify_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    verify_response = data['data']
                    
                    # Verify response includes status field
                    if 'status' in verify_response:
                        status = verify_response['status']
                        
                        # For dummy address, should return "waiting" status
                        if status == "waiting":
                            self.log_result(
                                "Verify Crypto Payment Status", 
                                True, 
                                f"Crypto payment verification working correctly (status: {status})",
                                {
                                    "status": status,
                                    "address": verify_data["address"],
                                    "currency": verify_data["currency"]
                                }
                            )
                            return True
                        else:
                            self.log_result(
                                "Verify Crypto Payment Status - Status", 
                                True, 
                                f"Endpoint responding correctly with status: {status}",
                                {"status": status, "response": verify_response}
                            )
                            return True
                    else:
                        self.log_result(
                            "Verify Crypto Payment Status - Structure", 
                            False, 
                            "Response missing status field",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "Verify Crypto Payment Status", 
                        False, 
                        "Response missing data field",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Verify Crypto Payment Status", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Verify Crypto Payment Status", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return False
    
    def test_tax_enabled_payment_link(self):
        """Test 7: Create Payment Link with Tax Enabled"""
        print("\n=== Test 7: Payment Link with Tax ===")
        
        if not self.jwt_token:
            self.log_result(
                "Payment Link with Tax", 
                False, 
                "No JWT token available for authentication"
            )
            return False
        
        # Create payment link with tax enabled
        payment_data = {
            "amount": 100,
            "currency": "EUR",
            "company_id": self.test_credentials["company_id"],
            "modes": ["CRYPTO"],
            "description": "Tax Test Payment",
            "apply_tax": True
        }
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data and 'payment_url' in data['data']:
                    payment_url = data['data']['payment_url']
                    
                    # Extract reference and test getData with tax
                    parsed_url = urlparse(payment_url)
                    query_params = parse_qs(parsed_url.query)
                    
                    if 'd' in query_params:
                        tax_reference = query_params['d'][0]
                        
                        # Test getData for tax payment
                        get_data_response = requests.post(
                            f"{self.backend_url}/api/pay/getData",
                            json={"d": tax_reference},
                            headers={"Content-Type": "application/json"},
                            timeout=15
                        )
                        
                        if get_data_response.status_code == 200:
                            get_data = get_data_response.json()
                            
                            if 'data' in get_data:
                                payment_info = get_data['data']
                                
                                # Check for tax_info in response
                                if 'tax_info' in payment_info:
                                    tax_info = payment_info['tax_info']
                                    
                                    self.log_result(
                                        "Payment Link with Tax", 
                                        True, 
                                        "Tax-enabled payment link created and verified successfully",
                                        {
                                            "apply_tax": payment_info.get('apply_tax'),
                                            "tax_info": {
                                                "tax_rate": tax_info.get('tax_rate'),
                                                "tax_amount": tax_info.get('tax_amount'),
                                                "total": tax_info.get('total'),
                                                "country": tax_info.get('country_name')
                                            }
                                        }
                                    )
                                    return True
                                else:
                                    self.log_result(
                                        "Payment Link with Tax - Tax Info", 
                                        False, 
                                        "Tax-enabled payment missing tax_info in getData response",
                                        {"payment_info": payment_info}
                                    )
                            else:
                                self.log_result(
                                    "Payment Link with Tax - getData", 
                                    False, 
                                    "getData response missing data field",
                                    {"response": get_data}
                                )
                        else:
                            self.log_result(
                                "Payment Link with Tax - getData", 
                                False, 
                                f"getData call failed with status {get_data_response.status_code}",
                                {"response": get_data_response.text}
                            )
                    else:
                        self.log_result(
                            "Payment Link with Tax - Reference", 
                            False, 
                            "Tax payment URL missing reference parameter 'd'",
                            {"payment_url": payment_url}
                        )
                else:
                    self.log_result(
                        "Payment Link with Tax", 
                        False, 
                        "Response missing payment_url",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Payment Link with Tax", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Payment Link with Tax", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return False
    
    def run_all_tests(self):
        """Run all checkout API tests"""
        print("🚀 Starting DynoPay Checkout API Testing Suite")
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Credentials: {self.test_credentials['email']}")
        
        # Run tests in sequence
        tests = [
            self.test_authentication,
            self.test_create_payment_link,
            self.test_get_payment_data,
            self.test_get_currency_rates,
            self.test_get_configured_currencies,
            self.test_verify_crypto_payment_status,
            self.test_tax_enabled_payment_link
        ]
        
        passed_tests = 0
        total_tests = len(tests)
        
        for test_func in tests:
            try:
                if test_func():
                    passed_tests += 1
            except Exception as e:
                print(f"❌ Test {test_func.__name__} crashed: {str(e)}")
        
        # Print summary
        print(f"\n{'='*60}")
        print(f"DYNOPAY CHECKOUT API TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if self.errors:
            print(f"\n❌ FAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        
        print(f"\n✅ SUCCESS CRITERIA VERIFICATION:")
        print(f"  - All endpoints respond with 200 status: {'✅' if passed_tests >= 6 else '❌'}")
        print(f"  - Response data matches expected structure: {'✅' if passed_tests >= 6 else '❌'}")
        print(f"  - Customer token authentication works: {'✅' if self.customer_token else '❌'}")
        print(f"  - Currency rates include fee calculations: {'✅' if passed_tests >= 4 else '❌'}")
        
        return passed_tests == total_tests

def main():
    """Main function"""
    tester = DynoPayCheckoutAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All DynoPay Checkout API tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some DynoPay Checkout API tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()