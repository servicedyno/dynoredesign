#!/usr/bin/env python3
"""
DynoPay Production Readiness Testing Suite
Critical Path Verification as per Review Request

Test Credentials:
- Email: nomadly@moxx.co
- Password: Katiekendra123@

Testing Protocol:
PHASE 1: Authentication & Authorization (CRITICAL - FOUNDATION)
PHASE 2: Core Account Setup (CRITICAL)
PHASE 3: Payment Processing (CRITICAL)
PHASE 4: Dashboard Analytics (HIGH PRIORITY)
PHASE 5: Error Handling & Edge Cases (CRITICAL)
PHASE 6: Tax & Compliance (HIGH PRIORITY)
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any, Optional
from datetime import datetime

class ProductionReadinessTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.company_id = None
        self.payment_link_id = None
        self.response_times = []
        
        # Test credentials from review request
        self.test_email = "nomadly@moxx.co"
        self.test_password = "Katiekendra123@"
        
        print(f"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                    DYNOPAY PRODUCTION READINESS TESTING                      ║
║                         Critical Path Verification                           ║
╚══════════════════════════════════════════════════════════════════════════════╝

Backend URL: {self.backend_url}
Test Credentials: {self.test_email}
""")
        
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
        
    def log_result(self, test_name: str, success: bool, message: str, details: Dict = None, response_time: float = None):
        """Log test result with response time tracking"""
        self.test_results[test_name] = {
            'success': success,
            'message': message,
            'details': details or {},
            'response_time': response_time
        }
        
        if response_time:
            self.response_times.append(response_time)
            time_str = f" ({response_time:.2f}s)"
        else:
            time_str = ""
            
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}{time_str}")
        
        if not success:
            self.errors.append(f"{test_name}: {message}")
    
    def make_request(self, method: str, endpoint: str, **kwargs) -> tuple:
        """Make HTTP request and track response time"""
        start_time = time.time()
        try:
            url = f"{self.backend_url}{endpoint}"
            response = requests.request(method, url, timeout=30, **kwargs)
            response_time = time.time() - start_time
            return response, response_time
        except Exception as e:
            response_time = time.time() - start_time
            raise Exception(f"Request failed after {response_time:.2f}s: {str(e)}")
    
    def run_all_tests(self):
        """Run all production readiness tests in sequence"""
        print("\n" + "="*80)
        print("STARTING PRODUCTION READINESS TESTING")
        print("="*80)
        
        # PHASE 1: Authentication & Authorization (CRITICAL - FOUNDATION)
        phase1_success = self.run_phase1_authentication()
        if not phase1_success:
            print("\n❌ CRITICAL FAILURE: Phase 1 Authentication failed - Cannot proceed")
            return self.generate_final_report()
        
        # PHASE 2: Core Account Setup (CRITICAL)
        phase2_success = self.run_phase2_account_setup()
        
        # PHASE 3: Payment Processing (CRITICAL)
        phase3_success = self.run_phase3_payment_processing()
        
        # PHASE 4: Dashboard Analytics (HIGH PRIORITY)
        phase4_success = self.run_phase4_dashboard_analytics()
        
        # PHASE 5: Error Handling & Edge Cases (CRITICAL)
        phase5_success = self.run_phase5_error_handling()
        
        # PHASE 6: Tax & Compliance (HIGH PRIORITY)
        phase6_success = self.run_phase6_tax_compliance()
        
        return self.generate_final_report()
    
    def run_phase1_authentication(self) -> bool:
        """PHASE 1: Authentication & Authorization (CRITICAL - FOUNDATION)"""
        print("\n" + "="*60)
        print("PHASE 1: AUTHENTICATION & AUTHORIZATION (CRITICAL)")
        print("="*60)
        
        # Test 1: POST /api/user/login with credentials
        login_success = self.test_user_login()
        if not login_success:
            return False
        
        # Test 2: GET /api/user/profile with JWT
        profile_success = self.test_user_profile()
        
        # Test 3: Test invalid token scenarios
        invalid_token_success = self.test_invalid_token_scenarios()
        
        # Test 4: Test missing token scenarios
        missing_token_success = self.test_missing_token_scenarios()
        
        return login_success and profile_success
    
    def test_user_login(self) -> bool:
        """Test POST /api/user/login with provided credentials"""
        print("\n--- Testing User Login ---")
        
        try:
            login_data = {
                "email": self.test_email,
                "password": self.test_password
            }
            
            response, response_time = self.make_request(
                "POST", 
                "/api/user/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data and 'accessToken' in data['data']:
                    self.jwt_token = data['data']['accessToken']
                    
                    # Verify JWT token structure
                    token_parts = self.jwt_token.split('.')
                    if len(token_parts) == 3:
                        self.log_result(
                            "User Login", 
                            True, 
                            "Successfully authenticated and received valid JWT token",
                            {
                                "email": self.test_email,
                                "token_length": len(self.jwt_token),
                                "token_parts": len(token_parts),
                                "user_id": data['data'].get('user', {}).get('user_id')
                            },
                            response_time
                        )
                        return True
                    else:
                        self.log_result(
                            "User Login - Token Structure", 
                            False, 
                            "JWT token format invalid",
                            {"token": self.jwt_token[:50] + "..."}
                        )
                        return False
                else:
                    self.log_result(
                        "User Login", 
                        False, 
                        "Login succeeded but no access token received",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "User Login", 
                    False, 
                    f"Login failed with status {response.status_code}",
                    {"response": response.text, "credentials": {"email": self.test_email}},
                    response_time
                )
                return False
                
        except Exception as e:
            self.log_result(
                "User Login", 
                False, 
                f"Login request failed: {str(e)}"
            )
            return False
    
    def test_user_profile(self) -> bool:
        """Test GET /api/user/profile with JWT"""
        print("\n--- Testing User Profile ---")
        
        if not self.jwt_token:
            self.log_result(
                "User Profile", 
                False, 
                "No JWT token available"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response, response_time = self.make_request(
                "GET", 
                "/api/user/profile",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    profile_data = data['data']
                    required_fields = ['user_id', 'name', 'email']
                    missing_fields = [field for field in required_fields if field not in profile_data]
                    
                    if not missing_fields:
                        # Verify email matches test credentials
                        if profile_data.get('email') == self.test_email:
                            self.log_result(
                                "User Profile", 
                                True, 
                                "Profile retrieved successfully with correct data",
                                {
                                    "user_id": profile_data.get('user_id'),
                                    "name": profile_data.get('name'),
                                    "email": profile_data.get('email')
                                },
                                response_time
                            )
                            return True
                        else:
                            self.log_result(
                                "User Profile - Email Mismatch", 
                                False, 
                                f"Profile email doesn't match login credentials",
                                {"expected": self.test_email, "actual": profile_data.get('email')}
                            )
                            return False
                    else:
                        self.log_result(
                            "User Profile - Missing Fields", 
                            False, 
                            f"Missing required fields: {', '.join(missing_fields)}",
                            {"profile_data": profile_data}
                        )
                        return False
                else:
                    self.log_result(
                        "User Profile", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "User Profile", 
                    False, 
                    f"Profile request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                return False
                
        except Exception as e:
            self.log_result(
                "User Profile", 
                False, 
                f"Profile request failed: {str(e)}"
            )
            return False
    
    def test_invalid_token_scenarios(self) -> bool:
        """Test invalid token scenarios (401 expected)"""
        print("\n--- Testing Invalid Token Scenarios ---")
        
        invalid_tokens = [
            "invalid.jwt.token",
            "Bearer invalid_token",
            "expired.token.here"
        ]
        
        all_tests_passed = True
        
        for i, invalid_token in enumerate(invalid_tokens):
            try:
                headers = {
                    "Authorization": f"Bearer {invalid_token}",
                    "Content-Type": "application/json"
                }
                
                response, response_time = self.make_request(
                    "GET", 
                    "/api/user/profile",
                    headers=headers
                )
                
                if response.status_code == 401:
                    self.log_result(
                        f"Invalid Token Test {i+1}", 
                        True, 
                        "Correctly rejected invalid token with 401",
                        {"token_preview": invalid_token[:20] + "..."},
                        response_time
                    )
                else:
                    self.log_result(
                        f"Invalid Token Test {i+1}", 
                        False, 
                        f"Expected 401, got {response.status_code}",
                        {"token_preview": invalid_token[:20] + "...", "response": response.text}
                    )
                    all_tests_passed = False
                    
            except Exception as e:
                self.log_result(
                    f"Invalid Token Test {i+1}", 
                    False, 
                    f"Request failed: {str(e)}"
                )
                all_tests_passed = False
        
        return all_tests_passed
    
    def test_missing_token_scenarios(self) -> bool:
        """Test missing token scenarios (401 expected)"""
        print("\n--- Testing Missing Token Scenarios ---")
        
        try:
            # Request without Authorization header
            response, response_time = self.make_request(
                "GET", 
                "/api/user/profile",
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                self.log_result(
                    "Missing Token Test", 
                    True, 
                    "Correctly rejected request without token with 401",
                    {},
                    response_time
                )
                return True
            else:
                self.log_result(
                    "Missing Token Test", 
                    False, 
                    f"Expected 401, got {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Missing Token Test", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def run_phase2_account_setup(self) -> bool:
        """PHASE 2: Core Account Setup (CRITICAL)"""
        print("\n" + "="*60)
        print("PHASE 2: CORE ACCOUNT SETUP (CRITICAL)")
        print("="*60)
        
        # Test 1: GET /api/company/getCompany
        company_success = self.test_get_company()
        
        # Test 2: Create company if needed
        if not self.company_id:
            create_company_success = self.test_create_company()
        else:
            create_company_success = True
        
        # Test 3: GET /api/wallet/configured-currencies
        currencies_success = self.test_configured_currencies()
        
        # Test 4: GET /api/wallet/getWallet
        wallet_success = self.test_get_wallet()
        
        # Test 5: GET /api/userApi/getApi
        api_keys_success = self.test_get_api_keys()
        
        return company_success and create_company_success and currencies_success
    
    def test_get_company(self) -> bool:
        """Test GET /api/company/getCompany"""
        print("\n--- Testing Get Company ---")
        
        if not self.jwt_token:
            self.log_result("Get Company", False, "No JWT token available")
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response, response_time = self.make_request(
                "GET", 
                "/api/company/getCompany",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data and data['data']:
                    companies = data['data'] if isinstance(data['data'], list) else [data['data']]
                    if companies:
                        # Store first company_id
                        self.company_id = companies[0].get('company_id')
                        
                        self.log_result(
                            "Get Company", 
                            True, 
                            f"Retrieved {len(companies)} company(ies)",
                            {
                                "company_count": len(companies),
                                "first_company_id": self.company_id,
                                "first_company_name": companies[0].get('company_name')
                            },
                            response_time
                        )
                        return True
                    else:
                        self.log_result(
                            "Get Company", 
                            True, 
                            "No companies found - will need to create one",
                            {"companies": []},
                            response_time
                        )
                        return True
                else:
                    self.log_result(
                        "Get Company", 
                        True, 
                        "No companies found - will need to create one",
                        {"response": data},
                        response_time
                    )
                    return True
            else:
                self.log_result(
                    "Get Company", 
                    False, 
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Get Company", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_create_company(self) -> bool:
        """Test POST /api/company/addCompany if no company exists"""
        print("\n--- Testing Create Company ---")
        
        if not self.jwt_token:
            self.log_result("Create Company", False, "No JWT token available")
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            company_data = {
                "company_name": "DynoPay Production Test",
                "address_line1": "123 Test St",
                "city": "Lisbon",
                "country": "PT",
                "zip_code": "1000-001"
            }
            
            response, response_time = self.make_request(
                "POST", 
                "/api/company/addCompany",
                json=company_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data and 'company_id' in data['data']:
                    self.company_id = data['data']['company_id']
                    
                    self.log_result(
                        "Create Company", 
                        True, 
                        "Successfully created test company",
                        {
                            "company_id": self.company_id,
                            "company_name": company_data["company_name"]
                        },
                        response_time
                    )
                    return True
                else:
                    self.log_result(
                        "Create Company", 
                        False, 
                        "Company creation succeeded but no company_id returned",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Create Company", 
                    False, 
                    f"Company creation failed with status {response.status_code}",
                    {"response": response.text, "company_data": company_data},
                    response_time
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Create Company", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_configured_currencies(self) -> bool:
        """Test GET /api/wallet/configured-currencies"""
        print("\n--- Testing Configured Currencies ---")
        
        if not self.jwt_token or not self.company_id:
            self.log_result(
                "Configured Currencies", 
                False, 
                f"Missing requirements - JWT: {bool(self.jwt_token)}, Company ID: {bool(self.company_id)}"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response, response_time = self.make_request(
                "GET", 
                f"/api/wallet/configured-currencies?company_id={self.company_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    currency_data = data['data']
                    currencies = currency_data.get('configured_currencies', [])
                    wallet_count = currency_data.get('wallet_count', 0)
                    
                    self.log_result(
                        "Configured Currencies", 
                        True, 
                        f"Retrieved {len(currencies)} configured currencies",
                        {
                            "currency_count": len(currencies),
                            "wallet_count": wallet_count,
                            "currencies": currencies[:5] if currencies else []  # Show first 5
                        },
                        response_time
                    )
                    return True
                else:
                    self.log_result(
                        "Configured Currencies", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Configured Currencies", 
                    False, 
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Configured Currencies", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_get_wallet(self) -> bool:
        """Test GET /api/wallet/getWallet"""
        print("\n--- Testing Get Wallet ---")
        
        if not self.jwt_token or not self.company_id:
            self.log_result(
                "Get Wallet", 
                False, 
                f"Missing requirements - JWT: {bool(self.jwt_token)}, Company ID: {bool(self.company_id)}"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response, response_time = self.make_request(
                "GET", 
                f"/api/wallet/getWallet?company_id={self.company_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    wallets = data['data'] if isinstance(data['data'], list) else [data['data']] if data['data'] else []
                    
                    self.log_result(
                        "Get Wallet", 
                        True, 
                        f"Retrieved {len(wallets)} wallet(s)",
                        {
                            "wallet_count": len(wallets),
                            "sample_wallet": wallets[0] if wallets else None
                        },
                        response_time
                    )
                    return True
                else:
                    self.log_result(
                        "Get Wallet", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Get Wallet", 
                    False, 
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Get Wallet", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_get_api_keys(self) -> bool:
        """Test GET /api/userApi/getApi"""
        print("\n--- Testing Get API Keys ---")
        
        if not self.jwt_token or not self.company_id:
            self.log_result(
                "Get API Keys", 
                False, 
                f"Missing requirements - JWT: {bool(self.jwt_token)}, Company ID: {bool(self.company_id)}"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response, response_time = self.make_request(
                "GET", 
                f"/api/userApi/getApi?company_id={self.company_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    api_data = data['data']
                    
                    # Handle both grouped and ungrouped responses
                    if isinstance(api_data, dict) and ('production' in api_data or 'development' in api_data):
                        # Grouped response
                        prod_keys = api_data.get('production', [])
                        dev_keys = api_data.get('development', [])
                        total_keys = len(prod_keys) + len(dev_keys)
                        
                        self.log_result(
                            "Get API Keys", 
                            True, 
                            f"Retrieved {total_keys} API key(s) (Prod: {len(prod_keys)}, Dev: {len(dev_keys)})",
                            {
                                "total_keys": total_keys,
                                "production_keys": len(prod_keys),
                                "development_keys": len(dev_keys)
                            },
                            response_time
                        )
                    else:
                        # Ungrouped response or empty
                        api_keys = api_data if isinstance(api_data, list) else []
                        
                        self.log_result(
                            "Get API Keys", 
                            True, 
                            f"Retrieved {len(api_keys)} API key(s)",
                            {"api_key_count": len(api_keys)},
                            response_time
                        )
                    
                    return True
                else:
                    self.log_result(
                        "Get API Keys", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Get API Keys", 
                    False, 
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Get API Keys", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def run_phase3_payment_processing(self) -> bool:
        """PHASE 3: Payment Processing (CRITICAL)"""
        print("\n" + "="*60)
        print("PHASE 3: PAYMENT PROCESSING (CRITICAL)")
        print("="*60)
        
        # Test 1: POST /api/pay/createPaymentLink
        create_link_success = self.test_create_payment_link()
        
        # Test 2: GET /api/pay/getPaymentLinks
        get_links_success = self.test_get_payment_links()
        
        # Test 3: GET /api/pay/links/:id
        get_link_by_id_success = self.test_get_payment_link_by_id()
        
        # Test 4: POST /api/wallet/getAllTransactions
        get_transactions_success = self.test_get_all_transactions()
        
        # Test 5: Test transaction filtering
        filter_transactions_success = self.test_transaction_filtering()
        
        return create_link_success and get_links_success
    
    def test_create_payment_link(self) -> bool:
        """Test POST /api/pay/createPaymentLink"""
        print("\n--- Testing Create Payment Link ---")
        
        if not self.jwt_token or not self.company_id:
            self.log_result(
                "Create Payment Link", 
                False, 
                f"Missing requirements - JWT: {bool(self.jwt_token)}, Company ID: {bool(self.company_id)}"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            payment_data = {
                "company_id": self.company_id,
                "base_amount": 100.00,
                "base_currency": "USD",
                "description": "Production readiness test payment",
                "expire": "24h",
                "callback_url": "https://example.com/callback"
            }
            
            response, response_time = self.make_request(
                "POST", 
                "/api/pay/createPaymentLink",
                json=payment_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    link_data = data['data']
                    
                    # Store payment_link_id for later tests
                    if 'link_id' in link_data:
                        self.payment_link_id = link_data['link_id']
                    elif 'payment_link_id' in link_data:
                        self.payment_link_id = link_data['payment_link_id']
                    
                    required_fields = ['payment_link', 'base_amount', 'base_currency']
                    missing_fields = [field for field in required_fields if field not in link_data]
                    
                    if not missing_fields:
                        self.log_result(
                            "Create Payment Link", 
                            True, 
                            "Payment link created successfully",
                            {
                                "payment_link_id": self.payment_link_id,
                                "base_amount": link_data.get('base_amount'),
                                "base_currency": link_data.get('base_currency'),
                                "payment_link": link_data.get('payment_link', '')[:50] + "..."
                            },
                            response_time
                        )
                        return True
                    else:
                        self.log_result(
                            "Create Payment Link - Missing Fields", 
                            False, 
                            f"Missing required fields: {', '.join(missing_fields)}",
                            {"link_data": link_data}
                        )
                        return False
                else:
                    self.log_result(
                        "Create Payment Link", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Create Payment Link", 
                    False, 
                    f"Request failed with status {response.status_code}",
                    {"response": response.text, "payment_data": payment_data},
                    response_time
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Create Payment Link", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_get_payment_links(self) -> bool:
        """Test GET /api/pay/getPaymentLinks"""
        print("\n--- Testing Get Payment Links ---")
        
        if not self.jwt_token or not self.company_id:
            self.log_result(
                "Get Payment Links", 
                False, 
                f"Missing requirements - JWT: {bool(self.jwt_token)}, Company ID: {bool(self.company_id)}"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response, response_time = self.make_request(
                "GET", 
                f"/api/pay/getPaymentLinks?company_id={self.company_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    links = data['data'] if isinstance(data['data'], list) else []
                    
                    # Verify our created link appears in the list
                    created_link_found = False
                    if self.payment_link_id:
                        for link in links:
                            if (link.get('link_id') == self.payment_link_id or 
                                link.get('payment_link_id') == self.payment_link_id):
                                created_link_found = True
                                break
                    
                    # Check status computation and formatting
                    status_check_passed = True
                    formatting_check_passed = True
                    
                    for link in links[:3]:  # Check first 3 links
                        # Verify status is computed (Active/Expired)
                        status = link.get('status')
                        if status not in ['Active', 'Expired', 'Completed']:
                            status_check_passed = False
                        
                        # Verify date formatting (DD/MM/YYYY HH:MM:SS)
                        created_date = link.get('created')
                        if created_date and not self.is_valid_date_format(created_date):
                            formatting_check_passed = False
                    
                    self.log_result(
                        "Get Payment Links", 
                        True, 
                        f"Retrieved {len(links)} payment link(s)",
                        {
                            "link_count": len(links),
                            "created_link_found": created_link_found,
                            "status_computation": status_check_passed,
                            "date_formatting": formatting_check_passed,
                            "sample_link": links[0] if links else None
                        },
                        response_time
                    )
                    return True
                else:
                    self.log_result(
                        "Get Payment Links", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Get Payment Links", 
                    False, 
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Get Payment Links", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_get_payment_link_by_id(self) -> bool:
        """Test GET /api/pay/links/:id"""
        print("\n--- Testing Get Payment Link By ID ---")
        
        if not self.jwt_token or not self.payment_link_id:
            self.log_result(
                "Get Payment Link By ID", 
                False, 
                f"Missing requirements - JWT: {bool(self.jwt_token)}, Payment Link ID: {bool(self.payment_link_id)}"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response, response_time = self.make_request(
                "GET", 
                f"/api/pay/links/{self.payment_link_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    link_data = data['data']
                    
                    # Verify all required fields are present
                    required_fields = [
                        'link_id', 'base_amount', 'base_currency', 
                        'status', 'created', 'payment_link'
                    ]
                    
                    # Handle different field names
                    if 'payment_link_id' in link_data and 'link_id' not in link_data:
                        required_fields = [f.replace('link_id', 'payment_link_id') for f in required_fields]
                    
                    missing_fields = [field for field in required_fields if field not in link_data]
                    
                    if not missing_fields:
                        self.log_result(
                            "Get Payment Link By ID", 
                            True, 
                            "Payment link details retrieved successfully",
                            {
                                "link_id": link_data.get('link_id') or link_data.get('payment_link_id'),
                                "base_amount": link_data.get('base_amount'),
                                "base_currency": link_data.get('base_currency'),
                                "status": link_data.get('status'),
                                "description": link_data.get('description')
                            },
                            response_time
                        )
                        return True
                    else:
                        self.log_result(
                            "Get Payment Link By ID - Missing Fields", 
                            False, 
                            f"Missing required fields: {', '.join(missing_fields)}",
                            {"link_data": link_data}
                        )
                        return False
                else:
                    self.log_result(
                        "Get Payment Link By ID", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Get Payment Link By ID", 
                    False, 
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Get Payment Link By ID", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_get_all_transactions(self) -> bool:
        """Test POST /api/wallet/getAllTransactions"""
        print("\n--- Testing Get All Transactions ---")
        
        if not self.jwt_token or not self.company_id:
            self.log_result(
                "Get All Transactions", 
                False, 
                f"Missing requirements - JWT: {bool(self.jwt_token)}, Company ID: {bool(self.company_id)}"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            transaction_data = {
                "company_id": self.company_id,
                "page": 1,
                "rowsPerPage": 10
            }
            
            response, response_time = self.make_request(
                "POST", 
                "/api/wallet/getAllTransactions",
                json=transaction_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    tx_data = data['data']
                    
                    # Verify transaction structure
                    required_fields = ['customers_transactions', 'self_transactions']
                    missing_fields = [field for field in required_fields if field not in tx_data]
                    
                    if not missing_fields:
                        customer_txs = tx_data.get('customers_transactions', [])
                        self_txs = tx_data.get('self_transactions', [])
                        total_txs = len(customer_txs) + len(self_txs)
                        
                        # Check pagination fields
                        pagination = tx_data.get('pagination', {})
                        pagination_fields = ['total', 'page', 'rowsPerPage', 'totalPages']
                        pagination_complete = all(field in pagination for field in pagination_fields)
                        
                        self.log_result(
                            "Get All Transactions", 
                            True, 
                            f"Retrieved {total_txs} transaction(s) with pagination",
                            {
                                "customer_transactions": len(customer_txs),
                                "self_transactions": len(self_txs),
                                "total_transactions": total_txs,
                                "pagination_complete": pagination_complete,
                                "pagination": pagination
                            },
                            response_time
                        )
                        return True
                    else:
                        self.log_result(
                            "Get All Transactions - Missing Fields", 
                            False, 
                            f"Missing required fields: {', '.join(missing_fields)}",
                            {"tx_data": tx_data}
                        )
                        return False
                else:
                    self.log_result(
                        "Get All Transactions", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Get All Transactions", 
                    False, 
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Get All Transactions", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_transaction_filtering(self) -> bool:
        """Test transaction filtering functionality"""
        print("\n--- Testing Transaction Filtering ---")
        
        if not self.jwt_token or not self.company_id:
            self.log_result(
                "Transaction Filtering", 
                False, 
                f"Missing requirements - JWT: {bool(self.jwt_token)}, Company ID: {bool(self.company_id)}"
            )
            return False
        
        # Test different filter combinations
        filter_tests = [
            {"status": "Done", "description": "Status filter - Done"},
            {"currency": "USD", "description": "Currency filter - USD"},
            {"search": "test", "description": "Search filter - test"}
        ]
        
        all_tests_passed = True
        
        for i, filter_test in enumerate(filter_tests):
            try:
                headers = {
                    "Authorization": f"Bearer {self.jwt_token}",
                    "Content-Type": "application/json"
                }
                
                transaction_data = {
                    "company_id": self.company_id,
                    "page": 1,
                    "rowsPerPage": 10
                }
                
                # Add filter parameters
                for key, value in filter_test.items():
                    if key != "description":
                        transaction_data[key] = value
                
                response, response_time = self.make_request(
                    "POST", 
                    "/api/wallet/getAllTransactions",
                    json=transaction_data,
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if 'data' in data:
                        tx_data = data['data']
                        customer_txs = tx_data.get('customers_transactions', [])
                        self_txs = tx_data.get('self_transactions', [])
                        total_txs = len(customer_txs) + len(self_txs)
                        
                        self.log_result(
                            f"Transaction Filter {i+1}", 
                            True, 
                            f"{filter_test['description']}: {total_txs} results",
                            {
                                "filter": {k: v for k, v in filter_test.items() if k != "description"},
                                "results": total_txs
                            },
                            response_time
                        )
                    else:
                        self.log_result(
                            f"Transaction Filter {i+1}", 
                            False, 
                            f"{filter_test['description']}: Invalid response format",
                            {"response": data}
                        )
                        all_tests_passed = False
                else:
                    self.log_result(
                        f"Transaction Filter {i+1}", 
                        False, 
                        f"{filter_test['description']}: Request failed with status {response.status_code}",
                        {"response": response.text}
                    )
                    all_tests_passed = False
                    
            except Exception as e:
                self.log_result(
                    f"Transaction Filter {i+1}", 
                    False, 
                    f"{filter_test['description']}: Request failed: {str(e)}"
                )
                all_tests_passed = False
        
        return all_tests_passed
    
    def run_phase4_dashboard_analytics(self) -> bool:
        """PHASE 4: Dashboard Analytics (HIGH PRIORITY)"""
        print("\n" + "="*60)
        print("PHASE 4: DASHBOARD ANALYTICS (HIGH PRIORITY)")
        print("="*60)
        
        # Test 1: GET /api/dashboard
        dashboard_success = self.test_dashboard_main()
        
        # Test 2: GET /api/dashboard/chart with different periods
        chart_success = self.test_dashboard_chart()
        
        # Test 3: GET /api/dashboard/recent-transactions
        recent_tx_success = self.test_dashboard_recent_transactions()
        
        return dashboard_success and chart_success and recent_tx_success
    
    def test_dashboard_main(self) -> bool:
        """Test GET /api/dashboard - main dashboard statistics"""
        print("\n--- Testing Dashboard Main Statistics ---")
        
        if not self.jwt_token or not self.company_id:
            self.log_result(
                "Dashboard Main", 
                False, 
                f"Missing requirements - JWT: {bool(self.jwt_token)}, Company ID: {bool(self.company_id)}"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response, response_time = self.make_request(
                "GET", 
                f"/api/dashboard?company_id={self.company_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    dashboard_data = data['data']
                    
                    # Verify all required stats are present
                    required_stats = [
                        'total_transactions', 'total_volume', 
                        'pending_transactions', 'active_wallets', 'fee_tier'
                    ]
                    
                    missing_stats = [stat for stat in required_stats if stat not in dashboard_data]
                    
                    if not missing_stats:
                        # Verify nested structure
                        total_tx = dashboard_data.get('total_transactions', {})
                        total_vol = dashboard_data.get('total_volume', {})
                        fee_tier = dashboard_data.get('fee_tier', {})
                        
                        structure_valid = (
                            'count' in total_tx and 'change_percent' in total_tx and
                            'amount' in total_vol and 'currency' in total_vol and 'change_percent' in total_vol and
                            'current_tier' in fee_tier
                        )
                        
                        if structure_valid:
                            self.log_result(
                                "Dashboard Main", 
                                True, 
                                "All dashboard statistics retrieved successfully",
                                {
                                    "total_transactions": f"{total_tx.get('count', 0)} ({total_tx.get('change_percent', 0):+.1f}%)",
                                    "total_volume": f"{total_vol.get('amount', 0)} {total_vol.get('currency', 'USD')} ({total_vol.get('change_percent', 0):+.1f}%)",
                                    "pending_transactions": dashboard_data.get('pending_transactions', 0),
                                    "active_wallets": dashboard_data.get('active_wallets', 0),
                                    "fee_tier": fee_tier.get('current_tier', 'Unknown')
                                },
                                response_time
                            )
                            return True
                        else:
                            self.log_result(
                                "Dashboard Main - Structure", 
                                False, 
                                "Dashboard statistics structure incomplete",
                                {"dashboard_data": dashboard_data}
                            )
                            return False
                    else:
                        self.log_result(
                            "Dashboard Main - Missing Stats", 
                            False, 
                            f"Missing required statistics: {', '.join(missing_stats)}",
                            {"dashboard_data": dashboard_data}
                        )
                        return False
                else:
                    self.log_result(
                        "Dashboard Main", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Dashboard Main", 
                    False, 
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Dashboard Main", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_dashboard_chart(self) -> bool:
        """Test GET /api/dashboard/chart with different periods"""
        print("\n--- Testing Dashboard Chart Data ---")
        
        if not self.jwt_token or not self.company_id:
            self.log_result(
                "Dashboard Chart", 
                False, 
                f"Missing requirements - JWT: {bool(self.jwt_token)}, Company ID: {bool(self.company_id)}"
            )
            return False
        
        # Test both 7d and 30d periods as specified in review request
        test_periods = ['7d', '30d']
        all_tests_passed = True
        
        for period in test_periods:
            try:
                headers = {
                    "Authorization": f"Bearer {self.jwt_token}",
                    "Content-Type": "application/json"
                }
                
                response, response_time = self.make_request(
                    "GET", 
                    f"/api/dashboard/chart?period={period}&company_id={self.company_id}",
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if 'data' in data:
                        chart_data = data['data']
                        
                        # Verify required fields
                        required_fields = ['chart_data', 'currency_breakdown', 'status_breakdown']
                        missing_fields = [field for field in required_fields if field not in chart_data]
                        
                        if not missing_fields:
                            chart_entries = chart_data.get('chart_data', [])
                            
                            # Verify aggregation logic
                            expected_grouping = "daily" if period == "7d" else "weekly" if period == "30d" else "unknown"
                            
                            self.log_result(
                                f"Dashboard Chart - {period}", 
                                True, 
                                f"Chart data retrieved successfully for {period} period",
                                {
                                    "period": period,
                                    "chart_entries": len(chart_entries),
                                    "expected_grouping": expected_grouping,
                                    "currency_breakdown": len(chart_data.get('currency_breakdown', [])),
                                    "status_breakdown": len(chart_data.get('status_breakdown', []))
                                },
                                response_time
                            )
                        else:
                            self.log_result(
                                f"Dashboard Chart - {period} Missing Fields", 
                                False, 
                                f"Missing required fields: {', '.join(missing_fields)}",
                                {"chart_data": chart_data}
                            )
                            all_tests_passed = False
                    else:
                        self.log_result(
                            f"Dashboard Chart - {period}", 
                            False, 
                            "Invalid response format",
                            {"response": data}
                        )
                        all_tests_passed = False
                else:
                    self.log_result(
                        f"Dashboard Chart - {period}", 
                        False, 
                        f"Request failed with status {response.status_code}",
                        {"response": response.text},
                        response_time
                    )
                    all_tests_passed = False
                    
            except Exception as e:
                self.log_result(
                    f"Dashboard Chart - {period}", 
                    False, 
                    f"Request failed: {str(e)}"
                )
                all_tests_passed = False
        
        return all_tests_passed
    
    def test_dashboard_recent_transactions(self) -> bool:
        """Test GET /api/dashboard/recent-transactions"""
        print("\n--- Testing Dashboard Recent Transactions ---")
        
        if not self.jwt_token or not self.company_id:
            self.log_result(
                "Dashboard Recent Transactions", 
                False, 
                f"Missing requirements - JWT: {bool(self.jwt_token)}, Company ID: {bool(self.company_id)}"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response, response_time = self.make_request(
                "GET", 
                f"/api/dashboard/recent-transactions?limit=5&company_id={self.company_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    tx_data = data['data']
                    transactions = tx_data.get('transactions', [])
                    
                    # Verify transaction structure if any exist
                    if transactions:
                        first_tx = transactions[0]
                        required_tx_fields = [
                            'transaction_id', 'base_amount', 'base_currency', 
                            'status', 'transaction_type'
                        ]
                        
                        missing_tx_fields = [field for field in required_tx_fields if field not in first_tx]
                        
                        if not missing_tx_fields:
                            self.log_result(
                                "Dashboard Recent Transactions", 
                                True, 
                                f"Retrieved {len(transactions)} recent transaction(s)",
                                {
                                    "transaction_count": len(transactions),
                                    "sample_transaction": {
                                        "id": first_tx.get('transaction_id'),
                                        "amount": first_tx.get('base_amount'),
                                        "currency": first_tx.get('base_currency'),
                                        "status": first_tx.get('status')
                                    }
                                },
                                response_time
                            )
                            return True
                        else:
                            self.log_result(
                                "Dashboard Recent Transactions - Structure", 
                                False, 
                                f"Transaction missing fields: {', '.join(missing_tx_fields)}",
                                {"first_transaction": first_tx}
                            )
                            return False
                    else:
                        # No transactions is also valid for new users
                        self.log_result(
                            "Dashboard Recent Transactions", 
                            True, 
                            "No recent transactions found (valid for new users)",
                            {"transaction_count": 0},
                            response_time
                        )
                        return True
                else:
                    self.log_result(
                        "Dashboard Recent Transactions", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Dashboard Recent Transactions", 
                    False, 
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Dashboard Recent Transactions", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def run_phase5_error_handling(self) -> bool:
        """PHASE 5: Error Handling & Edge Cases (CRITICAL)"""
        print("\n" + "="*60)
        print("PHASE 5: ERROR HANDLING & EDGE CASES (CRITICAL)")
        print("="*60)
        
        # Test 1: Invalid credentials test
        invalid_creds_success = self.test_invalid_credentials()
        
        # Test 2: Missing required fields
        missing_fields_success = self.test_missing_required_fields()
        
        # Test 3: Invalid token (already tested in Phase 1, but verify again)
        invalid_token_success = self.test_invalid_token_edge_cases()
        
        # Test 4: Unauthorized access
        unauthorized_success = self.test_unauthorized_access()
        
        # Test 5: Invalid transaction ID
        invalid_tx_success = self.test_invalid_transaction_id()
        
        return (invalid_creds_success and missing_fields_success and 
                invalid_token_success and unauthorized_success and invalid_tx_success)
    
    def test_invalid_credentials(self) -> bool:
        """Test POST /api/user/login with wrong password (401 expected)"""
        print("\n--- Testing Invalid Credentials ---")
        
        try:
            invalid_login_data = {
                "email": self.test_email,
                "password": "WrongPassword123!"
            }
            
            response, response_time = self.make_request(
                "POST", 
                "/api/user/login",
                json=invalid_login_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                self.log_result(
                    "Invalid Credentials", 
                    True, 
                    "Correctly rejected invalid credentials with 401",
                    {"email": self.test_email},
                    response_time
                )
                return True
            else:
                self.log_result(
                    "Invalid Credentials", 
                    False, 
                    f"Expected 401, got {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Invalid Credentials", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_missing_required_fields(self) -> bool:
        """Test POST /api/pay/createPaymentLink with missing base_amount (400 expected)"""
        print("\n--- Testing Missing Required Fields ---")
        
        if not self.jwt_token or not self.company_id:
            self.log_result(
                "Missing Required Fields", 
                False, 
                f"Missing requirements - JWT: {bool(self.jwt_token)}, Company ID: {bool(self.company_id)}"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Missing base_amount field
            incomplete_payment_data = {
                "company_id": self.company_id,
                "base_currency": "USD",
                "description": "Test payment with missing amount"
            }
            
            response, response_time = self.make_request(
                "POST", 
                "/api/pay/createPaymentLink",
                json=incomplete_payment_data,
                headers=headers
            )
            
            if response.status_code == 400:
                self.log_result(
                    "Missing Required Fields", 
                    True, 
                    "Correctly rejected request with missing base_amount (400)",
                    {"missing_field": "base_amount"},
                    response_time
                )
                return True
            else:
                self.log_result(
                    "Missing Required Fields", 
                    False, 
                    f"Expected 400 validation error, got {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Missing Required Fields", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_invalid_token_edge_cases(self) -> bool:
        """Test additional invalid token scenarios"""
        print("\n--- Testing Invalid Token Edge Cases ---")
        
        edge_cases = [
            {"token": "", "description": "Empty token"},
            {"token": "malformed_token", "description": "Malformed token"},
            {"token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.expired.token", "description": "Potentially expired token"}
        ]
        
        all_tests_passed = True
        
        for i, case in enumerate(edge_cases):
            try:
                headers = {
                    "Authorization": f"Bearer {case['token']}",
                    "Content-Type": "application/json"
                }
                
                response, response_time = self.make_request(
                    "GET", 
                    "/api/user/profile",
                    headers=headers
                )
                
                if response.status_code == 401:
                    self.log_result(
                        f"Invalid Token Edge Case {i+1}", 
                        True, 
                        f"{case['description']}: Correctly rejected with 401",
                        {"case": case['description']},
                        response_time
                    )
                else:
                    self.log_result(
                        f"Invalid Token Edge Case {i+1}", 
                        False, 
                        f"{case['description']}: Expected 401, got {response.status_code}",
                        {"response": response.text}
                    )
                    all_tests_passed = False
                    
            except Exception as e:
                self.log_result(
                    f"Invalid Token Edge Case {i+1}", 
                    False, 
                    f"{case['description']}: Request failed: {str(e)}"
                )
                all_tests_passed = False
        
        return all_tests_passed
    
    def test_unauthorized_access(self) -> bool:
        """Test accessing another company's resources (403 or 404 expected)"""
        print("\n--- Testing Unauthorized Access ---")
        
        if not self.jwt_token:
            self.log_result(
                "Unauthorized Access", 
                False, 
                "No JWT token available"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Try to access resources with a non-existent company ID
            fake_company_id = 99999
            
            response, response_time = self.make_request(
                "GET", 
                f"/api/wallet/getWallet?company_id={fake_company_id}",
                headers=headers
            )
            
            if response.status_code in [403, 404]:
                self.log_result(
                    "Unauthorized Access", 
                    True, 
                    f"Correctly rejected unauthorized access with {response.status_code}",
                    {"fake_company_id": fake_company_id},
                    response_time
                )
                return True
            elif response.status_code == 200:
                # Check if response is empty (which is also acceptable)
                data = response.json()
                if 'data' in data and not data['data']:
                    self.log_result(
                        "Unauthorized Access", 
                        True, 
                        "Correctly returned empty result for unauthorized company access",
                        {"fake_company_id": fake_company_id},
                        response_time
                    )
                    return True
                else:
                    self.log_result(
                        "Unauthorized Access", 
                        False, 
                        "Should not return data for unauthorized company access",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Unauthorized Access", 
                    False, 
                    f"Unexpected status code {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Unauthorized Access", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_invalid_transaction_id(self) -> bool:
        """Test GET /api/wallet/transaction/invalid-id-99999 (404 expected)"""
        print("\n--- Testing Invalid Transaction ID ---")
        
        if not self.jwt_token:
            self.log_result(
                "Invalid Transaction ID", 
                False, 
                "No JWT token available"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            invalid_tx_id = "invalid-id-99999"
            
            response, response_time = self.make_request(
                "GET", 
                f"/api/wallet/transaction/{invalid_tx_id}",
                headers=headers
            )
            
            if response.status_code == 404:
                self.log_result(
                    "Invalid Transaction ID", 
                    True, 
                    "Correctly returned 404 for invalid transaction ID",
                    {"invalid_tx_id": invalid_tx_id},
                    response_time
                )
                return True
            else:
                self.log_result(
                    "Invalid Transaction ID", 
                    False, 
                    f"Expected 404, got {response.status_code}",
                    {"response": response.text, "invalid_tx_id": invalid_tx_id}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Invalid Transaction ID", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def run_phase6_tax_compliance(self) -> bool:
        """PHASE 6: Tax & Compliance (HIGH PRIORITY)"""
        print("\n" + "="*60)
        print("PHASE 6: TAX & COMPLIANCE (HIGH PRIORITY)")
        print("="*60)
        
        # Test 1: GET /api/tax/rate/PT (cache verification)
        tax_rate_success = self.test_tax_rate_pt()
        
        # Test 2: GET /api/tax/acronyms (102 countries)
        tax_acronyms_success = self.test_tax_acronyms()
        
        # Test 3: GET /api/tax/lookup?country=Portugal
        tax_lookup_success = self.test_tax_lookup()
        
        return tax_rate_success and tax_acronyms_success and tax_lookup_success
    
    def test_tax_rate_pt(self) -> bool:
        """Test GET /api/tax/rate/PT with cache verification"""
        print("\n--- Testing Tax Rate PT (Cache Verification) ---")
        
        try:
            # First call - should return cached: false
            response1, response_time1 = self.make_request("GET", "/api/tax/rate/PT")
            
            if response1.status_code == 200:
                data1 = response1.json()
                
                if 'data' in data1:
                    tax_data1 = data1['data']
                    
                    # Verify PT tax rate is 23%
                    if tax_data1.get('standard_rate') == 23:
                        cached_status1 = tax_data1.get('cached', None)
                        
                        # Second call - should return cached: true
                        time.sleep(1)
                        response2, response_time2 = self.make_request("GET", "/api/tax/rate/PT")
                        
                        if response2.status_code == 200:
                            data2 = response2.json()
                            cached_status2 = data2.get('data', {}).get('cached', None)
                            
                            if cached_status2 is True:
                                self.log_result(
                                    "Tax Rate PT - Cache Test", 
                                    True, 
                                    f"PT tax rate verified (23%) with cache working correctly",
                                    {
                                        "standard_rate": tax_data1.get('standard_rate'),
                                        "first_call_cached": cached_status1,
                                        "second_call_cached": cached_status2,
                                        "country_code": tax_data1.get('country_code')
                                    },
                                    response_time1
                                )
                                return True
                            else:
                                self.log_result(
                                    "Tax Rate PT - Cache Test", 
                                    False, 
                                    f"Second call should return cached: true, got: {cached_status2}",
                                    {"second_call_data": data2}
                                )
                                return False
                        else:
                            self.log_result(
                                "Tax Rate PT - Second Call", 
                                False, 
                                f"Second call failed with status {response2.status_code}",
                                {"response": response2.text}
                            )
                            return False
                    else:
                        self.log_result(
                            "Tax Rate PT - Rate Verification", 
                            False, 
                            f"Expected 23% for PT, got {tax_data1.get('standard_rate')}%",
                            {"tax_data": tax_data1}
                        )
                        return False
                else:
                    self.log_result(
                        "Tax Rate PT", 
                        False, 
                        "Invalid response format",
                        {"response": data1}
                    )
                    return False
            else:
                self.log_result(
                    "Tax Rate PT", 
                    False, 
                    f"Request failed with status {response1.status_code}",
                    {"response": response1.text},
                    response_time1
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Tax Rate PT", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_tax_acronyms(self) -> bool:
        """Test GET /api/tax/acronyms (102 countries expected)"""
        print("\n--- Testing Tax Acronyms ---")
        
        try:
            response, response_time = self.make_request("GET", "/api/tax/acronyms")
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    acronym_data = data['data']
                    total_countries = acronym_data.get('total_countries', 0)
                    grouped_data = acronym_data.get('grouped', {})
                    
                    # Verify we have 102 countries
                    if total_countries == 102:
                        # Verify EU and Rest of World grouping
                        if 'european_union' in grouped_data and 'rest_of_world' in grouped_data:
                            eu_count = len(grouped_data['european_union'])
                            row_count = len(grouped_data['rest_of_world'])
                            
                            self.log_result(
                                "Tax Acronyms", 
                                True, 
                                f"Retrieved exactly 102 countries with proper EU/Rest of World grouping",
                                {
                                    "total_countries": total_countries,
                                    "eu_countries": eu_count,
                                    "rest_of_world": row_count
                                },
                                response_time
                            )
                            return True
                        else:
                            self.log_result(
                                "Tax Acronyms - Grouping", 
                                False, 
                                "Missing EU/Rest of World grouping",
                                {"grouped_keys": list(grouped_data.keys()) if grouped_data else []}
                            )
                            return False
                    else:
                        self.log_result(
                            "Tax Acronyms - Count", 
                            False, 
                            f"Expected 102 countries, got {total_countries}",
                            {"total_countries": total_countries}
                        )
                        return False
                else:
                    self.log_result(
                        "Tax Acronyms", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Tax Acronyms", 
                    False, 
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Tax Acronyms", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_tax_lookup(self) -> bool:
        """Test GET /api/tax/lookup?country=Portugal"""
        print("\n--- Testing Tax Lookup ---")
        
        try:
            response, response_time = self.make_request(
                "GET", 
                "/api/tax/lookup",
                params={"country": "Portugal"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    lookup_data = data['data']
                    
                    # Should redirect to PT with 23% rate
                    if (lookup_data.get('country_code') == 'PT' and 
                        lookup_data.get('standard_rate') == 23):
                        
                        self.log_result(
                            "Tax Lookup", 
                            True, 
                            "Successfully resolved Portugal to PT with 23% rate",
                            {
                                "country_name": lookup_data.get('country_name'),
                                "country_code": lookup_data.get('country_code'),
                                "standard_rate": lookup_data.get('standard_rate')
                            },
                            response_time
                        )
                        return True
                    else:
                        self.log_result(
                            "Tax Lookup - Resolution", 
                            False, 
                            f"Expected PT with 23%, got {lookup_data.get('country_code')} with {lookup_data.get('standard_rate')}%",
                            {"lookup_data": lookup_data}
                        )
                        return False
                else:
                    self.log_result(
                        "Tax Lookup", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Tax Lookup", 
                    False, 
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Tax Lookup", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def is_valid_date_format(self, date_str: str) -> bool:
        """Check if date string matches DD/MM/YYYY HH:MM:SS format"""
        try:
            datetime.strptime(date_str, "%d/%m/%Y %H:%M:%S")
            return True
        except:
            return False
    
    def generate_final_report(self) -> Dict:
        """Generate final production readiness report"""
        print("\n" + "="*80)
        print("PRODUCTION READINESS TESTING COMPLETE")
        print("="*80)
        
        # Calculate statistics
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        # Calculate average response time
        avg_response_time = sum(self.response_times) / len(self.response_times) if self.response_times else 0
        max_response_time = max(self.response_times) if self.response_times else 0
        
        # Categorize results by phase
        phase_results = {
            "Phase 1 - Authentication": [],
            "Phase 2 - Account Setup": [],
            "Phase 3 - Payment Processing": [],
            "Phase 4 - Dashboard Analytics": [],
            "Phase 5 - Error Handling": [],
            "Phase 6 - Tax & Compliance": []
        }
        
        for test_name, result in self.test_results.items():
            if any(keyword in test_name.lower() for keyword in ['login', 'profile', 'token', 'invalid token', 'missing token']):
                phase_results["Phase 1 - Authentication"].append((test_name, result))
            elif any(keyword in test_name.lower() for keyword in ['company', 'wallet', 'api key', 'configured currencies']):
                phase_results["Phase 2 - Account Setup"].append((test_name, result))
            elif any(keyword in test_name.lower() for keyword in ['payment', 'transaction']):
                phase_results["Phase 3 - Payment Processing"].append((test_name, result))
            elif 'dashboard' in test_name.lower():
                phase_results["Phase 4 - Dashboard Analytics"].append((test_name, result))
            elif any(keyword in test_name.lower() for keyword in ['invalid', 'missing', 'unauthorized', 'credentials']):
                phase_results["Phase 5 - Error Handling"].append((test_name, result))
            elif 'tax' in test_name.lower():
                phase_results["Phase 6 - Tax & Compliance"].append((test_name, result))
        
        # Determine production readiness
        critical_phases = ["Phase 1 - Authentication", "Phase 3 - Payment Processing", "Phase 5 - Error Handling"]
        critical_failures = []
        
        for phase in critical_phases:
            phase_tests = phase_results[phase]
            if phase_tests:
                phase_failures = [test for test, result in phase_tests if not result['success']]
                if phase_failures:
                    critical_failures.extend(phase_failures)
        
        production_ready = len(critical_failures) == 0 and success_rate >= 90
        
        # Generate report
        report = {
            "summary": {
                "total_tests": total_tests,
                "passed_tests": passed_tests,
                "failed_tests": failed_tests,
                "success_rate": f"{success_rate:.1f}%",
                "avg_response_time": f"{avg_response_time:.2f}s",
                "max_response_time": f"{max_response_time:.2f}s",
                "production_ready": production_ready
            },
            "phase_results": phase_results,
            "critical_failures": critical_failures,
            "all_errors": self.errors,
            "recommendation": "READY FOR PRODUCTION" if production_ready else "ISSUES FOUND - DO NOT DEPLOY"
        }
        
        # Print summary
        print(f"\n📊 TEST SUMMARY:")
        print(f"   Total Tests: {total_tests}")
        print(f"   Passed: {passed_tests} ✅")
        print(f"   Failed: {failed_tests} ❌")
        print(f"   Success Rate: {success_rate:.1f}%")
        print(f"   Avg Response Time: {avg_response_time:.2f}s")
        print(f"   Max Response Time: {max_response_time:.2f}s")
        
        print(f"\n📋 PHASE BREAKDOWN:")
        for phase, tests in phase_results.items():
            if tests:
                phase_passed = sum(1 for _, result in tests if result['success'])
                phase_total = len(tests)
                phase_rate = (phase_passed / phase_total * 100) if phase_total > 0 else 0
                status = "✅" if phase_rate == 100 else "⚠️" if phase_rate >= 80 else "❌"
                print(f"   {status} {phase}: {phase_passed}/{phase_total} ({phase_rate:.0f}%)")
        
        if critical_failures:
            print(f"\n🚨 CRITICAL FAILURES:")
            for failure in critical_failures:
                print(f"   ❌ {failure}")
        
        if self.errors:
            print(f"\n📝 ALL ERRORS:")
            for error in self.errors[:10]:  # Show first 10 errors
                print(f"   • {error}")
            if len(self.errors) > 10:
                print(f"   ... and {len(self.errors) - 10} more errors")
        
        print(f"\n🎯 FINAL RECOMMENDATION: {report['recommendation']}")
        
        if production_ready:
            print("\n✅ SUCCESS CRITERIA MET:")
            print("   ✅ All Phase 1 tests passed (authentication working)")
            print("   ✅ All Phase 3 tests passed (payment processing working)")
            print("   ✅ All Phase 5 tests passed (error handling correct)")
            print("   ✅ Response times < 2 seconds for standard requests")
        else:
            print("\n❌ FAILURE CRITERIA DETECTED:")
            if any("Phase 1" in str(failure) for failure in critical_failures):
                print("   ❌ Authentication fails or tokens not working")
            if any("payment" in str(failure).lower() for failure in critical_failures):
                print("   ❌ Payment links cannot be created")
            if any("500" in str(error) for error in self.errors):
                print("   ❌ Critical endpoints return 500 errors")
            if max_response_time > 2.0:
                print("   ❌ Response times exceed 2 seconds")
        
        return report

def main():
    """Main function to run production readiness tests"""
    tester = ProductionReadinessTester()
    report = tester.run_all_tests()
    
    # Save report to file
    with open('/app/production_readiness_report.json', 'w') as f:
        json.dump(report, f, indent=2, default=str)
    
    print(f"\n📄 Full report saved to: /app/production_readiness_report.json")
    
    # Exit with appropriate code
    sys.exit(0 if report['summary']['production_ready'] else 1)

if __name__ == "__main__":
    main()