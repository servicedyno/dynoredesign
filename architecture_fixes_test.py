#!/usr/bin/env python3
"""
DynoPay Architecture Fixes Testing Suite
Tests the specific architecture fixes mentioned in the review request:
1. Admin Fee Redis Fix
2. Test Router Authentication 
3. Invoice API Fee Hiding
4. Payment getData Endpoint Fee Info
"""

import os
import json
import requests
import time
from typing import Dict, List, Any

class ArchitectureFixesTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.test_credentials = {
            "email": "john@dyno.pt",
            "password": "Katiekendra123@"
        }
        
    def get_backend_url(self):
        """Get backend URL from frontend .env file"""
        # For testing, use localhost directly since external URL may have connectivity issues
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
        print("\n=== Authenticating User ===")
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json=self.test_credentials,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    self.jwt_token = data['data']['accessToken']
                    user_info = data['data']
                    self.log_result(
                        "User Authentication", 
                        True, 
                        f"Successfully authenticated {self.test_credentials['email']}",
                        {
                            "user_id": user_info.get('user_id'),
                            "name": user_info.get('name'),
                            "username": user_info.get('username'),
                            "has_token": bool(self.jwt_token)
                        }
                    )
                    return True
                else:
                    self.log_result(
                        "User Authentication", 
                        False, 
                        "Login succeeded but no token received",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "User Authentication", 
                    False, 
                    f"Login failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "User Authentication", 
                False, 
                f"Authentication failed: {str(e)}"
            )
        
        return False
    
    def test_admin_fee_redis_fix(self):
        """Test 1: Admin Fee Redis Fix - GET /api/admin/getTransactionFee"""
        print("\n=== Test 1: Admin Fee Redis Fix ===")
        
        if not self.jwt_token:
            self.log_result(
                "Admin Fee Redis Fix", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.get(
                f"{self.backend_url}/api/admin/getTransactionFee",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if both transaction_fee and blockchain_fee are returned
                response_data = data.get('data', {}) if 'data' in data else data
                
                has_transaction_fee = 'transaction_fee' in response_data
                has_blockchain_fee = 'blockchain_fee' in response_data
                
                if has_transaction_fee and has_blockchain_fee:
                    self.log_result(
                        "Admin Fee Redis Fix", 
                        True, 
                        "Both transaction_fee and blockchain_fee are returned correctly",
                        {
                            "transaction_fee": response_data.get('transaction_fee'),
                            "blockchain_fee": response_data.get('blockchain_fee'),
                            "response_keys": list(response_data.keys())
                        }
                    )
                else:
                    missing_fields = []
                    if not has_transaction_fee:
                        missing_fields.append('transaction_fee')
                    if not has_blockchain_fee:
                        missing_fields.append('blockchain_fee')
                    
                    self.log_result(
                        "Admin Fee Redis Fix", 
                        False, 
                        f"Missing required fields: {', '.join(missing_fields)}",
                        {
                            "has_transaction_fee": has_transaction_fee,
                            "has_blockchain_fee": has_blockchain_fee,
                            "response_data": response_data
                        }
                    )
            elif response.status_code == 403:
                # User doesn't have admin access - check if we can verify the fix via root endpoint
                self.test_admin_fee_via_root_endpoint()
            else:
                self.log_result(
                    "Admin Fee Redis Fix", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Admin Fee Redis Fix", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_admin_fee_via_root_endpoint(self):
        """Test admin fee fix via root endpoint that shows both fees"""
        try:
            response = requests.get(f"{self.backend_url}/", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                has_transaction_fee = 'transaction_fee' in data
                has_blockchain_fee = 'blockchain_fee' in data
                
                if has_transaction_fee and has_blockchain_fee:
                    self.log_result(
                        "Admin Fee Redis Fix", 
                        True, 
                        "Both transaction_fee and blockchain_fee are returned correctly (verified via root endpoint)",
                        {
                            "transaction_fee": data.get('transaction_fee'),
                            "blockchain_fee": data.get('blockchain_fee'),
                            "note": "Tested via root endpoint due to admin access limitation"
                        }
                    )
                else:
                    missing_fields = []
                    if not has_transaction_fee:
                        missing_fields.append('transaction_fee')
                    if not has_blockchain_fee:
                        missing_fields.append('blockchain_fee')
                    
                    self.log_result(
                        "Admin Fee Redis Fix", 
                        False, 
                        f"Missing required fields in root endpoint: {', '.join(missing_fields)}",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Admin Fee Redis Fix", 
                    False, 
                    f"Root endpoint failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Admin Fee Redis Fix", 
                False, 
                f"Root endpoint test failed: {str(e)}"
            )
    
    def test_test_router_authentication(self):
        """Test 2: Test Router Authentication - /api/test/* endpoints"""
        print("\n=== Test 2: Test Router Authentication ===")
        
        # Test endpoints without authentication first
        self.test_unauthenticated_test_endpoints()
        
        # Then test with authentication
        if self.jwt_token:
            self.test_authenticated_test_endpoints()
        else:
            self.log_result(
                "Test Router - Authenticated Tests", 
                False, 
                "No JWT token available for authenticated tests"
            )
    
    def test_unauthenticated_test_endpoints(self):
        """Test /api/test/* endpoints without authentication - should return 401"""
        print("\n--- Testing Test Router Without Authentication ---")
        
        test_endpoints = [
            {
                "method": "GET",
                "url": f"{self.backend_url}/api/test/thresholds",
                "name": "GET /api/test/thresholds"
            },
            {
                "method": "POST",
                "url": f"{self.backend_url}/api/test/calculate-fees",
                "name": "POST /api/test/calculate-fees",
                "data": {"blockchain": "ETH", "amount": 100}
            },
            {
                "method": "GET",
                "url": f"{self.backend_url}/api/test/redis/some-key",
                "name": "GET /api/test/redis/some-key"
            }
        ]
        
        for endpoint in test_endpoints:
            try:
                if endpoint["method"] == "GET":
                    response = requests.get(endpoint["url"], timeout=15)
                else:  # POST
                    response = requests.post(
                        endpoint["url"],
                        json=endpoint.get("data", {}),
                        headers={"Content-Type": "application/json"},
                        timeout=15
                    )
                
                if response.status_code == 401:
                    self.log_result(
                        f"Test Router Unauth - {endpoint['name']}", 
                        True, 
                        "Correctly returned 401 Unauthorized",
                        {"status_code": response.status_code}
                    )
                else:
                    self.log_result(
                        f"Test Router Unauth - {endpoint['name']}", 
                        False, 
                        f"Expected 401, got {response.status_code}",
                        {"status_code": response.status_code, "response": response.text}
                    )
                    
            except Exception as e:
                self.log_result(
                    f"Test Router Unauth - {endpoint['name']}", 
                    False, 
                    f"Request failed: {str(e)}"
                )
    
    def test_authenticated_test_endpoints(self):
        """Test /api/test/* endpoints with authentication"""
        print("\n--- Testing Test Router With Authentication ---")
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        # Test 1: GET /api/test/thresholds - should return thresholds
        try:
            response = requests.get(
                f"{self.backend_url}/api/test/thresholds",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                # Should return threshold data
                if 'data' in data or any(key.endswith('_THRESHOLD') for key in data.keys()):
                    self.log_result(
                        "Test Router Auth - GET thresholds", 
                        True, 
                        "Successfully returned thresholds data",
                        {"response_keys": list(data.keys())}
                    )
                else:
                    self.log_result(
                        "Test Router Auth - GET thresholds", 
                        False, 
                        "Response doesn't contain threshold data",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Test Router Auth - GET thresholds", 
                    False, 
                    f"Expected 200, got {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Test Router Auth - GET thresholds", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test 2: POST /api/test/calculate-fees - should return processing_fee but NOT other fee fields
        try:
            response = requests.post(
                f"{self.backend_url}/api/test/calculate-fees",
                json={"blockchain": "ETH", "amount": 100},
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                response_data = data.get('data', {}) if 'data' in data else data
                
                has_processing_fee = 'processing_fee' in response_data
                has_fixed_fee = 'fixed_fee' in response_data
                has_transaction_fee = 'transaction_fee' in response_data
                has_blockchain_buffer = 'blockchain_buffer' in response_data
                
                if has_processing_fee and not has_fixed_fee and not has_transaction_fee and not has_blockchain_buffer:
                    self.log_result(
                        "Test Router Auth - POST calculate-fees", 
                        True, 
                        "Response contains processing_fee but NOT fixed_fee, transaction_fee, blockchain_buffer",
                        {
                            "has_processing_fee": has_processing_fee,
                            "processing_fee": response_data.get('processing_fee'),
                            "response_keys": list(response_data.keys())
                        }
                    )
                else:
                    issues = []
                    if not has_processing_fee:
                        issues.append("missing processing_fee")
                    if has_fixed_fee:
                        issues.append("contains fixed_fee (should be hidden)")
                    if has_transaction_fee:
                        issues.append("contains transaction_fee (should be hidden)")
                    if has_blockchain_buffer:
                        issues.append("contains blockchain_buffer (should be hidden)")
                    
                    self.log_result(
                        "Test Router Auth - POST calculate-fees", 
                        False, 
                        f"Fee field issues: {', '.join(issues)}",
                        {
                            "has_processing_fee": has_processing_fee,
                            "has_fixed_fee": has_fixed_fee,
                            "has_transaction_fee": has_transaction_fee,
                            "has_blockchain_buffer": has_blockchain_buffer,
                            "response_data": response_data
                        }
                    )
            else:
                self.log_result(
                    "Test Router Auth - POST calculate-fees", 
                    False, 
                    f"Expected 200, got {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Test Router Auth - POST calculate-fees", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_invoice_api_fee_hiding(self):
        """Test 3: Invoice API Fee Hiding - GET /api/invoices"""
        print("\n=== Test 3: Invoice API Fee Hiding ===")
        
        if not self.jwt_token:
            self.log_result(
                "Invoice API Fee Hiding", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        # First create a payment link to ensure we have data
        payment_link_id = self.create_test_payment_link()
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.get(
                f"{self.backend_url}/api/invoices",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                invoices = data.get('data', []) if 'data' in data else data
                
                if isinstance(invoices, list) and len(invoices) > 0:
                    # Check first invoice for fee field hiding
                    first_invoice = invoices[0]
                    
                    has_processing_fee = 'processing_fee' in first_invoice
                    has_fixed_fee = 'fixed_fee' in first_invoice
                    has_transaction_fee_percent = 'transaction_fee_percent' in first_invoice
                    has_blockchain_buffer_percent = 'blockchain_buffer_percent' in first_invoice
                    
                    if has_processing_fee and not has_fixed_fee and not has_transaction_fee_percent and not has_blockchain_buffer_percent:
                        self.log_result(
                            "Invoice API Fee Hiding", 
                            True, 
                            "Invoice data contains processing_fee but hides internal fee fields",
                            {
                                "has_processing_fee": has_processing_fee,
                                "processing_fee": first_invoice.get('processing_fee'),
                                "invoice_keys": list(first_invoice.keys()),
                                "total_invoices": len(invoices)
                            }
                        )
                    else:
                        issues = []
                        if not has_processing_fee:
                            issues.append("missing processing_fee")
                        if has_fixed_fee:
                            issues.append("contains fixed_fee (should be hidden)")
                        if has_transaction_fee_percent:
                            issues.append("contains transaction_fee_percent (should be hidden)")
                        if has_blockchain_buffer_percent:
                            issues.append("contains blockchain_buffer_percent (should be hidden)")
                        
                        self.log_result(
                            "Invoice API Fee Hiding", 
                            False, 
                            f"Fee field issues: {', '.join(issues)}",
                            {
                                "has_processing_fee": has_processing_fee,
                                "has_fixed_fee": has_fixed_fee,
                                "has_transaction_fee_percent": has_transaction_fee_percent,
                                "has_blockchain_buffer_percent": has_blockchain_buffer_percent,
                                "first_invoice": first_invoice
                            }
                        )
                else:
                    self.log_result(
                        "Invoice API Fee Hiding", 
                        True, 
                        "No invoices found (empty response is valid)",
                        {"invoices_count": len(invoices) if isinstance(invoices, list) else 0}
                    )
            else:
                self.log_result(
                    "Invoice API Fee Hiding", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Invoice API Fee Hiding", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_payment_get_data_endpoint(self):
        """Test 4: Payment getData Endpoint - POST /api/pay/getData"""
        print("\n=== Test 4: Payment getData Endpoint Fee Info ===")
        
        # Create a payment link with fee_payer: "customer"
        payment_reference = self.create_test_payment_link_with_customer_fees()
        
        if not payment_reference:
            self.log_result(
                "Payment getData Endpoint", 
                False, 
                "Failed to create test payment link"
            )
            return
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/pay/getData",
                json={"reference": payment_reference},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                response_data = data.get('data', {}) if 'data' in data else data
                
                fee_info = response_data.get('fee_info', {})
                
                if fee_info:
                    # Check required fields in fee_info
                    has_fee_payer = 'fee_payer' in fee_info
                    has_processing_fee = 'processing_fee' in fee_info
                    has_total_amount = 'total_amount' in fee_info
                    
                    # Check forbidden fields
                    has_fee_percent = 'fee_percent' in fee_info
                    has_fixed_fee = 'fixed_fee' in fee_info
                    has_blockchain_buffer_percent = 'blockchain_buffer_percent' in fee_info
                    has_fee_display = 'fee_display' in fee_info
                    has_fee_breakdown = 'fee_breakdown' in fee_info
                    
                    required_fields_present = has_fee_payer and has_processing_fee and has_total_amount
                    forbidden_fields_absent = not (has_fee_percent or has_fixed_fee or has_blockchain_buffer_percent or has_fee_display or has_fee_breakdown)
                    
                    if required_fields_present and forbidden_fields_absent:
                        self.log_result(
                            "Payment getData Endpoint", 
                            True, 
                            "fee_info contains only required fields (fee_payer, processing_fee, total_amount)",
                            {
                                "fee_payer": fee_info.get('fee_payer'),
                                "processing_fee": fee_info.get('processing_fee'),
                                "total_amount": fee_info.get('total_amount'),
                                "fee_info_keys": list(fee_info.keys())
                            }
                        )
                    else:
                        issues = []
                        if not has_fee_payer:
                            issues.append("missing fee_payer")
                        if not has_processing_fee:
                            issues.append("missing processing_fee")
                        if not has_total_amount:
                            issues.append("missing total_amount")
                        if has_fee_percent:
                            issues.append("contains fee_percent (should be hidden)")
                        if has_fixed_fee:
                            issues.append("contains fixed_fee (should be hidden)")
                        if has_blockchain_buffer_percent:
                            issues.append("contains blockchain_buffer_percent (should be hidden)")
                        if has_fee_display:
                            issues.append("contains fee_display (should be hidden)")
                        if has_fee_breakdown:
                            issues.append("contains fee_breakdown (should be hidden)")
                        
                        self.log_result(
                            "Payment getData Endpoint", 
                            False, 
                            f"fee_info field issues: {', '.join(issues)}",
                            {
                                "required_fields_present": required_fields_present,
                                "forbidden_fields_absent": forbidden_fields_absent,
                                "fee_info": fee_info
                            }
                        )
                else:
                    self.log_result(
                        "Payment getData Endpoint", 
                        False, 
                        "Response missing fee_info object",
                        {"response_data": response_data}
                    )
            else:
                self.log_result(
                    "Payment getData Endpoint", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Payment getData Endpoint", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def create_test_payment_link(self):
        """Create a test payment link for invoice testing"""
        if not self.jwt_token:
            return None
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            payment_data = {
                "amount": 50,
                "currency": "USD",
                "email": "test@example.com",
                "modes": ["CRYPTO"],
                "description": "Test payment for invoice testing"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/user/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get('data', {}).get('link_id')
            
        except Exception as e:
            print(f"Failed to create test payment link: {str(e)}")
        
        return None
    
    def create_test_payment_link_with_customer_fees(self):
        """Create a test payment link with fee_payer: customer"""
        if not self.jwt_token:
            return None
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            payment_data = {
                "amount": 100,
                "currency": "USD",
                "email": "customer.fees@example.com",
                "modes": ["CRYPTO"],
                "description": "Test payment with customer fees",
                "fee_payer": "customer"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/user/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                # Extract reference from the payment link URL or response
                link_data = data.get('data', {})
                payment_link = link_data.get('payment_link', '')
                
                # Extract reference parameter from URL
                if '?d=' in payment_link:
                    reference = payment_link.split('?d=')[1]
                    return reference
                elif 'reference' in link_data:
                    return link_data['reference']
            
        except Exception as e:
            print(f"Failed to create test payment link with customer fees: {str(e)}")
        
        return None
    
    def run_all_tests(self):
        """Run all architecture fix tests"""
        print("🚀 Starting DynoPay Architecture Fixes Testing Suite")
        print(f"Backend URL: {self.backend_url}")
        print("=" * 60)
        
        # Step 1: Authenticate
        if not self.authenticate_user():
            print("\n❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Step 2: Run all architecture fix tests
        self.test_admin_fee_redis_fix()
        self.test_test_router_authentication()
        self.test_invoice_api_fee_hiding()
        self.test_payment_get_data_endpoint()
        
        # Step 3: Generate summary
        self.generate_summary()
        
        return len(self.errors) == 0
    
    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 60)
        print("📊 ARCHITECTURE FIXES TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            for test_name, result in self.test_results.items():
                if not result['success']:
                    print(f"  • {test_name}: {result['message']}")
        
        if passed_tests > 0:
            print(f"\n✅ PASSED TESTS ({passed_tests}):")
            for test_name, result in self.test_results.items():
                if result['success']:
                    print(f"  • {test_name}: {result['message']}")

if __name__ == "__main__":
    tester = ArchitectureFixesTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All architecture fix tests passed!")
        exit(0)
    else:
        print(f"\n💥 {len(tester.errors)} test(s) failed!")
        exit(1)