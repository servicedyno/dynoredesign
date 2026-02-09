#!/usr/bin/env python3
"""
Legacy API Backward Compatibility Testing
=========================================

Tests the Legacy API endpoints that provide backward compatibility with the OLD DynoPay API.
This test suite verifies that the SQL type error fix in paymentController.ts line 1444 is working correctly.

Test Scenarios:
1. Create Customer (NEW Flow) - x-api-key only
2. Create Crypto Payment with NEW Auth - x-api-key + customer JWT (CRITICAL - Previously Had SQL Error)
3. Create Crypto Payment with OLD Auth - x-api-key + legacy flow (auto-creates default customer)
4. Get Supported Currencies - x-api-key only
5. Get Balance - x-api-key + customer JWT
6. Get Transactions - x-api-key + customer JWT

Authentication:
- Test User: richard@dyno.pt
- Password: Katiekendra123@
- Company ID: 38
"""

import requests
import json
import time
import os
from datetime import datetime

# Configuration
BACKEND_URL = "https://eth-gas-debug.preview.emergentagent.com"
TEST_USER_EMAIL = "richard@dyno.pt"
TEST_USER_PASSWORD = "Katiekendra123@"
COMPANY_ID = 38

class LegacyAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'DynoPay-Legacy-API-Tester/1.0'
        })
        self.user_token = None
        self.api_key = None
        self.customer_token = None
        self.test_results = []
        
    def log_test(self, test_name, success, message, details=None):
        """Log test results"""
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'timestamp': datetime.now().isoformat(),
            'details': details or {}
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def authenticate_user(self):
        """Step 1: Authenticate as richard@dyno.pt to get access to company API key"""
        print("\n🔐 STEP 1: User Authentication")
        print("=" * 50)
        
        try:
            response = self.session.post(f"{BACKEND_URL}/api/user/login", json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                # Handle both response formats
                if data.get('data', {}).get('accessToken'):
                    # New format: data.data.accessToken
                    self.user_token = data['data']['accessToken']
                    user_info = data['data']['userData']
                elif data.get('data', {}).get('token'):
                    # Old format: data.data.token
                    self.user_token = data['data']['token']
                    user_info = data['data']
                else:
                    self.log_test("User Authentication", False, "Invalid response format", data)
                    return False
                    
                self.log_test(
                    "User Authentication", 
                    True, 
                    f"Successfully authenticated {TEST_USER_EMAIL}",
                    {
                        'user_id': user_info.get('user_id'),
                        'name': user_info.get('name'),
                        'username': user_info.get('username')
                    }
                )
                return True
            else:
                self.log_test("User Authentication", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("User Authentication", False, f"Exception: {str(e)}")
            return False
    
    def get_api_key(self):
        """Step 2: Retrieve the encrypted API key for company_id 38"""
        print("\n🔑 STEP 2: API Key Retrieval")
        print("=" * 50)
        
        if not self.user_token:
            self.log_test("API Key Retrieval", False, "No user token available")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.user_token}'}
            response = self.session.get(f"{BACKEND_URL}/api/userApi/getApi", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('data'):
                    # Look for API key with company_id 38
                    api_keys_data = data['data']
                    company_api_key = None
                    
                    # Check if there's an 'all' array
                    if 'all' in api_keys_data and isinstance(api_keys_data['all'], list):
                        for key_info in api_keys_data['all']:
                            if key_info.get('company_id') == COMPANY_ID:
                                company_api_key = key_info.get('apiKey')
                                break
                    
                    # If not found in 'all', check grouped structure
                    if not company_api_key and 'grouped' in api_keys_data:
                        grouped = api_keys_data['grouped']
                        for env_keys in grouped.values():
                            if isinstance(env_keys, list):
                                for key_info in env_keys:
                                    if key_info.get('company_id') == COMPANY_ID:
                                        company_api_key = key_info.get('apiKey')
                                        break
                            if company_api_key:
                                break
                    
                    # If still not found, try flat list structure
                    if not company_api_key and isinstance(api_keys_data, list):
                        for key_info in api_keys_data:
                            if key_info.get('company_id') == COMPANY_ID:
                                company_api_key = key_info.get('apiKey') or key_info.get('api_key')
                                break
                    
                    if company_api_key:
                        self.api_key = company_api_key
                        self.log_test(
                            "API Key Retrieval", 
                            True, 
                            f"Successfully retrieved API key for company {COMPANY_ID}",
                            {'api_key_length': len(company_api_key)}
                        )
                        return True
                    else:
                        self.log_test("API Key Retrieval", False, f"No API key found for company {COMPANY_ID}", api_keys_data)
                        return False
                else:
                    self.log_test("API Key Retrieval", False, "Invalid response format", data)
                    return False
            else:
                self.log_test("API Key Retrieval", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("API Key Retrieval", False, f"Exception: {str(e)}")
            return False
    
    def test_create_customer_new_flow(self):
        """SCENARIO 1: Create Customer (NEW Flow) - x-api-key only"""
        print("\n📝 SCENARIO 1: Create Customer (NEW Flow)")
        print("=" * 50)
        
        if not self.api_key:
            self.log_test("Create Customer (NEW Flow)", False, "No API key available")
            return False
            
        try:
            headers = {'x-api-key': self.api_key}
            test_email = f"test-legacy-api-{int(time.time())}@example.com"
            
            response = self.session.post(f"{BACKEND_URL}/api/user/createUser", 
                headers=headers,
                json={
                    "name": "Test Customer",
                    "email": test_email,
                    "mobile": "+1234567890"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('data', {}).get('token'):
                    self.customer_token = data['data']['token']
                    customer_id = data['data']['customer_id']
                    self.log_test(
                        "Create Customer (NEW Flow)", 
                        True, 
                        "Successfully created customer and received JWT token",
                        {
                            'customer_id': customer_id,
                            'email': test_email,
                            'token_length': len(self.customer_token)
                        }
                    )
                    return True
                else:
                    self.log_test("Create Customer (NEW Flow)", False, "Invalid response format", data)
                    return False
            else:
                self.log_test("Create Customer (NEW Flow)", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Create Customer (NEW Flow)", False, f"Exception: {str(e)}")
            return False
    
    def test_crypto_payment_new_auth(self):
        """SCENARIO 2: Create Crypto Payment with NEW Auth (CRITICAL - Previously Had SQL Error)"""
        print("\n💰 SCENARIO 2: Create Crypto Payment with NEW Auth (CRITICAL)")
        print("=" * 50)
        
        if not self.api_key or not self.customer_token:
            self.log_test("Crypto Payment (NEW Auth)", False, "Missing API key or customer token")
            return False
            
        try:
            headers = {
                'x-api-key': self.api_key,
                'Authorization': f'Bearer {self.customer_token}'
            }
            
            response = self.session.post(f"{BACKEND_URL}/api/user/cryptoPayment",
                headers=headers,
                json={
                    "amount": 10,
                    "currency": "ETH",
                    "redirect_uri": "https://example.com/success",
                    "fee_payer": "customer"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('data'):
                    payment_data = data['data']
                    required_fields = ['transaction_id', 'qr_code', 'address', 'amount', 'currency']
                    missing_fields = [field for field in required_fields if field not in payment_data]
                    
                    if not missing_fields:
                        self.log_test(
                            "Crypto Payment (NEW Auth)", 
                            True, 
                            "✅ CRITICAL SUCCESS: No SQL type error occurred! Payment created successfully",
                            {
                                'transaction_id': payment_data['transaction_id'],
                                'address': payment_data['address'],
                                'amount': payment_data['amount'],
                                'currency': payment_data['currency'],
                                'sql_error_fixed': True
                            }
                        )
                        return True
                    else:
                        self.log_test("Crypto Payment (NEW Auth)", False, f"Missing required fields: {missing_fields}", payment_data)
                        return False
                else:
                    self.log_test("Crypto Payment (NEW Auth)", False, "Invalid response format", data)
                    return False
            else:
                # Check if this is the SQL type error we were trying to fix
                error_text = response.text.lower()
                if "operator does not exist: character varying = integer" in error_text:
                    self.log_test(
                        "Crypto Payment (NEW Auth)", 
                        False, 
                        "❌ CRITICAL FAILURE: SQL type error still exists! Fix at line 1444 not working",
                        {'sql_error': True, 'error_text': response.text}
                    )
                else:
                    self.log_test("Crypto Payment (NEW Auth)", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Crypto Payment (NEW Auth)", False, f"Exception: {str(e)}")
            return False
    
    def test_crypto_payment_old_auth(self):
        """SCENARIO 3: Create Crypto Payment with OLD Auth (Legacy Flow)"""
        print("\n🔄 SCENARIO 3: Create Crypto Payment with OLD Auth (Legacy Flow)")
        print("=" * 50)
        
        if not self.api_key:
            self.log_test("Crypto Payment (OLD Auth)", False, "No API key available")
            return False
            
        try:
            headers = {
                'x-api-key': self.api_key,
                'Authorization': 'Bearer invalid_or_empty_token'  # This should trigger legacy flow
            }
            
            response = self.session.post(f"{BACKEND_URL}/api/user/cryptoPayment",
                headers=headers,
                json={
                    "amount": 20,
                    "currency": "BTC",
                    "redirect_uri": "https://example.com/success",
                    "fee_payer": "company"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('data'):
                    payment_data = data['data']
                    required_fields = ['transaction_id', 'qr_code', 'address', 'amount', 'currency']
                    missing_fields = [field for field in required_fields if field not in payment_data]
                    
                    if not missing_fields:
                        self.log_test(
                            "Crypto Payment (OLD Auth)", 
                            True, 
                            "Successfully created payment with auto-created default customer",
                            {
                                'transaction_id': payment_data['transaction_id'],
                                'address': payment_data['address'],
                                'amount': payment_data['amount'],
                                'currency': payment_data['currency'],
                                'legacy_flow': True
                            }
                        )
                        return True
                    else:
                        self.log_test("Crypto Payment (OLD Auth)", False, f"Missing required fields: {missing_fields}", payment_data)
                        return False
                else:
                    self.log_test("Crypto Payment (OLD Auth)", False, "Invalid response format", data)
                    return False
            else:
                self.log_test("Crypto Payment (OLD Auth)", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Crypto Payment (OLD Auth)", False, f"Exception: {str(e)}")
            return False
    
    def test_get_supported_currencies(self):
        """SCENARIO 4: Get Supported Currencies"""
        print("\n🪙 SCENARIO 4: Get Supported Currencies")
        print("=" * 50)
        
        if not self.api_key:
            self.log_test("Get Supported Currencies", False, "No API key available")
            return False
            
        try:
            headers = {'x-api-key': self.api_key}
            
            response = self.session.get(f"{BACKEND_URL}/api/user/getSupportedCurrency", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('data'):
                    currency_data = data['data']
                    currencies = currency_data.get('currencies', [])
                    all_supported = currency_data.get('all_supported', [])
                    
                    self.log_test(
                        "Get Supported Currencies", 
                        True, 
                        f"Successfully retrieved {len(currencies)} configured currencies",
                        {
                            'configured_currencies': currencies,
                            'all_supported_count': len(all_supported),
                            'all_supported': all_supported
                        }
                    )
                    return True
                else:
                    self.log_test("Get Supported Currencies", False, "Invalid response format", data)
                    return False
            else:
                self.log_test("Get Supported Currencies", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Get Supported Currencies", False, f"Exception: {str(e)}")
            return False
    
    def test_get_balance(self):
        """SCENARIO 5: Get Balance"""
        print("\n💰 SCENARIO 5: Get Customer Balance")
        print("=" * 50)
        
        if not self.api_key or not self.customer_token:
            self.log_test("Get Balance", False, "Missing API key or customer token")
            return False
            
        try:
            headers = {
                'x-api-key': self.api_key,
                'Authorization': f'Bearer {self.customer_token}'
            }
            
            response = self.session.get(f"{BACKEND_URL}/api/user/getBalance", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    balance_data = data.get('data', [])
                    self.log_test(
                        "Get Balance", 
                        True, 
                        f"Successfully retrieved balance for {len(balance_data)} wallets",
                        {'wallets': balance_data}
                    )
                    return True
                else:
                    self.log_test("Get Balance", False, "Invalid response format", data)
                    return False
            else:
                self.log_test("Get Balance", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Get Balance", False, f"Exception: {str(e)}")
            return False
    
    def test_get_transactions(self):
        """SCENARIO 6: Get Transactions"""
        print("\n📊 SCENARIO 6: Get Customer Transactions")
        print("=" * 50)
        
        if not self.api_key or not self.customer_token:
            self.log_test("Get Transactions", False, "Missing API key or customer token")
            return False
            
        try:
            headers = {
                'x-api-key': self.api_key,
                'Authorization': f'Bearer {self.customer_token}'
            }
            
            response = self.session.get(f"{BACKEND_URL}/api/user/getTransactions", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    transactions = data.get('data', [])
                    self.log_test(
                        "Get Transactions", 
                        True, 
                        f"Successfully retrieved {len(transactions)} transactions",
                        {'transaction_count': len(transactions)}
                    )
                    return True
                else:
                    self.log_test("Get Transactions", False, "Invalid response format", data)
                    return False
            else:
                self.log_test("Get Transactions", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Get Transactions", False, f"Exception: {str(e)}")
            return False
    
    def test_api_key_validation(self):
        """Test API key validation (should return 403 without API key)"""
        print("\n🔒 BONUS TEST: API Key Validation")
        print("=" * 50)
        
        try:
            # Test without API key - should return 403
            response = self.session.post(f"{BACKEND_URL}/api/user/createUser", json={
                "name": "Test Customer",
                "email": "test@example.com"
            })
            
            if response.status_code == 403:
                self.log_test(
                    "API Key Validation", 
                    True, 
                    "Correctly returned 403 Forbidden without API key"
                )
                return True
            else:
                self.log_test("API Key Validation", False, f"Expected 403, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("API Key Validation", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all Legacy API tests"""
        print("🚀 LEGACY API BACKWARD COMPATIBILITY TESTING")
        print("=" * 60)
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test User: {TEST_USER_EMAIL}")
        print(f"Company ID: {COMPANY_ID}")
        print(f"Test Time: {datetime.now().isoformat()}")
        
        # Step 1: Authentication and Setup
        if not self.authenticate_user():
            print("\n❌ CRITICAL: User authentication failed. Cannot proceed with tests.")
            return self.generate_summary()
            
        if not self.get_api_key():
            print("\n❌ CRITICAL: API key retrieval failed. Cannot proceed with tests.")
            return self.generate_summary()
        
        # Step 2: Run all test scenarios
        test_methods = [
            self.test_api_key_validation,
            self.test_create_customer_new_flow,
            self.test_crypto_payment_new_auth,  # CRITICAL TEST
            self.test_crypto_payment_old_auth,
            self.test_get_supported_currencies,
            self.test_get_balance,
            self.test_get_transactions
        ]
        
        for test_method in test_methods:
            try:
                test_method()
                time.sleep(1)  # Brief pause between tests
            except Exception as e:
                print(f"❌ UNEXPECTED ERROR in {test_method.__name__}: {str(e)}")
        
        return self.generate_summary()
    
    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 60)
        print("📋 LEGACY API TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        # Critical test status
        critical_test = next((r for r in self.test_results if "Crypto Payment (NEW Auth)" in r['test']), None)
        if critical_test:
            if critical_test['success']:
                print("\n🎉 CRITICAL SUCCESS: SQL type error fix is working correctly!")
                print("   ✅ cryptoPayment endpoint with NEW auth works WITHOUT SQL type error")
            else:
                print("\n🚨 CRITICAL FAILURE: SQL type error fix is NOT working!")
                print("   ❌ cryptoPayment endpoint still has SQL type error")
        
        print("\n📊 DETAILED RESULTS:")
        print("-" * 60)
        for result in self.test_results:
            status = "✅ PASS" if result['success'] else "❌ FAIL"
            print(f"{status} {result['test']}")
            if not result['success']:
                print(f"   Error: {result['message']}")
        
        # Final assessment
        print("\n🎯 FINAL ASSESSMENT:")
        print("-" * 60)
        if success_rate >= 85:
            print("✅ LEGACY API IS OPERATIONAL - Ready for production use")
        elif success_rate >= 70:
            print("⚠️  LEGACY API MOSTLY WORKING - Minor issues need attention")
        else:
            print("❌ LEGACY API HAS MAJOR ISSUES - Requires immediate fixes")
        
        return {
            'total_tests': total_tests,
            'passed_tests': passed_tests,
            'failed_tests': failed_tests,
            'success_rate': success_rate,
            'critical_test_passed': critical_test['success'] if critical_test else False,
            'results': self.test_results
        }

def main():
    """Main test execution"""
    tester = LegacyAPITester()
    summary = tester.run_all_tests()
    
    # Return appropriate exit code
    if summary['success_rate'] >= 85 and summary['critical_test_passed']:
        exit(0)  # Success
    else:
        exit(1)  # Failure

if __name__ == "__main__":
    main()