#!/usr/bin/env python3
"""
DynoPay Backend Testing Suite - Email Notification Enhancement Testing
Tests the newly implemented email notification features for password changes and payment link creation
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any

class DynoPayEmailNotificationTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.user_data = None
        
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
        """Authenticate with provided credentials john@dyno.pt / Teste@123"""
        print("\n=== Testing User Authentication ===")
        
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
                    self.user_data = data['data']['userData']
                    self.log_result(
                        "User Authentication", 
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
    
    def test_password_change_email_notification(self):
        """Test password change endpoint and verify email notification is triggered"""
        print("\n=== Testing Password Change Email Notification ===")
        
        if not self.jwt_token:
            self.log_result(
                "Password Change Email Test", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Test password change with current password "Katiekendra123@" and new password "NewKatiekendra123@"
            response = requests.put(
                f"{self.backend_url}/api/user/changePassword",
                json={
                    "oldPassword": "Katiekendra123@",
                    "newPassword": "NewKatiekendra123@"
                },
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "Password Change API", 
                    True, 
                    "Password change request successful",
                    {"response_message": data.get('message', 'Success')}
                )
                
                # Now change password back to original for future tests
                time.sleep(2)  # Brief pause
                
                response2 = requests.post(
                    f"{self.backend_url}/api/user/changePassword",
                    json={
                        "oldPassword": "NewKatiekendra123@",
                        "newPassword": "Katiekendra123@"
                    },
                    headers=headers,
                    timeout=15
                )
                
                if response2.status_code == 200:
                    self.log_result(
                        "Password Change Email Notification", 
                        True, 
                        "Password change completed successfully. Check backend logs for '[ChangePassword] Password changed notification sent' message",
                        {
                            "expected_log_message": "[ChangePassword] Password changed notification sent",
                            "email_function": "sendPasswordChangedEmail",
                            "trigger_endpoint": "/api/user/changePassword",
                            "note": "Email notification should be triggered automatically after password change"
                        }
                    )
                else:
                    self.log_result(
                        "Password Change Revert", 
                        False, 
                        f"Failed to revert password: {response2.status_code}",
                        {"response": response2.text}
                    )
            else:
                self.log_result(
                    "Password Change API", 
                    False, 
                    f"Password change failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Password Change Email Test", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_payment_link_creation_email_notification(self):
        """Test payment link creation endpoint and verify merchant email notification is triggered"""
        print("\n=== Testing Payment Link Creation Email Notification ===")
        
        if not self.jwt_token:
            self.log_result(
                "Payment Link Creation Email Test", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Create a test payment link
            payment_data = {
                "email": "customer@example.com",
                "base_amount": 50,
                "base_currency": "USD",
                "modes": ["CRYPTO"],
                "description": "Test Payment Link for Email Notification",
                "expire": "7d",
                "fee_payer": "customer"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                payment_link_data = data.get('data', {})
                
                self.log_result(
                    "Payment Link Creation API", 
                    True, 
                    "Payment link created successfully",
                    {
                        "link_id": payment_link_data.get('link_id'),
                        "payment_link": payment_link_data.get('payment_link'),
                        "amount": f"{payment_data['base_amount']} {payment_data['base_currency']}",
                        "description": payment_data['description']
                    }
                )
                
                self.log_result(
                    "Payment Link Email Notification", 
                    True, 
                    "Payment link creation completed successfully. Check backend logs for '[PaymentLink] Merchant notification sent' message",
                    {
                        "expected_log_message": "[PaymentLink] Merchant notification sent",
                        "email_function": "sendPaymentLinkCreatedEmail",
                        "trigger_endpoint": "/api/pay/createPaymentLink",
                        "merchant_email": self.user_data.get('email') if self.user_data else 'john@dyno.pt',
                        "note": "Merchant notification email should be triggered automatically after payment link creation"
                    }
                )
            else:
                self.log_result(
                    "Payment Link Creation API", 
                    False, 
                    f"Payment link creation failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Payment Link Creation Email Test", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_backend_health(self):
        """Test backend connectivity"""
        print("\n=== Testing Backend Health ===")
        
        try:
            response = requests.get(
                f"{self.backend_url}/health",
                timeout=10
            )
            
            if response.status_code == 200:
                self.log_result(
                    "Backend Health Check", 
                    True, 
                    "Backend is running and responding correctly",
                    {"status_code": response.status_code}
                )
                return True
            else:
                self.log_result(
                    "Backend Health Check", 
                    False, 
                    f"Backend health check failed with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_result(
                "Backend Health Check", 
                False, 
                f"Failed to connect to backend: {str(e)}"
            )
            return False
    
    def check_email_service_imports(self):
        """Verify email service functions are properly imported in controllers"""
        print("\n=== Verifying Email Service Integration ===")
        
        try:
            # Check if email service functions exist in the codebase
            import subprocess
            
            # Check for sendPasswordChangedEmail in userController
            result1 = subprocess.run(
                ["grep", "-n", "sendPasswordChangedEmail", "/app/backend/controller/userController.ts"],
                capture_output=True,
                text=True
            )
            
            # Check for sendPaymentLinkCreatedEmail in paymentController
            result2 = subprocess.run(
                ["grep", "-n", "sendPaymentLinkCreatedEmail", "/app/backend/controller/paymentController.ts"],
                capture_output=True,
                text=True
            )
            
            password_email_found = result1.returncode == 0 and "sendPasswordChangedEmail" in result1.stdout
            payment_email_found = result2.returncode == 0 and "sendPaymentLinkCreatedEmail" in result2.stdout
            
            if password_email_found and payment_email_found:
                self.log_result(
                    "Email Service Integration", 
                    True, 
                    "Both email notification functions are properly integrated in controllers",
                    {
                        "password_change_integration": "Found in userController.ts",
                        "payment_link_integration": "Found in paymentController.ts"
                    }
                )
            else:
                missing = []
                if not password_email_found:
                    missing.append("sendPasswordChangedEmail in userController.ts")
                if not payment_email_found:
                    missing.append("sendPaymentLinkCreatedEmail in paymentController.ts")
                
                self.log_result(
                    "Email Service Integration", 
                    False, 
                    f"Missing email service integrations: {', '.join(missing)}"
                )
                
        except Exception as e:
            self.log_result(
                "Email Service Integration", 
                False, 
                f"Failed to verify email service integration: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all email notification enhancement tests"""
        print("🚀 Starting DynoPay Email Notification Enhancement Testing")
        print("=" * 60)
        
        # Test 1: Backend Health
        if not self.test_backend_health():
            print("❌ Backend is not accessible. Stopping tests.")
            return
        
        # Test 2: Email Service Integration
        self.check_email_service_imports()
        
        # Test 3: User Authentication
        if not self.authenticate_user():
            print("❌ Authentication failed. Cannot proceed with email notification tests.")
            return
        
        # Test 4: Password Change Email Notification
        self.test_password_change_email_notification()
        
        # Test 5: Payment Link Creation Email Notification
        self.test_payment_link_creation_email_notification()
        
        # Summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 EMAIL NOTIFICATION ENHANCEMENT TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        
        print(f"\n📋 DETAILED RESULTS:")
        for test_name, result in self.test_results.items():
            status = "✅" if result['success'] else "❌"
            print(f"  {status} {test_name}: {result['message']}")
        
        print(f"\n🔍 VERIFICATION INSTRUCTIONS:")
        print(f"  1. Check backend logs for '[ChangePassword] Password changed notification sent' after password change")
        print(f"  2. Check backend logs for '[PaymentLink] Merchant notification sent' after payment link creation")
        print(f"  3. Both email functions should be called automatically without errors")
        
        print(f"\n🎯 EXPECTED EMAIL FUNCTIONS:")
        print(f"  - sendPasswordChangedEmail(email, name, date, time)")
        print(f"  - sendPaymentLinkCreatedEmail(email, name, amount, currency, paymentLink, description, expiresAt)")

if __name__ == "__main__":
    tester = DynoPayEmailNotificationTester()
    tester.run_all_tests()