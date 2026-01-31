#!/usr/bin/env python3
"""
DynoPay Tax at Checkout Feature Testing
Tests the tax calculation functionality for payment links as requested in review.
"""

import os
import json
import requests
import time
from typing import Dict, Any

class TaxCheckoutTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        
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
        """Authenticate with provided test credentials"""
        print(f"\n=== Authenticating with {self.test_email} ===")
        
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
                    user_info = data['data']
                    self.log_result(
                        "Authentication", 
                        True, 
                        f"Successfully authenticated as {user_info.get('name', 'Unknown')}",
                        {
                            "user_id": user_info.get('user_id'),
                            "email": user_info.get('email'),
                            "name": user_info.get('name')
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
    
    def test_payment_link_without_tax(self):
        """Test 1: Create Payment Link WITHOUT Tax (Default Behavior)"""
        print("\n=== Test 1: Payment Link WITHOUT Tax ===")
        
        if not self.jwt_token:
            self.log_result("Payment Link Without Tax", False, "No JWT token available")
            return None
        
        # Create payment link WITHOUT apply_tax field
        payment_data = {
            "amount": 50,
            "currency": "EUR",
            "modes": ["CRYPTO"],
            "company_id": 38,
            "description": "Product without tax"
            # NOTE: apply_tax field is intentionally omitted - should default to false
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
                
                if 'data' in data and 'link' in data['data']:
                    payment_link = data['data']['link']
                    
                    # Extract payment reference from URL
                    # URL format: https://domain.com/pay?d=reference
                    if '?d=' in payment_link:
                        reference = payment_link.split('?d=')[1]
                        
                        self.log_result(
                            "Payment Link Creation (No Tax)", 
                            True, 
                            "Payment link created successfully without tax",
                            {
                                "link": payment_link,
                                "reference": reference,
                                "amount": payment_data["amount"],
                                "currency": payment_data["currency"]
                            }
                        )
                        
                        # Test getData endpoint
                        return self.test_get_data_without_tax(reference)
                    else:
                        self.log_result(
                            "Payment Link Creation (No Tax)", 
                            False, 
                            "Invalid payment link format",
                            {"link": payment_link}
                        )
                else:
                    self.log_result(
                        "Payment Link Creation (No Tax)", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Payment Link Creation (No Tax)", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Payment Link Creation (No Tax)", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return None
    
    def test_get_data_without_tax(self, reference: str):
        """Test getData endpoint for payment link without tax"""
        print(f"\n--- Testing getData for reference: {reference} ---")
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/pay/getData",
                json={"data": reference},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    payment_data = data['data']
                    
                    # Verify apply_tax is false
                    apply_tax = payment_data.get('apply_tax', None)
                    has_tax_info = 'tax_info' in payment_data
                    
                    if apply_tax is False and not has_tax_info:
                        self.log_result(
                            "getData Without Tax - Verification", 
                            True, 
                            "Correctly shows apply_tax: false and no tax_info object",
                            {
                                "apply_tax": apply_tax,
                                "has_tax_info": has_tax_info,
                                "amount": payment_data.get('amount'),
                                "currency": payment_data.get('base_currency')
                            }
                        )
                        return reference
                    else:
                        self.log_result(
                            "getData Without Tax - Verification", 
                            False, 
                            f"Expected apply_tax: false and no tax_info, got apply_tax: {apply_tax}, has_tax_info: {has_tax_info}",
                            {"payment_data": payment_data}
                        )
                else:
                    self.log_result(
                        "getData Without Tax", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "getData Without Tax", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "getData Without Tax", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return None
    
    def test_payment_link_with_tax(self):
        """Test 2: Create Payment Link WITH Tax Enabled"""
        print("\n=== Test 2: Payment Link WITH Tax Enabled ===")
        
        if not self.jwt_token:
            self.log_result("Payment Link With Tax", False, "No JWT token available")
            return None
        
        # Create payment link WITH apply_tax: true
        payment_data = {
            "amount": 100,
            "currency": "EUR",
            "modes": ["CRYPTO"],
            "company_id": 38,
            "description": "Product with tax enabled",
            "apply_tax": True  # Enable tax calculation
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
                
                if 'data' in data and 'link' in data['data']:
                    payment_link = data['data']['link']
                    
                    # Extract payment reference from URL
                    if '?d=' in payment_link:
                        reference = payment_link.split('?d=')[1]
                        
                        self.log_result(
                            "Payment Link Creation (With Tax)", 
                            True, 
                            "Payment link created successfully with tax enabled",
                            {
                                "link": payment_link,
                                "reference": reference,
                                "amount": payment_data["amount"],
                                "currency": payment_data["currency"],
                                "apply_tax": payment_data["apply_tax"]
                            }
                        )
                        
                        # Test getData endpoint
                        return self.test_get_data_with_tax(reference)
                    else:
                        self.log_result(
                            "Payment Link Creation (With Tax)", 
                            False, 
                            "Invalid payment link format",
                            {"link": payment_link}
                        )
                else:
                    self.log_result(
                        "Payment Link Creation (With Tax)", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Payment Link Creation (With Tax)", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Payment Link Creation (With Tax)", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return None
    
    def test_get_data_with_tax(self, reference: str):
        """Test getData endpoint for payment link with tax enabled"""
        print(f"\n--- Testing getData WITH TAX for reference: {reference} ---")
        
        try:
            # Add custom headers to simulate customer location (Portugal)
            headers = {
                "Content-Type": "application/json",
                "X-Forwarded-For": "85.240.1.1",  # Portuguese IP
                "CF-IPCountry": "PT",  # Cloudflare country header
                "X-Real-IP": "85.240.1.1"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/getData",
                json={"data": reference},
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    payment_data = data['data']
                    
                    # Verify apply_tax is true
                    apply_tax = payment_data.get('apply_tax', None)
                    tax_info = payment_data.get('tax_info', None)
                    
                    if apply_tax is True:
                        self.log_result(
                            "getData With Tax - apply_tax Field", 
                            True, 
                            "Correctly shows apply_tax: true",
                            {"apply_tax": apply_tax}
                        )
                        
                        # Verify tax_info object structure
                        if tax_info and isinstance(tax_info, dict):
                            required_fields = [
                                'tax_enabled', 'tax_rate', 'tax_acronym', 
                                'tax_amount', 'subtotal', 'total', 
                                'country_code', 'country_name'
                            ]
                            
                            missing_fields = [field for field in required_fields if field not in tax_info]
                            
                            if not missing_fields:
                                # Verify tax calculation values
                                tax_enabled = tax_info.get('tax_enabled')
                                tax_rate = tax_info.get('tax_rate')
                                tax_acronym = tax_info.get('tax_acronym')
                                tax_amount = tax_info.get('tax_amount')
                                subtotal = tax_info.get('subtotal')
                                total = tax_info.get('total')
                                country_code = tax_info.get('country_code')
                                country_name = tax_info.get('country_name')
                                
                                # Verify calculation logic
                                expected_tax_amount = (subtotal * tax_rate) / 100
                                expected_total = subtotal + tax_amount
                                
                                calculation_correct = (
                                    abs(expected_tax_amount - tax_amount) < 0.01 and
                                    abs(expected_total - total) < 0.01
                                )
                                
                                if calculation_correct:
                                    self.log_result(
                                        "getData With Tax - Tax Calculation", 
                                        True, 
                                        f"Tax calculation correct: {tax_rate}% {tax_acronym} on {subtotal} = {tax_amount}, total: {total}",
                                        {
                                            "country": f"{country_name} ({country_code})",
                                            "tax_rate": tax_rate,
                                            "tax_acronym": tax_acronym,
                                            "subtotal": subtotal,
                                            "tax_amount": tax_amount,
                                            "total": total,
                                            "currency": tax_info.get('currency')
                                        }
                                    )
                                else:
                                    self.log_result(
                                        "getData With Tax - Tax Calculation", 
                                        False, 
                                        f"Tax calculation incorrect: expected {expected_tax_amount}, got {tax_amount}",
                                        {"tax_info": tax_info}
                                    )
                                
                                # Verify country detection
                                if country_code and country_name:
                                    self.log_result(
                                        "getData With Tax - Country Detection", 
                                        True, 
                                        f"Country detected: {country_name} ({country_code})",
                                        {"country_code": country_code, "country_name": country_name}
                                    )
                                else:
                                    self.log_result(
                                        "getData With Tax - Country Detection", 
                                        False, 
                                        "Country not detected properly",
                                        {"country_code": country_code, "country_name": country_name}
                                    )
                                
                            else:
                                self.log_result(
                                    "getData With Tax - tax_info Structure", 
                                    False, 
                                    f"Missing required tax_info fields: {', '.join(missing_fields)}",
                                    {"tax_info": tax_info, "missing_fields": missing_fields}
                                )
                        else:
                            self.log_result(
                                "getData With Tax - tax_info Object", 
                                False, 
                                "tax_info object missing or invalid",
                                {"tax_info": tax_info}
                            )
                    else:
                        self.log_result(
                            "getData With Tax - apply_tax Field", 
                            False, 
                            f"Expected apply_tax: true, got: {apply_tax}",
                            {"apply_tax": apply_tax}
                        )
                else:
                    self.log_result(
                        "getData With Tax", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "getData With Tax", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "getData With Tax", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return reference
    
    def test_tax_rate_endpoints(self):
        """Test 3: Verify Tax API Rate Endpoints"""
        print("\n=== Test 3: Tax API Rate Endpoints ===")
        
        # Test Portugal (PT) - should return ~23% with acronym "IVA"
        self.test_single_tax_rate("PT", expected_rate_range=(20, 25), expected_acronym="IVA")
        
        # Test Germany (DE) - should return ~19% with acronym "VAT"  
        self.test_single_tax_rate("DE", expected_rate_range=(18, 20), expected_acronym="VAT")
    
    def test_single_tax_rate(self, country_code: str, expected_rate_range: tuple, expected_acronym: str):
        """Test a single tax rate endpoint"""
        print(f"\n--- Testing Tax Rate for {country_code} ---")
        
        try:
            response = requests.get(
                f"{self.backend_url}/api/tax/rate/{country_code}",
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    tax_data = data['data']
                    
                    country_code_resp = tax_data.get('country_code')
                    standard_rate = tax_data.get('standard_rate')
                    tax_acronym = tax_data.get('tax_acronym')
                    country_name = tax_data.get('country_name')
                    
                    # Verify country code matches
                    if country_code_resp == country_code:
                        self.log_result(
                            f"Tax Rate {country_code} - Country Code", 
                            True, 
                            f"Country code matches: {country_code_resp}"
                        )
                    else:
                        self.log_result(
                            f"Tax Rate {country_code} - Country Code", 
                            False, 
                            f"Expected {country_code}, got {country_code_resp}"
                        )
                    
                    # Verify tax rate is in expected range
                    if standard_rate is not None and expected_rate_range[0] <= standard_rate <= expected_rate_range[1]:
                        self.log_result(
                            f"Tax Rate {country_code} - Rate Value", 
                            True, 
                            f"Tax rate {standard_rate}% is within expected range {expected_rate_range}"
                        )
                    else:
                        self.log_result(
                            f"Tax Rate {country_code} - Rate Value", 
                            False, 
                            f"Tax rate {standard_rate}% is outside expected range {expected_rate_range}"
                        )
                    
                    # Verify tax acronym
                    if tax_acronym == expected_acronym:
                        self.log_result(
                            f"Tax Rate {country_code} - Acronym", 
                            True, 
                            f"Tax acronym matches: {tax_acronym}"
                        )
                    else:
                        self.log_result(
                            f"Tax Rate {country_code} - Acronym", 
                            False, 
                            f"Expected {expected_acronym}, got {tax_acronym}"
                        )
                    
                    # Overall success for this country
                    self.log_result(
                        f"Tax Rate API - {country_code}", 
                        True, 
                        f"Successfully retrieved: {standard_rate}% {tax_acronym} for {country_name}",
                        {
                            "country_code": country_code_resp,
                            "country_name": country_name,
                            "standard_rate": standard_rate,
                            "tax_acronym": tax_acronym
                        }
                    )
                else:
                    self.log_result(
                        f"Tax Rate API - {country_code}", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    f"Tax Rate API - {country_code}", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                f"Tax Rate API - {country_code}", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all tax checkout tests"""
        print("🧪 Starting DynoPay Tax at Checkout Feature Testing")
        print("=" * 60)
        
        # Step 1: Authenticate
        if not self.authenticate():
            print("\n❌ Authentication failed - cannot proceed with tests")
            return False
        
        # Step 2: Test payment link without tax (default behavior)
        self.test_payment_link_without_tax()
        
        # Step 3: Test payment link with tax enabled
        self.test_payment_link_with_tax()
        
        # Step 4: Test tax rate API endpoints
        self.test_tax_rate_endpoints()
        
        # Summary
        self.print_summary()
        
        return len(self.errors) == 0
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("🧪 TAX AT CHECKOUT TESTING SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if self.errors:
            print(f"\n❌ FAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        else:
            print(f"\n🎉 ALL TESTS PASSED!")
        
        print("\n" + "=" * 60)

def main():
    """Main function"""
    tester = TaxCheckoutTester()
    success = tester.run_all_tests()
    
    if success:
        print("✅ Tax at checkout feature testing completed successfully!")
        exit(0)
    else:
        print("❌ Tax at checkout feature testing completed with failures!")
        exit(1)

if __name__ == "__main__":
    main()