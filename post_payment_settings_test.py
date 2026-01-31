#!/usr/bin/env python3
"""
DynoPay Post-Payment Settings Test
Tests the post-payment settings functionality including callback_url, redirect_url, and webhook_url
"""

import os
import sys
import json
import requests
import re
from typing import Dict, List, Any
from urllib.parse import urlparse, parse_qs

class PostPaymentSettingsTest:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.payment_reference = None
        self.payment_link_id = None
        
        # Test credentials from review request
        self.test_email = "john@dyno.pt"
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
    
    def authenticate(self):
        """Authenticate with test credentials"""
        print("\n=== Step 1: Authentication ===")
        
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
                    user_info = data['data'].get('user', {})
                    self.log_result(
                        "Authentication", 
                        True, 
                        f"Successfully authenticated user: {user_info.get('name', 'Unknown')}",
                        {
                            "email": self.test_email,
                            "user_id": user_info.get('user_id'),
                            "name": user_info.get('name'),
                            "has_token": bool(self.jwt_token)
                        }
                    )
                    return True
                else:
                    self.log_result(
                        "Authentication", 
                        False, 
                        "Login succeeded but no token received",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Authentication", 
                    False, 
                    f"Login failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Authentication", 
                False, 
                f"Authentication failed: {str(e)}"
            )
        
        return False
    
    def create_payment_link_with_post_payment_settings(self):
        """Create payment link with post-payment settings as specified in review request"""
        print("\n=== Step 2: Create Payment Link with Post-Payment Settings ===")
        
        if not self.jwt_token:
            self.log_result(
                "Payment Link Creation", 
                False, 
                "No JWT token available for authentication"
            )
            return False
        
        # Payment link data as specified in review request
        payment_data = {
            "amount": 25,
            "currency": "USD",
            "modes": ["CRYPTO"],
            "company_id": 38,
            "description": "Test post-payment settings",
            "callback_url": "https://webhook.site/test-callback",
            "redirect_url": "https://example.com/payment-success",
            "webhook_url": "https://webhook.site/test-webhook"
        }
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data and 'payment_link' in data['data']:
                    payment_link = data['data']['payment_link']
                    
                    # Extract payment reference from URL (d= parameter)
                    if payment_link:
                        parsed_url = urlparse(payment_link)
                        query_params = parse_qs(parsed_url.query)
                        
                        if 'd' in query_params:
                            self.payment_reference = query_params['d'][0]
                            
                            # Also try to get link_id if available
                            if 'link_id' in data['data']:
                                self.payment_link_id = data['data']['link_id']
                            
                            self.log_result(
                                "Payment Link Creation", 
                                True, 
                                f"Successfully created payment link with post-payment settings",
                                {
                                    "payment_link": payment_link,
                                    "payment_reference": self.payment_reference,
                                    "link_id": self.payment_link_id,
                                    "amount": payment_data["amount"],
                                    "currency": payment_data["currency"],
                                    "modes": payment_data["modes"],
                                    "callback_url": payment_data["callback_url"],
                                    "redirect_url": payment_data["redirect_url"],
                                    "webhook_url": payment_data["webhook_url"]
                                }
                            )
                            return True
                        else:
                            self.log_result(
                                "Payment Link Creation - Reference Extraction", 
                                False, 
                                "Could not extract payment reference (d parameter) from URL",
                                {"payment_link": payment_link, "query_params": query_params}
                            )
                    else:
                        self.log_result(
                            "Payment Link Creation", 
                            False, 
                            "Payment link is empty in response",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "Payment Link Creation", 
                        False, 
                        "Invalid response format - missing payment_link",
                        {"response": data}
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
    
    def test_get_data_endpoint(self):
        """Test POST /api/pay/getData with extracted reference"""
        print("\n=== Step 3: Test getData Endpoint ===")
        
        if not self.payment_reference:
            self.log_result(
                "getData Endpoint", 
                False, 
                "No payment reference available for testing"
            )
            return False
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/pay/getData",
                json={"reference": self.payment_reference},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    checkout_data = data['data']
                    
                    # Check if redirect_url is present
                    redirect_url_present = 'redirect_url' in checkout_data
                    redirect_url_value = checkout_data.get('redirect_url')
                    
                    # Check if callback_url and webhook_url are NOT present (security requirement)
                    callback_url_present = 'callback_url' in checkout_data
                    webhook_url_present = 'webhook_url' in checkout_data
                    
                    # Verify redirect_url value matches expected
                    redirect_url_correct = redirect_url_value == "https://example.com/payment-success"
                    
                    # Security check: callback_url and webhook_url should NOT be exposed
                    security_check_passed = not callback_url_present and not webhook_url_present
                    
                    if redirect_url_present and redirect_url_correct and security_check_passed:
                        self.log_result(
                            "getData Endpoint - Security & Functionality", 
                            True, 
                            "✅ redirect_url returned correctly, callback_url and webhook_url properly hidden",
                            {
                                "redirect_url": redirect_url_value,
                                "redirect_url_correct": redirect_url_correct,
                                "callback_url_exposed": callback_url_present,
                                "webhook_url_exposed": webhook_url_present,
                                "security_check_passed": security_check_passed
                            }
                        )
                        
                        # Additional verification of other expected fields
                        expected_fields = ['amount', 'base_currency', 'payment_mode', 'allowedModes', 'description']
                        present_fields = [field for field in expected_fields if field in checkout_data]
                        
                        self.log_result(
                            "getData Endpoint - Field Verification", 
                            True, 
                            f"Found {len(present_fields)}/{len(expected_fields)} expected fields",
                            {
                                "present_fields": present_fields,
                                "amount": checkout_data.get('amount'),
                                "currency": checkout_data.get('base_currency'),
                                "modes": checkout_data.get('allowedModes'),
                                "description": checkout_data.get('description')
                            }
                        )
                        return True
                    else:
                        issues = []
                        if not redirect_url_present:
                            issues.append("redirect_url missing")
                        elif not redirect_url_correct:
                            issues.append(f"redirect_url incorrect (got: {redirect_url_value})")
                        if callback_url_present:
                            issues.append("callback_url exposed (security issue)")
                        if webhook_url_present:
                            issues.append("webhook_url exposed (security issue)")
                        
                        self.log_result(
                            "getData Endpoint - Validation", 
                            False, 
                            f"Validation failed: {', '.join(issues)}",
                            {
                                "redirect_url_present": redirect_url_present,
                                "redirect_url_value": redirect_url_value,
                                "redirect_url_correct": redirect_url_correct,
                                "callback_url_exposed": callback_url_present,
                                "webhook_url_exposed": webhook_url_present,
                                "all_fields": list(checkout_data.keys())
                            }
                        )
                else:
                    self.log_result(
                        "getData Endpoint", 
                        False, 
                        "Invalid response format - missing data field",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "getData Endpoint", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "getData Endpoint", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return False
    
    def verify_payment_link_database_storage(self):
        """Verify all 3 URLs are stored in database via getLinks endpoint"""
        print("\n=== Step 4: Verify Payment Link Database Storage ===")
        
        if not self.jwt_token:
            self.log_result(
                "Database Storage Verification", 
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
                f"{self.backend_url}/api/paymentLink/getLinks",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    payment_links = data['data']
                    
                    # Find our payment link (by link_id if available, or by amount/description)
                    target_link = None
                    
                    if isinstance(payment_links, list):
                        for link in payment_links:
                            # Try to match by link_id first
                            if self.payment_link_id and link.get('link_id') == self.payment_link_id:
                                target_link = link
                                break
                            # Fallback: match by amount and description
                            elif (link.get('amount') == 25 and 
                                  link.get('description') == "Test post-payment settings"):
                                target_link = link
                                break
                    
                    if target_link:
                        # Check if all 3 URLs are stored
                        callback_url = target_link.get('callback_url')
                        redirect_url = target_link.get('redirect_url')
                        webhook_url = target_link.get('webhook_url')
                        
                        # Verify URLs match expected values
                        callback_correct = callback_url == "https://webhook.site/test-callback"
                        redirect_correct = redirect_url == "https://example.com/payment-success"
                        webhook_correct = webhook_url == "https://webhook.site/test-webhook"
                        
                        all_urls_present = callback_url and redirect_url and webhook_url
                        all_urls_correct = callback_correct and redirect_correct and webhook_correct
                        
                        if all_urls_present and all_urls_correct:
                            self.log_result(
                                "Database Storage Verification", 
                                True, 
                                "✅ All 3 URLs correctly stored in database",
                                {
                                    "link_id": target_link.get('link_id'),
                                    "callback_url": callback_url,
                                    "redirect_url": redirect_url,
                                    "webhook_url": webhook_url,
                                    "callback_correct": callback_correct,
                                    "redirect_correct": redirect_correct,
                                    "webhook_correct": webhook_correct
                                }
                            )
                            return True
                        else:
                            issues = []
                            if not callback_url:
                                issues.append("callback_url missing")
                            elif not callback_correct:
                                issues.append(f"callback_url incorrect (got: {callback_url})")
                            
                            if not redirect_url:
                                issues.append("redirect_url missing")
                            elif not redirect_correct:
                                issues.append(f"redirect_url incorrect (got: {redirect_url})")
                            
                            if not webhook_url:
                                issues.append("webhook_url missing")
                            elif not webhook_correct:
                                issues.append(f"webhook_url incorrect (got: {webhook_url})")
                            
                            self.log_result(
                                "Database Storage Verification", 
                                False, 
                                f"URL storage issues: {', '.join(issues)}",
                                {
                                    "callback_url": callback_url,
                                    "redirect_url": redirect_url,
                                    "webhook_url": webhook_url,
                                    "expected_callback": "https://webhook.site/test-callback",
                                    "expected_redirect": "https://example.com/payment-success",
                                    "expected_webhook": "https://webhook.site/test-webhook"
                                }
                            )
                    else:
                        self.log_result(
                            "Database Storage Verification", 
                            False, 
                            "Could not find the created payment link in database",
                            {
                                "searched_link_id": self.payment_link_id,
                                "total_links": len(payment_links) if isinstance(payment_links, list) else 0,
                                "sample_links": payment_links[:2] if isinstance(payment_links, list) else payment_links
                            }
                        )
                else:
                    self.log_result(
                        "Database Storage Verification", 
                        False, 
                        "Invalid response format - missing data field",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Database Storage Verification", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Database Storage Verification", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return False
    
    def run_comprehensive_test(self):
        """Run the complete post-payment settings test suite"""
        print("🚀 Starting DynoPay Post-Payment Settings Test")
        print("=" * 60)
        
        # Step 1: Authenticate
        if not self.authenticate():
            print("\n❌ Authentication failed - cannot proceed with tests")
            return False
        
        # Step 2: Create payment link with post-payment settings
        if not self.create_payment_link_with_post_payment_settings():
            print("\n❌ Payment link creation failed - cannot proceed with tests")
            return False
        
        # Step 3: Test getData endpoint
        get_data_success = self.test_get_data_endpoint()
        
        # Step 4: Verify database storage
        db_storage_success = self.verify_payment_link_database_storage()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if self.errors:
            print("\n❌ FAILED TESTS:")
            for error in self.errors:
                print(f"  • {error}")
        
        # Detailed results for each test
        print("\n📋 DETAILED RESULTS:")
        for test_name, result in self.test_results.items():
            status = "✅ PASS" if result['success'] else "❌ FAIL"
            print(f"  {status} {test_name}: {result['message']}")
        
        # Overall conclusion
        critical_tests_passed = (
            self.test_results.get("Authentication", {}).get('success', False) and
            self.test_results.get("Payment Link Creation", {}).get('success', False) and
            get_data_success and
            db_storage_success
        )
        
        if critical_tests_passed:
            print("\n🎉 POST-PAYMENT SETTINGS FUNCTIONALITY: ✅ WORKING")
            print("✅ Payment links created with callback_url, redirect_url, webhook_url")
            print("✅ getData endpoint returns redirect_url for checkout page")
            print("✅ callback_url and webhook_url properly hidden from getData response (security)")
            print("✅ All 3 URLs correctly stored in database")
        else:
            print("\n⚠️  POST-PAYMENT SETTINGS FUNCTIONALITY: ❌ ISSUES FOUND")
            print("❌ One or more critical tests failed")
        
        return critical_tests_passed

def main():
    """Main function to run the post-payment settings test"""
    tester = PostPaymentSettingsTest()
    success = tester.run_comprehensive_test()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()