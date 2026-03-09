#!/usr/bin/env python3
"""
DynoPay Backend Testing - Payment Link Creation with Merchant Pool Address

This test script verifies:
1. User login functionality
2. BTC-only payment link creation with direct_pay_address (pool address)
3. Multi-currency payment link creation without direct_pay fields
4. Checkout flow using pool address
5. Proper address validation (should be bc1q... format, not 1JH5...)

Test Requirements:
- Backend URL: https://a21adebb-de1d-4a59-a169-5bf700b7e9d8.preview.emergentagent.com
- Login credentials: nomadly@moxx.co / Katiekendra123@
- Company ID: 3
"""

import requests
import json
import sys
import re
from datetime import datetime
from typing import Dict, Any, Optional


class DynoPayTester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.access_token = None
        self.test_results = []
        
    def log_test(self, test_name: str, status: str, details: str = ""):
        """Log test result"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        result = {
            'test': test_name,
            'status': status,
            'details': details,
            'timestamp': timestamp
        }
        self.test_results.append(result)
        
        # Color coding for terminal output
        color = '\033[92m' if status == 'PASS' else '\033[91m' if status == 'FAIL' else '\033[93m'
        reset = '\033[0m'
        print(f"{color}[{timestamp}] {test_name}: {status}{reset}")
        if details:
            print(f"  → {details}")
            
    def login(self, email: str, password: str) -> bool:
        """Login and extract access token"""
        try:
            url = f"{self.base_url}/api/user/login"
            payload = {
                "email": email,
                "password": password
            }
            
            response = self.session.post(url, json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    self.access_token = data['data']['accessToken']
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.access_token}'
                    })
                    self.log_test("Login", "PASS", f"Successfully logged in as {email}")
                    return True
                else:
                    self.log_test("Login", "FAIL", f"No access token in response: {data}")
                    return False
            else:
                self.log_test("Login", "FAIL", f"Login failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Login", "FAIL", f"Login exception: {str(e)}")
            return False
            
    def create_btc_only_payment_link(self) -> Optional[Dict[str, Any]]:
        """Create BTC-only payment link and verify direct_pay_address"""
        try:
            url = f"{self.base_url}/api/pay/createPaymentLink"
            payload = {
                "base_amount": 20,
                "base_currency": "USD",
                "modes": ["CRYPTO"],
                "accepted_currencies": ["BTC"],
                "company_id": 3,
                "fee_payer": "company",
                "description": "Test pool address"
            }
            
            response = self.session.post(url, json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    payment_data = data['data']
                    
                    # Check for required fields
                    required_fields = ['direct_pay_address', 'direct_pay_qr_code', 'direct_pay_temp_id', 'payment_link']
                    missing_fields = [field for field in required_fields if field not in payment_data]
                    
                    if missing_fields:
                        self.log_test("BTC Payment Link Creation", "FAIL", 
                                    f"Missing required fields: {missing_fields}")
                        return None
                    
                    # Validate direct_pay_address format
                    direct_address = payment_data['direct_pay_address']
                    if not direct_address.startswith('bc1q'):
                        self.log_test("BTC Payment Link Creation", "FAIL", 
                                    f"direct_pay_address should be bc1q... format, got: {direct_address}")
                        return None
                    
                    # Ensure it's NOT the merchant's direct wallet
                    if direct_address == "1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7":
                        self.log_test("BTC Payment Link Creation", "FAIL", 
                                    f"direct_pay_address is merchant's wallet, not pool address: {direct_address}")
                        return None
                    
                    # Validate QR code format
                    qr_code = payment_data['direct_pay_qr_code']
                    if not qr_code.startswith('data:image/png;base64,'):
                        self.log_test("BTC Payment Link Creation", "FAIL", 
                                    f"QR code should be PNG base64 data URL, got: {qr_code[:50]}...")
                        return None
                    
                    # Validate temp_id is numeric
                    temp_id = payment_data['direct_pay_temp_id']
                    if not isinstance(temp_id, int):
                        self.log_test("BTC Payment Link Creation", "FAIL", 
                                    f"direct_pay_temp_id should be number, got: {temp_id}")
                        return None
                    
                    self.log_test("BTC Payment Link Creation", "PASS", 
                                f"Pool address: {direct_address}, temp_id: {temp_id}")
                    return payment_data
                else:
                    self.log_test("BTC Payment Link Creation", "FAIL", f"No data in response: {data}")
                    return None
            else:
                self.log_test("BTC Payment Link Creation", "FAIL", 
                            f"Request failed with status {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("BTC Payment Link Creation", "FAIL", f"Exception: {str(e)}")
            return None
            
    def create_multi_currency_payment_link(self) -> Optional[Dict[str, Any]]:
        """Create multi-currency payment link and verify NO direct_pay fields"""
        try:
            url = f"{self.base_url}/api/pay/createPaymentLink"
            payload = {
                "base_amount": 25,
                "base_currency": "USD",
                "modes": ["CRYPTO"],
                "accepted_currencies": ["BTC", "ETH"],
                "company_id": 3,
                "fee_payer": "company",
                "description": "Test multi-currency"
            }
            
            response = self.session.post(url, json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    payment_data = data['data']
                    
                    # Check that direct_pay fields are NOT present
                    direct_pay_fields = ['direct_pay_address', 'direct_pay_qr_code', 'direct_pay_temp_id']
                    present_fields = [field for field in direct_pay_fields if field in payment_data]
                    
                    if present_fields:
                        self.log_test("Multi-Currency Payment Link Creation", "FAIL", 
                                    f"direct_pay fields should not be present for multi-currency, found: {present_fields}")
                        return None
                    
                    # Verify payment_link and accepted_currencies are present
                    if 'payment_link' not in payment_data:
                        self.log_test("Multi-Currency Payment Link Creation", "FAIL", 
                                    "payment_link field missing")
                        return None
                    
                    if 'accepted_currencies' not in payment_data:
                        self.log_test("Multi-Currency Payment Link Creation", "FAIL", 
                                    "accepted_currencies field missing")
                        return None
                    
                    accepted_currencies = payment_data['accepted_currencies']
                    if not isinstance(accepted_currencies, list) or len(accepted_currencies) != 2:
                        self.log_test("Multi-Currency Payment Link Creation", "FAIL", 
                                    f"accepted_currencies should be array of 2 items, got: {accepted_currencies}")
                        return None
                    
                    self.log_test("Multi-Currency Payment Link Creation", "PASS", 
                                f"No direct_pay fields (correct), accepted_currencies: {accepted_currencies}")
                    return payment_data
                else:
                    self.log_test("Multi-Currency Payment Link Creation", "FAIL", f"No data in response: {data}")
                    return None
            else:
                self.log_test("Multi-Currency Payment Link Creation", "FAIL", 
                            f"Request failed with status {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Multi-Currency Payment Link Creation", "FAIL", f"Exception: {str(e)}")
            return None
            
    def test_checkout_flow(self, payment_link: str) -> bool:
        """Test checkout flow using getData endpoint"""
        try:
            # Extract reference from payment_link URL
            if 'd=' not in payment_link:
                self.log_test("Checkout Flow", "FAIL", "No 'd=' parameter in payment_link")
                return False
            
            ref = payment_link.split('d=')[1].split('&')[0]  # Handle potential additional params
            
            url = f"{self.base_url}/api/pay/getData"
            payload = {"data": ref}
            
            response = self.session.post(url, json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data and 'token' in data['data']:
                    checkout_data = data['data']
                    
                    # Basic validation of checkout response
                    required_fields = ['amount', 'base_currency', 'token', 'payment_mode']
                    missing_fields = [field for field in required_fields if field not in checkout_data]
                    
                    if missing_fields:
                        self.log_test("Checkout Flow", "FAIL", 
                                    f"Missing required checkout fields: {missing_fields}")
                        return False
                    
                    self.log_test("Checkout Flow", "PASS", 
                                f"Checkout token received, amount: {checkout_data['amount']} {checkout_data['base_currency']}")
                    return True
                else:
                    self.log_test("Checkout Flow", "FAIL", f"No checkout token in response: {data}")
                    return False
            else:
                self.log_test("Checkout Flow", "FAIL", 
                            f"Request failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Checkout Flow", "FAIL", f"Exception: {str(e)}")
            return False
            
    def print_summary(self):
        """Print test summary"""
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r['status'] == 'PASS'])
        failed_tests = len([r for r in self.test_results if r['status'] == 'FAIL'])
        
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: \033[92m{passed_tests}\033[0m")
        print(f"Failed: \033[91m{failed_tests}\033[0m")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if result['status'] == 'FAIL':
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        print("\n" + "="*60)
        return failed_tests == 0


def main():
    """Main test execution"""
    print("DynoPay Backend Testing - Payment Link Creation with Merchant Pool Address")
    print("="*80)
    
    # Configuration
    BACKEND_URL = "https://a21adebb-de1d-4a59-a169-5bf700b7e9d8.preview.emergentagent.com"
    LOGIN_EMAIL = "nomadly@moxx.co"
    LOGIN_PASSWORD = "Katiekendra123@"
    
    tester = DynoPayTester(BACKEND_URL)
    
    # Test sequence
    print(f"\nTesting backend at: {BACKEND_URL}")
    print(f"Login credentials: {LOGIN_EMAIL}")
    print("-" * 80)
    
    # Step 1: Login
    if not tester.login(LOGIN_EMAIL, LOGIN_PASSWORD):
        print("❌ Login failed - cannot proceed with tests")
        return False
    
    # Step 2: Create BTC-only payment link
    btc_payment_data = tester.create_btc_only_payment_link()
    if not btc_payment_data:
        print("❌ BTC payment link creation failed")
    
    # Step 3: Create multi-currency payment link
    multi_payment_data = tester.create_multi_currency_payment_link()
    if not multi_payment_data:
        print("❌ Multi-currency payment link creation failed")
    
    # Step 4: Test checkout flow (using BTC payment link if available)
    if btc_payment_data and 'payment_link' in btc_payment_data:
        tester.test_checkout_flow(btc_payment_data['payment_link'])
    else:
        tester.log_test("Checkout Flow", "SKIP", "No BTC payment link to test")
    
    # Print summary and return result
    success = tester.print_summary()
    return success


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)