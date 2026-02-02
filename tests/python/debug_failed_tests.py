#!/usr/bin/env python3
"""
DynoPay Backend - Debug Remaining Failed Tests
Root Cause Analysis for specific failing endpoints as requested in review.

CRITICAL FAILURES TO INVESTIGATE:
1. LOGIN AND GET COMPANY
2. Company Creation Failure (2.3) - multipart/form-data issues
3. API Key Creation Failure (4.2) - validation issues
4. Payment Link Creation Failures (5.1, 5.2) - field format issues
"""

import os
import json
import requests
import time
from typing import Dict, Any

class DynoPayDebugTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.jwt_token = None
        self.company_id = None
        self.test_results = {}
        self.errors = []
        
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
        
    def log_result(self, test_name: str, success: bool, message: str, details: Dict = None):
        """Log test result with detailed information"""
        self.test_results[test_name] = {
            'success': success,
            'message': message,
            'details': details or {}
        }
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        print(f"   Message: {message}")
        if details:
            print(f"   Details: {json.dumps(details, indent=2)}")
        print()
        
        if not success:
            self.errors.append(f"{test_name}: {message}")
    
    def debug_login_and_get_company(self):
        """DEBUG 1: LOGIN AND GET COMPANY - Root cause analysis"""
        print("=" * 80)
        print("DEBUG 1: LOGIN AND GET COMPANY")
        print("=" * 80)
        
        # Step 1: Test login with provided credentials
        print("\n--- Step 1: Testing Login ---")
        
        login_data = {
            "email": self.test_email,
            "password": self.test_password
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json=login_data,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            print(f"Login Request URL: {self.backend_url}/api/user/login")
            print(f"Login Request Body: {json.dumps(login_data, indent=2)}")
            print(f"Login Response Status: {response.status_code}")
            print(f"Login Response Headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                try:
                    login_response = response.json()
                    print(f"Login Response Body: {json.dumps(login_response, indent=2)}")
                    
                    # Extract JWT token
                    if 'data' in login_response and 'accessToken' in login_response['data']:
                        self.jwt_token = login_response['data']['accessToken']
                        user_id = login_response['data'].get('user_id')
                        
                        self.log_result(
                            "1.1 User Login",
                            True,
                            f"Successfully logged in user {self.test_email}",
                            {
                                "user_id": user_id,
                                "token_length": len(self.jwt_token) if self.jwt_token else 0,
                                "token_preview": self.jwt_token[:20] + "..." if self.jwt_token else None
                            }
                        )
                        
                        # Step 2: Get user's companies
                        self.debug_get_companies()
                        
                    else:
                        self.log_result(
                            "1.1 User Login - Token Extraction",
                            False,
                            "Login succeeded but no accessToken found in response",
                            {"response_structure": list(login_response.keys())}
                        )
                        
                except json.JSONDecodeError as e:
                    self.log_result(
                        "1.1 User Login - JSON Parse",
                        False,
                        f"Failed to parse login response as JSON: {str(e)}",
                        {"raw_response": response.text[:500]}
                    )
            else:
                self.log_result(
                    "1.1 User Login",
                    False,
                    f"Login failed with status {response.status_code}",
                    {
                        "status_code": response.status_code,
                        "response_text": response.text,
                        "response_headers": dict(response.headers)
                    }
                )
                
        except Exception as e:
            self.log_result(
                "1.1 User Login",
                False,
                f"Login request failed: {str(e)}",
                {"exception_type": type(e).__name__}
            )
    
    def debug_get_companies(self):
        """Step 2: Get user's companies to find company_id"""
        print("\n--- Step 2: Getting User Companies ---")
        
        if not self.jwt_token:
            self.log_result(
                "1.2 Get Companies",
                False,
                "No JWT token available for authentication"
            )
            return
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        try:
            # Try different endpoints to get company information
            company_endpoints = [
                "/api/company/getCompany",
                "/api/user/profile",
                "/api/dashboard"
            ]
            
            for endpoint in company_endpoints:
                print(f"\nTrying endpoint: {endpoint}")
                
                response = requests.get(
                    f"{self.backend_url}{endpoint}",
                    headers=headers,
                    timeout=30
                )
                
                print(f"Response Status: {response.status_code}")
                print(f"Response Headers: {dict(response.headers)}")
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        print(f"Response Body: {json.dumps(data, indent=2)}")
                        
                        # Look for company_id in response
                        company_id = self.extract_company_id(data)
                        if company_id:
                            self.company_id = company_id
                            self.log_result(
                                "1.2 Get Company ID",
                                True,
                                f"Found company_id: {company_id} from endpoint {endpoint}",
                                {"company_id": company_id, "endpoint": endpoint}
                            )
                            return
                            
                    except json.JSONDecodeError as e:
                        print(f"JSON Parse Error: {str(e)}")
                        print(f"Raw Response: {response.text[:500]}")
                else:
                    print(f"Error Response: {response.text}")
            
            # If no company_id found, this might be the issue
            self.log_result(
                "1.2 Get Company ID",
                False,
                "Could not find company_id from any endpoint - user may not have companies",
                {"tested_endpoints": company_endpoints}
            )
                        
        except Exception as e:
            self.log_result(
                "1.2 Get Companies",
                False,
                f"Request failed: {str(e)}",
                {"exception_type": type(e).__name__}
            )
    
    def extract_company_id(self, data: Dict) -> str:
        """Extract company_id from various response formats"""
        # Check common locations for company_id
        if isinstance(data, dict):
            # Direct company_id field
            if 'company_id' in data:
                return str(data['company_id'])
            
            # In data object
            if 'data' in data:
                # If data is a list (like from /api/company/getCompany)
                if isinstance(data['data'], list) and data['data']:
                    # Get first company's ID
                    if 'company_id' in data['data'][0]:
                        return str(data['data'][0]['company_id'])
                
                # If data is a dict
                elif isinstance(data['data'], dict):
                    if 'company_id' in data['data']:
                        return str(data['data']['company_id'])
                    
                    # In user profile
                    if 'user' in data['data'] and isinstance(data['data']['user'], dict):
                        if 'company_id' in data['data']['user']:
                            return str(data['data']['user']['company_id'])
                    
                    # In companies array
                    if 'companies' in data['data'] and isinstance(data['data']['companies'], list):
                        if data['data']['companies'] and 'company_id' in data['data']['companies'][0]:
                            return str(data['data']['companies'][0]['company_id'])
        
        return None
    
    def debug_company_creation(self):
        """DEBUG 2: Company Creation Failure (2.3) - multipart/form-data analysis"""
        print("=" * 80)
        print("DEBUG 2: COMPANY CREATION FAILURE (2.3)")
        print("=" * 80)
        
        if not self.jwt_token:
            self.log_result(
                "2.1 Company Creation - Auth Check",
                False,
                "No JWT token available for company creation test"
            )
            return
        
        # Test company data as specified in review request
        company_data = {
            "company_name": "Debug Test Company",
            "email": "debug@dynopay.com",
            "mobile": "+1234567890",
            "address_line1": "123 Test Street",
            "city": "Test City",
            "country": "US",
            "vat_number": "US123456789",
            "vat_type": "VAT"
        }
        
        print(f"\n--- Testing Company Creation with multipart/form-data ---")
        print(f"Company Data: {json.dumps(company_data, indent=2)}")
        
        # Test the exact format mentioned in review request
        headers = {
            "Authorization": f"Bearer {self.jwt_token}"
            # Note: NOT setting Content-Type for multipart/form-data - requests will set it
        }
        
        try:
            # Format as multipart/form-data with JSON in 'data' field
            files = {
                'data': (None, json.dumps(company_data), 'application/json')
            }
            
            print(f"Request URL: {self.backend_url}/api/company/addCompany")
            print(f"Request Headers: {headers}")
            print(f"Request Files: {files}")
            
            response = requests.post(
                f"{self.backend_url}/api/company/addCompany",
                headers=headers,
                files=files,
                timeout=30
            )
            
            print(f"Response Status: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            print(f"Response Body: {response.text}")
            
            if response.status_code == 200:
                try:
                    response_data = response.json()
                    self.log_result(
                        "2.1 Company Creation - multipart/form-data",
                        True,
                        "Company creation succeeded with multipart/form-data format",
                        {
                            "response": response_data,
                            "company_id": response_data.get('data', {}).get('company_id') if 'data' in response_data else None
                        }
                    )
                except json.JSONDecodeError:
                    self.log_result(
                        "2.1 Company Creation - Response Parse",
                        False,
                        "Company creation returned 200 but response is not valid JSON",
                        {"raw_response": response.text}
                    )
            else:
                # Analyze the exact error
                try:
                    error_data = response.json()
                    error_message = error_data.get('message', 'Unknown error')
                    
                    self.log_result(
                        "2.1 Company Creation - Error Analysis",
                        False,
                        f"Company creation failed: {error_message}",
                        {
                            "status_code": response.status_code,
                            "error_response": error_data,
                            "possible_causes": self.analyze_company_creation_error(response.status_code, error_message)
                        }
                    )
                except json.JSONDecodeError:
                    self.log_result(
                        "2.1 Company Creation - Raw Error",
                        False,
                        f"Company creation failed with status {response.status_code}",
                        {
                            "status_code": response.status_code,
                            "raw_response": response.text,
                            "possible_causes": ["Invalid endpoint", "Server error", "Authentication issue"]
                        }
                    )
        
        except Exception as e:
            self.log_result(
                "2.1 Company Creation",
                False,
                f"Company creation request failed: {str(e)}",
                {"exception_type": type(e).__name__}
            )
        
        # Test alternative formats
        self.test_alternative_company_formats(company_data)
    
    def analyze_company_creation_error(self, status_code: int, error_message: str) -> list:
        """Analyze company creation error and suggest possible causes"""
        causes = []
        
        if status_code == 400:
            if "required" in error_message.lower():
                causes.append("Missing required fields")
            if "validation" in error_message.lower():
                causes.append("Field validation failed")
            if "format" in error_message.lower():
                causes.append("Incorrect data format")
        elif status_code == 401:
            causes.append("Authentication failed - invalid JWT token")
        elif status_code == 403:
            causes.append("Authorization failed - insufficient permissions")
        elif status_code == 500:
            causes.append("Server error - database or internal issue")
        
        if not causes:
            causes.append("Unknown error - check server logs")
        
        return causes
    
    def test_alternative_company_formats(self, company_data: Dict):
        """Test alternative request formats for company creation"""
        print(f"\n--- Testing Alternative Company Creation Formats ---")
        
        headers_with_auth = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        # Test 1: Regular JSON format
        try:
            response = requests.post(
                f"{self.backend_url}/api/company/addCompany",
                json=company_data,
                headers=headers_with_auth,
                timeout=30
            )
            
            print(f"JSON Format - Status: {response.status_code}")
            print(f"JSON Format - Response: {response.text[:200]}...")
            
            if response.status_code == 200:
                self.log_result(
                    "2.2 Company Creation - JSON Format",
                    True,
                    "Company creation succeeded with regular JSON format",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result(
                    "2.2 Company Creation - JSON Format",
                    False,
                    f"JSON format also failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text[:200]}
                )
                
        except Exception as e:
            self.log_result(
                "2.2 Company Creation - JSON Format",
                False,
                f"JSON format request failed: {str(e)}",
                {"exception_type": type(e).__name__}
            )
        
        # Test 2: Minimal required fields only
        minimal_data = {
            "company_name": "Minimal Test Company",
            "email": "minimal@dynopay.com",
            "mobile": "+1234567890"
        }
        
        try:
            files_minimal = {
                'data': (None, json.dumps(minimal_data), 'application/json')
            }
            
            response = requests.post(
                f"{self.backend_url}/api/company/addCompany",
                headers={"Authorization": f"Bearer {self.jwt_token}"},
                files=files_minimal,
                timeout=30
            )
            
            print(f"Minimal Fields - Status: {response.status_code}")
            print(f"Minimal Fields - Response: {response.text[:200]}...")
            
            if response.status_code == 200:
                self.log_result(
                    "2.3 Company Creation - Minimal Fields",
                    True,
                    "Company creation succeeded with minimal required fields",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result(
                    "2.3 Company Creation - Minimal Fields",
                    False,
                    f"Even minimal fields failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text[:200]}
                )
                
        except Exception as e:
            self.log_result(
                "2.3 Company Creation - Minimal Fields",
                False,
                f"Minimal fields request failed: {str(e)}",
                {"exception_type": type(e).__name__}
            )
    
    def debug_api_key_creation(self):
        """DEBUG 3: API Key Creation Failure (4.2) - validation analysis"""
        print("=" * 80)
        print("DEBUG 3: API KEY CREATION FAILURE (4.2)")
        print("=" * 80)
        
        if not self.jwt_token:
            self.log_result(
                "3.1 API Key Creation - Auth Check",
                False,
                "No JWT token available for API key creation test"
            )
            return
        
        if not self.company_id:
            # Try to get company_id first
            print("No company_id available, attempting to get one...")
            self.debug_get_companies()
            
            if not self.company_id:
                self.log_result(
                    "3.1 API Key Creation - Company ID",
                    False,
                    "No company_id available - cannot test API key creation"
                )
                return
        
        # Test API key data as specified in review request
        api_key_data = {
            "company_id": self.company_id,
            "api_name": "Test API",
            "base_currency": "USD",
            "environment": "development",
            "permissions": ["payments", "transactions"]
        }
        
        print(f"\n--- Testing API Key Creation ---")
        print(f"API Key Data: {json.dumps(api_key_data, indent=2)}")
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/userApi/addApi",
                json=api_key_data,
                headers=headers,
                timeout=30
            )
            
            print(f"Request URL: {self.backend_url}/api/userApi/addApi")
            print(f"Request Headers: {headers}")
            print(f"Request Body: {json.dumps(api_key_data, indent=2)}")
            print(f"Response Status: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            print(f"Response Body: {response.text}")
            
            if response.status_code == 200:
                try:
                    response_data = response.json()
                    self.log_result(
                        "3.1 API Key Creation",
                        True,
                        "API key creation succeeded",
                        {
                            "response": response_data,
                            "api_id": response_data.get('data', {}).get('api_id') if 'data' in response_data else None
                        }
                    )
                except json.JSONDecodeError:
                    self.log_result(
                        "3.1 API Key Creation - Response Parse",
                        False,
                        "API key creation returned 200 but response is not valid JSON",
                        {"raw_response": response.text}
                    )
            else:
                # Analyze the exact error
                try:
                    error_data = response.json()
                    error_message = error_data.get('message', 'Unknown error')
                    
                    self.log_result(
                        "3.1 API Key Creation - Error Analysis",
                        False,
                        f"API key creation failed: {error_message}",
                        {
                            "status_code": response.status_code,
                            "error_response": error_data,
                            "possible_causes": self.analyze_api_key_error(response.status_code, error_message)
                        }
                    )
                    
                    # If it's a wallet requirement issue, check wallets
                    if "wallet" in error_message.lower():
                        self.debug_wallet_requirements()
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "3.1 API Key Creation - Raw Error",
                        False,
                        f"API key creation failed with status {response.status_code}",
                        {
                            "status_code": response.status_code,
                            "raw_response": response.text
                        }
                    )
        
        except Exception as e:
            self.log_result(
                "3.1 API Key Creation",
                False,
                f"API key creation request failed: {str(e)}",
                {"exception_type": type(e).__name__}
            )
    
    def analyze_api_key_error(self, status_code: int, error_message: str) -> list:
        """Analyze API key creation error"""
        causes = []
        
        if "wallet" in error_message.lower():
            causes.append("User needs wallet addresses configured for this company")
        if "company" in error_message.lower():
            causes.append("Invalid or missing company_id")
        if "permission" in error_message.lower():
            causes.append("Invalid permissions array")
        if "currency" in error_message.lower():
            causes.append("Invalid base_currency")
        if status_code == 403:
            causes.append("User doesn't have permission to create API keys for this company")
        
        if not causes:
            causes.append("Unknown validation error")
        
        return causes
    
    def debug_wallet_requirements(self):
        """Check wallet requirements for API key creation"""
        print(f"\n--- Checking Wallet Requirements ---")
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        # Check user's wallets
        try:
            response = requests.get(
                f"{self.backend_url}/api/wallet/getWallet",
                headers=headers,
                timeout=30
            )
            
            print(f"Wallet Check - Status: {response.status_code}")
            print(f"Wallet Check - Response: {response.text[:300]}...")
            
            if response.status_code == 200:
                wallet_data = response.json()
                wallets = wallet_data.get('data', [])
                
                self.log_result(
                    "3.2 Wallet Requirements Check",
                    len(wallets) > 0,
                    f"User has {len(wallets)} wallets configured",
                    {"wallet_count": len(wallets), "wallets": wallets[:3] if wallets else []}
                )
            else:
                self.log_result(
                    "3.2 Wallet Requirements Check",
                    False,
                    f"Failed to check wallets: status {response.status_code}",
                    {"response": response.text[:200]}
                )
                
        except Exception as e:
            self.log_result(
                "3.2 Wallet Requirements Check",
                False,
                f"Wallet check failed: {str(e)}",
                {"exception_type": type(e).__name__}
            )
    
    def debug_payment_link_creation(self):
        """DEBUG 4: Payment Link Creation Failures (5.1, 5.2) - field format analysis"""
        print("=" * 80)
        print("DEBUG 4: PAYMENT LINK CREATION FAILURES (5.1, 5.2)")
        print("=" * 80)
        
        if not self.jwt_token:
            self.log_result(
                "4.1 Payment Link Creation - Auth Check",
                False,
                "No JWT token available for payment link creation test"
            )
            return
        
        if not self.company_id:
            self.log_result(
                "4.1 Payment Link Creation - Company ID",
                False,
                "No company_id available for payment link creation test"
            )
            return
        
        # Test NEW format as specified in review request
        print(f"\n--- Testing NEW Payment Link Format ---")
        
        new_format_data = {
            "base_amount": 100.00,
            "base_currency": "USD",
            "company_id": self.company_id,
            "email": "test@dynopay.com",
            "modes": ["crypto", "card"],
            "description": "Test",
            "expire": "24h"
        }
        
        self.test_payment_link_format("NEW Format", new_format_data)
        
        # Test LEGACY format as specified in review request
        print(f"\n--- Testing LEGACY Payment Link Format ---")
        
        legacy_format_data = {
            "amount": 50.00,
            "currency": "USD",
            "company_id": self.company_id,
            "email": "test@dynopay.com",
            "modes": ["crypto", "card"],
            "description": "Test",
            "expire": "7d"
        }
        
        self.test_payment_link_format("LEGACY Format", legacy_format_data)
        
        # Test variations of modes field
        self.test_payment_modes_variations()
    
    def test_payment_link_format(self, format_name: str, payment_data: Dict):
        """Test specific payment link format"""
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        try:
            print(f"Testing {format_name}:")
            print(f"Payment Data: {json.dumps(payment_data, indent=2)}")
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=30
            )
            
            print(f"Request URL: {self.backend_url}/api/pay/createPaymentLink")
            print(f"Request Headers: {headers}")
            print(f"Response Status: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            print(f"Response Body: {response.text}")
            
            if response.status_code == 200:
                try:
                    response_data = response.json()
                    self.log_result(
                        f"4.1 Payment Link - {format_name}",
                        True,
                        f"{format_name} payment link creation succeeded",
                        {
                            "response": response_data,
                            "link_id": response_data.get('data', {}).get('link_id') if 'data' in response_data else None
                        }
                    )
                except json.JSONDecodeError:
                    self.log_result(
                        f"4.1 Payment Link - {format_name} Parse",
                        False,
                        f"{format_name} returned 200 but response is not valid JSON",
                        {"raw_response": response.text}
                    )
            else:
                # Analyze the exact error
                try:
                    error_data = response.json()
                    error_message = error_data.get('message', 'Unknown error')
                    
                    self.log_result(
                        f"4.1 Payment Link - {format_name} Error",
                        False,
                        f"{format_name} failed: {error_message}",
                        {
                            "status_code": response.status_code,
                            "error_response": error_data,
                            "possible_causes": self.analyze_payment_link_error(error_message, payment_data)
                        }
                    )
                except json.JSONDecodeError:
                    self.log_result(
                        f"4.1 Payment Link - {format_name} Raw Error",
                        False,
                        f"{format_name} failed with status {response.status_code}",
                        {
                            "status_code": response.status_code,
                            "raw_response": response.text
                        }
                    )
        
        except Exception as e:
            self.log_result(
                f"4.1 Payment Link - {format_name}",
                False,
                f"{format_name} request failed: {str(e)}",
                {"exception_type": type(e).__name__}
            )
    
    def analyze_payment_link_error(self, error_message: str, payment_data: Dict) -> list:
        """Analyze payment link creation error"""
        causes = []
        
        if "validation" in error_message.lower():
            causes.append("Field validation failed")
            
            # Check specific field issues
            if "amount" in error_message.lower():
                causes.append("Amount field format issue - check if using base_amount vs amount")
            if "currency" in error_message.lower():
                causes.append("Currency field format issue - check if using base_currency vs currency")
            if "modes" in error_message.lower():
                causes.append("Modes field format issue - check array format and values")
            if "email" in error_message.lower():
                causes.append("Email field validation failed")
        
        if "company" in error_message.lower():
            causes.append("Invalid company_id or company access issue")
        
        if "expire" in error_message.lower():
            causes.append("Invalid expire format - check if 24h/7d/30d format is correct")
        
        # Check for field conflicts
        has_base_amount = 'base_amount' in payment_data
        has_amount = 'amount' in payment_data
        has_base_currency = 'base_currency' in payment_data
        has_currency = 'currency' in payment_data
        
        if has_base_amount and has_amount:
            causes.append("Conflicting amount fields - has both base_amount and amount")
        if has_base_currency and has_currency:
            causes.append("Conflicting currency fields - has both base_currency and currency")
        
        if not causes:
            causes.append("Unknown validation error")
        
        return causes
    
    def test_payment_modes_variations(self):
        """Test different variations of the modes field"""
        print(f"\n--- Testing Payment Modes Variations ---")
        
        if not self.company_id:
            return
        
        modes_variations = [
            ["crypto", "card"],           # lowercase
            ["CRYPTO", "CARD"],           # uppercase  
            ["Crypto", "Card"],           # title case
            ["crypto"],                   # single mode
            ["card"],                     # single mode
            "crypto,card",                # string format
            {"crypto": True, "card": True} # object format
        ]
        
        base_data = {
            "base_amount": 25.00,
            "base_currency": "USD", 
            "company_id": self.company_id,
            "email": "modes.test@dynopay.com",
            "description": "Modes Test",
            "expire": "24h"
        }
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        for i, modes in enumerate(modes_variations):
            test_data = base_data.copy()
            test_data["modes"] = modes
            
            try:
                response = requests.post(
                    f"{self.backend_url}/api/pay/createPaymentLink",
                    json=test_data,
                    headers=headers,
                    timeout=30
                )
                
                print(f"Modes Variation {i+1}: {modes}")
                print(f"Status: {response.status_code}")
                print(f"Response: {response.text[:100]}...")
                
                success = response.status_code == 200
                self.log_result(
                    f"4.2 Payment Modes - Variation {i+1}",
                    success,
                    f"Modes format {modes} {'succeeded' if success else 'failed'}",
                    {
                        "modes_format": str(modes),
                        "modes_type": type(modes).__name__,
                        "status_code": response.status_code
                    }
                )
                
            except Exception as e:
                self.log_result(
                    f"4.2 Payment Modes - Variation {i+1}",
                    False,
                    f"Modes variation {i+1} failed: {str(e)}",
                    {"modes_format": str(modes)}
                )
    
    def run_debug_tests(self):
        """Run all debug tests in sequence"""
        print("🔍 DynoPay Backend - Debug Failed Tests")
        print("=" * 80)
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Credentials: {self.test_email}")
        print("=" * 80)
        
        # Run debug tests in order
        self.debug_login_and_get_company()
        
        if self.jwt_token:
            self.debug_company_creation()
            self.debug_api_key_creation()
            self.debug_payment_link_creation()
        else:
            print("\n⚠️  Skipping remaining tests - login failed")
        
        # Print summary
        self.print_debug_summary()
    
    def print_debug_summary(self):
        """Print comprehensive debug summary"""
        print("\n" + "=" * 80)
        print("DEBUG SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "0%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            for test_name, result in self.test_results.items():
                if not result['success']:
                    print(f"  • {test_name}: {result['message']}")
        
        if passed_tests > 0:
            print(f"\n✅ PASSED TESTS ({passed_tests}):")
            for test_name, result in self.test_results.items():
                if result['success']:
                    print(f"  • {test_name}: {result['message']}")
        
        print("\n" + "=" * 80)
        print("ROOT CAUSE ANALYSIS COMPLETE")
        print("=" * 80)

if __name__ == "__main__":
    tester = DynoPayDebugTester()
    tester.run_debug_tests()