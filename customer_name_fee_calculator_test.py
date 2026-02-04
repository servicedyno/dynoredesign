#!/usr/bin/env python3
"""
DynoPay Customer Name & Fee Calculator Features Test
Tests the two new features as specified in the review request:
1. Customer Name for Payment Links (3 test scenarios)
2. Fee Calculator Endpoint (5 test scenarios)
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any
import uuid

class DynoPayCustomerNameFeeCalculatorTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.user_data = None
        
        # Test credentials from review request
        self.test_email = "richard@dyno.pt"
        self.test_password = "Katiekendra123@"
        self.company_id = "38"
        
        # Store payment link reference for Test 1.3
        self.payment_link_ref = None
        
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

    # ============================================
    # FEATURE 1: Customer Name for Payment Links
    # ============================================
    
    def test_1_1_create_payment_link_with_customer_name(self):
        """Test 1.1: Create Payment Link WITH customer name"""
        print("\n" + "="*60)
        print("TEST 1.1: CREATE PAYMENT LINK WITH CUSTOMER NAME")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("Test 1.1", False, "No JWT token available")
            return
            
        try:
            payment_data = {
                "amount": 150,
                "email": "customer@test.com",
                "name": "Alice Johnson",
                "modes": ["CRYPTO"],
                "company_id": self.company_id,
                "description": "Monthly Subscription"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payment_data,
                headers={
                    "Authorization": f"Bearer {self.jwt_token}",
                    "Content-Type": "application/json"
                },
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                response_data = data.get('data', {})
                
                # Check if customer_name is in response
                customer_name = response_data.get('customer_name')
                
                # Extract payment link reference for Test 1.3
                payment_link = response_data.get('payment_link', '')
                if payment_link and 'd=' in payment_link:
                    self.payment_link_ref = payment_link.split('d=')[1].split('&')[0]
                
                if customer_name == "Alice Johnson":
                    self.log_result(
                        "Test 1.1", 
                        True, 
                        f"Payment link created with customer_name: '{customer_name}'",
                        {
                            "customer_name": customer_name,
                            "amount": payment_data["amount"],
                            "payment_link_ref": self.payment_link_ref,
                            "link_id": response_data.get('link_id')
                        }
                    )
                else:
                    self.log_result("Test 1.1", False, f"Expected customer_name 'Alice Johnson', got '{customer_name}'")
            else:
                self.log_result("Test 1.1", False, f"Payment link creation failed with status {response.status_code}")
                
        except Exception as e:
            self.log_result("Test 1.1", False, f"Payment link creation request failed: {str(e)}")
    
    def test_1_2_create_payment_link_without_customer_name(self):
        """Test 1.2: Create Payment Link WITHOUT customer name (optional field)"""
        print("\n" + "="*60)
        print("TEST 1.2: CREATE PAYMENT LINK WITHOUT CUSTOMER NAME")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("Test 1.2", False, "No JWT token available")
            return
            
        try:
            payment_data = {
                "amount": 75,
                "email": "another@test.com",
                "modes": ["CRYPTO"],
                "company_id": self.company_id
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payment_data,
                headers={
                    "Authorization": f"Bearer {self.jwt_token}",
                    "Content-Type": "application/json"
                },
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                response_data = data.get('data', {})
                
                # Check if customer_name is null when not provided
                customer_name = response_data.get('customer_name')
                
                if customer_name is None:
                    self.log_result(
                        "Test 1.2", 
                        True, 
                        "Payment link created with customer_name: null (as expected)",
                        {
                            "customer_name": customer_name,
                            "amount": payment_data["amount"],
                            "link_id": response_data.get('link_id')
                        }
                    )
                else:
                    self.log_result("Test 1.2", False, f"Expected customer_name null, got '{customer_name}'")
            else:
                self.log_result("Test 1.2", False, f"Payment link creation failed with status {response.status_code}")
                
        except Exception as e:
            self.log_result("Test 1.2", False, f"Payment link creation request failed: {str(e)}")
    
    def test_1_3_get_data_shows_customer_name(self):
        """Test 1.3: Get Data shows customer name (use link from Test 1.1)"""
        print("\n" + "="*60)
        print("TEST 1.3: GET DATA SHOWS CUSTOMER NAME")
        print("="*60)
        
        if not self.payment_link_ref:
            self.log_result("Test 1.3", False, "No payment link reference from Test 1.1")
            return
            
        try:
            get_data_payload = {
                "data": self.payment_link_ref
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/getData",
                json=get_data_payload,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                response_data = data.get('data', {})
                
                # Check if customer_name is in getData response
                customer_name = response_data.get('customer_name')
                
                if customer_name == "Alice Johnson":
                    self.log_result(
                        "Test 1.3", 
                        True, 
                        f"getData response contains customer_name: '{customer_name}'",
                        {
                            "customer_name": customer_name,
                            "payment_ref": self.payment_link_ref,
                            "amount": response_data.get('amount')
                        }
                    )
                else:
                    self.log_result("Test 1.3", False, f"Expected customer_name 'Alice Johnson', got '{customer_name}'")
            else:
                self.log_result("Test 1.3", False, f"getData request failed with status {response.status_code}")
                
        except Exception as e:
            self.log_result("Test 1.3", False, f"getData request failed: {str(e)}")

    # ============================================
    # FEATURE 2: Fee Calculator Endpoint
    # ============================================
    
    def test_2_1_calculate_fees_eth(self):
        """Test 2.1: Calculate fees for ETH"""
        print("\n" + "="*60)
        print("TEST 2.1: CALCULATE FEES FOR ETH")
        print("="*60)
        
        try:
            fee_data = {
                "amount": 100,
                "cryptocurrency": "ETH"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/calculateFees",
                json=fee_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                response_data = data.get('data', {})
                
                # Verify required fields based on actual API structure
                fee_breakdown = response_data.get('fee_breakdown', {})
                platform_fee = fee_breakdown.get('platform_fee')
                blockchain_fee = fee_breakdown.get('blockchain_fee')
                total_fees = fee_breakdown.get('total_fees')
                net_to_merchant = response_data.get('net_to_merchant')
                details = response_data.get('details')
                
                # Check if platform_fee is 1% of amount ($1)
                expected_platform_fee = 1.0  # 1% of $100
                
                if (platform_fee == expected_platform_fee and 
                    blockchain_fee is not None and 
                    total_fees is not None and 
                    net_to_merchant is not None and 
                    details is not None):
                    
                    self.log_result(
                        "Test 2.1", 
                        True, 
                        f"ETH fee calculation successful - platform_fee: ${platform_fee}, total_fees: ${total_fees}",
                        {
                            "platform_fee": platform_fee,
                            "blockchain_fee": blockchain_fee,
                            "total_fees": total_fees,
                            "net_to_merchant": net_to_merchant,
                            "has_details": bool(details)
                        }
                    )
                else:
                    self.log_result("Test 2.1", False, f"Fee calculation response missing required fields or incorrect platform_fee (expected $1, got ${platform_fee})")
            else:
                self.log_result("Test 2.1", False, f"Fee calculation failed with status {response.status_code}")
                
        except Exception as e:
            self.log_result("Test 2.1", False, f"Fee calculation request failed: {str(e)}")
    
    def test_2_2_calculate_fees_btc_large_amount(self):
        """Test 2.2: Calculate fees for BTC with larger amount"""
        print("\n" + "="*60)
        print("TEST 2.2: CALCULATE FEES FOR BTC WITH LARGER AMOUNT")
        print("="*60)
        
        try:
            fee_data = {
                "amount": 500,
                "cryptocurrency": "BTC"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/calculateFees",
                json=fee_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                response_data = data.get('data', {})
                
                # Verify required fields
                platform_fee = response_data.get('platform_fee')
                total_fees = response_data.get('total_fees')
                net_to_merchant = response_data.get('net_to_merchant')
                
                # Check if platform_fee is 1% of amount ($5)
                expected_platform_fee = 5.0  # 1% of $500
                expected_net_to_merchant = 500 - total_fees if total_fees else None
                
                if (platform_fee == expected_platform_fee and 
                    total_fees is not None and 
                    net_to_merchant == expected_net_to_merchant):
                    
                    self.log_result(
                        "Test 2.2", 
                        True, 
                        f"BTC fee calculation successful - platform_fee: ${platform_fee}, net_to_merchant: ${net_to_merchant}",
                        {
                            "platform_fee": platform_fee,
                            "total_fees": total_fees,
                            "net_to_merchant": net_to_merchant,
                            "amount": fee_data["amount"]
                        }
                    )
                else:
                    self.log_result("Test 2.2", False, f"Fee calculation incorrect - expected platform_fee $5, got ${platform_fee}")
            else:
                self.log_result("Test 2.2", False, f"Fee calculation failed with status {response.status_code}")
                
        except Exception as e:
            self.log_result("Test 2.2", False, f"Fee calculation request failed: {str(e)}")
    
    def test_2_3_calculate_fees_usdt_trc20(self):
        """Test 2.3: Calculate fees for USDT-TRC20"""
        print("\n" + "="*60)
        print("TEST 2.3: CALCULATE FEES FOR USDT-TRC20")
        print("="*60)
        
        try:
            fee_data = {
                "amount": 200,
                "cryptocurrency": "USDT-TRC20"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/calculateFees",
                json=fee_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                response_data = data.get('data', {})
                
                # Verify calculations are consistent
                platform_fee = response_data.get('platform_fee')
                blockchain_fee = response_data.get('blockchain_fee')
                total_fees = response_data.get('total_fees')
                net_to_merchant = response_data.get('net_to_merchant')
                
                # Check if platform_fee is 1% of amount ($2)
                expected_platform_fee = 2.0  # 1% of $200
                
                if (platform_fee == expected_platform_fee and 
                    blockchain_fee is not None and 
                    total_fees is not None and 
                    net_to_merchant is not None):
                    
                    # Verify calculation consistency
                    calculated_total = platform_fee + blockchain_fee
                    calculated_net = 200 - total_fees
                    
                    if abs(calculated_total - total_fees) < 0.01 and abs(calculated_net - net_to_merchant) < 0.01:
                        self.log_result(
                            "Test 2.3", 
                            True, 
                            f"USDT-TRC20 fee calculation consistent - platform_fee: ${platform_fee}",
                            {
                                "platform_fee": platform_fee,
                                "blockchain_fee": blockchain_fee,
                                "total_fees": total_fees,
                                "net_to_merchant": net_to_merchant,
                                "calculations_consistent": True
                            }
                        )
                    else:
                        self.log_result("Test 2.3", False, "Fee calculations are inconsistent")
                else:
                    self.log_result("Test 2.3", False, f"Fee calculation incorrect - expected platform_fee $2, got ${platform_fee}")
            else:
                self.log_result("Test 2.3", False, f"Fee calculation failed with status {response.status_code}")
                
        except Exception as e:
            self.log_result("Test 2.3", False, f"Fee calculation request failed: {str(e)}")
    
    def test_2_4_validation_missing_amount(self):
        """Test 2.4: Validation - Missing amount"""
        print("\n" + "="*60)
        print("TEST 2.4: VALIDATION - MISSING AMOUNT")
        print("="*60)
        
        try:
            fee_data = {
                "cryptocurrency": "ETH"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/calculateFees",
                json=fee_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 400:
                data = response.json()
                error_message = data.get('message', '').lower()
                
                # Check if error message mentions amount requirement
                if 'amount' in error_message and ('required' in error_message or 'valid' in error_message):
                    self.log_result(
                        "Test 2.4", 
                        True, 
                        f"Validation working - 400 error for missing amount: '{data.get('message')}'",
                        {
                            "status_code": response.status_code,
                            "error_message": data.get('message'),
                            "validation_working": True
                        }
                    )
                else:
                    self.log_result("Test 2.4", False, f"Error message doesn't mention amount requirement: '{data.get('message')}'")
            else:
                self.log_result("Test 2.4", False, f"Expected 400 error, got status {response.status_code}")
                
        except Exception as e:
            self.log_result("Test 2.4", False, f"Validation test request failed: {str(e)}")
    
    def test_2_5_validation_invalid_cryptocurrency(self):
        """Test 2.5: Validation - Invalid cryptocurrency"""
        print("\n" + "="*60)
        print("TEST 2.5: VALIDATION - INVALID CRYPTOCURRENCY")
        print("="*60)
        
        try:
            fee_data = {
                "amount": 100,
                "cryptocurrency": "INVALID"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/calculateFees",
                json=fee_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 400:
                data = response.json()
                error_message = data.get('message', '').lower()
                
                # Check if error message mentions valid options
                if ('invalid' in error_message or 'valid' in error_message) and 'cryptocurrency' in error_message:
                    self.log_result(
                        "Test 2.5", 
                        True, 
                        f"Validation working - 400 error for invalid cryptocurrency: '{data.get('message')}'",
                        {
                            "status_code": response.status_code,
                            "error_message": data.get('message'),
                            "validation_working": True
                        }
                    )
                else:
                    self.log_result("Test 2.5", False, f"Error message doesn't mention cryptocurrency validation: '{data.get('message')}'")
            else:
                self.log_result("Test 2.5", False, f"Expected 400 error, got status {response.status_code}")
                
        except Exception as e:
            self.log_result("Test 2.5", False, f"Validation test request failed: {str(e)}")

    # ============================================
    # Main Test Runner
    # ============================================
    
    def run_all_tests(self):
        """Run all Customer Name & Fee Calculator tests"""
        print("="*80)
        print("DYNOPAY CUSTOMER NAME & FEE CALCULATOR FEATURES TEST")
        print("="*80)
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Credentials: {self.test_email}")
        print(f"Company ID: {self.company_id}")
        print("="*80)
        
        # Authenticate first
        if not self.authenticate_user():
            print("\n❌ AUTHENTICATION FAILED - Cannot proceed with tests")
            return
        
        # Feature 1: Customer Name for Payment Links
        print("\n🎯 FEATURE 1: CUSTOMER NAME FOR PAYMENT LINKS")
        self.test_1_1_create_payment_link_with_customer_name()
        self.test_1_2_create_payment_link_without_customer_name()
        self.test_1_3_get_data_shows_customer_name()
        
        # Feature 2: Fee Calculator Endpoint
        print("\n🎯 FEATURE 2: FEE CALCULATOR ENDPOINT")
        self.test_2_1_calculate_fees_eth()
        self.test_2_2_calculate_fees_btc_large_amount()
        self.test_2_3_calculate_fees_usdt_trc20()
        self.test_2_4_validation_missing_amount()
        self.test_2_5_validation_invalid_cryptocurrency()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Feature breakdown
        feature_1_tests = [k for k in self.test_results.keys() if k.startswith('Test 1.')]
        feature_2_tests = [k for k in self.test_results.keys() if k.startswith('Test 2.')]
        
        feature_1_passed = sum(1 for test in feature_1_tests if self.test_results[test]['success'])
        feature_2_passed = sum(1 for test in feature_2_tests if self.test_results[test]['success'])
        
        print(f"\n📊 FEATURE BREAKDOWN:")
        print(f"Feature 1 (Customer Name): {feature_1_passed}/{len(feature_1_tests)} tests passed")
        print(f"Feature 2 (Fee Calculator): {feature_2_passed}/{len(feature_2_tests)} tests passed")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        
        if passed_tests == total_tests:
            print("\n🎉 ALL CUSTOMER NAME & FEE CALCULATOR FEATURES WORKING!")
        else:
            print(f"\n⚠️  {failed_tests} TEST(S) NEED ATTENTION")

if __name__ == "__main__":
    tester = DynoPayCustomerNameFeeCalculatorTester()
    tester.run_all_tests()