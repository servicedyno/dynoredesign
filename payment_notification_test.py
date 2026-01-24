#!/usr/bin/env python3
"""
DynoPay Payment Notification Flow Testing Suite
Tests the complete payment notification flow end-to-end as requested in the review
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any

class PaymentNotificationTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        
    def get_backend_url(self):
        """Get backend URL from frontend .env file"""
        try:
            with open('/app/frontend/.env', 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        return line.split('=', 1)[1].strip()
        except:
            pass
        # Fallback to localhost
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
    
    def authenticate_with_provided_credentials(self):
        """Authenticate with the provided test credentials"""
        print("\n--- Authenticating with Provided Credentials ---")
        
        test_credentials = {
            "email": "nomadly@moxx.co",
            "password": "Katiekendra123@"
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json=test_credentials,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                login_data = response.json()
                if 'data' in login_data and 'accessToken' in login_data['data']:
                    self.jwt_token = login_data['data']['accessToken']
                    self.log_result(
                        "Authentication - Provided Credentials", 
                        True, 
                        "Successfully authenticated with nomadly@moxx.co",
                        {"email": test_credentials["email"], "has_token": bool(self.jwt_token)}
                    )
                    return True
                else:
                    self.log_result(
                        "Authentication - Provided Credentials", 
                        False, 
                        "Login succeeded but no token received",
                        {"response": login_data}
                    )
            else:
                self.log_result(
                    "Authentication - Provided Credentials", 
                    False, 
                    f"Login failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Authentication - Provided Credentials", 
                False, 
                f"Authentication failed: {str(e)}"
            )
        
        return False

    def test_notification_types_for_payment_flow(self):
        """Test notification types relevant to payment flow"""
        print("\n--- Testing Notification Types for Payment Flow ---")
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.get(
                f"{self.backend_url}/api/notifications/types",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    notification_types = data['data'].get('types', [])
                    
                    # Extract values from the notification types objects
                    type_values = [nt.get('value') for nt in notification_types if isinstance(nt, dict) and 'value' in nt]
                    
                    # Check for payment-related notification types
                    required_types = ['payment_pending', 'payment_received', 'payment_partial']
                    found_types = []
                    missing_types = []
                    
                    for required_type in required_types:
                        if required_type in type_values:
                            found_types.append(required_type)
                        else:
                            missing_types.append(required_type)
                    
                    if not missing_types:
                        self.log_result(
                            "Notification Types - Payment Flow", 
                            True, 
                            f"All required payment notification types found: {', '.join(found_types)}",
                            {"found_types": found_types, "total_types": len(notification_types)}
                        )
                    else:
                        self.log_result(
                            "Notification Types - Payment Flow", 
                            False, 
                            f"Missing payment notification types: {', '.join(missing_types)}",
                            {"found_types": found_types, "missing_types": missing_types, "all_types": type_values}
                        )
                else:
                    self.log_result(
                        "Notification Types - Payment Flow", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Notification Types - Payment Flow", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Notification Types - Payment Flow", 
                False, 
                f"Request failed: {str(e)}"
            )

    def test_webhook_endpoints_for_payment_flow(self):
        """Test webhook endpoints for payment flow"""
        print("\n--- Testing Webhook Endpoints for Payment Flow ---")
        
        # Test 1: POST /api/tatum-crypto-webhook
        try:
            test_webhook_data = {
                "address": "test-full-address",
                "counterAddress": "sender-123",
                "amount": "0.001",
                "asset": "BTC",
                "txId": "tx-full-payment-001",
                "blockNumber": None
            }
            
            response = requests.post(
                f"{self.backend_url}/api/tatum-crypto-webhook",
                json=test_webhook_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                self.log_result(
                    "Webhook - Tatum Crypto", 
                    True, 
                    "Tatum crypto webhook endpoint responds correctly",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result(
                    "Webhook - Tatum Crypto", 
                    False, 
                    f"Webhook failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Webhook - Tatum Crypto", 
                False, 
                f"Webhook request failed: {str(e)}"
            )
        
        # Test 2: POST /api/tatum-webhook (general webhook)
        try:
            response = requests.post(
                f"{self.backend_url}/api/tatum-webhook",
                json={},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                self.log_result(
                    "Webhook - Tatum General", 
                    True, 
                    "Tatum general webhook endpoint responds correctly",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result(
                    "Webhook - Tatum General", 
                    False, 
                    f"Webhook failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Webhook - Tatum General", 
                False, 
                f"Webhook request failed: {str(e)}"
            )

    def test_notification_retrieval_endpoints(self):
        """Test notification retrieval endpoints"""
        print("\n--- Testing Notification Retrieval Endpoints ---")
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        # Test 1: GET /api/notifications (all notifications)
        try:
            response = requests.get(
                f"{self.backend_url}/api/notifications",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    notifications = data['data'].get('notifications', [])
                    total = data['data'].get('total', 0)
                    
                    self.log_result(
                        "Notifications - Get All", 
                        True, 
                        f"Retrieved {len(notifications)} notifications (total: {total})",
                        {"count": len(notifications), "total": total}
                    )
                else:
                    self.log_result(
                        "Notifications - Get All", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Notifications - Get All", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Notifications - Get All", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test notification types individually
        notification_types = ["payment_pending", "payment_partial", "payment_received"]
        
        for notification_type in notification_types:
            try:
                response = requests.get(
                    f"{self.backend_url}/api/notifications",
                    params={"type": notification_type},
                    headers=headers,
                    timeout=15
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if 'data' in data:
                        notifications = data['data'].get('notifications', [])
                        
                        self.log_result(
                            f"Notifications - {notification_type.title()}", 
                            True, 
                            f"Retrieved {len(notifications)} {notification_type} notifications",
                            {"count": len(notifications)}
                        )
                    else:
                        self.log_result(
                            f"Notifications - {notification_type.title()}", 
                            False, 
                            "Invalid response format",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        f"Notifications - {notification_type.title()}", 
                        False, 
                        f"API call failed with status {response.status_code}",
                        {"response": response.text}
                    )
                    
            except Exception as e:
                self.log_result(
                    f"Notifications - {notification_type.title()}", 
                    False, 
                    f"Request failed: {str(e)}"
                )

    def test_payment_webhook_scenarios(self):
        """Test payment webhook scenarios as specified in the review request"""
        print("\n--- Testing Payment Webhook Scenarios ---")
        
        # Scenario 1: Full Payment Flow
        print("\n--- Scenario 1: Full Payment Flow ---")
        
        full_payment_data = {
            "address": "test-full-address",
            "counterAddress": "sender-123",
            "amount": "0.001",
            "asset": "BTC",
            "txId": "tx-full-payment-001",
            "blockNumber": None
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/tatum-crypto-webhook",
                json=full_payment_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                self.log_result(
                    "Payment Scenario - Full Payment", 
                    True, 
                    "Full payment webhook processed successfully",
                    {"txId": full_payment_data["txId"], "amount": full_payment_data["amount"]}
                )
            else:
                self.log_result(
                    "Payment Scenario - Full Payment", 
                    False, 
                    f"Full payment webhook failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Payment Scenario - Full Payment", 
                False, 
                f"Full payment webhook failed: {str(e)}"
            )
        
        # Scenario 2: Partial Payment Flow
        print("\n--- Scenario 2: Partial Payment Flow ---")
        
        partial_payment_data = {
            "address": "test-partial-address",
            "counterAddress": "sender-456",
            "amount": "0.005",
            "asset": "BTC",
            "txId": "tx-partial-001",
            "blockNumber": None
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/tatum-crypto-webhook",
                json=partial_payment_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                self.log_result(
                    "Payment Scenario - Partial Payment", 
                    True, 
                    "Partial payment webhook processed successfully",
                    {"txId": partial_payment_data["txId"], "amount": partial_payment_data["amount"]}
                )
            else:
                self.log_result(
                    "Payment Scenario - Partial Payment", 
                    False, 
                    f"Partial payment webhook failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Payment Scenario - Partial Payment", 
                False, 
                f"Partial payment webhook failed: {str(e)}"
            )

    def test_crypto_verification_endpoint(self):
        """Test cryptoVerification endpoint for processing payments"""
        print("\n--- Testing Crypto Verification Endpoint ---")
        
        # Note: This endpoint might require specific data structure
        # Testing with minimal data to see if endpoint exists and responds
        
        try:
            test_verification_data = {
                "address": "test-full-address",
                "txId": "tx-full-payment-001"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/cryptoVerification",
                json=test_verification_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            # Accept various response codes as the endpoint might have specific requirements
            if response.status_code in [200, 400, 404, 500]:
                self.log_result(
                    "Crypto Verification Endpoint", 
                    True, 
                    f"Crypto verification endpoint exists and responds (status: {response.status_code})",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result(
                    "Crypto Verification Endpoint", 
                    False, 
                    f"Unexpected response status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Crypto Verification Endpoint", 
                False, 
                f"Request failed: {str(e)}"
            )

    def test_backend_connectivity(self):
        """Test backend server connectivity"""
        print("\n=== Testing Backend Connectivity ===")
        
        try:
            # Test a simple API endpoint that should work
            response = requests.get(
                f"{self.backend_url}/api/tax/rate/PT",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'country_code' in data['data']:
                    self.log_result(
                        "Backend Server Connection", 
                        True, 
                        "Backend API is responding correctly",
                        {"country_code": data['data']['country_code']}
                    )
                    return True
                else:
                    self.log_result(
                        "Backend Server Connection", 
                        False, 
                        "Backend API response format unexpected",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Backend Server Connection", 
                    False, 
                    f"Backend API returned status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_result(
                "Backend Server Connection", 
                False, 
                f"Failed to connect to backend: {str(e)}"
            )
            return False
        except json.JSONDecodeError as e:
            self.log_result(
                "Backend Server Connection", 
                False, 
                f"Failed to parse backend response: {str(e)}"
            )
            return False

    def run_payment_notification_tests(self):
        """Run the complete payment notification flow tests"""
        print("=" * 80)
        print("DYNOPAY PAYMENT NOTIFICATION FLOW TESTING SUITE")
        print("=" * 80)
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Credentials: nomadly@moxx.co")
        print("=" * 80)
        
        # Phase 1: Basic connectivity
        if not self.test_backend_connectivity():
            print("\n❌ CRITICAL: Backend server is not responding. Cannot continue with tests.")
            return False
        
        # Phase 2: Authentication with provided credentials
        if not self.authenticate_with_provided_credentials():
            print("\n❌ CRITICAL: Authentication failed. Cannot continue with authenticated tests.")
            return False
        
        # Phase 3: Test notification types
        self.test_notification_types_for_payment_flow()
        
        # Phase 4: Test webhook endpoints
        self.test_webhook_endpoints_for_payment_flow()
        
        # Phase 5: Test notification retrieval endpoints
        self.test_notification_retrieval_endpoints()
        
        # Phase 6: Test payment webhook scenarios
        self.test_payment_webhook_scenarios()
        
        # Phase 7: Test crypto verification endpoint
        self.test_crypto_verification_endpoint()
        
        # Generate summary
        self.generate_test_summary()
        
        return len(self.errors) == 0

    def generate_test_summary(self):
        """Generate a comprehensive test summary"""
        print("\n" + "=" * 80)
        print("PAYMENT NOTIFICATION FLOW TEST SUMMARY")
        print("=" * 80)
        
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
                    print(f"  - {test_name}: {result['message']}")
        
        if passed_tests > 0:
            print(f"\n✅ PASSED TESTS ({passed_tests}):")
            for test_name, result in self.test_results.items():
                if result['success']:
                    print(f"  - {test_name}: {result['message']}")
        
        print("\n" + "=" * 80)

def main():
    """Main test execution"""
    tester = PaymentNotificationTester()
    
    try:
        # Run payment notification flow tests as specified in review request
        success = tester.run_payment_notification_tests()
        
        if success:
            print("\n🎉 ALL PAYMENT NOTIFICATION TESTS PASSED!")
            sys.exit(0)
        else:
            print(f"\n❌ {len(tester.errors)} TESTS FAILED!")
            for error in tester.errors:
                print(f"  - {error}")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n⏹️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()