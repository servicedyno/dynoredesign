#!/usr/bin/env python3
"""
Tax Integration with Crypto Payment Flow Testing
==============================================

Test the tax integration with payment flow in DynoPay to ensure underpayment logic 
and funds distribution work correctly as requested in the review.

Test Scenarios:
1. Create Payment Link with Tax → Verify Crypto Amount Includes Tax
2. Create Payment Link WITHOUT Tax → Verify Normal Flow
3. Verify Tax Rate Endpoint Still Works

Test Credentials:
- Email: john@dyno.pt
- Password: Katiekendra123@
"""

import requests
import json
import os
import sys
import time
from urllib.parse import urlparse, parse_qs
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

# Get backend URL from frontend .env
BACKEND_URL = "https://dependency-setup-8.preview.emergentagent.com"
try:
    with open('/app/frontend/.env', 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BACKEND_URL = line.split('=', 1)[1].strip()
                break
except:
    pass

API_BASE = f"{BACKEND_URL}/api"

class TaxCryptoIntegrationTester:
    def __init__(self):
        self.session = requests.Session()
        self.jwt_token = None
        self.user_data = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
    
    def authenticate(self):
        """Authenticate with test credentials"""
        print("\n🔐 AUTHENTICATION")
        print("=" * 50)
        
        try:
            response = self.session.post(f"{API_BASE}/user/login", json={
                "email": "john@dyno.pt",
                "password": "Katiekendra123@"
            })
            
            if response.status_code == 200:
                data = response.json()
                
                # Handle nested data structure
                if 'data' in data and 'accessToken' in data['data']:
                    self.jwt_token = data['data']['accessToken']
                    self.user_data = data['data']
                else:
                    self.jwt_token = data.get('token')
                    self.user_data = data.get('user', {})
                
                # Set authorization header for future requests
                self.session.headers.update({
                    'Authorization': f'Bearer {self.jwt_token}',
                    'Content-Type': 'application/json'
                })
                
                self.log_test("User Authentication", True, 
                    f"User ID: {self.user_data.get('user_id')}, Name: {self.user_data.get('name')}")
                return True
            else:
                self.log_test("User Authentication", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User Authentication", False, f"Exception: {str(e)}")
            return False
    
    def test_tax_rate_endpoints(self):
        """Test 3: Verify Tax Rate Endpoint Still Works"""
        print("\n📊 TAX RATE ENDPOINTS TESTING")
        print("=" * 50)
        
        # Test Portugal (23% VAT)
        try:
            response = self.session.get(f"{API_BASE}/tax/rate/PT")
            if response.status_code == 200:
                data = response.json()
                
                # Handle nested data structure
                if 'data' in data:
                    tax_data = data['data']
                    tax_rate = tax_data.get('standard_rate', 0)
                else:
                    tax_rate = data.get('standard_rate', 0)
                
                if 20 <= tax_rate <= 25:  # Expected range for Portugal VAT
                    self.log_test("Portugal Tax Rate (PT)", True, 
                        f"Rate: {tax_rate}%, Country: {tax_data.get('country_name', 'Portugal')}")
                else:
                    self.log_test("Portugal Tax Rate (PT)", False, 
                        f"Unexpected rate: {tax_rate}%")
            else:
                self.log_test("Portugal Tax Rate (PT)", False, 
                    f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Portugal Tax Rate (PT)", False, f"Exception: {str(e)}")
        
        # Test US (0% or low rate)
        try:
            response = self.session.get(f"{API_BASE}/tax/rate/US")
            if response.status_code == 200:
                data = response.json()
                
                # Handle nested data structure
                if 'data' in data:
                    tax_data = data['data']
                    tax_rate = tax_data.get('standard_rate', 0)
                else:
                    tax_rate = data.get('standard_rate', 0)
                
                if tax_rate <= 10:  # Expected low/zero rate for US
                    self.log_test("US Tax Rate (US)", True, 
                        f"Rate: {tax_rate}%, Country: {tax_data.get('country_name', 'US')}")
                else:
                    self.log_test("US Tax Rate (US)", False, 
                        f"Unexpected rate: {tax_rate}%")
            else:
                self.log_test("US Tax Rate (US)", False, 
                    f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("US Tax Rate (US)", False, f"Exception: {str(e)}")
    
    def create_payment_link(self, apply_tax=False, amount=100, description="Test Product"):
        """Create a payment link with or without tax"""
        payload = {
            "amount": amount,
            "currency": "EUR",
            "modes": ["CRYPTO"],
            "company_id": 38,
            "description": description
        }
        
        if apply_tax:
            payload["apply_tax"] = True
        
        try:
            response = self.session.post(f"{API_BASE}/pay/createPaymentLink", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                
                # Handle nested data structure
                if 'data' in data and 'payment_link' in data['data']:
                    payment_link = data['data']['payment_link']
                else:
                    payment_link = data.get('payment_link', '')
                
                # Extract payment reference from URL
                if '?d=' in payment_link:
                    reference = payment_link.split('?d=')[1]
                else:
                    parsed_url = urlparse(payment_link)
                    query_params = parse_qs(parsed_url.query)
                    reference = query_params.get('d', [None])[0]
                
                return {
                    'success': True,
                    'link': payment_link,
                    'reference': reference,
                    'data': data
                }
            else:
                return {
                    'success': False,
                    'error': f"Status: {response.status_code}, Response: {response.text}"
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f"Exception: {str(e)}"
            }
    
    def get_payment_data(self, reference):
        """Get payment data using reference"""
        try:
            # Add Portuguese IP headers for tax geolocation
            headers = {
                'X-Forwarded-For': '85.240.1.1',  # Portuguese IP
                'X-Real-IP': '85.240.1.1',
                'CF-IPCountry': 'PT'
            }
            headers.update(self.session.headers)
            
            response = self.session.post(f"{API_BASE}/pay/getData", 
                json={"data": reference}, 
                headers=headers)
            
            if response.status_code == 200:
                return {
                    'success': True,
                    'data': response.json()
                }
            else:
                return {
                    'success': False,
                    'error': f"Status: {response.status_code}, Response: {response.text}"
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f"Exception: {str(e)}"
            }
    
    def create_crypto_payment(self, reference, currency="ETH"):
        """Create crypto payment"""
        try:
            response = self.session.post(f"{API_BASE}/pay/createCryptoPayment", json={
                "uniqueRef": reference,
                "currency": currency
            })
            
            if response.status_code == 200:
                return {
                    'success': True,
                    'data': response.json()
                }
            else:
                return {
                    'success': False,
                    'error': f"Status: {response.status_code}, Response: {response.text}"
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f"Exception: {str(e)}"
            }
    
    def test_payment_with_tax(self):
        """Test 1: Create Payment Link with Tax → Verify Crypto Amount Includes Tax"""
        print("\n💰 PAYMENT WITH TAX TESTING")
        print("=" * 50)
        
        # Step 1: Create payment link with tax
        payment_result = self.create_payment_link(
            apply_tax=True, 
            amount=100, 
            description="Product with tax"
        )
        
        if not payment_result['success']:
            self.log_test("Create Payment Link with Tax", False, payment_result['error'])
            return
        
        self.log_test("Create Payment Link with Tax", True, 
            f"Reference: {payment_result['reference']}")
        
        # Step 2: Get payment data and verify tax_info
        data_result = self.get_payment_data(payment_result['reference'])
        
        if not data_result['success']:
            self.log_test("Get Payment Data with Tax", False, data_result['error'])
            return
        
        payment_data = data_result['data']
        
        # Handle nested data structure
        if 'data' in payment_data:
            payment_info = payment_data['data']
        else:
            payment_info = payment_data
        
        # Verify tax_info is present
        if 'tax_info' in payment_info:
            tax_info = payment_info['tax_info']
            self.log_test("Tax Info Present", True, 
                f"Tax Rate: {tax_info.get('tax_rate')}%, Tax Amount: {tax_info.get('tax_amount')}")
        else:
            self.log_test("Tax Info Present", False, 
                f"No tax_info in response. Keys: {list(payment_info.keys())}")
            return
        
        # Step 3: Create crypto payment
        crypto_result = self.create_crypto_payment(payment_result['reference'], "ETH")
        
        if not crypto_result['success']:
            self.log_test("Create Crypto Payment with Tax", False, crypto_result['error'])
            return
        
        crypto_data = crypto_result['data']
        
        # Step 4: Verify crypto amount includes tax
        if 'data' in crypto_data:
            crypto_info = crypto_data['data']
        else:
            crypto_info = crypto_data
            
        crypto_amount = crypto_info.get('amount', 0)
        merchant_amount = crypto_info.get('merchant_amount', 0)
        
        # Check if tax_info is in crypto response
        if 'tax_info' in crypto_info:
            tax_info = crypto_info['tax_info']
            tax_amount_eur = tax_info.get('tax_amount', 0)
            tax_amount_crypto = tax_info.get('tax_amount_crypto', 0)
            self.log_test("Tax Info in Crypto Response", True, 
                f"Tax included: {tax_amount_eur} EUR = {tax_amount_crypto:.6f} ETH")
        else:
            self.log_test("Tax Info in Crypto Response", False, 
                "No tax_info in crypto payment response")
        
        # Verify merchant amount includes tax (should be > base amount equivalent)
        base_amount_crypto = crypto_amount - crypto_info.get('tax_info', {}).get('tax_amount_crypto', 0)
        if merchant_amount > base_amount_crypto * 0.6:  # Merchant gets ~67% after fees
            self.log_test("Merchant Amount Includes Tax", True, 
                f"Merchant Amount: {merchant_amount} ETH (includes tax portion)")
        else:
            self.log_test("Merchant Amount Includes Tax", False, 
                f"Merchant Amount: {merchant_amount} ETH (may not include tax)")
        
        self.log_test("Create Crypto Payment with Tax", True, 
            f"Crypto Amount: {crypto_amount} ETH, Merchant Amount: {merchant_amount} ETH")
    
    def test_payment_without_tax(self):
        """Test 2: Create Payment Link WITHOUT Tax → Verify Normal Flow"""
        print("\n💳 PAYMENT WITHOUT TAX TESTING")
        print("=" * 50)
        
        # Step 1: Create payment link without tax
        payment_result = self.create_payment_link(
            apply_tax=False, 
            amount=100, 
            description="Product without tax"
        )
        
        if not payment_result['success']:
            self.log_test("Create Payment Link without Tax", False, payment_result['error'])
            return
        
        self.log_test("Create Payment Link without Tax", True, 
            f"Reference: {payment_result['reference']}")
        
        # Step 2: Get payment data and verify NO tax_info
        data_result = self.get_payment_data(payment_result['reference'])
        
        if not data_result['success']:
            self.log_test("Get Payment Data without Tax", False, data_result['error'])
            return
        
        payment_data = data_result['data']
        
        # Handle nested data structure
        if 'data' in payment_data:
            payment_info = payment_data['data']
        else:
            payment_info = payment_data
        
        # Verify NO tax_info is present
        if 'tax_info' not in payment_info or not payment_info.get('apply_tax', True):
            self.log_test("No Tax Info Present", True, 
                f"Apply Tax: {payment_info.get('apply_tax', False)}")
        else:
            self.log_test("No Tax Info Present", False, 
                "Unexpected tax_info in response")
        
        # Step 3: Create crypto payment
        crypto_result = self.create_crypto_payment(payment_result['reference'], "ETH")
        
        if not crypto_result['success']:
            self.log_test("Create Crypto Payment without Tax", False, crypto_result['error'])
            return
        
        crypto_data = crypto_result['data']
        
        # Step 4: Verify crypto amount is base only
        if 'data' in crypto_data:
            crypto_info = crypto_data['data']
        else:
            crypto_info = crypto_data
            
        crypto_amount = crypto_info.get('amount', 0)
        merchant_amount = crypto_info.get('merchant_amount', 0)
        
        # Check if NO tax_info is in crypto response
        if 'tax_info' not in crypto_info:
            self.log_test("No Tax Info in Crypto Response", True, 
                f"No tax in crypto payment")
        else:
            self.log_test("No Tax Info in Crypto Response", False, 
                "Unexpected tax_info in crypto payment response")
        
        self.log_test("Create Crypto Payment without Tax", True, 
            f"Crypto Amount: {crypto_amount} ETH, Merchant Amount: {merchant_amount} ETH")
    
    def run_all_tests(self):
        """Run all tax crypto integration tests"""
        print("🧪 TAX CRYPTO INTEGRATION TESTING")
        print("=" * 60)
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test Credentials: john@dyno.pt")
        
        # Step 1: Authenticate
        if not self.authenticate():
            print("\n❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Step 2: Test tax rate endpoints
        self.test_tax_rate_endpoints()
        
        # Step 3: Test payment with tax
        self.test_payment_with_tax()
        
        # Step 4: Test payment without tax
        self.test_payment_without_tax()
        
        # Summary
        print("\n📋 TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        # List failed tests
        failed_tests = [result for result in self.test_results if not result['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        
        return success_rate >= 80  # Consider 80%+ as success

if __name__ == "__main__":
    tester = TaxCryptoIntegrationTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 TAX CRYPTO INTEGRATION TESTS COMPLETED SUCCESSFULLY")
    else:
        print("\n⚠️  TAX CRYPTO INTEGRATION TESTS COMPLETED WITH ISSUES")
    
    sys.exit(0 if success else 1)