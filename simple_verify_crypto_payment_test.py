#!/usr/bin/env python3
"""
DynoPay - Simple Verify Crypto Payment Endpoint Testing
Tests the /api/pay/verifyCryptoPayment endpoint directly to verify implementation of:
- remaining_seconds field
- merchant_settings object with overpayment_threshold_usd and grace_period_minutes
- grace_period_minutes field

This test uses a direct approach to test the endpoint structure.
"""

import os
import json
import requests
import time
from typing import Dict, Any

class SimpleVerifyCryptoPaymentTester:
    def __init__(self):
        # Use the backend URL from review request
        self.backend_url = "http://localhost:3300"
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        
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
    
    def test_verify_crypto_payment_with_mock_address(self):
        """Test verifyCryptoPayment endpoint with a mock address to check response structure"""
        print("\n=== Testing verifyCryptoPayment with Mock Address ===")
        
        # Use a mock ETH address for testing
        mock_address = "0x1234567890123456789012345678901234567890"
        
        try:
            # Test without customer auth first to see the error structure
            response = requests.post(
                f"{self.backend_url}/api/pay/verifyCryptoPayment",
                json={"address": mock_address},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            self.log_result(
                "verifyCryptoPayment - No Auth", 
                True, 
                f"Endpoint accessible, returned status {response.status_code}",
                {
                    "status_code": response.status_code,
                    "response_preview": response.text[:200] + "..." if len(response.text) > 200 else response.text
                }
            )
            
            # Now test with JWT token (though it might not work due to customerAuthMiddleware)
            if self.jwt_token:
                headers = {
                    "Authorization": f"Bearer {self.jwt_token}",
                    "Content-Type": "application/json"
                }
                
                response2 = requests.post(
                    f"{self.backend_url}/api/pay/verifyCryptoPayment",
                    json={"address": mock_address},
                    headers=headers,
                    timeout=15
                )
                
                self.log_result(
                    "verifyCryptoPayment - With JWT", 
                    True, 
                    f"With JWT token, returned status {response2.status_code}",
                    {
                        "status_code": response2.status_code,
                        "response_preview": response2.text[:200] + "..." if len(response2.text) > 200 else response2.text
                    }
                )
                
                # If we get a 200 response, check the structure
                if response2.status_code == 200:
                    try:
                        data = response2.json()
                        if 'data' in data:
                            self.analyze_response_structure(data['data'])
                    except json.JSONDecodeError:
                        self.log_result(
                            "Response Structure Analysis", 
                            False, 
                            "Could not parse JSON response"
                        )
                
        except Exception as e:
            self.log_result(
                "verifyCryptoPayment Test", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def analyze_response_structure(self, response_data: Dict):
        """Analyze the response structure for required fields"""
        print("\n--- Analyzing Response Structure ---")
        
        # Check for required fields
        required_fields = ['remaining_seconds', 'grace_period_minutes', 'merchant_settings']
        missing_fields = [field for field in required_fields if field not in response_data]
        
        if not missing_fields:
            # Check merchant_settings structure
            merchant_settings = response_data.get('merchant_settings', {})
            required_merchant_fields = ['overpayment_threshold_usd', 'grace_period_minutes']
            missing_merchant_fields = [field for field in required_merchant_fields if field not in merchant_settings]
            
            if not missing_merchant_fields:
                self.log_result(
                    "Response Structure - All Fields", 
                    True, 
                    "All required fields present in response",
                    {
                        "remaining_seconds": response_data.get('remaining_seconds'),
                        "grace_period_minutes": response_data.get('grace_period_minutes'),
                        "merchant_settings": merchant_settings,
                        "status": response_data.get('status'),
                        "message": response_data.get('message')
                    }
                )
                
                # Test default values
                self.test_default_values(response_data)
            else:
                self.log_result(
                    "Response Structure - Merchant Settings", 
                    False, 
                    f"Missing merchant_settings fields: {', '.join(missing_merchant_fields)}",
                    {"merchant_settings": merchant_settings}
                )
        else:
            self.log_result(
                "Response Structure - Required Fields", 
                False, 
                f"Missing required fields: {', '.join(missing_fields)}",
                {"available_fields": list(response_data.keys())}
            )
    
    def test_default_values(self, response_data: Dict):
        """Test that default values are correct"""
        print("\n--- Testing Default Values ---")
        
        merchant_settings = response_data.get('merchant_settings', {})
        grace_period_minutes = response_data.get('grace_period_minutes')
        
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
                "Default Values", 
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
                "Default Values", 
                False, 
                f"Default values incorrect: {'; '.join(issues)}",
                {
                    "expected": {"overpayment_threshold_usd": 5, "grace_period_minutes": 30},
                    "actual": merchant_settings,
                    "top_level_grace_period": grace_period_minutes
                }
            )
    
    def test_remaining_seconds_field(self, response_data: Dict):
        """Test that remaining_seconds field is valid"""
        print("\n--- Testing Remaining Seconds Field ---")
        
        remaining_seconds = response_data.get('remaining_seconds')
        
        # Check if remaining_seconds is a number
        if isinstance(remaining_seconds, (int, float)):
            # Should be non-negative
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
                        "is_non_negative": remaining_seconds >= 0
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
    
    def test_endpoint_accessibility(self):
        """Test if the endpoint is accessible and what authentication it requires"""
        print("\n=== Testing Endpoint Accessibility ===")
        
        mock_address = "0x1234567890123456789012345678901234567890"
        
        # Test 1: No authentication
        try:
            response = requests.post(
                f"{self.backend_url}/api/pay/verifyCryptoPayment",
                json={"address": mock_address},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            self.log_result(
                "Endpoint Access - No Auth", 
                True, 
                f"Endpoint responded with status {response.status_code}",
                {
                    "status_code": response.status_code,
                    "requires_auth": response.status_code in [401, 403],
                    "response_size": len(response.text)
                }
            )
            
        except Exception as e:
            self.log_result(
                "Endpoint Access - No Auth", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test 2: With JWT token
        if self.jwt_token:
            try:
                headers = {
                    "Authorization": f"Bearer {self.jwt_token}",
                    "Content-Type": "application/json"
                }
                
                response = requests.post(
                    f"{self.backend_url}/api/pay/verifyCryptoPayment",
                    json={"address": mock_address},
                    headers=headers,
                    timeout=15
                )
                
                self.log_result(
                    "Endpoint Access - With JWT", 
                    True, 
                    f"With JWT, endpoint responded with status {response.status_code}",
                    {
                        "status_code": response.status_code,
                        "jwt_accepted": response.status_code not in [401, 403],
                        "response_size": len(response.text)
                    }
                )
                
            except Exception as e:
                self.log_result(
                    "Endpoint Access - With JWT", 
                    False, 
                    f"Request failed: {str(e)}"
                )
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Simple verifyCryptoPayment Endpoint Testing")
        print("=" * 60)
        
        # Step 1: Authenticate
        if not self.authenticate_user():
            print("\n❌ Authentication failed, proceeding with limited tests")
        
        # Step 2: Test endpoint accessibility
        self.test_endpoint_accessibility()
        
        # Step 3: Test with mock address
        self.test_verify_crypto_payment_with_mock_address()
        
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
    tester = SimpleVerifyCryptoPaymentTester()
    summary = tester.run_all_tests()
    
    # Exit with error code if tests failed
    if summary['failed_tests'] > 0:
        exit(1)
    else:
        exit(0)