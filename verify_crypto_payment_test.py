#!/usr/bin/env python3
"""
DynoPay - Verify Crypto Payment Endpoint Testing
Tests the /api/pay/verifyCryptoPayment endpoint to verify implementation of:
- remaining_seconds field
- merchant_settings object with overpayment_threshold_usd and grace_period_minutes
- grace_period_minutes field
"""

import os
import json
import requests
import time
from typing import Dict, Any

class VerifyCryptoPaymentTester:
    def __init__(self):
        # Use the backend URL from review request
        self.backend_url = "http://localhost:3300"
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.payment_reference = None
        
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
        """Authenticate with provided credentials john@dyno.pt / Katiekendra123@"""
        print("\n=== Authenticating User ===")
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json={
                    "email": "john@dyno.pt",
                    "password": "Katiekendra123@"
                },
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
                        f"Successfully authenticated user: {user_info.get('name', 'Unknown')}",
                        {
                            "user_id": user_info.get('user_id'),
                            "email": user_info.get('email'),
                            "company_id": user_info.get('company_id'),
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
    
    def create_payment_link(self):
        """Create a payment link with CRYPTO mode to get a valid payment reference"""
        print("\n=== Creating Payment Link ===")
        
        if not self.jwt_token:
            self.log_result(
                "Payment Link Creation", 
                False, 
                "No JWT token available for authentication"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Create payment link with CRYPTO mode - use correct endpoint
            payment_data = {
                "amount": 50,
                "currency": "USD",
                "email": "test@example.com",
                "modes": ["CRYPTO"],
                "description": "Test payment for verifyCryptoPayment endpoint",
                "expire": "7d",
                "fee_payer": "customer"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/payment/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    payment_info = data['data']
                    # Extract payment reference from the payment link URL
                    payment_link = payment_info.get('payment_link', '')
                    if '?d=' in payment_link:
                        self.payment_reference = payment_link.split('?d=')[1]
                        self.log_result(
                            "Payment Link Creation", 
                            True, 
                            f"Successfully created payment link",
                            {
                                "transaction_id": payment_info.get('transaction_id'),
                                "link_id": payment_info.get('link_id'),
                                "amount": payment_info.get('amount'),
                                "currency": payment_info.get('currency'),
                                "payment_reference": self.payment_reference
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Payment Link Creation", 
                            False, 
                            "Could not extract payment reference from link",
                            {"payment_link": payment_link}
                        )
                else:
                    self.log_result(
                        "Payment Link Creation", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            elif response.status_code == 404:
                # Try alternative endpoint structure
                response2 = requests.post(
                    f"{self.backend_url}/api/payment/links",
                    json=payment_data,
                    headers=headers,
                    timeout=15
                )
                
                if response2.status_code == 200:
                    data = response2.json()
                    if 'data' in data:
                        payment_info = data['data']
                        payment_link = payment_info.get('payment_link', '')
                        if '?d=' in payment_link:
                            self.payment_reference = payment_link.split('?d=')[1]
                            self.log_result(
                                "Payment Link Creation", 
                                True, 
                                f"Successfully created payment link (alternative endpoint)",
                                {
                                    "transaction_id": payment_info.get('transaction_id'),
                                    "link_id": payment_info.get('link_id'),
                                    "amount": payment_info.get('amount'),
                                    "currency": payment_info.get('currency'),
                                    "payment_reference": self.payment_reference
                                }
                            )
                            return True
                
                self.log_result(
                    "Payment Link Creation", 
                    False, 
                    f"Both endpoints failed. Status: {response.status_code}, Alt Status: {response2.status_code}",
                    {"response1": response.text, "response2": response2.text}
                )
            else:
                self.log_result(
                    "Payment Link Creation", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Payment Link Creation", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return False
    
    def get_crypto_address(self):
        """Get crypto address by calling the payment data endpoint"""
        print("\n=== Getting Crypto Address ===")
        
        if not self.payment_reference:
            self.log_result(
                "Get Crypto Address", 
                False, 
                "No payment reference available"
            )
            return None
        
        try:
            # Get payment data to access crypto address generation
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
                    self.log_result(
                        "Get Payment Data", 
                        True, 
                        "Successfully retrieved payment data",
                        {
                            "amount": payment_data.get('amount'),
                            "currency": payment_data.get('base_currency'),
                            "transaction_id": payment_data.get('transaction_id'),
                            "has_crypto_modes": 'CRYPTO' in payment_data.get('allowedModes', [])
                        }
                    )
                    
                    # Now try to create crypto payment to get address
                    crypto_response = requests.post(
                        f"{self.backend_url}/api/pay/createCryptoPayment",
                        json={
                            "d": self.payment_reference,
                            "currency": "ETH"  # Use ETH as test currency
                        },
                        headers={"Content-Type": "application/json"},
                        timeout=15
                    )
                    
                    if crypto_response.status_code == 200:
                        crypto_data = crypto_response.json()
                        if 'data' in crypto_data and 'address' in crypto_data['data']:
                            crypto_address = crypto_data['data']['address']
                            self.log_result(
                                "Get Crypto Address", 
                                True, 
                                f"Successfully generated crypto address",
                                {
                                    "address": crypto_address,
                                    "currency": crypto_data['data'].get('currency'),
                                    "amount": crypto_data['data'].get('amount'),
                                    "qr_code": crypto_data['data'].get('qr_code', '').startswith('data:image')
                                }
                            )
                            return crypto_address
                        else:
                            self.log_result(
                                "Get Crypto Address", 
                                False, 
                                "No address in crypto payment response",
                                {"response": crypto_data}
                            )
                    else:
                        self.log_result(
                            "Get Crypto Address", 
                            False, 
                            f"Crypto payment creation failed with status {crypto_response.status_code}",
                            {"response": crypto_response.text}
                        )
                else:
                    self.log_result(
                        "Get Payment Data", 
                        False, 
                        "Invalid payment data response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Get Payment Data", 
                    False, 
                    f"Payment data API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Get Crypto Address", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return None
    
    def test_verify_crypto_payment_endpoint(self, crypto_address: str):
        """Test the verifyCryptoPayment endpoint with various scenarios"""
        print("\n=== Testing verifyCryptoPayment Endpoint ===")
        
        # Test 1: Waiting status (no payment sent yet)
        self.test_verify_waiting_status(crypto_address)
        
        # Test 2: Verify response structure contains required fields
        self.test_verify_response_structure(crypto_address)
        
        # Test 3: Test merchant settings defaults
        self.test_merchant_settings_defaults(crypto_address)
        
        # Test 4: Test remaining_seconds field
        self.test_remaining_seconds_field(crypto_address)
    
    def test_verify_waiting_status(self, crypto_address: str):
        """Test verifyCryptoPayment returns waiting status for new address"""
        print("\n--- Testing Waiting Status ---")
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/pay/verifyCryptoPayment",
                json={"address": crypto_address},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    payment_status = data['data']
                    status = payment_status.get('status')
                    
                    if status in ['waiting', 'pending']:
                        self.log_result(
                            "Verify Waiting Status", 
                            True, 
                            f"Correctly returned {status} status for new address",
                            {
                                "status": status,
                                "message": payment_status.get('message'),
                                "has_remaining_seconds": 'remaining_seconds' in payment_status,
                                "has_merchant_settings": 'merchant_settings' in payment_status
                            }
                        )
                    else:
                        self.log_result(
                            "Verify Waiting Status", 
                            False, 
                            f"Expected waiting/pending status, got: {status}",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "Verify Waiting Status", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Verify Waiting Status", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Verify Waiting Status", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_verify_response_structure(self, crypto_address: str):
        """Test that response contains all required fields"""
        print("\n--- Testing Response Structure ---")
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/pay/verifyCryptoPayment",
                json={"address": crypto_address},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    payment_data = data['data']
                    
                    # Check for required fields
                    required_fields = ['remaining_seconds', 'grace_period_minutes', 'merchant_settings']
                    missing_fields = [field for field in required_fields if field not in payment_data]
                    
                    if not missing_fields:
                        # Check merchant_settings structure
                        merchant_settings = payment_data.get('merchant_settings', {})
                        required_merchant_fields = ['overpayment_threshold_usd', 'grace_period_minutes']
                        missing_merchant_fields = [field for field in required_merchant_fields if field not in merchant_settings]
                        
                        if not missing_merchant_fields:
                            self.log_result(
                                "Response Structure", 
                                True, 
                                "All required fields present in response",
                                {
                                    "remaining_seconds": payment_data.get('remaining_seconds'),
                                    "grace_period_minutes": payment_data.get('grace_period_minutes'),
                                    "merchant_settings": merchant_settings,
                                    "status": payment_data.get('status')
                                }
                            )
                        else:
                            self.log_result(
                                "Response Structure - Merchant Settings", 
                                False, 
                                f"Missing merchant_settings fields: {', '.join(missing_merchant_fields)}",
                                {"merchant_settings": merchant_settings}
                            )
                    else:
                        self.log_result(
                            "Response Structure", 
                            False, 
                            f"Missing required fields: {', '.join(missing_fields)}",
                            {"available_fields": list(payment_data.keys())}
                        )
                else:
                    self.log_result(
                        "Response Structure", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Response Structure", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Response Structure", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_merchant_settings_defaults(self, crypto_address: str):
        """Test that merchant settings have correct default values"""
        print("\n--- Testing Merchant Settings Defaults ---")
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/pay/verifyCryptoPayment",
                json={"address": crypto_address},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    payment_data = data['data']
                    merchant_settings = payment_data.get('merchant_settings', {})
                    grace_period_minutes = payment_data.get('grace_period_minutes')
                    
                    # Check default values
                    overpayment_threshold = merchant_settings.get('overpayment_threshold_usd')
                    merchant_grace_period = merchant_settings.get('grace_period_minutes')
                    
                    # Verify defaults: overpayment_threshold_usd = 5, grace_period_minutes = 30
                    defaults_correct = True
                    issues = []
                    
                    if overpayment_threshold != 5:
                        defaults_correct = False
                        issues.append(f"overpayment_threshold_usd should be 5, got {overpayment_threshold}")
                    
                    if merchant_grace_period != 30:
                        defaults_correct = False
                        issues.append(f"merchant grace_period_minutes should be 30, got {merchant_grace_period}")
                    
                    if grace_period_minutes != 30:
                        defaults_correct = False
                        issues.append(f"top-level grace_period_minutes should be 30, got {grace_period_minutes}")
                    
                    if defaults_correct:
                        self.log_result(
                            "Merchant Settings Defaults", 
                            True, 
                            "All default values are correct",
                            {
                                "overpayment_threshold_usd": overpayment_threshold,
                                "grace_period_minutes": grace_period_minutes,
                                "merchant_settings": merchant_settings
                            }
                        )
                    else:
                        self.log_result(
                            "Merchant Settings Defaults", 
                            False, 
                            f"Default values incorrect: {'; '.join(issues)}",
                            {
                                "expected": {"overpayment_threshold_usd": 5, "grace_period_minutes": 30},
                                "actual": merchant_settings,
                                "top_level_grace_period": grace_period_minutes
                            }
                        )
                else:
                    self.log_result(
                        "Merchant Settings Defaults", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Merchant Settings Defaults", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Merchant Settings Defaults", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_remaining_seconds_field(self, crypto_address: str):
        """Test that remaining_seconds field is a valid number"""
        print("\n--- Testing Remaining Seconds Field ---")
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/pay/verifyCryptoPayment",
                json={"address": crypto_address},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    payment_data = data['data']
                    remaining_seconds = payment_data.get('remaining_seconds')
                    
                    # Check if remaining_seconds is a number
                    if isinstance(remaining_seconds, (int, float)):
                        # Should be positive for active payment
                        if remaining_seconds >= 0:
                            # Convert to minutes for readability
                            remaining_minutes = remaining_seconds / 60
                            self.log_result(
                                "Remaining Seconds Field", 
                                True, 
                                f"Valid remaining_seconds field: {remaining_seconds} seconds ({remaining_minutes:.1f} minutes)",
                                {
                                    "remaining_seconds": remaining_seconds,
                                    "remaining_minutes": round(remaining_minutes, 1),
                                    "is_number": True,
                                    "is_positive": remaining_seconds >= 0
                                }
                            )
                        else:
                            self.log_result(
                                "Remaining Seconds Field", 
                                False, 
                                f"remaining_seconds should be non-negative, got {remaining_seconds}",
                                {"remaining_seconds": remaining_seconds}
                            )
                    else:
                        self.log_result(
                            "Remaining Seconds Field", 
                            False, 
                            f"remaining_seconds should be a number, got {type(remaining_seconds).__name__}: {remaining_seconds}",
                            {"remaining_seconds": remaining_seconds, "type": type(remaining_seconds).__name__}
                        )
                else:
                    self.log_result(
                        "Remaining Seconds Field", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Remaining Seconds Field", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Remaining Seconds Field", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_all_payment_statuses(self, crypto_address: str):
        """Test that all payment statuses include the required fields"""
        print("\n--- Testing All Payment Status Responses ---")
        
        # Test multiple calls to see if we can get different statuses
        statuses_tested = set()
        
        for i in range(3):  # Test multiple times
            try:
                response = requests.post(
                    f"{self.backend_url}/api/pay/verifyCryptoPayment",
                    json={"address": crypto_address},
                    headers={"Content-Type": "application/json"},
                    timeout=15
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if 'data' in data:
                        payment_data = data['data']
                        status = payment_data.get('status')
                        
                        if status not in statuses_tested:
                            statuses_tested.add(status)
                            
                            # Check if this status includes required fields
                            has_remaining_seconds = 'remaining_seconds' in payment_data
                            has_grace_period = 'grace_period_minutes' in payment_data
                            has_merchant_settings = 'merchant_settings' in payment_data
                            
                            all_fields_present = has_remaining_seconds and has_grace_period and has_merchant_settings
                            
                            self.log_result(
                                f"Status {status} - Required Fields", 
                                all_fields_present, 
                                f"Status '{status}' {'includes' if all_fields_present else 'missing'} required fields",
                                {
                                    "status": status,
                                    "has_remaining_seconds": has_remaining_seconds,
                                    "has_grace_period_minutes": has_grace_period,
                                    "has_merchant_settings": has_merchant_settings,
                                    "remaining_seconds": payment_data.get('remaining_seconds'),
                                    "grace_period_minutes": payment_data.get('grace_period_minutes')
                                }
                            )
                
                # Small delay between requests
                if i < 2:
                    time.sleep(1)
                    
            except Exception as e:
                self.log_result(
                    f"All Status Test - Attempt {i+1}", 
                    False, 
                    f"Request failed: {str(e)}"
                )
        
        # Summary of statuses tested
        if statuses_tested:
            self.log_result(
                "All Payment Statuses Summary", 
                True, 
                f"Tested {len(statuses_tested)} different status(es): {', '.join(statuses_tested)}",
                {"statuses_tested": list(statuses_tested)}
            )
        else:
            self.log_result(
                "All Payment Statuses Summary", 
                False, 
                "No valid statuses were tested"
            )
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting verifyCryptoPayment Endpoint Testing")
        print("=" * 60)
        
        # Step 1: Authenticate
        if not self.authenticate_user():
            print("\n❌ Authentication failed, cannot proceed with tests")
            return self.generate_summary()
        
        # Step 2: Create payment link
        if not self.create_payment_link():
            print("\n❌ Payment link creation failed, cannot proceed with tests")
            return self.generate_summary()
        
        # Step 3: Get crypto address
        crypto_address = self.get_crypto_address()
        if not crypto_address:
            print("\n❌ Crypto address generation failed, cannot proceed with tests")
            return self.generate_summary()
        
        # Step 4: Test verifyCryptoPayment endpoint
        self.test_verify_crypto_payment_endpoint(crypto_address)
        
        # Step 5: Test all payment statuses
        self.test_all_payment_statuses(crypto_address)
        
        return self.generate_summary()
    
    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "No tests run")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            for error in self.errors:
                print(f"  • {error}")
        
        if passed_tests > 0:
            print(f"\n✅ PASSED TESTS ({passed_tests}):")
            for test_name, result in self.test_results.items():
                if result['success']:
                    print(f"  • {test_name}: {result['message']}")
        
        return {
            'total_tests': total_tests,
            'passed_tests': passed_tests,
            'failed_tests': failed_tests,
            'success_rate': (passed_tests/total_tests*100) if total_tests > 0 else 0,
            'errors': self.errors,
            'test_results': self.test_results
        }

if __name__ == "__main__":
    tester = VerifyCryptoPaymentTester()
    summary = tester.run_all_tests()
    
    # Exit with error code if tests failed
    if summary['failed_tests'] > 0:
        exit(1)
    else:
        exit(0)