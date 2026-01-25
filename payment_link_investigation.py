#!/usr/bin/env python3
"""
DynoPay Payment Link Investigation - Detailed Analysis
Focus on payment link creation field requirements
"""

import os
import json
import requests
import time
from typing import Dict, List, Any

class PaymentLinkInvestigator:
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
            "company_name": "Payment Link Test Company",
            "email": "paymenttest@company.com",
            "mobile": "+351999000222"
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
    
    def test_payment_link_variations(self):
        """Test different payment link field combinations"""
        if not self.jwt_token or not self.company_id:
            print("❌ Missing authentication or company_id")
            return
        
        print("\n=== PAYMENT LINK FIELD INVESTIGATION ===")
        
        # Based on the error messages, we need: email, amount/base_amount, modes, base_currency
        test_variations = [
            {
                "name": "Complete NEW Format",
                "data": {
                    "base_amount": 100.00,
                    "base_currency": "USD",
                    "company_id": self.company_id,
                    "description": "Debug test",
                    "email": "customer@test.com",
                    "modes": ["BTC", "ETH"]
                }
            },
            {
                "name": "Complete LEGACY Format",
                "data": {
                    "amount": 50.00,
                    "base_currency": "USD",
                    "company_id": self.company_id,
                    "description": "Debug test",
                    "email": "customer@test.com",
                    "modes": ["BTC", "ETH"]
                }
            },
            {
                "name": "Minimal Required Fields",
                "data": {
                    "amount": 25.00,
                    "base_currency": "USD",
                    "email": "customer@test.com",
                    "modes": ["BTC"]
                }
            },
            {
                "name": "With All Optional Fields",
                "data": {
                    "amount": 75.00,
                    "base_currency": "USD",
                    "company_id": self.company_id,
                    "description": "Full test",
                    "email": "customer@test.com",
                    "modes": ["BTC", "ETH", "USDT-TRC20"],
                    "expire": "24h",
                    "callback_url": "https://example.com/callback",
                    "redirect_url": "https://example.com/success",
                    "webhook_url": "https://example.com/webhook"
                }
            }
        ]
        
        for variation in test_variations:
            self.test_single_payment_link(variation["name"], variation["data"])
    
    def test_single_payment_link(self, test_name: str, payment_data: Dict):
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
                    print(f"Response: {json.dumps(data, indent=2)}")
                except json.JSONDecodeError:
                    print(f"✅ SUCCESS: {test_name} (non-JSON response)")
                    print(f"Response: {response.text}")
            else:
                try:
                    error_data = response.json()
                    print(f"❌ FAILED: {test_name}")
                    print(f"Error: {json.dumps(error_data, indent=2)}")
                    
                    # Analyze missing fields
                    if 'errors' in error_data:
                        missing_fields = [error['key'] for error in error_data['errors']]
                        print(f"Missing Fields: {missing_fields}")
                        
                except json.JSONDecodeError:
                    print(f"❌ FAILED: {test_name}")
                    print(f"Error: {response.text}")
                    
        except Exception as e:
            print(f"❌ ERROR: {test_name} - {str(e)}")
    
    def investigate_existing_payment_links(self):
        """Check existing payment links to understand the expected format"""
        if not self.jwt_token:
            return
        
        print("\n=== INVESTIGATING EXISTING PAYMENT LINKS ===")
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.get(
                f"{self.backend_url}/api/pay/getPaymentLinks",
                headers=headers,
                timeout=15
            )
            
            print(f"GET Payment Links Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Existing Payment Links Response: {json.dumps(data, indent=2)}")
                
                # Analyze structure of existing links
                if 'data' in data and isinstance(data['data'], list) and len(data['data']) > 0:
                    sample_link = data['data'][0]
                    print(f"\nSample Payment Link Structure:")
                    for key, value in sample_link.items():
                        print(f"  {key}: {type(value).__name__} = {value}")
                else:
                    print("No existing payment links found")
            else:
                print(f"Failed to get payment links: {response.text}")
                
        except Exception as e:
            print(f"Error getting payment links: {str(e)}")
    
    def run_investigation(self):
        """Run the complete payment link investigation"""
        print("╔══════════════════════════════════════════════════════════╗")
        print("║  DynoPay Payment Link Investigation - Field Requirements ║")
        print("╚══════════════════════════════════════════════════════════╝")
        
        if not self.authenticate():
            return
        
        if not self.create_company():
            return
        
        # First check existing payment links to understand structure
        self.investigate_existing_payment_links()
        
        # Then test different field combinations
        self.test_payment_link_variations()
        
        print("\n" + "="*80)
        print("INVESTIGATION COMPLETE")
        print("="*80)

if __name__ == "__main__":
    investigator = PaymentLinkInvestigator()
    investigator.run_investigation()