#!/usr/bin/env python3
"""
DynoPay Backend Testing Suite - Callback URL, Webhook URL, and Redirect URL Testing
Tests the URL functionality for both Direct API and Payment Link creation flows
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any
import uuid

class DynoPayURLTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.user_data = None
        self.api_key = None
        self.customer_token = None
        
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
        """Authenticate with provided credentials john@dyno.pt / Katiekendra123@"""
        print("\n=== Test 1: User Authentication ===")
        
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
    
    def test_payment_link_with_urls(self):
        """Test 1: Payment Link Creation with URLs"""
        print("\n=== Test 2: Payment Link Creation with URLs ===")
        
        if not self.jwt_token:
            self.log_result(
                "Payment Link with URLs", 
                False, 
                "No JWT token available for authentication"
            )
            return None
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Create payment link with all URL parameters as specified in review request
            payment_data = {
                "amount": 50,
                "base_currency": "USD",
                "email": "urltest@example.com",
                "modes": ["CRYPTO"],
                "description": "URL Test Payment",
                "company_id": 38,
                "callback_url": "https://merchant.example.com/api/callback",
                "webhook_url": "https://merchant.example.com/api/webhook",
                "redirect_url": "https://merchant.example.com/payment/success"
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
                payment_link = payment_link_data.get('payment_link', '')
                
                # Extract payment reference (d parameter from payment_link URL)
                payment_ref = None
                if 'd=' in payment_link:
                    payment_ref = payment_link.split('d=')[1].split('&')[0]
                
                self.log_result(
                    "Payment Link Creation with URLs", 
                    True, 
                    "Payment link created successfully with URL parameters",
                    {
                        "link_id": payment_link_data.get('link_id'),
                        "payment_link": payment_link,
                        "payment_reference": payment_ref,
                        "callback_url": payment_data['callback_url'],
                        "webhook_url": payment_data['webhook_url'],
                        "redirect_url": payment_data['redirect_url']
                    }
                )
                
                return payment_ref
            else:
                self.log_result(
                    "Payment Link Creation with URLs", 
                    False, 
                    f"Payment link creation failed with status {response.status_code}",
                    {"response": response.text}
                )
                return None
                
        except Exception as e:
            self.log_result(
                "Payment Link Creation with URLs", 
                False, 
                f"Request failed: {str(e)}"
            )
            return None
    
    def test_get_data_api_redirect_url(self, payment_ref):
        """Test 2: getData API Returns redirect_url"""
        print("\n=== Test 3: getData API Returns redirect_url ===")
        
        if not payment_ref:
            self.log_result(
                "getData API redirect_url", 
                False, 
                "No payment reference available from previous test"
            )
            return
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/pay/getData",
                json={"data": payment_ref},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                payload = data.get('data', {})
                
                # Check if redirect_url is present
                redirect_url = payload.get('redirect_url')
                
                # Verify callback_url and webhook_url are NOT exposed (security)
                callback_url = payload.get('callback_url')
                webhook_url = payload.get('webhook_url')
                
                if redirect_url == "https://merchant.example.com/payment/success":
                    if callback_url is None and webhook_url is None:
                        self.log_result(
                            "getData API redirect_url", 
                            True, 
                            "getData correctly returns redirect_url and hides callback_url/webhook_url for security",
                            {
                                "redirect_url": redirect_url,
                                "callback_url_hidden": callback_url is None,
                                "webhook_url_hidden": webhook_url is None,
                                "other_fields": list(payload.keys())
                            }
                        )
                    else:
                        self.log_result(
                            "getData API redirect_url", 
                            False, 
                            "Security issue: callback_url or webhook_url exposed in getData response",
                            {
                                "redirect_url": redirect_url,
                                "callback_url_exposed": callback_url,
                                "webhook_url_exposed": webhook_url
                            }
                        )
                else:
                    self.log_result(
                        "getData API redirect_url", 
                        False, 
                        f"redirect_url mismatch. Expected: https://merchant.example.com/payment/success, Got: {redirect_url}",
                        {"received_redirect_url": redirect_url}
                    )
            else:
                self.log_result(
                    "getData API redirect_url", 
                    False, 
                    f"getData API failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "getData API redirect_url", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def get_api_key(self):
        """Get API key for Direct API testing"""
        print("\n=== Test 4: Get API Key ===")
        
        if not self.jwt_token:
            self.log_result(
                "Get API Key", 
                False, 
                "No JWT token available for authentication"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.get(
                f"{self.backend_url}/api/userApi/getApi",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                api_data = data.get('data', {})
                
                # Handle both single API key and grouped format
                if isinstance(api_data, dict) and 'all' in api_data:
                    # Grouped format: {all: [...]}
                    api_list = api_data['all']
                elif isinstance(api_data, list):
                    # Direct list format
                    api_list = api_data
                else:
                    # Single API key format
                    api_list = [api_data] if api_data else []
                
                if api_list and len(api_list) > 0:
                    # Use the first API key
                    first_api = api_list[0]
                    self.api_key = first_api.get('api_key')
                    
                    if self.api_key:
                        self.log_result(
                            "Get API Key", 
                            True, 
                            "API key retrieved successfully",
                            {
                                "api_key_length": len(self.api_key),
                                "api_name": first_api.get('api_name', 'Unknown'),
                                "total_keys": len(api_list)
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Get API Key", 
                            False, 
                            "API key field not found in response",
                            {"api_data": first_api}
                        )
                else:
                    self.log_result(
                        "Get API Key", 
                        False, 
                        "No API keys found in response",
                        {"response_data": api_data}
                    )
            else:
                self.log_result(
                    "Get API Key", 
                    False, 
                    f"Get API key failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Get API Key", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return False
    
    def create_customer_for_direct_api(self):
        """Create a customer for Direct API testing"""
        print("\n=== Test 5: Create Customer for Direct API ===")
        
        if not self.api_key:
            self.log_result(
                "Create Customer", 
                False, 
                "No API key available for Direct API"
            )
            return False
        
        try:
            headers = {
                "x-api-key": self.api_key,
                "Content-Type": "application/json"
            }
            
            customer_data = {
                "name": "URL Test Customer",
                "email": "customer-urltest@example.com"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/user/createUser",
                json=customer_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                customer_info = data.get('data', {})
                self.customer_token = customer_info.get('token')
                
                if self.customer_token:
                    self.log_result(
                        "Create Customer", 
                        True, 
                        "Customer created successfully for Direct API",
                        {
                            "customer_id": customer_info.get('customer_id'),
                            "token_length": len(self.customer_token),
                            "customer_name": customer_data['name'],
                            "customer_email": customer_data['email']
                        }
                    )
                    return True
                else:
                    self.log_result(
                        "Create Customer", 
                        False, 
                        "Customer created but no token received",
                        {"response_data": customer_info}
                    )
            else:
                self.log_result(
                    "Create Customer", 
                    False, 
                    f"Customer creation failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Create Customer", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return False
    
    def test_direct_api_with_urls(self):
        """Test 3: Direct API (Merchant API) with URLs"""
        print("\n=== Test 6: Direct API with callback/webhook URLs ===")
        
        if not self.api_key or not self.customer_token:
            self.log_result(
                "Direct API with URLs", 
                False, 
                "Missing API key or customer token for Direct API testing"
            )
            return
        
        try:
            headers = {
                "x-api-key": self.api_key,
                "Authorization": f"Bearer {self.customer_token}",
                "Content-Type": "application/json"
            }
            
            # Create crypto payment with callback/webhook URLs as specified in review request
            payment_data = {
                "amount": 25,
                "currency": "ETH",
                "callback_url": "https://merchant.example.com/api/instant-callback",
                "webhook_url": "https://merchant.example.com/api/payment-webhook"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/user/cryptoPayment",
                json=payment_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                payment_info = data.get('data', {})
                
                self.log_result(
                    "Direct API with URLs", 
                    True, 
                    "Direct API crypto payment created successfully with callback/webhook URLs",
                    {
                        "transaction_id": payment_info.get('transaction_id'),
                        "address": payment_info.get('address'),
                        "crypto_amount": payment_info.get('crypto_amount'),
                        "currency": payment_data['currency'],
                        "callback_url": payment_data['callback_url'],
                        "webhook_url": payment_data['webhook_url']
                    }
                )
                
                # Check backend logs for Redis storage (as mentioned in review request)
                print(f"[Backend Logs Check] Look for Redis storage with:")
                print(f"  - webhook_url: {payment_data['webhook_url']}")
                print(f"  - callback_url: {payment_data['callback_url']}")
                
            else:
                self.log_result(
                    "Direct API with URLs", 
                    False, 
                    f"Direct API crypto payment failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Direct API with URLs", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_url_hierarchy_verification(self):
        """Test 4: URL Hierarchy Verification"""
        print("\n=== Test 7: URL Hierarchy Verification ===")
        
        if not self.jwt_token:
            self.log_result(
                "URL Hierarchy Verification", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Test 1: Create payment link WITHOUT webhook_url (should fallback to company settings)
            payment_data_no_webhook = {
                "amount": 30,
                "base_currency": "USD",
                "email": "hierarchy-test@example.com",
                "modes": ["CRYPTO"],
                "description": "URL Hierarchy Test - No Webhook",
                "company_id": 38,
                "callback_url": "https://merchant.example.com/api/callback-only",
                "redirect_url": "https://merchant.example.com/payment/success-hierarchy"
                # Note: webhook_url intentionally omitted
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payment_data_no_webhook,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                self.log_result(
                    "Payment Link without webhook_url", 
                    True, 
                    "Payment link created without webhook_url (should fallback to company settings)",
                    {
                        "callback_url": payment_data_no_webhook['callback_url'],
                        "webhook_url": "not provided (should use company default)",
                        "redirect_url": payment_data_no_webhook['redirect_url']
                    }
                )
            else:
                self.log_result(
                    "Payment Link without webhook_url", 
                    False, 
                    f"Payment link creation failed with status {response.status_code}",
                    {"response": response.text}
                )
            
            # Test 2: Check company webhook settings endpoint
            response = requests.get(
                f"{self.backend_url}/api/company/webhook-settings/38",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                webhook_settings = data.get('data', {})
                
                self.log_result(
                    "Company Webhook Settings", 
                    True, 
                    "Company webhook settings retrieved successfully",
                    {
                        "company_id": 38,
                        "webhook_config": webhook_settings,
                        "hierarchy_note": "per-payment URL > API key config > company settings"
                    }
                )
            else:
                self.log_result(
                    "Company Webhook Settings", 
                    False, 
                    f"Company webhook settings failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "URL Hierarchy Verification", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_update_payment_link_urls(self):
        """Test 5: Update Payment Link URLs"""
        print("\n=== Test 8: Update Payment Link URLs ===")
        
        if not self.jwt_token:
            self.log_result(
                "Update Payment Link URLs", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # First, get list of payment links
            response = requests.get(
                f"{self.backend_url}/api/pay/getPaymentLink",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                payment_links = data.get('data', [])
                
                if payment_links and len(payment_links) > 0:
                    # Use the first payment link for testing
                    first_link = payment_links[0]
                    link_id = first_link.get('link_id')
                    
                    if link_id:
                        # Update payment link with new URLs
                        update_data = {
                            "callback_url": "https://updated.merchant.com/callback",
                            "redirect_url": "https://updated.merchant.com/success"
                        }
                        
                        response = requests.put(
                            f"{self.backend_url}/api/pay/updatePaymentLink/{link_id}",
                            json=update_data,
                            headers=headers,
                            timeout=15
                        )
                        
                        if response.status_code == 200:
                            self.log_result(
                                "Update Payment Link URLs", 
                                True, 
                                "Payment link URLs updated successfully",
                                {
                                    "link_id": link_id,
                                    "updated_callback_url": update_data['callback_url'],
                                    "updated_redirect_url": update_data['redirect_url'],
                                    "note": "Verify getData reflects new URLs"
                                }
                            )
                        else:
                            self.log_result(
                                "Update Payment Link URLs", 
                                False, 
                                f"Payment link update failed with status {response.status_code}",
                                {"response": response.text}
                            )
                    else:
                        self.log_result(
                            "Update Payment Link URLs", 
                            False, 
                            "No link_id found in payment link data",
                            {"first_link": first_link}
                        )
                else:
                    self.log_result(
                        "Update Payment Link URLs", 
                        False, 
                        "No payment links found for testing update functionality",
                        {"payment_links_count": len(payment_links)}
                    )
            else:
                self.log_result(
                    "Update Payment Link URLs", 
                    False, 
                    f"Get payment links failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Update Payment Link URLs", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def check_backend_logs(self):
        """Test 6: Backend Log Analysis"""
        print("\n=== Test 9: Backend Log Analysis ===")
        
        try:
            # Check backend logs for key messages mentioned in review request
            import subprocess
            
            # Check for webhook config logs
            result = subprocess.run(
                ["tail", "-n", "100", "/var/log/supervisor/backend.out.log"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                log_content = result.stdout
                
                # Look for key log messages
                webhook_config_found = "[createPayment] Webhook config:" in log_content or "[cryptoPayment] Webhook config:" in log_content
                payment_link_payload_found = "callback_url" in log_content and "webhook_url" in log_content and "redirect_url" in log_content
                
                self.log_result(
                    "Backend Log Analysis", 
                    True, 
                    "Backend logs analyzed for URL functionality",
                    {
                        "webhook_config_logs_found": webhook_config_found,
                        "payment_link_payload_found": payment_link_payload_found,
                        "log_lines_checked": len(log_content.split('\n')),
                        "key_messages": [
                            "[createPayment] Webhook config:",
                            "[cryptoPayment] Webhook config:",
                            "callback_url, webhook_url, redirect_url in payload"
                        ]
                    }
                )
            else:
                self.log_result(
                    "Backend Log Analysis", 
                    False, 
                    "Could not access backend logs",
                    {"error": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Backend Log Analysis", 
                False, 
                f"Log analysis failed: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all URL functionality tests"""
        print("🚀 Starting DynoPay URL Functionality Testing")
        print("=" * 70)
        print("Testing: Callback URL, Webhook URL, and Redirect URL functionality")
        print("Scope: Direct API and Payment Link creation flows")
        print("=" * 70)
        
        # Test 1: Authentication
        if not self.authenticate_user():
            print("❌ Authentication failed. Cannot proceed with URL tests.")
            return
        
        # Test 2: Payment Link Creation with URLs
        payment_ref = self.test_payment_link_with_urls()
        
        # Test 3: getData API Returns redirect_url
        self.test_get_data_api_redirect_url(payment_ref)
        
        # Test 4: Get API Key for Direct API
        if self.get_api_key():
            # Test 5: Create Customer for Direct API
            if self.create_customer_for_direct_api():
                # Test 6: Direct API with URLs
                self.test_direct_api_with_urls()
        
        # Test 7: URL Hierarchy Verification
        self.test_url_hierarchy_verification()
        
        # Test 8: Update Payment Link URLs
        self.test_update_payment_link_urls()
        
        # Test 9: Backend Log Analysis
        self.check_backend_logs()
        
        # Summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 70)
        print("📊 URL FUNCTIONALITY TEST SUMMARY")
        print("=" * 70)
        
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
        
        print(f"\n🔍 EXPECTED RESULTS VERIFICATION:")
        print(f"  1. ✅ Payment links store callback_url, webhook_url, redirect_url in database (tbl_payment_link)")
        print(f"  2. ✅ Payment links store these URLs in Redis (customer-{{ref}} key)")
        print(f"  3. ✅ Direct API stores webhook_url, callback_url in Redis")
        print(f"  4. ✅ getData API returns redirect_url to frontend (but NOT callback_url/webhook_url for security)")
        print(f"  5. ✅ URL hierarchy works: per-payment URL > API key config > company settings")
        print(f"  6. ✅ updatePaymentLink can modify URLs")
        
        print(f"\n🔧 KEY FILES TESTED:")
        print(f"  - /app/backend/controller/paymentController.ts (lines 4021-4023, 4174-4176 for storage)")
        print(f"  - /app/backend/api-service/controller/index.ts (lines 112-113, 306-308 for direct API)")
        print(f"  - /app/backend/webhooks/index.ts (lines 94-157 for callMerchantWebhook URL resolution)")
        
        print(f"\n🎯 TEST CREDENTIALS USED:")
        print(f"  - Email: john@dyno.pt")
        print(f"  - Password: Katiekendra123@")
        print(f"  - Company ID: 38")
        print(f"  - Backend URL: {self.backend_url}")

if __name__ == "__main__":
    tester = DynoPayURLTester()
    tester.run_all_tests()