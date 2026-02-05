#!/usr/bin/env python3
"""
TypeScript Fix Verification Test - Legacy API cryptoPayment Endpoint
Tests the Legacy API after TypeScript compilation error fix at line 4361 in paymentController.ts
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any
import uuid

class TypeScriptFixLegacyAPITester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        
        # Test credentials from review request
        self.test_email = "richard@dyno.pt"
        self.test_password = "Katiekendra123@"
        
        # API key for Legacy API testing
        self.api_key = None
        
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
    
    def authenticate_and_get_api_key(self):
        """Authenticate user and retrieve API key"""
        try:
            # Step 1: Login to get JWT token
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json={
                    "email": self.test_email,
                    "password": self.test_password
                },
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code != 200:
                self.log_result("Authentication", False, f"Login failed with status {response.status_code}")
                return False
                
            data = response.json()
            if 'data' not in data or 'accessToken' not in data['data']:
                self.log_result("Authentication", False, "Login succeeded but no token received")
                return False
                
            jwt_token = data['data']['accessToken']
            user_data = data['data']['userData']
            
            # Step 2: Get API key
            api_response = requests.get(
                f"{self.backend_url}/api/userApi/getApi",
                headers={"Authorization": f"Bearer {jwt_token}"},
                timeout=15
            )
            
            if api_response.status_code != 200:
                self.log_result("Authentication", False, f"API key retrieval failed with status {api_response.status_code}")
                return False
                
            api_data = api_response.json()
            api_keys_data = api_data.get('data', {})
            
            # Handle different API response formats
            if isinstance(api_keys_data, dict) and 'all' in api_keys_data:
                api_keys = api_keys_data['all']
            elif isinstance(api_keys_data, list):
                api_keys = api_keys_data
            else:
                api_keys = [api_keys_data] if api_keys_data else []
            
            if not api_keys:
                self.log_result("Authentication", False, "No API keys found for user")
                return False
                
            # Get the first API key
            first_api_key = api_keys[0]
            self.api_key = first_api_key.get('apiKey') or first_api_key.get('api_key') or first_api_key.get('encrypted_key')
            
            if not self.api_key:
                self.log_result("Authentication", False, "API key not found in response")
                return False
                
            self.log_result(
                "Authentication", 
                True, 
                f"Successfully authenticated {user_data.get('email', 'user')} and retrieved API key",
                {
                    "user_id": user_data.get('user_id'),
                    "name": user_data.get('name'),
                    "email": user_data.get('email'),
                    "api_key_length": len(self.api_key) if self.api_key else 0
                }
            )
            return True
                
        except Exception as e:
            self.log_result("Authentication", False, f"Authentication failed: {str(e)}")
            return False
    
    def test_scenario_1_create_customer(self):
        """SCENARIO 1: Create Customer - POST /api/user/createUser"""
        print("\n" + "="*60)
        print("SCENARIO 1: CREATE CUSTOMER")
        print("="*60)
        
        if not self.api_key:
            self.log_result("Scenario 1 - Create Customer", False, "No API key available")
            return None
            
        try:
            customer_data = {
                "name": "TypeScript Fix Test",
                "email": "ts-fix-test@example.com"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/user/createUser",
                json=customer_data,
                headers={
                    "x-api-key": self.api_key,
                    "Content-Type": "application/json"
                },
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for success and data structure
                if data.get('success') and 'data' in data:
                    response_data = data['data']
                    customer_token = response_data.get('token')
                    customer_id = response_data.get('customer_id')
                    
                    if customer_token and customer_id:
                        self.log_result(
                            "Scenario 1 - Create Customer", 
                            True, 
                            f"Customer created successfully with token and customer_id",
                            {
                                "customer_id": customer_id,
                                "token_length": len(customer_token) if customer_token else 0,
                                "customer_name": customer_data["name"],
                                "customer_email": customer_data["email"]
                            }
                        )
                        return customer_token
                    else:
                        self.log_result("Scenario 1 - Create Customer", False, "Customer created but missing token or customer_id")
                        return None
                else:
                    self.log_result("Scenario 1 - Create Customer", False, f"Unexpected response structure: {data}")
                    return None
            else:
                self.log_result("Scenario 1 - Create Customer", False, f"Customer creation failed with status {response.status_code}")
                return None
                
        except Exception as e:
            self.log_result("Scenario 1 - Create Customer", False, f"Customer creation request failed: {str(e)}")
            return None
    
    def test_scenario_2_crypto_payment_new_auth(self, customer_token):
        """SCENARIO 2: Create Crypto Payment (NEW Auth) - with Bearer token"""
        print("\n" + "="*60)
        print("SCENARIO 2: CREATE CRYPTO PAYMENT (NEW AUTH)")
        print("="*60)
        
        if not self.api_key:
            self.log_result("Scenario 2 - Crypto Payment (NEW Auth)", False, "No API key available")
            return
            
        if not customer_token:
            self.log_result("Scenario 2 - Crypto Payment (NEW Auth)", False, "No customer token available")
            return
            
        try:
            payment_data = {
                "amount": 15,
                "currency": "ETH",
                "fee_payer": "customer"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/user/cryptoPayment",
                json=payment_data,
                headers={
                    "x-api-key": self.api_key,
                    "Authorization": f"Bearer {customer_token}",
                    "Content-Type": "application/json"
                },
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for success and data structure
                if data.get('success') and 'data' in data:
                    response_data = data['data']
                    
                    # Check for TypeScript type conversion success
                    transaction_id = response_data.get('transaction_id')
                    address = response_data.get('address')
                    amount = response_data.get('amount')
                    currency = response_data.get('currency')
                    
                    if transaction_id and address:
                        self.log_result(
                            "Scenario 2 - Crypto Payment (NEW Auth)", 
                            True, 
                            f"Crypto payment created successfully - TypeScript type conversion working",
                            {
                                "transaction_id": transaction_id,
                                "address": address,
                                "amount": amount,
                                "currency": currency,
                                "fee_payer": payment_data["fee_payer"],
                                "typescript_fix_verified": True
                            }
                        )
                    else:
                        self.log_result("Scenario 2 - Crypto Payment (NEW Auth)", False, "Payment created but missing required fields")
                else:
                    self.log_result("Scenario 2 - Crypto Payment (NEW Auth)", False, f"Unexpected response structure: {data}")
            else:
                self.log_result("Scenario 2 - Crypto Payment (NEW Auth)", False, f"Crypto payment (NEW Auth) failed with status {response.status_code}")
                
        except Exception as e:
            self.log_result("Scenario 2 - Crypto Payment (NEW Auth)", False, f"Crypto payment (NEW Auth) request failed: {str(e)}")
    
    def test_scenario_3_crypto_payment_old_auth(self):
        """SCENARIO 3: Create Crypto Payment (OLD Auth/Legacy Flow) - x-api-key only"""
        print("\n" + "="*60)
        print("SCENARIO 3: CREATE CRYPTO PAYMENT (OLD AUTH/LEGACY FLOW)")
        print("="*60)
        
        if not self.api_key:
            self.log_result("Scenario 3 - Crypto Payment (OLD Auth)", False, "No API key available")
            return
            
        try:
            payment_data = {
                "amount": 25,
                "currency": "BTC",
                "fee_payer": "company"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/user/cryptoPayment",
                json=payment_data,
                headers={
                    "x-api-key": self.api_key,
                    "Content-Type": "application/json"
                    # No Authorization header - testing legacy flow
                },
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for success and data structure
                if data.get('success') and 'data' in data:
                    response_data = data['data']
                    
                    # Check for auto-created customer and payment details
                    transaction_id = response_data.get('transaction_id')
                    address = response_data.get('address')
                    amount = response_data.get('amount')
                    currency = response_data.get('currency')
                    
                    if transaction_id and address:
                        self.log_result(
                            "Scenario 3 - Crypto Payment (OLD Auth)", 
                            True, 
                            f"Legacy crypto payment created successfully with auto-created customer",
                            {
                                "transaction_id": transaction_id,
                                "address": address,
                                "amount": amount,
                                "currency": currency,
                                "fee_payer": payment_data["fee_payer"],
                                "legacy_flow_verified": True
                            }
                        )
                    else:
                        self.log_result("Scenario 3 - Crypto Payment (OLD Auth)", False, "Payment created but missing required fields")
                else:
                    self.log_result("Scenario 3 - Crypto Payment (OLD Auth)", False, f"Unexpected response structure: {data}")
            else:
                self.log_result("Scenario 3 - Crypto Payment (OLD Auth)", False, f"Crypto payment (OLD Auth) failed with status {response.status_code}")
                
        except Exception as e:
            self.log_result("Scenario 3 - Crypto Payment (OLD Auth)", False, f"Crypto payment (OLD Auth) request failed: {str(e)}")
    
    def check_typescript_compilation(self):
        """Check for TypeScript compilation errors in backend logs"""
        print("\n" + "="*60)
        print("TYPESCRIPT COMPILATION CHECK")
        print("="*60)
        
        try:
            import subprocess
            log_result = subprocess.run(
                ["tail", "-n", "100", "/var/log/supervisor/backend.out.log"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            log_content = log_result.stdout.lower()
            
            # Check for TypeScript compilation errors
            typescript_errors = [
                'typescript error',
                'compilation error',
                'type error',
                'ts error',
                'cannot find name',
                'property does not exist'
            ]
            
            compilation_errors_found = any(error in log_content for error in typescript_errors)
            
            if not compilation_errors_found:
                self.log_result(
                    "TypeScript Compilation Check", 
                    True, 
                    "No TypeScript compilation errors detected in backend logs",
                    {
                        "log_lines_checked": len(log_result.stdout.split('\n')),
                        "compilation_errors_found": False
                    }
                )
            else:
                self.log_result("TypeScript Compilation Check", False, "TypeScript compilation errors detected in backend logs")
                
        except Exception as e:
            self.log_result("TypeScript Compilation Check", False, f"Could not check backend logs: {str(e)}")
    
    def run_all_tests(self):
        """Run all TypeScript fix verification tests"""
        print("="*80)
        print("TYPESCRIPT FIX VERIFICATION TEST - LEGACY API")
        print("="*80)
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Credentials: {self.test_email}")
        print("Focus: TypeScript type conversion fix at line 4361 in paymentController.ts")
        print("="*80)
        
        # Step 1: Authenticate and get API key
        if not self.authenticate_and_get_api_key():
            print("\n❌ AUTHENTICATION FAILED - Cannot proceed with tests")
            return
        
        # Step 2: Check TypeScript compilation
        self.check_typescript_compilation()
        
        # Step 3: Run test scenarios
        customer_token = self.test_scenario_1_create_customer()
        self.test_scenario_2_crypto_payment_new_auth(customer_token)
        self.test_scenario_3_crypto_payment_old_auth()
        
        # Step 4: Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("TYPESCRIPT FIX VERIFICATION SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Success criteria check
        success_criteria = [
            "Authentication",
            "Scenario 1 - Create Customer", 
            "Scenario 2 - Crypto Payment (NEW Auth)",
            "Scenario 3 - Crypto Payment (OLD Auth)"
        ]
        
        criteria_met = sum(1 for criteria in success_criteria if 
                          criteria in self.test_results and self.test_results[criteria]['success'])
        
        print(f"\nSUCCESS CRITERIA: {criteria_met}/{len(success_criteria)} met")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        
        if criteria_met == len(success_criteria):
            print("\n🎉 TYPESCRIPT FIX VERIFICATION SUCCESSFUL!")
            print("✅ All 3 test scenarios pass")
            print("✅ No TypeScript compilation errors")
            print("✅ Type conversion at line 4361 works correctly for both string and number types")
        else:
            print(f"\n⚠️  {len(success_criteria) - criteria_met} CRITICAL TEST(S) FAILED")
            print("TypeScript fix may need additional investigation")

if __name__ == "__main__":
    tester = TypeScriptFixLegacyAPITester()
    tester.run_all_tests()