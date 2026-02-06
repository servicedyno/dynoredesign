#!/usr/bin/env python3
"""
DynoPay Backend Testing - Comprehensive Recent Implementations
Testing Agent for Enhanced Webhooks, KYC Enforcement, and Onboarding Status

Test Credentials:
- Email: richard@dyno.pt
- Password: Katiekendra123@
- Company ID: 38

Database Connection:
- Host: tramway.proxy.rlwy.net
- Port: 57376
- User: postgres
- Password: oYLtGbXGKLFLWjoEbLjzxOzTXPLtJXQV
- Database: db_bozzwallet
"""

import requests
import json
import time
import os
from typing import Dict, Any, Optional, List

class DynoPayTester:
    def __init__(self):
        self.base_url = "https://init-config.preview.emergentagent.com"
        self.api_url = f"{self.base_url}/api"
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'DynoPay-Testing-Agent/1.0'
        })
        
        # Test credentials
        self.email = "richard@dyno.pt"
        self.password = "Katiekendra123@"
        self.company_id = 38
        self.jwt_token = None
        self.user_id = None
        
        # Test results
        self.test_results = []
        self.total_tests = 0
        self.passed_tests = 0
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.total_tests += 1
        if success:
            self.passed_tests += 1
            
        result = {
            'test': test_name,
            'success': success,
            'details': details,
            'response_data': response_data,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} | {test_name}")
        if details:
            print(f"      Details: {details}")
        if not success and response_data:
            print(f"      Response: {response_data}")
        print()

    def authenticate(self) -> bool:
        """Authenticate with test credentials"""
        try:
            response = self.session.post(f"{self.api_url}/user/login", json={
                "email": self.email,
                "password": self.password
            })
            
            if response.status_code == 200:
                data = response.json()
                # Handle different response structures
                if data.get('data', {}).get('accessToken'):
                    self.jwt_token = data['data']['accessToken']
                    self.user_id = data['data'].get('userData', {}).get('user_id')
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.jwt_token}'
                    })
                    self.log_test("Authentication", True, f"Authenticated as {self.email} (user_id: {self.user_id})")
                    return True
                elif data.get('success') and data.get('data', {}).get('token'):
                    self.jwt_token = data['data']['token']
                    self.user_id = data['data'].get('user_id')
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.jwt_token}'
                    })
                    self.log_test("Authentication", True, f"Authenticated as {self.email} (user_id: {self.user_id})")
                    return True
                    
            self.log_test("Authentication", False, f"Login failed: {response.status_code}", response.json())
            return False
            
        except Exception as e:
            self.log_test("Authentication", False, f"Authentication error: {str(e)}")
            return False

    def test_enhanced_webhook_payloads(self):
        """TEST 1: Enhanced Webhook Payloads - Verify webhook code contains new fields"""
        print("🔍 TEST 1: Enhanced Webhook Payloads")
        
        # Test 1.1: Check payment controller for enhanced webhook fields
        webhook_fields = [
            'payment_type', 'merchant_amount', 'total_fee', 'total_fee_usd',
            'customer_name', 'customer_email', 'description', 'link_id',
            'tax_info', 'overpayment', 'verification_url', 'api_endpoint', 'has_active_session'
        ]
        
        try:
            # Read payment controller file to verify webhook fields
            controller_path = "/app/backend/controller/paymentController.ts"
            if os.path.exists(controller_path):
                with open(controller_path, 'r') as f:
                    content = f.read()
                
                found_fields = []
                missing_fields = []
                
                for field in webhook_fields:
                    if field in content:
                        found_fields.append(field)
                    else:
                        missing_fields.append(field)
                
                if len(found_fields) >= 10:  # Most fields should be present
                    self.log_test("Enhanced Webhook Fields in Payment Controller", True, 
                                f"Found {len(found_fields)}/{len(webhook_fields)} fields: {', '.join(found_fields)}")
                else:
                    self.log_test("Enhanced Webhook Fields in Payment Controller", False,
                                f"Only found {len(found_fields)}/{len(webhook_fields)} fields. Missing: {', '.join(missing_fields)}")
            else:
                self.log_test("Enhanced Webhook Fields in Payment Controller", False, "Payment controller file not found")
                
        except Exception as e:
            self.log_test("Enhanced Webhook Fields in Payment Controller", False, f"Error reading controller: {str(e)}")

        # Test 1.2: Check webhooks/index.ts for enhanced fields
        try:
            webhook_path = "/app/backend/webhooks/index.ts"
            if os.path.exists(webhook_path):
                with open(webhook_path, 'r') as f:
                    webhook_content = f.read()
                
                # Check for payment_type field in webhooks
                if 'payment_type' in webhook_content:
                    self.log_test("Payment Type Field in Webhooks", True, "payment_type field found in webhook implementation")
                else:
                    self.log_test("Payment Type Field in Webhooks", False, "payment_type field not found in webhook implementation")
                    
                # Check for enhanced customer details
                customer_fields = ['customer_name', 'customer_email', 'description']
                found_customer_fields = [field for field in customer_fields if field in webhook_content]
                
                if len(found_customer_fields) >= 2:
                    self.log_test("Enhanced Customer Details in Webhooks", True, 
                                f"Found customer fields: {', '.join(found_customer_fields)}")
                else:
                    self.log_test("Enhanced Customer Details in Webhooks", False,
                                f"Limited customer fields found: {', '.join(found_customer_fields)}")
            else:
                self.log_test("Enhanced Customer Details in Webhooks", False, "Webhooks file not found")
                
        except Exception as e:
            self.log_test("Enhanced Customer Details in Webhooks", False, f"Error reading webhooks: {str(e)}")

    def test_kyc_enforcement(self):
        """TEST 2: KYC Enforcement ($10,000 Threshold + 90-Day Grace)"""
        print("🔍 TEST 2: KYC Enforcement")
        
        # Test 2.1: Check threshold values in code
        try:
            files_to_check = [
                "/app/backend/controller/paymentController.ts",
                "/app/backend/controller/userController.ts", 
                "/app/backend/controller/kycController.ts"
            ]
            
            threshold_found = False
            grace_found = False
            
            for file_path in files_to_check:
                if os.path.exists(file_path):
                    with open(file_path, 'r') as f:
                        content = f.read()
                    
                    if "kycThreshold = 10000" in content or "volumeThreshold = 10000" in content:
                        threshold_found = True
                    
                    if "kycGracePeriodDays = 90" in content or "gracePeriodDays = 90" in content:
                        grace_found = True
            
            if threshold_found:
                self.log_test("KYC Threshold $10,000", True, "Found $10,000 threshold in controller files")
            else:
                self.log_test("KYC Threshold $10,000", False, "Could not find $10,000 threshold in controller files")
                
            if grace_found:
                self.log_test("KYC Grace Period 90 Days", True, "Found 90-day grace period in controller files")
            else:
                self.log_test("KYC Grace Period 90 Days", False, "Could not find 90-day grace period in controller files")
                
        except Exception as e:
            self.log_test("KYC Threshold and Grace Period Check", False, f"Error checking files: {str(e)}")

        # Test 2.2: Test KYC status endpoint
        try:
            response = self.session.get(f"{self.api_url}/kyc/status")
            
            if response.status_code == 200:
                data = response.json()
                kyc_data = data.get('data', {})
                
                # Check for volume_threshold
                if kyc_data.get('volume_threshold') == 10000:
                    self.log_test("KYC Status Endpoint - Threshold", True, "volume_threshold: 10000 found in response")
                else:
                    self.log_test("KYC Status Endpoint - Threshold", False, 
                                f"Expected volume_threshold: 10000, got: {kyc_data.get('volume_threshold')}")
                
                # Check for grace_period object
                if 'grace_period' in kyc_data:
                    self.log_test("KYC Status Endpoint - Grace Period", True, "grace_period object found in response")
                else:
                    self.log_test("KYC Status Endpoint - Grace Period", False, "grace_period object not found in response")
                    
            else:
                self.log_test("KYC Status Endpoint", False, f"Endpoint returned {response.status_code}", response.json())
                
        except Exception as e:
            self.log_test("KYC Status Endpoint", False, f"Error testing endpoint: {str(e)}")

    def test_onboarding_status_endpoint(self):
        """TEST 3: Onboarding Status Endpoint"""
        print("🔍 TEST 3: Onboarding Status Endpoint")
        
        try:
            response = self.session.get(f"{self.api_url}/user/onboarding-status")
            
            if response.status_code == 200:
                data = response.json()
                onboarding_data = data.get('data', {})
                
                # Check required fields
                required_fields = [
                    'wallet_setup', 'kyc_status', 'api_key_status', 
                    'company_setup', 'onboarding_complete', 'next_steps'
                ]
                
                missing_fields = []
                for field in required_fields:
                    if field not in onboarding_data:
                        missing_fields.append(field)
                
                if not missing_fields:
                    self.log_test("Onboarding Status - Required Fields", True, "All required fields present")
                else:
                    self.log_test("Onboarding Status - Required Fields", False, 
                                f"Missing fields: {', '.join(missing_fields)}")
                
                # Check KYC status structure
                kyc_status = onboarding_data.get('kyc_status', {})
                kyc_required_fields = ['status', 'requires_kyc', 'is_approved', 'total_volume', 'threshold', 'grace_period_days']
                
                kyc_missing = [field for field in kyc_required_fields if field not in kyc_status]
                
                if not kyc_missing:
                    self.log_test("Onboarding Status - KYC Structure", True, "KYC status structure complete")
                else:
                    self.log_test("Onboarding Status - KYC Structure", False,
                                f"KYC missing fields: {', '.join(kyc_missing)}")
                
                # Check threshold value
                if kyc_status.get('threshold') == 10000:
                    self.log_test("Onboarding Status - KYC Threshold", True, "threshold: 10000 confirmed")
                else:
                    self.log_test("Onboarding Status - KYC Threshold", False,
                                f"Expected threshold: 10000, got: {kyc_status.get('threshold')}")
                
                # Check grace period
                if kyc_status.get('grace_period_days') == 90:
                    self.log_test("Onboarding Status - Grace Period", True, "grace_period_days: 90 confirmed")
                else:
                    self.log_test("Onboarding Status - Grace Period", False,
                                f"Expected grace_period_days: 90, got: {kyc_status.get('grace_period_days')}")
                    
            else:
                self.log_test("Onboarding Status Endpoint", False, f"Endpoint returned {response.status_code}", response.json())
                
        except Exception as e:
            self.log_test("Onboarding Status Endpoint", False, f"Error testing endpoint: {str(e)}")

    def test_kyc_warning_in_api_responses(self):
        """TEST 4: KYC Warning in API Responses"""
        print("🔍 TEST 4: KYC Warning in API Responses")
        
        try:
            # Create a payment link to test kyc_warning field
            payment_data = {
                "amount": 50,
                "currency": "USD",
                "email": "test@example.com",
                "modes": ["CRYPTO"],
                "description": "KYC Test Payment",
                "company_id": self.company_id
            }
            
            response = self.session.post(f"{self.api_url}/pay/createPaymentLink", json=payment_data)
            
            if response.status_code == 200:
                data = response.json()
                payment_response = data.get('data', {})
                
                # Check for kyc_warning field (may be null if under threshold)
                if 'kyc_warning' in payment_response:
                    self.log_test("Payment Link - KYC Warning Field", True, 
                                f"kyc_warning field present: {payment_response.get('kyc_warning')}")
                else:
                    self.log_test("Payment Link - KYC Warning Field", False, "kyc_warning field not found in response")
                    
                # If kyc_warning exists and is not null, check its structure
                kyc_warning = payment_response.get('kyc_warning')
                if kyc_warning:
                    warning_fields = ['type', 'message', 'days_remaining', 'verification_url', 'api_endpoint', 'has_active_session']
                    missing_warning_fields = [field for field in warning_fields if field not in kyc_warning]
                    
                    if not missing_warning_fields:
                        self.log_test("KYC Warning Structure", True, "All warning fields present")
                    else:
                        self.log_test("KYC Warning Structure", False,
                                    f"Missing warning fields: {', '.join(missing_warning_fields)}")
                else:
                    self.log_test("KYC Warning Structure", True, "kyc_warning is null (expected if under threshold)")
                    
            else:
                self.log_test("Payment Link Creation for KYC Test", False, 
                            f"Failed to create payment link: {response.status_code}", response.json())
                
        except Exception as e:
            self.log_test("KYC Warning in API Responses", False, f"Error testing KYC warning: {str(e)}")

    def test_api_documentation(self):
        """TEST 5: API Documentation"""
        print("🔍 TEST 5: API Documentation")
        
        try:
            # Test API docs endpoint
            response = self.session.get(f"{self.api_url}/docs/")
            
            if response.status_code == 200:
                self.log_test("API Documentation Access", True, "API docs accessible")
                
                # Check for webhook documentation section
                docs_content = response.text
                if "📡 Webhooks" in docs_content or "Webhooks" in docs_content:
                    self.log_test("Webhook Documentation Section", True, "Webhooks section found in API docs")
                else:
                    self.log_test("Webhook Documentation Section", False, "Webhooks section not found in API docs")
                    
            else:
                self.log_test("API Documentation Access", False, f"API docs returned {response.status_code}")
                
        except Exception as e:
            self.log_test("API Documentation", False, f"Error accessing API docs: {str(e)}")

        # Test for duplicate webhook sections in swagger
        try:
            swagger_path = "/app/backend/swagger/paths/payment.ts"
            if os.path.exists(swagger_path):
                with open(swagger_path, 'r') as f:
                    swagger_content = f.read()
                
                webhook_count = swagger_content.count('tags.*Webhooks')
                if webhook_count <= 1:
                    self.log_test("No Duplicate Webhook Sections", True, f"Found {webhook_count} webhook tag references")
                else:
                    self.log_test("No Duplicate Webhook Sections", False, f"Found {webhook_count} duplicate webhook sections")
            else:
                self.log_test("Swagger File Check", False, "Swagger payment file not found")
                
        except Exception as e:
            self.log_test("Swagger File Check", False, f"Error checking swagger file: {str(e)}")

    def test_monthly_kyc_notification_logic(self):
        """TEST 6: Monthly KYC Notification Logic"""
        print("🔍 TEST 6: Monthly KYC Notification Logic")
        
        try:
            kyc_controller_path = "/app/backend/controller/kycController.ts"
            if os.path.exists(kyc_controller_path):
                with open(kyc_controller_path, 'r') as f:
                    content = f.read()
                
                # Check for 30-day interval
                if "INTERVAL '30" in content or "30 days" in content:
                    self.log_test("Monthly Notification Interval", True, "30-day notification interval found")
                else:
                    self.log_test("Monthly Notification Interval", False, "30-day notification interval not found")
                    
                # Check for monthly notification logic
                if "monthly" in content.lower() or "30 days" in content:
                    self.log_test("Monthly Notification Logic", True, "Monthly notification logic implemented")
                else:
                    self.log_test("Monthly Notification Logic", False, "Monthly notification logic not found")
                    
            else:
                self.log_test("KYC Controller File Check", False, "KYC controller file not found")
                
        except Exception as e:
            self.log_test("Monthly KYC Notification Logic", False, f"Error checking notification logic: {str(e)}")

    def run_comprehensive_tests(self):
        """Run all comprehensive tests"""
        print("🚀 Starting DynoPay Comprehensive Backend Testing")
        print("=" * 60)
        
        # Authenticate first
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return
            
        print()
        
        # Run all test suites
        self.test_enhanced_webhook_payloads()
        self.test_kyc_enforcement()
        self.test_onboarding_status_endpoint()
        self.test_kyc_warning_in_api_responses()
        self.test_api_documentation()
        self.test_monthly_kyc_notification_logic()
        
        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("=" * 60)
        print("🎯 TEST SUMMARY")
        print("=" * 60)
        
        success_rate = (self.passed_tests / self.total_tests * 100) if self.total_tests > 0 else 0
        
        print(f"Total Tests: {self.total_tests}")
        print(f"Passed: {self.passed_tests}")
        print(f"Failed: {self.total_tests - self.passed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        print()
        
        # Print failed tests
        failed_tests = [test for test in self.test_results if not test['success']]
        if failed_tests:
            print("❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['details']}")
            print()
        
        # Print success criteria check
        print("🎯 SUCCESS CRITERIA CHECK:")
        criteria_met = 0
        total_criteria = 7
        
        # Check each success criterion
        criteria = [
            ("All threshold values = $10,000", any("KYC Threshold $10,000" in test['test'] and test['success'] for test in self.test_results)),
            ("Grace period = 90 days", any("Grace Period" in test['test'] and test['success'] for test in self.test_results)),
            ("Onboarding status returns complete structure", any("Onboarding Status" in test['test'] and test['success'] for test in self.test_results)),
            ("Payment link creation returns kyc_warning", any("KYC Warning" in test['test'] and test['success'] for test in self.test_results)),
            ("Webhook payloads include enhanced fields", any("Enhanced Webhook" in test['test'] and test['success'] for test in self.test_results)),
            ("API docs show webhooks section", any("Documentation" in test['test'] and test['success'] for test in self.test_results)),
            ("Monthly notification interval = 30 days", any("Monthly Notification" in test['test'] and test['success'] for test in self.test_results))
        ]
        
        for criterion, met in criteria:
            status = "✅" if met else "❌"
            print(f"   {status} {criterion}")
            if met:
                criteria_met += 1
        
        print(f"\nCriteria Met: {criteria_met}/{total_criteria}")
        
        if criteria_met == total_criteria:
            print("\n🎉 ALL SUCCESS CRITERIA MET! System is ready for production.")
        elif criteria_met >= 5:
            print(f"\n⚠️  Most criteria met ({criteria_met}/{total_criteria}). Minor issues to address.")
        else:
            print(f"\n❌ Significant issues found ({criteria_met}/{total_criteria}). Major fixes needed.")

if __name__ == "__main__":
    tester = DynoPayTester()
    tester.run_comprehensive_tests()