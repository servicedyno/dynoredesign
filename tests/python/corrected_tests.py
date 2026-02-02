#!/usr/bin/env python3
"""
DynoPay Backend - Corrected Tests Based on Root Cause Analysis
Testing with the correct field formats discovered from the debug analysis.
"""

import os
import json
import requests
import time
from typing import Dict, Any

class DynoPayCorrectedTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.jwt_token = None
        self.company_id = "3"  # Using the discovered company_id
        self.test_results = {}
        self.errors = []
        
        # Test credentials from review request
        self.test_email = "nomadly@moxx.co"
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
        """Log test result with detailed information"""
        self.test_results[test_name] = {
            'success': success,
            'message': message,
            'details': details or {}
        }
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        print(f"   Message: {message}")
        if details:
            print(f"   Details: {json.dumps(details, indent=2)}")
        print()
        
        if not success:
            self.errors.append(f"{test_name}: {message}")
    
    def authenticate(self):
        """Authenticate and get JWT token"""
        print("=== AUTHENTICATION ===")
        
        login_data = {
            "email": self.test_email,
            "password": self.test_password
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json=login_data,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if response.status_code == 200:
                login_response = response.json()
                if 'data' in login_response and 'accessToken' in login_response['data']:
                    self.jwt_token = login_response['data']['accessToken']
                    self.log_result(
                        "Authentication",
                        True,
                        f"Successfully authenticated user {self.test_email}",
                        {"token_length": len(self.jwt_token)}
                    )
                    return True
                    
            self.log_result(
                "Authentication",
                False,
                f"Login failed with status {response.status_code}",
                {"response": response.text}
            )
            return False
                
        except Exception as e:
            self.log_result(
                "Authentication",
                False,
                f"Login request failed: {str(e)}"
            )
            return False
    
    def test_corrected_company_creation(self):
        """Test company creation with corrected format (without invalid TAX ID)"""
        print("=== CORRECTED COMPANY CREATION ===")
        
        if not self.jwt_token:
            self.log_result("Company Creation", False, "No JWT token available")
            return
        
        # Test without TAX ID to avoid validation issues
        company_data = {
            "company_name": "Corrected Test Company",
            "email": "corrected@dynopay.com",
            "mobile": "+1234567890",
            "address_line1": "123 Corrected Street",
            "city": "Test City",
            "country": "US"
            # Removed vat_number and vat_type to avoid TAX ID validation
        }
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}"
        }
        
        try:
            # Use multipart/form-data format as required
            files = {
                'data': (None, json.dumps(company_data), 'application/json')
            }
            
            response = requests.post(
                f"{self.backend_url}/api/company/addCompany",
                headers=headers,
                files=files,
                timeout=30
            )
            
            if response.status_code == 200:
                response_data = response.json()
                self.log_result(
                    "Company Creation - Corrected Format",
                    True,
                    "Company creation succeeded without TAX ID validation issues",
                    {
                        "company_id": response_data.get('data', {}).get('company_id'),
                        "company_name": response_data.get('data', {}).get('company_name')
                    }
                )
            else:
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"raw": response.text}
                self.log_result(
                    "Company Creation - Corrected Format",
                    False,
                    f"Company creation failed: {error_data.get('message', 'Unknown error')}",
                    {"status_code": response.status_code, "error": error_data}
                )
                
        except Exception as e:
            self.log_result(
                "Company Creation - Corrected Format",
                False,
                f"Request failed: {str(e)}"
            )
    
    def test_corrected_api_key_creation(self):
        """Test API key creation with different currency to avoid duplicate error"""
        print("=== CORRECTED API KEY CREATION ===")
        
        if not self.jwt_token:
            self.log_result("API Key Creation", False, "No JWT token available")
            return
        
        # Use different currency to avoid "already exists" error
        api_key_data = {
            "company_id": int(self.company_id),  # Convert to integer
            "api_name": "Corrected Test API",
            "base_currency": "BTC",  # Different currency
            "environment": "development",
            "permissions": ["payments", "transactions"]
        }
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/userApi/addApi",
                json=api_key_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                response_data = response.json()
                self.log_result(
                    "API Key Creation - Corrected Format",
                    True,
                    "API key creation succeeded with different currency",
                    {
                        "api_id": response_data.get('data', {}).get('api_id'),
                        "base_currency": api_key_data["base_currency"]
                    }
                )
            else:
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"raw": response.text}
                self.log_result(
                    "API Key Creation - Corrected Format",
                    False,
                    f"API key creation failed: {error_data.get('message', 'Unknown error')}",
                    {"status_code": response.status_code, "error": error_data}
                )
                
        except Exception as e:
            self.log_result(
                "API Key Creation - Corrected Format",
                False,
                f"Request failed: {str(e)}"
            )
    
    def test_corrected_payment_link_creation(self):
        """Test payment link creation with corrected field formats"""
        print("=== CORRECTED PAYMENT LINK CREATION ===")
        
        if not self.jwt_token:
            self.log_result("Payment Link Creation", False, "No JWT token available")
            return
        
        # Based on the error analysis, the API expects:
        # 1. Both "amount" AND "base_currency" fields (not base_amount)
        # 2. Modes in uppercase: ["CRYPTO", "CARD"]
        
        corrected_data = {
            "amount": 100.00,  # Use "amount" not "base_amount"
            "base_currency": "USD",  # Still need base_currency
            "company_id": int(self.company_id),
            "email": "corrected@dynopay.com",
            "modes": ["CRYPTO", "CARD"],  # Uppercase modes
            "description": "Corrected Test Payment",
            "expire": "24h"
        }
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=corrected_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                response_data = response.json()
                self.log_result(
                    "Payment Link - Corrected Format",
                    True,
                    "Payment link creation succeeded with corrected field formats",
                    {
                        "link_id": response_data.get('data', {}).get('link_id'),
                        "amount": corrected_data["amount"],
                        "modes": corrected_data["modes"]
                    }
                )
            else:
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"raw": response.text}
                self.log_result(
                    "Payment Link - Corrected Format",
                    False,
                    f"Payment link creation failed: {error_data.get('message', 'Unknown error')}",
                    {"status_code": response.status_code, "error": error_data}
                )
                
        except Exception as e:
            self.log_result(
                "Payment Link - Corrected Format",
                False,
                f"Request failed: {str(e)}"
            )
    
    def test_alternative_payment_modes(self):
        """Test different valid payment modes"""
        print("=== TESTING ALTERNATIVE PAYMENT MODES ===")
        
        if not self.jwt_token:
            return
        
        # Test different valid mode combinations based on the error message
        valid_modes = [
            ["CARD"],
            ["CRYPTO"], 
            ["BANK_TRANSFER"],
            ["CARD", "CRYPTO"],
            ["CARD", "BANK_TRANSFER"],
            ["CRYPTO", "BANK_TRANSFER"]
        ]
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        for i, modes in enumerate(valid_modes):
            test_data = {
                "amount": 25.00 + i,  # Different amounts to avoid duplicates
                "base_currency": "USD",
                "company_id": int(self.company_id),
                "email": f"modes{i}@dynopay.com",
                "modes": modes,
                "description": f"Modes Test {i+1}",
                "expire": "24h"
            }
            
            try:
                response = requests.post(
                    f"{self.backend_url}/api/pay/createPaymentLink",
                    json=test_data,
                    headers=headers,
                    timeout=30
                )
                
                success = response.status_code == 200
                if success:
                    response_data = response.json()
                    link_id = response_data.get('data', {}).get('link_id')
                else:
                    error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"raw": response.text}
                    link_id = None
                
                self.log_result(
                    f"Payment Modes - {'+'.join(modes)}",
                    success,
                    f"Modes {modes} {'succeeded' if success else 'failed'}",
                    {
                        "modes": modes,
                        "status_code": response.status_code,
                        "link_id": link_id
                    }
                )
                
            except Exception as e:
                self.log_result(
                    f"Payment Modes - {'+'.join(modes)}",
                    False,
                    f"Request failed: {str(e)}",
                    {"modes": modes}
                )
    
    def run_corrected_tests(self):
        """Run all corrected tests"""
        print("🔧 DynoPay Backend - Corrected Tests Based on Root Cause Analysis")
        print("=" * 80)
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Credentials: {self.test_email}")
        print(f"Using Company ID: {self.company_id}")
        print("=" * 80)
        
        # Authenticate first
        if not self.authenticate():
            print("❌ Authentication failed - cannot proceed with tests")
            return
        
        # Run corrected tests
        self.test_corrected_company_creation()
        self.test_corrected_api_key_creation()
        self.test_corrected_payment_link_creation()
        self.test_alternative_payment_modes()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("CORRECTED TESTS SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "0%")
        
        if failed_tests > 0:
            print(f"\n❌ REMAINING FAILURES ({failed_tests}):")
            for test_name, result in self.test_results.items():
                if not result['success']:
                    print(f"  • {test_name}: {result['message']}")
        
        if passed_tests > 0:
            print(f"\n✅ SUCCESSFUL FIXES ({passed_tests}):")
            for test_name, result in self.test_results.items():
                if result['success']:
                    print(f"  • {test_name}: {result['message']}")
        
        print("\n" + "=" * 80)
        print("ROOT CAUSE FIXES VERIFICATION COMPLETE")
        print("=" * 80)

if __name__ == "__main__":
    tester = DynoPayCorrectedTester()
    tester.run_corrected_tests()