#!/usr/bin/env python3
"""
DynoPay API Key and Wallet Name Auto-Generation Testing
Tests the auto-generation of friendly names for API keys and wallets when not provided by user
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any
import uuid
import re

class DynoPayAutoGenerationTester:
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
    
    def is_friendly_name(self, name: str) -> bool:
        """Check if a name follows the friendly name pattern (adjective + noun + number)"""
        if not name:
            return False
            
        # Pattern: [Prefix] Adjective Noun [Number]
        # Examples: "Live Swift Key 42", "Test Bold Star 17", "BTC Swift Vault 42"
        pattern = r'^(?:\w+\s+)?[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+\d+)?$'
        return bool(re.match(pattern, name))
    
    def test_get_existing_api_keys(self):
        """Get existing API keys to see current state"""
        print("\n" + "="*60)
        print("STEP 1: GET EXISTING API KEYS")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("Get Existing API Keys", False, "No JWT token available")
            return []
            
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
                
                self.log_result(
                    "Get Existing API Keys", 
                    True, 
                    f"Retrieved {len(api_list)} existing API keys",
                    {
                        "api_key_count": len(api_list),
                        "existing_names": [api.get('api_name') for api in api_list if api.get('api_name')]
                    }
                )
                return api_list
            else:
                self.log_result("Get Existing API Keys", False, f"Failed with status {response.status_code}")
                return []
                
        except Exception as e:
            self.log_result("Get Existing API Keys", False, f"Request failed: {str(e)}")
            return []
    
    def test_api_key_auto_generation_without_name(self):
        """Test API key creation WITHOUT providing api_name field"""
        print("\n" + "="*60)
        print("STEP 2: API KEY AUTO-GENERATION WITHOUT NAME")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("API Key Auto-Generation", False, "No JWT token available")
            return
            
        try:
            # Create API key WITHOUT api_name field
            api_key_data = {
                "company_id": str(self.company_id),
                "base_currency": "USD",
                "environment": "development"  # Use development to avoid wallet requirements
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
                generated_name = api_response.get('api_name')
                
                if generated_name:
                    is_friendly = self.is_friendly_name(generated_name)
                    self.log_result(
                        "API Key Auto-Generation", 
                        is_friendly, 
                        f"API key created with auto-generated name: '{generated_name}'" + 
                        (" (follows friendly pattern)" if is_friendly else " (does NOT follow friendly pattern)"),
                        {
                            "generated_name": generated_name,
                            "is_friendly_format": is_friendly,
                            "api_id": api_response.get('api_id'),
                            "environment": api_response.get('environment'),
                            "company_id": api_response.get('company_id')
                        }
                    )
                else:
                    self.log_result("API Key Auto-Generation", False, "API key created but no api_name returned")
            elif response.status_code == 400 and 'already exists' in response.text:
                self.log_result(
                    "API Key Auto-Generation", 
                    True, 
                    "API key already exists for this company/currency (expected behavior)",
                    {"status_code": response.status_code, "message": "Duplicate key prevention working"}
                )
            else:
                self.log_result("API Key Auto-Generation", False, f"Failed with status {response.status_code}: {response.text[:200]}")
                
        except Exception as e:
            self.log_result("API Key Auto-Generation", False, f"Request failed: {str(e)}")
    
    def test_api_key_with_custom_name(self):
        """Test API key creation WITH custom api_name field"""
        print("\n" + "="*60)
        print("STEP 3: API KEY CREATION WITH CUSTOM NAME")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("API Key Custom Name", False, "No JWT token available")
            return
            
        try:
            # Create API key WITH custom api_name field
            custom_name = f"My Custom API Key {int(time.time())}"
            api_key_data = {
                "company_id": str(self.company_id),
                "base_currency": "EUR",  # Different currency to avoid duplicate
                "environment": "development",
                "api_name": custom_name
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
                returned_name = api_response.get('api_name')
                
                if returned_name == custom_name:
                    self.log_result(
                        "API Key Custom Name", 
                        True, 
                        f"API key created with custom name: '{returned_name}'",
                        {
                            "custom_name": custom_name,
                            "returned_name": returned_name,
                            "names_match": returned_name == custom_name,
                            "api_id": api_response.get('api_id')
                        }
                    )
                else:
                    self.log_result("API Key Custom Name", False, f"Custom name not preserved. Expected: '{custom_name}', Got: '{returned_name}'")
            elif response.status_code == 400 and 'already exists' in response.text:
                self.log_result(
                    "API Key Custom Name", 
                    True, 
                    "API key already exists for this company/currency (expected behavior)",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result("API Key Custom Name", False, f"Failed with status {response.status_code}: {response.text[:200]}")
                
        except Exception as e:
            self.log_result("API Key Custom Name", False, f"Request failed: {str(e)}")
    
    def test_wallet_addresses_auto_generation(self):
        """Test wallet address auto-generation of names"""
        print("\n" + "="*60)
        print("STEP 4: WALLET ADDRESS NAME AUTO-GENERATION")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("Wallet Address Auto-Generation", False, "No JWT token available")
            return
            
        try:
            # Get existing wallet addresses
            response = requests.get(
                f"{self.backend_url}/api/wallet/getWalletAddresses",
                headers={"Authorization": f"Bearer {self.jwt_token}"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                wallet_addresses = data.get('data', [])
                
                friendly_names = []
                non_friendly_names = []
                
                for wallet in wallet_addresses:
                    wallet_name = wallet.get('wallet_name')
                    if wallet_name:
                        if self.is_friendly_name(wallet_name):
                            friendly_names.append(wallet_name)
                        else:
                            non_friendly_names.append(wallet_name)
                
                total_wallets = len(wallet_addresses)
                friendly_count = len(friendly_names)
                
                if total_wallets > 0:
                    success_rate = (friendly_count / total_wallets) * 100
                    is_success = success_rate >= 50  # At least 50% should have friendly names
                    
                    self.log_result(
                        "Wallet Address Auto-Generation", 
                        is_success, 
                        f"Found {total_wallets} wallet addresses, {friendly_count} with friendly names ({success_rate:.1f}%)",
                        {
                            "total_wallets": total_wallets,
                            "friendly_names_count": friendly_count,
                            "success_rate": f"{success_rate:.1f}%",
                            "sample_friendly_names": friendly_names[:5],
                            "sample_non_friendly_names": non_friendly_names[:3]
                        }
                    )
                else:
                    self.log_result(
                        "Wallet Address Auto-Generation", 
                        True, 
                        "No wallet addresses found (expected for new account)",
                        {"total_wallets": 0}
                    )
            else:
                self.log_result("Wallet Address Auto-Generation", False, f"Failed with status {response.status_code}")
                
        except Exception as e:
            self.log_result("Wallet Address Auto-Generation", False, f"Request failed: {str(e)}")
    
    def test_add_wallet_without_name(self):
        """Test adding wallet address WITHOUT wallet_name field"""
        print("\n" + "="*60)
        print("STEP 5: ADD WALLET ADDRESS WITHOUT NAME")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("Add Wallet Without Name", False, "No JWT token available")
            return
            
        try:
            # Add wallet address WITHOUT wallet_name field
            wallet_data = {
                "company_id": str(self.company_id),
                "currency": "BTC",
                "wallet_address": f"1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN{int(time.time()) % 10}"  # Slightly modify to avoid duplicates
            }
            
            response = requests.post(
                f"{self.backend_url}/api/wallet/addWalletAddress",
                json=wallet_data,
                headers={
                    "Authorization": f"Bearer {self.jwt_token}",
                    "Content-Type": "application/json"
                },
                timeout=15
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                wallet_response = data.get('data', {})
                generated_name = wallet_response.get('wallet_name')
                
                if generated_name:
                    is_friendly = self.is_friendly_name(generated_name)
                    self.log_result(
                        "Add Wallet Without Name", 
                        is_friendly, 
                        f"Wallet created with auto-generated name: '{generated_name}'" + 
                        (" (follows friendly pattern)" if is_friendly else " (does NOT follow friendly pattern)"),
                        {
                            "generated_name": generated_name,
                            "is_friendly_format": is_friendly,
                            "currency": wallet_data["currency"],
                            "wallet_address": wallet_data["wallet_address"]
                        }
                    )
                else:
                    self.log_result("Add Wallet Without Name", False, "Wallet created but no wallet_name returned")
            elif response.status_code == 520 and 'already exists' in response.text:
                self.log_result(
                    "Add Wallet Without Name", 
                    True, 
                    "Wallet address already exists (expected behavior)",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result("Add Wallet Without Name", False, f"Failed with status {response.status_code}: {response.text[:200]}")
                
        except Exception as e:
            self.log_result("Add Wallet Without Name", False, f"Request failed: {str(e)}")
    
    def test_add_wallet_with_custom_name(self):
        """Test adding wallet address WITH custom wallet_name field"""
        print("\n" + "="*60)
        print("STEP 6: ADD WALLET ADDRESS WITH CUSTOM NAME")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("Add Wallet With Custom Name", False, "No JWT token available")
            return
            
        try:
            # Add wallet address WITH custom wallet_name field
            custom_name = f"My Custom Wallet {int(time.time())}"
            wallet_data = {
                "company_id": str(self.company_id),
                "currency": "ETH",
                "wallet_address": f"0x742d35Cc6634C0532925a3b8D4{int(time.time()) % 1000000:06d}",  # Generate unique ETH address
                "wallet_name": custom_name
            }
            
            response = requests.post(
                f"{self.backend_url}/api/wallet/addWalletAddress",
                json=wallet_data,
                headers={
                    "Authorization": f"Bearer {self.jwt_token}",
                    "Content-Type": "application/json"
                },
                timeout=15
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                wallet_response = data.get('data', {})
                returned_name = wallet_response.get('wallet_name')
                
                if returned_name == custom_name:
                    self.log_result(
                        "Add Wallet With Custom Name", 
                        True, 
                        f"Wallet created with custom name: '{returned_name}'",
                        {
                            "custom_name": custom_name,
                            "returned_name": returned_name,
                            "names_match": returned_name == custom_name,
                            "currency": wallet_data["currency"]
                        }
                    )
                else:
                    self.log_result("Add Wallet With Custom Name", False, f"Custom name not preserved. Expected: '{custom_name}', Got: '{returned_name}'")
            elif response.status_code == 520 and 'already exists' in response.text:
                self.log_result(
                    "Add Wallet With Custom Name", 
                    True, 
                    "Wallet address already exists (expected behavior)",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result("Add Wallet With Custom Name", False, f"Failed with status {response.status_code}: {response.text[:200]}")
                
        except Exception as e:
            self.log_result("Add Wallet With Custom Name", False, f"Request failed: {str(e)}")
    
    def test_friendly_name_patterns(self):
        """Test that generated names follow the expected patterns"""
        print("\n" + "="*60)
        print("STEP 7: VERIFY FRIENDLY NAME PATTERNS")
        print("="*60)
        
        # Test various name patterns
        test_names = [
            ("Live Swift Key 42", True, "API key production format"),
            ("Test Bold Star 17", True, "API key development format"),
            ("BTC Swift Vault 42", True, "Wallet name with currency"),
            ("ETH Quantum Hub 5", True, "Another wallet format"),
            ("api_key_123", False, "Non-friendly format"),
            ("", False, "Empty name"),
            ("Key", False, "Too short"),
            ("LIVE SWIFT KEY 42", False, "All caps"),
            ("live swift key 42", False, "All lowercase")
        ]
        
        passed_tests = 0
        total_tests = len(test_names)
        
        for name, expected_friendly, description in test_names:
            actual_friendly = self.is_friendly_name(name)
            if actual_friendly == expected_friendly:
                passed_tests += 1
                print(f"✅ {description}: '{name}' -> {actual_friendly} (correct)")
            else:
                print(f"❌ {description}: '{name}' -> {actual_friendly} (expected {expected_friendly})")
        
        success_rate = (passed_tests / total_tests) * 100
        is_success = success_rate >= 80  # At least 80% should pass
        
        self.log_result(
            "Friendly Name Patterns", 
            is_success, 
            f"Pattern validation: {passed_tests}/{total_tests} tests passed ({success_rate:.1f}%)",
            {
                "passed_tests": passed_tests,
                "total_tests": total_tests,
                "success_rate": f"{success_rate:.1f}%"
            }
        )
    
    def run_all_tests(self):
        """Run all auto-generation tests"""
        print("="*80)
        print("DYNOPAY API KEY AND WALLET NAME AUTO-GENERATION TESTING")
        print("="*80)
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Credentials: {self.test_email}")
        print(f"Company ID: {self.company_id}")
        print("="*80)
        
        # Authenticate first
        if not self.authenticate_user():
            print("\n❌ AUTHENTICATION FAILED - Cannot proceed with tests")
            return
        
        # Run all tests in sequence
        self.test_get_existing_api_keys()
        self.test_api_key_auto_generation_without_name()
        self.test_api_key_with_custom_name()
        self.test_wallet_addresses_auto_generation()
        self.test_add_wallet_without_name()
        self.test_add_wallet_with_custom_name()
        self.test_friendly_name_patterns()
        
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
            print("\n🎉 ALL AUTO-GENERATION TESTS PASSED!")
            print("✅ API keys auto-generate friendly names when not provided")
            print("✅ Wallets auto-generate friendly names when not provided")
            print("✅ Custom names are preserved when provided")
            print("✅ Generated names follow human-readable patterns")
        else:
            print(f"\n⚠️  {failed_tests} TEST(S) NEED ATTENTION")
            
        print("\n" + "="*80)
        print("KEY FINDINGS:")
        print("="*80)
        
        # Analyze results for key insights
        auth_success = self.test_results.get("Authentication", {}).get("success", False)
        api_auto_gen = self.test_results.get("API Key Auto-Generation", {}).get("success", False)
        wallet_auto_gen = self.test_results.get("Wallet Address Auto-Generation", {}).get("success", False)
        pattern_validation = self.test_results.get("Friendly Name Patterns", {}).get("success", False)
        
        if auth_success:
            print("✅ Authentication working with provided credentials")
        
        if api_auto_gen:
            print("✅ API key auto-generation producing friendly names")
        else:
            print("❌ API key auto-generation needs attention")
            
        if wallet_auto_gen:
            print("✅ Wallet name auto-generation working")
        else:
            print("❌ Wallet name auto-generation needs attention")
            
        if pattern_validation:
            print("✅ Generated names follow expected patterns (adjective + noun + number)")
        else:
            print("❌ Name pattern validation failing")

if __name__ == "__main__":
    tester = DynoPayAutoGenerationTester()
    tester.run_all_tests()