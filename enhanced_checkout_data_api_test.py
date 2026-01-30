#!/usr/bin/env python3
"""
Enhanced Checkout Data API Test - POST /api/pay/getData
Tests the enhanced checkout data API endpoint with comprehensive field verification
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any
from urllib.parse import urlparse, parse_qs

class EnhancedCheckoutDataAPITester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.payment_reference = None
        
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
        """Authenticate with provided credentials: john@dyno.pt / Katiekendra123@"""
        print("\n=== Step 1: Authentication ===")
        
        credentials = {
            "email": "john@dyno.pt",
            "password": "Katiekendra123@"
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json=credentials,
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
                            "name": user_info.get('name'),
                            "email": credentials["email"],
                            "has_token": bool(self.jwt_token)
                        }
                    )
                    return True
                else:
                    self.log_result(
                        "User Authentication", 
                        False, 
                        "Login succeeded but no access token received",
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
                f"Authentication request failed: {str(e)}"
            )
        
        return False
    
    def create_payment_link(self):
        """Create payment link with specified parameters"""
        print("\n=== Step 2: Create Payment Link ===")
        
        if not self.jwt_token:
            self.log_result(
                "Payment Link Creation", 
                False, 
                "No JWT token available for authentication"
            )
            return False
        
        payment_data = {
            "amount": 50,
            "currency": "USD",
            "email": "test@example.com",
            "modes": ["CRYPTO"],
            "description": "Monthly Digital Art Subscription",
            "expire": "7d",
            "fee_payer": "customer",
            "company_id": 38
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
                    
                    # Extract the 'd' parameter from the payment link URL
                    parsed_url = urlparse(payment_link)
                    query_params = parse_qs(parsed_url.query)
                    
                    if 'd' in query_params:
                        self.payment_reference = query_params['d'][0]
                        
                        self.log_result(
                            "Payment Link Creation", 
                            True, 
                            f"Payment link created successfully",
                            {
                                "payment_link": payment_link,
                                "reference": self.payment_reference,
                                "transaction_id": data['data'].get('transaction_id'),
                                "amount": payment_data["amount"],
                                "currency": payment_data["currency"],
                                "description": payment_data["description"]
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Payment Link Creation", 
                            False, 
                            "Payment link created but no 'd' parameter found in URL",
                            {"payment_link": payment_link, "parsed_query": query_params}
                        )
                else:
                    self.log_result(
                        "Payment Link Creation", 
                        False, 
                        "Payment link creation succeeded but no payment_link in response",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Payment Link Creation", 
                    False, 
                    f"Payment link creation failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Payment Link Creation", 
                False, 
                f"Payment link creation request failed: {str(e)}"
            )
        
        return False
    
    def test_enhanced_checkout_data_api(self):
        """Test POST /api/pay/getData with comprehensive field verification"""
        print("\n=== Step 3: Test Enhanced Checkout Data API ===")
        
        if not self.payment_reference:
            self.log_result(
                "Enhanced Checkout Data API", 
                False, 
                "No payment reference available for testing"
            )
            return False
        
        request_data = {
            "data": self.payment_reference
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/pay/getData",
                json=request_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    checkout_data = data['data']
                    
                    # Test all required fields
                    self.verify_basic_fields(checkout_data)
                    self.verify_merchant_info(checkout_data)
                    self.verify_fee_info(checkout_data)
                    self.verify_order_reference(checkout_data)
                    self.verify_expiry_info(checkout_data)
                    self.verify_description_field(checkout_data)
                    self.verify_transaction_id(checkout_data)
                    
                    return True
                else:
                    self.log_result(
                        "Enhanced Checkout Data API", 
                        False, 
                        "API response missing 'data' field",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Enhanced Checkout Data API", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Enhanced Checkout Data API", 
                False, 
                f"API request failed: {str(e)}"
            )
        
        return False
    
    def verify_basic_fields(self, checkout_data: Dict):
        """Verify basic fields: amount, base_currency, token, payment_mode, allowedModes, fee_payer"""
        print("\n--- Verifying Basic Fields ---")
        
        expected_basic_fields = {
            'amount': 50,
            'base_currency': 'USD',
            'payment_mode': 'createLink',
            'allowedModes': 'CRYPTO',
            'fee_payer': 'customer'
        }
        
        missing_fields = []
        incorrect_values = []
        
        for field, expected_value in expected_basic_fields.items():
            if field not in checkout_data:
                missing_fields.append(field)
            elif checkout_data[field] != expected_value:
                incorrect_values.append({
                    'field': field,
                    'expected': expected_value,
                    'actual': checkout_data[field]
                })
        
        # Check for token field (should exist but value can vary)
        if 'token' not in checkout_data:
            missing_fields.append('token')
        
        if missing_fields:
            self.log_result(
                "Basic Fields - Missing", 
                False, 
                f"Missing required basic fields: {', '.join(missing_fields)}",
                {"missing_fields": missing_fields}
            )
        elif incorrect_values:
            self.log_result(
                "Basic Fields - Values", 
                False, 
                f"Incorrect field values found",
                {"incorrect_values": incorrect_values}
            )
        else:
            self.log_result(
                "Basic Fields", 
                True, 
                "All basic fields present with correct values",
                {
                    "amount": checkout_data.get('amount'),
                    "base_currency": checkout_data.get('base_currency'),
                    "payment_mode": checkout_data.get('payment_mode'),
                    "allowedModes": checkout_data.get('allowedModes'),
                    "fee_payer": checkout_data.get('fee_payer'),
                    "has_token": 'token' in checkout_data
                }
            )
    
    def verify_merchant_info(self, checkout_data: Dict):
        """Verify merchant object with company_name and company_logo"""
        print("\n--- Verifying Merchant Info ---")
        
        if 'merchant' not in checkout_data:
            self.log_result(
                "Merchant Info", 
                False, 
                "Missing merchant object in response"
            )
            return
        
        merchant = checkout_data['merchant']
        
        # Check company_name (should be "Johnnys LDA" for company_id 38)
        if 'company_name' not in merchant:
            self.log_result(
                "Merchant Info - Company Name", 
                False, 
                "Missing company_name in merchant object"
            )
        elif merchant['company_name'] != "Johnnys LDA":
            self.log_result(
                "Merchant Info - Company Name", 
                False, 
                f"Expected company_name 'Johnnys LDA', got '{merchant['company_name']}'",
                {"expected": "Johnnys LDA", "actual": merchant['company_name']}
            )
        else:
            self.log_result(
                "Merchant Info - Company Name", 
                True, 
                f"Company name correct: {merchant['company_name']}"
            )
        
        # Check company_logo (may be null)
        if 'company_logo' not in merchant:
            self.log_result(
                "Merchant Info - Company Logo", 
                False, 
                "Missing company_logo field in merchant object"
            )
        else:
            logo_value = merchant['company_logo']
            self.log_result(
                "Merchant Info - Company Logo", 
                True, 
                f"Company logo field present: {logo_value if logo_value else 'null'}",
                {"company_logo": logo_value}
            )
    
    def verify_fee_info(self, checkout_data: Dict):
        """Verify fee_info object with all required fields"""
        print("\n--- Verifying Fee Info ---")
        
        if 'fee_info' not in checkout_data:
            self.log_result(
                "Fee Info", 
                False, 
                "Missing fee_info object in response"
            )
            return
        
        fee_info = checkout_data['fee_info']
        
        # Expected values based on $50 amount and tier $5-$100
        expected_fee_info = {
            'fee_payer': 'customer',
            'fee_percent': 2.0,
            'fixed_fee': 3,
            'fee_display': '2% + $3.00'
        }
        
        # Verify basic fee info fields
        fee_errors = []
        for field, expected_value in expected_fee_info.items():
            if field not in fee_info:
                fee_errors.append(f"Missing {field}")
            elif fee_info[field] != expected_value:
                fee_errors.append(f"{field}: expected {expected_value}, got {fee_info[field]}")
        
        if fee_errors:
            self.log_result(
                "Fee Info - Basic Fields", 
                False, 
                f"Fee info errors: {'; '.join(fee_errors)}",
                {"fee_info": fee_info, "expected": expected_fee_info}
            )
        else:
            self.log_result(
                "Fee Info - Basic Fields", 
                True, 
                "All basic fee info fields correct",
                {
                    "fee_percent": fee_info.get('fee_percent'),
                    "fixed_fee": fee_info.get('fixed_fee'),
                    "fee_display": fee_info.get('fee_display')
                }
            )
        
        # Verify fee_breakdown (since fee_payer is "customer")
        if 'fee_breakdown' not in fee_info:
            self.log_result(
                "Fee Info - Breakdown", 
                False, 
                "Missing fee_breakdown object"
            )
        else:
            breakdown = fee_info['fee_breakdown']
            expected_breakdown = {
                'base_amount': 50,
                'percentage_fee': 1,  # 2% of $50 = $1
                'fixed_fee': 3,
                'total_fee': 4,  # $1 + $3 = $4
                'total_amount': 54  # $50 + $4 = $54
            }
            
            breakdown_errors = []
            for field, expected_value in expected_breakdown.items():
                if field not in breakdown:
                    breakdown_errors.append(f"Missing {field}")
                elif breakdown[field] != expected_value:
                    breakdown_errors.append(f"{field}: expected {expected_value}, got {breakdown[field]}")
            
            if breakdown_errors:
                self.log_result(
                    "Fee Info - Breakdown", 
                    False, 
                    f"Fee breakdown errors: {'; '.join(breakdown_errors)}",
                    {"fee_breakdown": breakdown, "expected": expected_breakdown}
                )
            else:
                self.log_result(
                    "Fee Info - Breakdown", 
                    True, 
                    "Fee breakdown calculation correct",
                    {
                        "base_amount": breakdown.get('base_amount'),
                        "total_fee": breakdown.get('total_fee'),
                        "total_amount": breakdown.get('total_amount')
                    }
                )
    
    def verify_order_reference(self, checkout_data: Dict):
        """Verify order_reference field (format: INV-2026-xxx)"""
        print("\n--- Verifying Order Reference ---")
        
        if 'order_reference' not in checkout_data:
            self.log_result(
                "Order Reference", 
                False, 
                "Missing order_reference field"
            )
            return
        
        order_ref = checkout_data['order_reference']
        
        # Check format: INV-2026-xxx
        if order_ref.startswith('INV-2026-'):
            self.log_result(
                "Order Reference", 
                True, 
                f"Order reference format correct: {order_ref}"
            )
        else:
            self.log_result(
                "Order Reference", 
                False, 
                f"Order reference format incorrect. Expected 'INV-2026-xxx', got '{order_ref}'"
            )
    
    def verify_expiry_info(self, checkout_data: Dict):
        """Verify expiry object with expires_at, is_expired, countdown"""
        print("\n--- Verifying Expiry Info ---")
        
        if 'expiry' not in checkout_data:
            self.log_result(
                "Expiry Info", 
                False, 
                "Missing expiry object in response"
            )
            return
        
        expiry = checkout_data['expiry']
        
        # Check required fields
        required_expiry_fields = ['expires_at', 'is_expired', 'countdown']
        missing_fields = [field for field in required_expiry_fields if field not in expiry]
        
        if missing_fields:
            self.log_result(
                "Expiry Info - Structure", 
                False, 
                f"Missing expiry fields: {', '.join(missing_fields)}",
                {"expiry": expiry}
            )
            return
        
        # Verify is_expired should be false for new payment
        if expiry['is_expired'] != False:
            self.log_result(
                "Expiry Info - Status", 
                False, 
                f"Expected is_expired to be false, got {expiry['is_expired']}"
            )
        else:
            self.log_result(
                "Expiry Info - Status", 
                True, 
                "Expiry status correct (not expired)"
            )
        
        # Verify countdown object
        if 'countdown' not in expiry:
            self.log_result(
                "Expiry Info - Countdown", 
                False, 
                "Missing countdown object"
            )
        else:
            countdown = expiry['countdown']
            required_countdown_fields = ['days', 'hours', 'minutes', 'seconds', 'formatted']
            missing_countdown_fields = [field for field in required_countdown_fields if field not in countdown]
            
            if missing_countdown_fields:
                self.log_result(
                    "Expiry Info - Countdown Structure", 
                    False, 
                    f"Missing countdown fields: {', '.join(missing_countdown_fields)}",
                    {"countdown": countdown}
                )
            else:
                # For 7d expiry, days should be around 6-7
                days = countdown.get('days', 0)
                if 6 <= days <= 7:
                    self.log_result(
                        "Expiry Info - Countdown", 
                        True, 
                        f"Countdown values correct for 7d expiry",
                        {
                            "days": days,
                            "hours": countdown.get('hours'),
                            "formatted": countdown.get('formatted')
                        }
                    )
                else:
                    self.log_result(
                        "Expiry Info - Countdown", 
                        False, 
                        f"Expected ~6-7 days for 7d expiry, got {days} days",
                        {"countdown": countdown}
                    )
    
    def verify_description_field(self, checkout_data: Dict):
        """Verify description field matches expected value"""
        print("\n--- Verifying Description Field ---")
        
        expected_description = "Monthly Digital Art Subscription"
        
        if 'description' not in checkout_data:
            self.log_result(
                "Description Field", 
                False, 
                "Missing description field"
            )
        elif checkout_data['description'] != expected_description:
            self.log_result(
                "Description Field", 
                False, 
                f"Description mismatch. Expected '{expected_description}', got '{checkout_data['description']}'",
                {"expected": expected_description, "actual": checkout_data['description']}
            )
        else:
            self.log_result(
                "Description Field", 
                True, 
                f"Description correct: {checkout_data['description']}"
            )
    
    def verify_transaction_id(self, checkout_data: Dict):
        """Verify transaction_id field (UUID format)"""
        print("\n--- Verifying Transaction ID ---")
        
        if 'transaction_id' not in checkout_data:
            self.log_result(
                "Transaction ID", 
                False, 
                "Missing transaction_id field"
            )
            return
        
        transaction_id = checkout_data['transaction_id']
        
        # Basic UUID format check (8-4-4-4-12 characters with hyphens)
        import re
        uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        
        if re.match(uuid_pattern, transaction_id, re.IGNORECASE):
            self.log_result(
                "Transaction ID", 
                True, 
                f"Transaction ID format correct (UUID): {transaction_id}"
            )
        else:
            self.log_result(
                "Transaction ID", 
                False, 
                f"Transaction ID format incorrect. Expected UUID format, got: {transaction_id}"
            )
    
    def run_comprehensive_test(self):
        """Run the complete test suite"""
        print("🚀 Starting Enhanced Checkout Data API Test")
        print("=" * 60)
        
        # Step 1: Authenticate
        if not self.authenticate_user():
            print("\n❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Step 2: Create payment link
        if not self.create_payment_link():
            print("\n❌ Payment link creation failed. Cannot proceed with API test.")
            return False
        
        # Step 3: Test enhanced checkout data API
        if not self.test_enhanced_checkout_data_api():
            print("\n❌ Enhanced checkout data API test failed.")
            return False
        
        # Summary
        self.print_test_summary()
        return len(self.errors) == 0
    
    def print_test_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if self.errors:
            print(f"\n🔍 FAILED TESTS:")
            for error in self.errors:
                print(f"  • {error}")
        else:
            print(f"\n🎉 ALL TESTS PASSED!")
        
        print("\n" + "=" * 60)

def main():
    """Main function to run the test"""
    tester = EnhancedCheckoutDataAPITester()
    success = tester.run_comprehensive_test()
    
    if success:
        print("✅ Enhanced Checkout Data API test completed successfully!")
        sys.exit(0)
    else:
        print("❌ Enhanced Checkout Data API test completed with failures!")
        sys.exit(1)

if __name__ == "__main__":
    main()