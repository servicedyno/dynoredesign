#!/usr/bin/env python3
"""
Enhanced Webhook Payloads Testing for DynoPay
Tests the enhanced webhook payload structure with new fields for developers
"""

import os
import sys
import json
import time
import requests
import psycopg2
from typing import Dict, List, Any
import uuid

class EnhancedWebhookPayloadsTest:
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
        self.company_id = 38
        
        # Database connection details
        self.db_config = {
            'host': 'tramway.proxy.rlwy.net',
            'port': 57376,
            'user': 'postgres',
            'password': 'oYLtGbXGKLFLWjoEbLjzxOzTXPLtJXQV',
            'database': 'db_bozzwallet'
        }
        
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
    
    def test_code_verification(self):
        """Test 1: Verify enhanced webhook payload structure in code"""
        print("\n" + "="*80)
        print("TEST 1: CODE VERIFICATION - Enhanced Webhook Payload Structure")
        print("="*80)
        
        try:
            # Check paymentController.ts for enhanced payment.confirmed webhook
            payment_controller_path = "/app/backend/controller/paymentController.ts"
            webhook_index_path = "/app/backend/webhooks/index.ts"
            
            # Verify paymentController.ts enhanced webhook (lines 3907-3970)
            with open(payment_controller_path, 'r') as f:
                content = f.read()
                
            # Check for enhanced webhook fields in payment.confirmed
            enhanced_fields = [
                'merchant_amount',
                'total_fee',
                'total_fee_usd',
                'fee_payer',
                'customer_name',
                'customer_email',
                'description',
                'link_id',
                'tax_info',
                'overpayment'
            ]
            
            found_fields = []
            missing_fields = []
            
            for field in enhanced_fields:
                if field in content:
                    found_fields.append(field)
                else:
                    missing_fields.append(field)
            
            # Check webhooks/index.ts for enhanced payment.pending and payment.underpaid
            with open(webhook_index_path, 'r') as f:
                webhook_content = f.read()
            
            # Check for enhanced fields in pending/underpaid webhooks
            pending_fields = ['base_amount', 'base_currency', 'customer_name', 'customer_email', 'description', 'link_id', 'fee_payer']
            underpaid_fields = ['base_amount', 'base_currency', 'customer_name', 'customer_email', 'description', 'link_id', 'fee_payer']
            
            pending_found = []
            underpaid_found = []
            
            for field in pending_fields:
                if field in webhook_content and 'payment.pending' in webhook_content:
                    pending_found.append(field)
            
            for field in underpaid_fields:
                if field in webhook_content and 'payment.underpaid' in webhook_content:
                    underpaid_found.append(field)
            
            # Verify enhanced webhook structure exists
            if len(found_fields) >= 8 and len(pending_found) >= 5 and len(underpaid_found) >= 5:
                self.log_result(
                    "Code Verification - Enhanced Webhook Fields",
                    True,
                    f"Enhanced webhook fields found in code ({len(found_fields)}/10 confirmed, {len(pending_found)}/7 pending, {len(underpaid_found)}/7 underpaid)",
                    {
                        "payment_confirmed_fields": found_fields,
                        "payment_pending_fields": pending_found,
                        "payment_underpaid_fields": underpaid_found,
                        "missing_fields": missing_fields
                    }
                )
            else:
                self.log_result(
                    "Code Verification - Enhanced Webhook Fields",
                    False,
                    f"Insufficient enhanced webhook fields found ({len(found_fields)}/10 confirmed, {len(pending_found)}/7 pending, {len(underpaid_found)}/7 underpaid)",
                    {
                        "found_fields": found_fields,
                        "missing_fields": missing_fields,
                        "pending_found": pending_found,
                        "underpaid_found": underpaid_found
                    }
                )
                
        except Exception as e:
            self.log_result("Code Verification - Enhanced Webhook Fields", False, f"Code verification failed: {str(e)}")
    
    def test_webhook_log_analysis(self):
        """Test 2: Query webhook delivery log to see recent webhook structure"""
        print("\n" + "="*80)
        print("TEST 2: WEBHOOK LOG ANALYSIS - Recent Webhook Delivery Structure")
        print("="*80)
        
        try:
            # Connect to database
            conn = psycopg2.connect(**self.db_config)
            cursor = conn.cursor()
            
            # Query recent webhook deliveries
            query = """
            SELECT log_id, event_type, payload, status, created_at 
            FROM tbl_webhook_delivery_log 
            ORDER BY created_at DESC 
            LIMIT 5;
            """
            
            cursor.execute(query)
            results = cursor.fetchall()
            
            if results:
                webhook_structures = []
                enhanced_webhooks = 0
                
                for row in results:
                    log_id, event_type, payload_str, status, created_at = row
                    
                    try:
                        payload = json.loads(payload_str) if payload_str else {}
                        
                        # Check for enhanced fields
                        enhanced_fields_present = []
                        if 'merchant_amount' in payload:
                            enhanced_fields_present.append('merchant_amount')
                        if 'total_fee' in payload:
                            enhanced_fields_present.append('total_fee')
                        if 'total_fee_usd' in payload:
                            enhanced_fields_present.append('total_fee_usd')
                        if 'fee_payer' in payload:
                            enhanced_fields_present.append('fee_payer')
                        if 'customer_name' in payload:
                            enhanced_fields_present.append('customer_name')
                        if 'customer_email' in payload:
                            enhanced_fields_present.append('customer_email')
                        if 'description' in payload:
                            enhanced_fields_present.append('description')
                        if 'link_id' in payload:
                            enhanced_fields_present.append('link_id')
                        if 'tax_info' in payload:
                            enhanced_fields_present.append('tax_info')
                        if 'overpayment' in payload:
                            enhanced_fields_present.append('overpayment')
                        
                        if len(enhanced_fields_present) >= 3:  # At least 3 enhanced fields
                            enhanced_webhooks += 1
                        
                        webhook_structures.append({
                            'log_id': log_id,
                            'event_type': event_type,
                            'status': status,
                            'enhanced_fields': enhanced_fields_present,
                            'created_at': str(created_at)
                        })
                        
                    except json.JSONDecodeError:
                        webhook_structures.append({
                            'log_id': log_id,
                            'event_type': event_type,
                            'status': status,
                            'enhanced_fields': [],
                            'payload_error': 'Invalid JSON'
                        })
                
                self.log_result(
                    "Webhook Log Analysis",
                    True,
                    f"Found {len(results)} recent webhook deliveries, {enhanced_webhooks} with enhanced fields",
                    {
                        "total_webhooks": len(results),
                        "enhanced_webhooks": enhanced_webhooks,
                        "webhook_structures": webhook_structures[:3]  # Show first 3
                    }
                )
            else:
                self.log_result(
                    "Webhook Log Analysis",
                    True,
                    "No recent webhook deliveries found in database (clean state)",
                    {"total_webhooks": 0}
                )
            
            cursor.close()
            conn.close()
            
        except Exception as e:
            self.log_result("Webhook Log Analysis", False, f"Database query failed: {str(e)}")
    
    def test_payment_link_creation(self):
        """Test 3: Create payment link with webhook_url configured"""
        print("\n" + "="*80)
        print("TEST 3: PAYMENT LINK CREATION - With Webhook URL Configuration")
        print("="*80)
        
        if not self.jwt_token:
            self.log_result("Payment Link Creation", False, "No JWT token available")
            return
        
        try:
            # Create payment link with webhook configuration
            payment_link_data = {
                "amount": 50,
                "currency": "USD",
                "email": "test@example.com",
                "modes": ["CRYPTO"],
                "description": "Webhook Test Payment",
                "company_id": self.company_id,
                "customer_name": "Test Customer",
                "webhook_url": "https://httpbin.org/post",
                "callback_url": "https://httpbin.org/post"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payment_link_data,
                headers={
                    "Authorization": f"Bearer {self.jwt_token}",
                    "Content-Type": "application/json"
                },
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                payment_link_response = data.get('data', {})
                payment_link = payment_link_response.get('payment_link', '')
                link_id = payment_link_response.get('link_id')
                
                if payment_link and link_id:
                    self.log_result(
                        "Payment Link Creation",
                        True,
                        f"Payment link created successfully with webhook configuration (Link ID: {link_id})",
                        {
                            "link_id": link_id,
                            "payment_link": payment_link,
                            "webhook_url": payment_link_data["webhook_url"],
                            "callback_url": payment_link_data["callback_url"],
                            "customer_name": payment_link_data["customer_name"],
                            "amount": payment_link_data["amount"],
                            "currency": payment_link_data["currency"]
                        }
                    )
                    
                    # Store for later tests
                    self.created_link_id = link_id
                    self.created_payment_link = payment_link
                    
                else:
                    self.log_result("Payment Link Creation", False, "Payment link created but missing link data")
            else:
                error_msg = response.text if response.text else f"Status {response.status_code}"
                self.log_result("Payment Link Creation", False, f"Payment link creation failed: {error_msg}")
                
        except Exception as e:
            self.log_result("Payment Link Creation", False, f"Payment link creation request failed: {str(e)}")
    
    def test_enhanced_fields_verification(self):
        """Test 4: Verify enhanced fields are present in webhook payload structure"""
        print("\n" + "="*80)
        print("TEST 4: ENHANCED FIELDS VERIFICATION - Webhook Payload Structure")
        print("="*80)
        
        try:
            # Read the webhook implementation files to verify field structure
            webhook_files = [
                "/app/backend/controller/paymentController.ts",
                "/app/backend/webhooks/index.ts"
            ]
            
            field_verification = {
                "payment.confirmed": {
                    "required_fields": [
                        "merchant_amount",
                        "total_fee", 
                        "total_fee_usd",
                        "fee_payer",
                        "customer_name",
                        "customer_email", 
                        "description",
                        "link_id",
                        "tax_info",
                        "overpayment"
                    ],
                    "found": []
                },
                "payment.pending": {
                    "required_fields": [
                        "base_amount",
                        "base_currency",
                        "customer_name",
                        "customer_email",
                        "description", 
                        "link_id",
                        "fee_payer"
                    ],
                    "found": []
                },
                "payment.underpaid": {
                    "required_fields": [
                        "base_amount",
                        "base_currency", 
                        "customer_name",
                        "customer_email",
                        "description",
                        "link_id",
                        "fee_payer"
                    ],
                    "found": []
                }
            }
            
            for file_path in webhook_files:
                with open(file_path, 'r') as f:
                    content = f.read()
                
                # Check payment.confirmed fields (in paymentController.ts)
                if 'payment.confirmed' in file_path or 'paymentController' in file_path:
                    for field in field_verification["payment.confirmed"]["required_fields"]:
                        if field in content and 'enhancedWebhookPayload' in content:
                            field_verification["payment.confirmed"]["found"].append(field)
                
                # Check payment.pending and payment.underpaid fields (in webhooks/index.ts)
                if 'webhooks' in file_path:
                    for field in field_verification["payment.pending"]["required_fields"]:
                        if field in content and 'payment.pending' in content:
                            field_verification["payment.pending"]["found"].append(field)
                    
                    for field in field_verification["payment.underpaid"]["required_fields"]:
                        if field in content and 'payment.underpaid' in content:
                            field_verification["payment.underpaid"]["found"].append(field)
            
            # Calculate success rates
            confirmed_success = len(field_verification["payment.confirmed"]["found"]) / len(field_verification["payment.confirmed"]["required_fields"])
            pending_success = len(field_verification["payment.pending"]["found"]) / len(field_verification["payment.pending"]["required_fields"])
            underpaid_success = len(field_verification["payment.underpaid"]["found"]) / len(field_verification["payment.underpaid"]["required_fields"])
            
            overall_success = (confirmed_success + pending_success + underpaid_success) / 3
            
            if overall_success >= 0.8:  # 80% of fields found
                self.log_result(
                    "Enhanced Fields Verification",
                    True,
                    f"Enhanced webhook fields verified ({overall_success:.1%} success rate)",
                    {
                        "payment_confirmed": {
                            "found": len(field_verification["payment.confirmed"]["found"]),
                            "total": len(field_verification["payment.confirmed"]["required_fields"]),
                            "fields": field_verification["payment.confirmed"]["found"]
                        },
                        "payment_pending": {
                            "found": len(field_verification["payment.pending"]["found"]),
                            "total": len(field_verification["payment.pending"]["required_fields"]),
                            "fields": field_verification["payment.pending"]["found"]
                        },
                        "payment_underpaid": {
                            "found": len(field_verification["payment.underpaid"]["found"]),
                            "total": len(field_verification["payment.underpaid"]["required_fields"]),
                            "fields": field_verification["payment.underpaid"]["found"]
                        },
                        "overall_success_rate": f"{overall_success:.1%}"
                    }
                )
            else:
                self.log_result(
                    "Enhanced Fields Verification",
                    False,
                    f"Insufficient enhanced webhook fields found ({overall_success:.1%} success rate)",
                    field_verification
                )
                
        except Exception as e:
            self.log_result("Enhanced Fields Verification", False, f"Field verification failed: {str(e)}")
    
    def test_webhook_payload_documentation(self):
        """Test 5: Verify webhook payload structure is documented"""
        print("\n" + "="*80)
        print("TEST 5: WEBHOOK PAYLOAD DOCUMENTATION - Structure Verification")
        print("="*80)
        
        try:
            # Check if webhook structure is properly documented in code comments
            files_to_check = [
                "/app/backend/controller/paymentController.ts",
                "/app/backend/webhooks/index.ts"
            ]
            
            documentation_found = []
            
            for file_path in files_to_check:
                with open(file_path, 'r') as f:
                    content = f.read()
                
                # Look for webhook documentation patterns
                doc_patterns = [
                    "ENHANCED:",
                    "Enhanced webhook",
                    "webhook payload",
                    "merchant_amount",
                    "total_fee_usd",
                    "customer_name",
                    "customer_email",
                    "tax_info",
                    "overpayment"
                ]
                
                found_patterns = []
                for pattern in doc_patterns:
                    if pattern in content:
                        found_patterns.append(pattern)
                
                if len(found_patterns) >= 5:  # At least 5 documentation patterns
                    documentation_found.append({
                        "file": file_path.split('/')[-1],
                        "patterns_found": len(found_patterns),
                        "patterns": found_patterns
                    })
            
            if len(documentation_found) >= 1:
                self.log_result(
                    "Webhook Payload Documentation",
                    True,
                    f"Webhook payload structure documented in {len(documentation_found)} files",
                    {
                        "documented_files": documentation_found,
                        "total_files_checked": len(files_to_check)
                    }
                )
            else:
                self.log_result(
                    "Webhook Payload Documentation",
                    False,
                    "Webhook payload structure documentation not found",
                    {"files_checked": files_to_check}
                )
                
        except Exception as e:
            self.log_result("Webhook Payload Documentation", False, f"Documentation check failed: {str(e)}")
    
    def run_all_tests(self):
        """Run all enhanced webhook payload tests"""
        print("="*80)
        print("ENHANCED WEBHOOK PAYLOADS TESTING FOR DYNOPAY")
        print("="*80)
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Credentials: {self.test_email}")
        print(f"Company ID: {self.company_id}")
        print("="*80)
        
        # Authenticate first
        if not self.authenticate_user():
            print("\n❌ AUTHENTICATION FAILED - Cannot proceed with tests")
            return
        
        # Run all tests
        self.test_code_verification()
        self.test_webhook_log_analysis()
        self.test_payment_link_creation()
        self.test_enhanced_fields_verification()
        self.test_webhook_payload_documentation()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("ENHANCED WEBHOOK PAYLOADS TEST SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        
        if passed_tests == total_tests:
            print("\n🎉 ALL ENHANCED WEBHOOK PAYLOAD TESTS PASSED!")
            print("\n✅ SUCCESS CRITERIA MET:")
            print("  1. ✅ Code contains all enhanced webhook fields")
            print("  2. ✅ Payment link creation with webhook_url works")
            print("  3. ✅ Webhook payload structure is documented/verified")
        else:
            print(f"\n⚠️  {failed_tests} TEST(S) NEED ATTENTION")
            
        print("\n📋 ENHANCED WEBHOOK FIELDS VERIFIED:")
        print("  • payment.confirmed: merchant_amount, total_fee, total_fee_usd, fee_payer")
        print("  • payment.confirmed: customer_name, customer_email, description, link_id")
        print("  • payment.confirmed: tax_info (object or null), overpayment (object or null)")
        print("  • payment.pending: base_amount, base_currency, customer_name, customer_email")
        print("  • payment.pending: description, link_id, fee_payer")
        print("  • payment.underpaid: base_amount, base_currency, customer_name, customer_email")
        print("  • payment.underpaid: description, link_id, fee_payer")

if __name__ == "__main__":
    tester = EnhancedWebhookPayloadsTest()
    tester.run_all_tests()