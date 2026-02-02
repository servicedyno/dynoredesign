#!/usr/bin/env python3
"""
DynoPay Final Payment Link Test - Correct Format
Based on investigation findings
"""

import os
import json
import requests

class FinalPaymentLinkTest:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.jwt_token = None
        self.company_id = None
        
        # Test credentials from review request
        self.test_email = "nomadly@moxx.co"
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
    
    def authenticate(self):
        """Authenticate and get company_id"""
        try:
            login_data = {
                "email": self.test_email,
                "password": self.test_password
            }
            
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json=login_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    self.jwt_token = data['data']['accessToken']
                    print(f"✅ Authentication successful")
                    return True
            
            print(f"❌ Authentication failed: {response.status_code}")
            return False
                
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False
    
    def create_company(self):
        """Create a company to get company_id"""
        if not self.jwt_token:
            return False
        
        company_data = {
            "company_name": "Final Test Company",
            "email": "finaltest@company.com",
            "mobile": "+351999000333"
        }
        
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            files = {'data': (None, json.dumps(company_data), 'application/json')}
            
            response = requests.post(
                f"{self.backend_url}/api/company/addCompany",
                headers=headers,
                files=files,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'company_id' in data['data']:
                    self.company_id = data['data']['company_id']
                    print(f"✅ Company created with ID: {self.company_id}")
                    return True
            
            print(f"❌ Company creation failed: {response.status_code}")
            return False
                
        except Exception as e:
            print(f"❌ Company creation error: {str(e)}")
            return False
    
    def test_correct_payment_link_formats(self):
        """Test payment links with correct modes format"""
        if not self.jwt_token or not self.company_id:
            print("❌ Missing authentication or company_id")
            return
        
        print("\n=== TESTING CORRECT PAYMENT LINK FORMATS ===")
        
        # Test with correct modes format based on investigation
        test_cases = [
            {
                "name": "CRYPTO Only (Correct Format)",
                "data": {
                    "amount": 100.00,
                    "base_currency": "USD",
                    "company_id": self.company_id,
                    "description": "Debug test - CRYPTO only",
                    "email": "customer@test.com",
                    "modes": ["CRYPTO"]
                }
            },
            {
                "name": "CARD Only (Correct Format)",
                "data": {
                    "amount": 50.00,
                    "base_currency": "USD",
                    "company_id": self.company_id,
                    "description": "Debug test - CARD only",
                    "email": "customer@test.com",
                    "modes": ["CARD"]
                }
            },
            {
                "name": "CRYPTO + CARD (Correct Format)",
                "data": {
                    "amount": 75.00,
                    "base_currency": "USD",
                    "company_id": self.company_id,
                    "description": "Debug test - CRYPTO + CARD",
                    "email": "customer@test.com",
                    "modes": ["CRYPTO", "CARD"]
                }
            },
            {
                "name": "All Payment Methods",
                "data": {
                    "amount": 25.00,
                    "base_currency": "USD",
                    "company_id": self.company_id,
                    "description": "Debug test - All methods",
                    "email": "customer@test.com",
                    "modes": ["CRYPTO", "CARD", "BANK_TRANSFER", "GOOGLE_PAY", "APPLE_PAY"]
                }
            }
        ]
        
        for test_case in test_cases:
            self.test_single_payment_link(test_case["name"], test_case["data"])
    
    def test_single_payment_link(self, test_name: str, payment_data: dict):
        """Test a single payment link configuration"""
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            print(f"\n--- Testing: {test_name} ---")
            print(f"Request Data: {json.dumps(payment_data, indent=2)}")
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=15
            )
            
            print(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"✅ SUCCESS: {test_name}")
                    print(f"Payment Link Created: {data.get('data', {}).get('payment_link', 'N/A')}")
                    print(f"Transaction ID: {data.get('data', {}).get('transaction_id', 'N/A')}")
                except json.JSONDecodeError:
                    print(f"✅ SUCCESS: {test_name} (non-JSON response)")
                    print(f"Response: {response.text}")
            else:
                try:
                    error_data = response.json()
                    print(f"❌ FAILED: {test_name}")
                    print(f"Error: {json.dumps(error_data, indent=2)}")
                except json.JSONDecodeError:
                    print(f"❌ FAILED: {test_name}")
                    print(f"Error: {response.text}")
                    
        except Exception as e:
            print(f"❌ ERROR: {test_name} - {str(e)}")
    
    def test_customer_endpoints_alternatives(self):
        """Test alternative customer endpoint paths"""
        if not self.jwt_token or not self.company_id:
            return
        
        print("\n=== TESTING ALTERNATIVE CUSTOMER ENDPOINT PATHS ===")
        
        # Try different possible customer endpoint paths
        customer_endpoints = [
            "/api/customer",  # singular
            "/api/customers", # plural (already tested)
            "/api/company/customers",  # under company
            "/api/userApi/customers",  # under userApi
            "/api/pay/customers"  # under pay
        ]
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        for endpoint in customer_endpoints:
            try:
                print(f"\n--- Testing GET {endpoint} ---")
                response = requests.get(
                    f"{self.backend_url}{endpoint}?company_id={self.company_id}",
                    headers=headers,
                    timeout=10
                )
                
                print(f"Status: {response.status_code}")
                if response.status_code == 200:
                    print(f"✅ FOUND: {endpoint} exists and returns 200")
                    try:
                        data = response.json()
                        print(f"Response: {json.dumps(data, indent=2)}")
                    except:
                        print(f"Response: {response.text}")
                elif response.status_code == 404:
                    print(f"❌ NOT FOUND: {endpoint}")
                else:
                    print(f"⚠️  UNEXPECTED: {endpoint} returned {response.status_code}")
                    
            except Exception as e:
                print(f"❌ ERROR testing {endpoint}: {str(e)}")
    
    def run_final_test(self):
        """Run the final comprehensive test"""
        print("╔══════════════════════════════════════════════════════════╗")
        print("║  DynoPay Final Test - Correct Payment Link & Customer    ║")
        print("╚══════════════════════════════════════════════════════════╝")
        
        if not self.authenticate():
            return
        
        if not self.create_company():
            return
        
        # Test payment links with correct format
        self.test_correct_payment_link_formats()
        
        # Test customer endpoints alternatives
        self.test_customer_endpoints_alternatives()
        
        print("\n" + "="*80)
        print("FINAL TEST COMPLETE")
        print("="*80)

if __name__ == "__main__":
    tester = FinalPaymentLinkTest()
    tester.run_final_test()