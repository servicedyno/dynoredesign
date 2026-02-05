#!/usr/bin/env python3
"""
Legacy API cryptoPayment Endpoint Testing
Re-test the cryptoPayment endpoint after SQL type error fix
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any
import uuid

class LegacyAPICryptoPaymentTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.user_data = None
        self.api_key = None
        self.customer_token = None
        
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
        """Step 1: Authenticate with provided credentials"""
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
                        "Step 1 - Authentication", 
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
                    self.log_result("Step 1 - Authentication", False, "Login succeeded but no token received")
                    return False
            else:
                self.log_result("Step 1 - Authentication", False, f"Login failed with status {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Step 1 - Authentication", False, f"Authentication failed: {str(e)}")
            return False
    
    def get_api_key(self):
        """Step 2: Retrieve API key via /api/userApi/getApi"""
        if not self.jwt_token:
            self.log_result("Step 2 - Get API Key", False, "No JWT token available")
            return False
            
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
                
                # Get the first active API key
                for api_key_obj in api_list:
                    if api_key_obj.get('status') == 'active':
                        self.api_key = api_key_obj.get('api_key')
                        break
                
                if not self.api_key and api_list:
                    # If no active key found, use the first one
                    self.api_key = api_list[0].get('api_key')
                
                if self.api_key:
                    self.log_result(
                        "Step 2 - Get API Key", 
                        True, 
                        f"Successfully retrieved API key",
                        {
                            "api_key_count": len(api_list),
                            "api_key_preview": self.api_key[:20] + "..." if len(self.api_key) > 20 else self.api_key
                        }
                    )
                    return True
                else:
                    self.log_result("Step 2 - Get API Key", False, "No API key found in response")
                    return False
            else:
                self.log_result("Step 2 - Get API Key", False, f"API key endpoint failed with status {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Step 2 - Get API Key", False, f"API key request failed: {str(e)}")
            return False
    
    def create_customer(self):
        """Step 3: Create a customer using POST /api/user/createUser with API key"""
        if not self.api_key:
            self.log_result("Step 3 - Create Customer", False, "No API key available")
            return False
            
        try:
            customer_data = {
                "email": f"test_customer_{int(time.time())}@example.com",
                "name": "Test Customer",
                "phone": "+1234567890"
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
                customer_response = data.get('data', {})
                self.customer_token = customer_response.get('token')
                
                if self.customer_token:
                    self.log_result(
                        "Step 3 - Create Customer", 
                        True, 
                        "Successfully created customer and retrieved JWT token",
                        {
                            "customer_email": customer_data["email"],
                            "customer_name": customer_data["name"],
                            "token_preview": self.customer_token[:30] + "..." if len(self.customer_token) > 30 else self.customer_token
                        }
                    )
                    return True
                else:
                    self.log_result("Step 3 - Create Customer", False, "Customer created but no JWT token received")
                    return False
            else:
                self.log_result("Step 3 - Create Customer", False, f"Customer creation failed with status {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Step 3 - Create Customer", False, f"Customer creation request failed: {str(e)}")
            return False
    
    def test_crypto_payment(self):
        """Step 4: Test POST /api/user/cryptoPayment with required headers and body"""
        if not self.api_key or not self.customer_token:
            self.log_result("Step 4 - CryptoPayment Test", False, "Missing API key or customer token")
            return False
            
        try:
            payment_data = {
                "amount": 10,
                "currency": "ETH"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/user/cryptoPayment",
                json=payment_data,
                headers={
                    "x-api-key": self.api_key,
                    "Authorization": f"Bearer {self.customer_token}",
                    "Content-Type": "application/json"
                },
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                payment_response = data.get('data', {})
                
                # Verify required fields in response
                required_fields = ['transaction_id', 'qr_code', 'address', 'amount', 'currency']
                missing_fields = []
                present_fields = {}
                
                for field in required_fields:
                    if field in payment_response:
                        present_fields[field] = payment_response[field]
                    else:
                        missing_fields.append(field)
                
                if not missing_fields:
                    self.log_result(
                        "Step 4 - CryptoPayment Test", 
                        True, 
                        "CryptoPayment endpoint working correctly - all required fields present",
                        {
                            "transaction_id": present_fields.get('transaction_id'),
                            "address": present_fields.get('address'),
                            "amount": present_fields.get('amount'),
                            "currency": present_fields.get('currency'),
                            "qr_code_present": bool(present_fields.get('qr_code')),
                            "sql_error_fixed": True
                        }
                    )
                    return True
                else:
                    self.log_result("Step 4 - CryptoPayment Test", False, f"Missing required fields: {missing_fields}")
                    return False
            else:
                # Check for SQL type error in response
                response_text = response.text.lower()
                has_sql_error = ('operator does not exist' in response_text and 
                               'character varying = integer' in response_text)
                
                if has_sql_error:
                    self.log_result("Step 4 - CryptoPayment Test", False, f"SQL type error still present (status {response.status_code})")
                else:
                    self.log_result("Step 4 - CryptoPayment Test", False, f"CryptoPayment failed with status {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Step 4 - CryptoPayment Test", False, f"CryptoPayment request failed: {str(e)}")
            return False
    
    def check_backend_logs(self):
        """Step 5: Check backend logs for any SQL errors"""
        try:
            import subprocess
            log_result = subprocess.run(
                ["tail", "-n", "100", "/var/log/supervisor/backend.out.log"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            log_content = log_result.stdout.lower()
            
            # Check for SQL type errors
            sql_errors = []
            if 'operator does not exist: character varying = integer' in log_content:
                sql_errors.append("SQL type error: character varying = integer")
            if 'items.adm_id' in log_content and 'error' in log_content:
                sql_errors.append("adm_id related error")
            
            if not sql_errors:
                self.log_result(
                    "Step 5 - Backend Logs Check", 
                    True, 
                    "No SQL type errors found in recent backend logs",
                    {
                        "log_lines_checked": len(log_result.stdout.split('\n')),
                        "sql_errors_found": False
                    }
                )
                return True
            else:
                self.log_result("Step 5 - Backend Logs Check", False, f"SQL errors found in logs: {sql_errors}")
                return False
                
        except Exception as e:
            self.log_result("Step 5 - Backend Logs Check", False, f"Could not check backend logs: {str(e)}")
            return False
    
    def run_legacy_api_test(self):
        """Run the complete Legacy API cryptoPayment test sequence"""
        print("="*80)
        print("LEGACY API CRYPTOPAYMENT ENDPOINT TESTING")
        print("Re-test after SQL type error fix")
        print("="*80)
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Credentials: {self.test_email}")
        print("="*80)
        
        # Run test sequence
        success_count = 0
        total_steps = 5
        
        if self.authenticate_user():
            success_count += 1
        else:
            print("\n❌ AUTHENTICATION FAILED - Cannot proceed with tests")
            return
        
        if self.get_api_key():
            success_count += 1
        else:
            print("\n❌ API KEY RETRIEVAL FAILED - Cannot proceed with tests")
            return
        
        if self.create_customer():
            success_count += 1
        else:
            print("\n❌ CUSTOMER CREATION FAILED - Cannot proceed with tests")
            return
        
        if self.test_crypto_payment():
            success_count += 1
        
        if self.check_backend_logs():
            success_count += 1
        
        # Print summary
        self.print_summary(success_count, total_steps)
    
    def print_summary(self, success_count, total_steps):
        """Print test summary"""
        print("\n" + "="*80)
        print("LEGACY API CRYPTOPAYMENT TEST SUMMARY")
        print("="*80)
        
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = len(self.test_results) - passed_tests
        
        print(f"Total Steps: {len(self.test_results)}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/len(self.test_results))*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED STEPS:")
            for error in self.errors:
                print(f"  - {error}")
        
        # Determine overall result
        crypto_payment_working = any(
            result['success'] for name, result in self.test_results.items() 
            if 'CryptoPayment Test' in name
        )
        
        if crypto_payment_working:
            print("\n🎉 CRYPTOPAYMENT ENDPOINT IS WORKING!")
            print("✅ SQL type error has been successfully fixed")
        else:
            print("\n⚠️  CRYPTOPAYMENT ENDPOINT STILL HAS ISSUES")
            print("❌ SQL type error may still be present")
        
        print("\n" + "="*80)

if __name__ == "__main__":
    tester = LegacyAPICryptoPaymentTester()
    tester.run_legacy_api_test()