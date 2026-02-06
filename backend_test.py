#!/usr/bin/env python3
"""
DynoPay Shorter API Key Name Auto-Generation Testing
Tests the shorter auto-generated names for API keys and wallets as requested in review
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any
import uuid
import re

class DynoPayShorterNameTester:
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
    
    def test_api_key_name_auto_generation_eur(self):
        """Test API Key Name Auto-Generation with EUR currency"""
        print("\n" + "="*60)
        print("TEST 1: API KEY NAME AUTO-GENERATION - EUR CURRENCY")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("API Key Auto-Generation EUR", False, "No JWT token available")
            return
            
        try:
            # Create API key WITHOUT api_name field, using EUR currency
            api_key_data = {
                "company_id": self.company_id,
                "base_currency": "EUR",
                "environment": "development"
                # Intentionally NOT including api_name to trigger auto-generation
            }
            
            response = requests.post(
                f"{self.backend_url}/api/userApi/addApi",
                json=api_key_data,
                headers={
                    "Authorization": f"Bearer {self.jwt_token}",
                    "Content-Type": "application/json"
                },
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                api_response = data.get('data', {})
                api_name = api_response.get('api_name', '')
                
                # Check if name matches the short format "Word-Number"
                short_name_pattern = r'^[A-Za-z]+-\d+$'
                is_short_format = bool(re.match(short_name_pattern, api_name))
                
                # Check if it's NOT a long format
                is_not_long = len(api_name) < 20 and 'Live' not in api_name and 'Key' not in api_name
                
                if api_name and is_short_format and is_not_long:
                    self.log_result(
                        "API Key Auto-Generation EUR", 
                        True, 
                        f"Short auto-generated name created: '{api_name}' (EUR currency)",
                        {
                            "api_name": api_name,
                            "base_currency": "EUR",
                            "environment": "development",
                            "matches_pattern": is_short_format,
                            "name_length": len(api_name),
                            "api_id": api_response.get('api_id')
                        }
                    )
                else:
                    self.log_result(
                        "API Key Auto-Generation EUR", 
                        False, 
                        f"Generated name '{api_name}' doesn't match short format 'Word-Number'",
                        {
                            "api_name": api_name,
                            "matches_pattern": is_short_format,
                            "is_not_long": is_not_long,
                            "expected_pattern": "Word-Number (e.g., Swift-42)"
                        }
                    )
            elif response.status_code == 400 and 'already exists' in response.text.lower():
                # Try with GBP if EUR already exists
                self.test_api_key_name_auto_generation_gbp()
            else:
                self.log_result(
                    "API Key Auto-Generation EUR", 
                    False, 
                    f"API key creation failed with status {response.status_code}: {response.text[:200]}"
                )
                
        except Exception as e:
            self.log_result("API Key Auto-Generation EUR", False, f"API key creation request failed: {str(e)}")
    
    def test_api_key_name_auto_generation_gbp(self):
        """Test API Key Name Auto-Generation with GBP currency"""
        print("\n" + "="*60)
        print("TEST 2: API KEY NAME AUTO-GENERATION - GBP CURRENCY")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("API Key Auto-Generation GBP", False, "No JWT token available")
            return
            
        try:
            # Create API key WITHOUT api_name field, using GBP currency
            api_key_data = {
                "company_id": self.company_id,
                "base_currency": "GBP",
                "environment": "development"
                # Intentionally NOT including api_name to trigger auto-generation
            }
            
            response = requests.post(
                f"{self.backend_url}/api/userApi/addApi",
                json=api_key_data,
                headers={
                    "Authorization": f"Bearer {self.jwt_token}",
                    "Content-Type": "application/json"
                },
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                api_response = data.get('data', {})
                api_name = api_response.get('api_name', '')
                
                # Check if name matches the short format "Word-Number"
                short_name_pattern = r'^[A-Za-z]+-\d+$'
                is_short_format = bool(re.match(short_name_pattern, api_name))
                
                # Check if it's NOT a long format
                is_not_long = len(api_name) < 20 and 'Live' not in api_name and 'Key' not in api_name
                
                if api_name and is_short_format and is_not_long:
                    self.log_result(
                        "API Key Auto-Generation GBP", 
                        True, 
                        f"Short auto-generated name created: '{api_name}' (GBP currency)",
                        {
                            "api_name": api_name,
                            "base_currency": "GBP",
                            "environment": "development",
                            "matches_pattern": is_short_format,
                            "name_length": len(api_name),
                            "api_id": api_response.get('api_id')
                        }
                    )
                else:
                    self.log_result(
                        "API Key Auto-Generation GBP", 
                        False, 
                        f"Generated name '{api_name}' doesn't match short format 'Word-Number'",
                        {
                            "api_name": api_name,
                            "matches_pattern": is_short_format,
                            "is_not_long": is_not_long,
                            "expected_pattern": "Word-Number (e.g., Nova-7)"
                        }
                    )
            elif response.status_code == 400 and 'already exists' in response.text.lower():
                # Try with BTC if GBP already exists
                self.test_api_key_name_auto_generation_btc()
            else:
                self.log_result(
                    "API Key Auto-Generation GBP", 
                    False, 
                    f"API key creation failed with status {response.status_code}: {response.text[:200]}"
                )
                
        except Exception as e:
            self.log_result("API Key Auto-Generation GBP", False, f"API key creation request failed: {str(e)}")
    
    def test_api_key_name_auto_generation_btc(self):
        """Test API Key Name Auto-Generation with BTC currency"""
        print("\n" + "="*60)
        print("TEST 3: API KEY NAME AUTO-GENERATION - BTC CURRENCY")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("API Key Auto-Generation BTC", False, "No JWT token available")
            return
            
        try:
            # Create API key WITHOUT api_name field, using BTC currency
            api_key_data = {
                "company_id": self.company_id,
                "base_currency": "BTC",
                "environment": "development"
                # Intentionally NOT including api_name to trigger auto-generation
            }
            
            response = requests.post(
                f"{self.backend_url}/api/userApi/addApi",
                json=api_key_data,
                headers={
                    "Authorization": f"Bearer {self.jwt_token}",
                    "Content-Type": "application/json"
                },
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                api_response = data.get('data', {})
                api_name = api_response.get('api_name', '')
                
                # Check if name matches the short format "Word-Number"
                short_name_pattern = r'^[A-Za-z]+-\d+$'
                is_short_format = bool(re.match(short_name_pattern, api_name))
                
                # Check if it's NOT a long format
                is_not_long = len(api_name) < 20 and 'Live' not in api_name and 'Key' not in api_name
                
                if api_name and is_short_format and is_not_long:
                    self.log_result(
                        "API Key Auto-Generation BTC", 
                        True, 
                        f"Short auto-generated name created: '{api_name}' (BTC currency)",
                        {
                            "api_name": api_name,
                            "base_currency": "BTC",
                            "environment": "development",
                            "matches_pattern": is_short_format,
                            "name_length": len(api_name),
                            "api_id": api_response.get('api_id')
                        }
                    )
                else:
                    self.log_result(
                        "API Key Auto-Generation BTC", 
                        False, 
                        f"Generated name '{api_name}' doesn't match short format 'Word-Number'",
                        {
                            "api_name": api_name,
                            "matches_pattern": is_short_format,
                            "is_not_long": is_not_long,
                            "expected_pattern": "Word-Number (e.g., Blaze-15)"
                        }
                    )
            elif response.status_code == 400 and 'already exists' in response.text.lower():
                # Try with NGN if BTC already exists
                self.test_api_key_name_auto_generation_ngn()
            else:
                self.log_result(
                    "API Key Auto-Generation BTC", 
                    False, 
                    f"API key creation failed with status {response.status_code}: {response.text[:200]}"
                )
                
        except Exception as e:
            self.log_result("API Key Auto-Generation BTC", False, f"API key creation request failed: {str(e)}")
    
    def test_api_key_name_auto_generation_ngn(self):
        """Test API Key Name Auto-Generation with NGN currency"""
        print("\n" + "="*60)
        print("TEST 4: API KEY NAME AUTO-GENERATION - NGN CURRENCY")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("API Key Auto-Generation NGN", False, "No JWT token available")
            return
            
        try:
            # Create API key WITHOUT api_name field, using NGN currency
            api_key_data = {
                "company_id": self.company_id,
                "base_currency": "NGN",
                "environment": "development"
                # Intentionally NOT including api_name to trigger auto-generation
            }
            
            response = requests.post(
                f"{self.backend_url}/api/userApi/addApi",
                json=api_key_data,
                headers={
                    "Authorization": f"Bearer {self.jwt_token}",
                    "Content-Type": "application/json"
                },
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                api_response = data.get('data', {})
                api_name = api_response.get('api_name', '')
                
                # Check if name matches the short format "Word-Number"
                short_name_pattern = r'^[A-Za-z]+-\d+$'
                is_short_format = bool(re.match(short_name_pattern, api_name))
                
                # Check if it's NOT a long format
                is_not_long = len(api_name) < 20 and 'Live' not in api_name and 'Key' not in api_name
                
                if api_name and is_short_format and is_not_long:
                    self.log_result(
                        "API Key Auto-Generation NGN", 
                        True, 
                        f"Short auto-generated name created: '{api_name}' (NGN currency)",
                        {
                            "api_name": api_name,
                            "base_currency": "NGN",
                            "environment": "development",
                            "matches_pattern": is_short_format,
                            "name_length": len(api_name),
                            "api_id": api_response.get('api_id')
                        }
                    )
                else:
                    self.log_result(
                        "API Key Auto-Generation NGN", 
                        False, 
                        f"Generated name '{api_name}' doesn't match short format 'Word-Number'",
                        {
                            "api_name": api_name,
                            "matches_pattern": is_short_format,
                            "is_not_long": is_not_long,
                            "expected_pattern": "Word-Number (e.g., Pulse-88)"
                        }
                    )
            else:
                self.log_result(
                    "API Key Auto-Generation NGN", 
                    False, 
                    f"API key creation failed with status {response.status_code}: {response.text[:200]}"
                )
                
        except Exception as e:
            self.log_result("API Key Auto-Generation NGN", False, f"API key creation request failed: {str(e)}")
    
    def test_name_format_validation(self):
        """Test that generated names match the expected pattern"""
        print("\n" + "="*60)
        print("TEST 5: NAME FORMAT VALIDATION")
        print("="*60)
        
        # Test the generateFriendlyName function pattern
        expected_words = [
            'Swift', 'Bold', 'Nova', 'Apex', 'Pulse', 'Spark', 'Echo', 'Flux',
            'Prime', 'Core', 'Wave', 'Blaze', 'Edge', 'Volt', 'Zoom', 'Dash',
            'Snap', 'Beam', 'Glow', 'Rush', 'Mint', 'Jade', 'Onyx', 'Ruby',
            'Sage', 'Lynx', 'Hawk', 'Wolf', 'Fox', 'Zap', 'Arc', 'Ion'
        ]
        
        # Check if any of our test results contain valid names
        valid_names = []
        invalid_names = []
        
        for test_name, result in self.test_results.items():
            if 'API Key Auto-Generation' in test_name and result.get('success'):
                details = result.get('details', {})
                api_name = details.get('api_name', '')
                if api_name:
                    # Check if it matches Word-Number pattern
                    pattern_match = re.match(r'^([A-Za-z]+)-(\d+)$', api_name)
                    if pattern_match:
                        word, number = pattern_match.groups()
                        if word in expected_words and 0 <= int(number) <= 99:
                            valid_names.append(api_name)
                        else:
                            invalid_names.append(api_name)
        
        if valid_names:
            self.log_result(
                "Name Format Validation", 
                True, 
                f"Generated names follow correct format: {', '.join(valid_names)}",
                {
                    "valid_names": valid_names,
                    "invalid_names": invalid_names,
                    "expected_pattern": "Word-Number where Word is from predefined list and Number is 0-99"
                }
            )
        else:
            self.log_result(
                "Name Format Validation", 
                False, 
                "No valid short names were generated in previous tests",
                {
                    "valid_names": valid_names,
                    "invalid_names": invalid_names,
                    "note": "This could be due to duplicate API keys or other creation issues"
                }
            )
    
    def test_existing_api_keys_format(self):
        """Test existing API keys to see their name format"""
        print("\n" + "="*60)
        print("TEST 6: EXISTING API KEYS FORMAT CHECK")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("Existing API Keys Format", False, "No JWT token available")
            return
            
        try:
            response = requests.get(
                f"{self.backend_url}/api/userApi/getApi",
                headers={"Authorization": f"Bearer {self.jwt_token}"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                api_data = data.get('data', {})
                
                # Handle both single API key and grouped format
                if isinstance(api_data, dict) and 'all' in api_data:
                    api_list = api_data['all']
                elif isinstance(api_data, list):
                    api_list = api_data
                else:
                    api_list = [api_data] if api_data else []
                
                short_format_names = []
                long_format_names = []
                
                for api_key in api_list:
                    api_name = api_key.get('api_name', '')
                    if api_name:
                        # Check if it matches short format "Word-Number"
                        short_pattern = r'^[A-Za-z]+-\d+$'
                        if re.match(short_pattern, api_name) and len(api_name) < 15:
                            short_format_names.append(api_name)
                        else:
                            long_format_names.append(api_name)
                
                total_keys = len(api_list)
                short_count = len(short_format_names)
                
                if short_count > 0:
                    self.log_result(
                        "Existing API Keys Format", 
                        True, 
                        f"Found {short_count}/{total_keys} API keys with short format names",
                        {
                            "total_api_keys": total_keys,
                            "short_format_names": short_format_names[:5],  # Show first 5
                            "long_format_names": long_format_names[:3],   # Show first 3
                            "short_format_count": short_count,
                            "long_format_count": len(long_format_names)
                        }
                    )
                else:
                    self.log_result(
                        "Existing API Keys Format", 
                        False, 
                        f"No short format names found among {total_keys} API keys",
                        {
                            "total_api_keys": total_keys,
                            "long_format_names": long_format_names[:5],
                            "note": "All existing API keys use long format names"
                        }
                    )
            else:
                self.log_result("Existing API Keys Format", False, f"Failed to retrieve API keys: status {response.status_code}")
                
        except Exception as e:
            self.log_result("Existing API Keys Format", False, f"API keys request failed: {str(e)}")
    
    def run_all_tests(self):
        """Run all shorter name generation tests"""
        print("="*80)
        print("DYNOPAY SHORTER API KEY NAME AUTO-GENERATION TESTING")
        print("="*80)
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Credentials: {self.test_email}")
        print(f"Company ID: {self.company_id}")
        print("="*80)
        
        # Authenticate first
        if not self.authenticate_user():
            print("\n❌ AUTHENTICATION FAILED - Cannot proceed with tests")
            return
        
        # Check existing API keys format first
        self.test_existing_api_keys_format()
        
        # Test API key auto-generation with different currencies
        self.test_api_key_name_auto_generation_eur()
        self.test_api_key_name_auto_generation_gbp()
        self.test_api_key_name_auto_generation_btc()
        self.test_api_key_name_auto_generation_ngn()
        
        # Validate name format
        self.test_name_format_validation()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("TEST SUMMARY")
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
            print("\n🎉 ALL SHORTER NAME GENERATION TESTS PASSED!")
        else:
            print(f"\n⚠️  {failed_tests} TEST(S) NEED ATTENTION")
        
        # Show successful name generations
        successful_names = []
        for test_name, result in self.test_results.items():
            if 'API Key Auto-Generation' in test_name and result.get('success'):
                details = result.get('details', {})
                api_name = details.get('api_name', '')
                if api_name:
                    successful_names.append(f"{api_name} ({details.get('base_currency', 'Unknown')})")
        
        if successful_names:
            print(f"\n✅ SUCCESSFULLY GENERATED SHORT NAMES:")
            for name in successful_names:
                print(f"  - {name}")

if __name__ == "__main__":
    tester = DynoPayShorterNameTester()
    tester.run_all_tests()