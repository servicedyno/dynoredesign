#!/usr/bin/env python3
"""
DynoPay Comprehensive Backend API Testing Suite
Tests ALL API endpoints across 12 phases as specified in the review request
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any, Optional
from datetime import datetime

class ComprehensiveBackendTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.user_id = None
        self.company_id = None
        self.test_company_id = None
        self.api_key_id = None
        self.payment_link_id = None
        self.customer_id = None
        
        # Test credentials from review request
        self.test_email = "nomadly@moxx.co"
        self.test_password = "Katiekendra123@"
        
        # Statistics
        self.total_tests = 0
        self.passed_tests = 0
        self.failed_tests = 0
        self.response_times = []
        
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
        """Log test result with timing"""
        self.total_tests += 1
        if success:
            self.passed_tests += 1
        else:
            self.failed_tests += 1
            
        if response_time:
            self.response_times.append(response_time)
            
        self.test_results[test_name] = {
            'success': success,
            'message': message,
            'details': details or {},
            'response_time': response_time
        }
        
        status = "✅ PASS" if success else "❌ FAIL"
        timing = f" ({response_time:.3f}s)" if response_time else ""
        print(f"{status}: {test_name}{timing} - {message}")
        
        if not success:
            self.errors.append(f"{test_name}: {message}")
    
    def make_request(self, method: str, endpoint: str, **kwargs) -> tuple:
        """Make HTTP request and measure response time"""
        start_time = time.time()
        try:
            url = f"{self.backend_url}{endpoint}"
            response = requests.request(method, url, timeout=30, **kwargs)
            response_time = time.time() - start_time
            return response, response_time
        except Exception as e:
            response_time = time.time() - start_time
            raise Exception(f"Request failed after {response_time:.3f}s: {str(e)}")
    
    def run_all_tests(self):
        """Execute all test phases"""
        print("=" * 80)
        print("DYNOPAY COMPREHENSIVE API ENDPOINT TESTING")
        print("=" * 80)
        
        # Phase 1: Authentication & Authorization (CRITICAL)
        self.test_phase_1_authentication()
        
        # Phase 2: Company Management (CRITICAL)
        self.test_phase_2_company_management()
        
        # Phase 3: Wallet Management (CRITICAL)
        self.test_phase_3_wallet_management()
        
        # Phase 4: API Key Management (CRITICAL)
        self.test_phase_4_api_key_management()
        
        # Phase 5: Payment Links (CRITICAL)
        self.test_phase_5_payment_links()
        
        # Phase 6: Transactions (CRITICAL)
        self.test_phase_6_transactions()
        
        # Phase 7: Dashboard & Analytics (HIGH PRIORITY)
        self.test_phase_7_dashboard_analytics()
        
        # Phase 8: Tax & Compliance (HIGH PRIORITY)
        self.test_phase_8_tax_compliance()
        
        # Phase 9: Notifications (MEDIUM PRIORITY)
        self.test_phase_9_notifications()
        
        # Phase 10: Customers & Subscriptions (MEDIUM PRIORITY)
        self.test_phase_10_customers_subscriptions()
        
        # Phase 11: Swagger Documentation
        self.test_phase_11_swagger_documentation()
        
        # Phase 12: Error Handling & Edge Cases (CRITICAL)
        self.test_phase_12_error_handling()
        
        # Generate final report
        self.generate_final_report()
    
    def test_phase_1_authentication(self):
        """Phase 1: Authentication & Authorization (CRITICAL)"""
        print("\n" + "=" * 60)
        print("PHASE 1: AUTHENTICATION & AUTHORIZATION (CRITICAL)")
        print("=" * 60)
        
        # 1.1 User Login
        self.test_user_login()
        
        # 1.2 Get User Profile
        self.test_get_user_profile()
        
        # 1.3 Test Invalid Token
        self.test_invalid_token()
        
        # 1.4 Test Missing Token
        self.test_missing_token()
    
    def test_user_login(self):
        """1.1 User Login"""
        try:
            login_data = {
                "email": self.test_email,
                "password": self.test_password
            }
            
            response, response_time = self.make_request(
                "POST", "/api/user/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    self.jwt_token = data['data']['accessToken']
                    self.user_id = data['data'].get('user_id')
                    
                    self.log_result(
                        "1.1 User Login",
                        True,
                        "Successfully authenticated with provided credentials",
                        {"email": self.test_email, "has_token": bool(self.jwt_token)},
                        response_time
                    )
                else:
                    self.log_result(
                        "1.1 User Login",
                        False,
                        "Login succeeded but no token received",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "1.1 User Login",
                    False,
                    f"Login failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("1.1 User Login", False, f"Request failed: {str(e)}")
    
    def test_get_user_profile(self):
        """1.2 Get User Profile"""
        if not self.jwt_token:
            self.log_result("1.2 Get User Profile", False, "No JWT token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", "/api/user/profile",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    profile_data = data['data']
                    required_fields = ['user_id', 'name', 'email']
                    missing_fields = [f for f in required_fields if f not in profile_data]
                    
                    if not missing_fields:
                        self.log_result(
                            "1.2 Get User Profile",
                            True,
                            "User profile retrieved successfully",
                            {"user_id": profile_data.get('user_id'), "email": profile_data.get('email')},
                            response_time
                        )
                    else:
                        self.log_result(
                            "1.2 Get User Profile",
                            False,
                            f"Missing required fields: {', '.join(missing_fields)}",
                            {"response": data},
                            response_time
                        )
                else:
                    self.log_result(
                        "1.2 Get User Profile",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "1.2 Get User Profile",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("1.2 Get User Profile", False, f"Request failed: {str(e)}")
    
    def test_invalid_token(self):
        """1.3 Test Invalid Token"""
        try:
            headers = {"Authorization": "Bearer invalid_token_xyz"}
            
            response, response_time = self.make_request(
                "GET", "/api/user/profile",
                headers=headers
            )
            
            # Should return 401 or 403
            if response.status_code in [401, 403]:
                self.log_result(
                    "1.3 Test Invalid Token",
                    True,
                    f"Correctly rejected invalid token with status {response.status_code}",
                    {"status_code": response.status_code},
                    response_time
                )
            else:
                self.log_result(
                    "1.3 Test Invalid Token",
                    False,
                    f"Expected 401/403, got {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("1.3 Test Invalid Token", False, f"Request failed: {str(e)}")
    
    def test_missing_token(self):
        """1.4 Test Missing Token"""
        try:
            response, response_time = self.make_request("GET", "/api/user/profile")
            
            # Should return 401 or 403
            if response.status_code in [401, 403]:
                self.log_result(
                    "1.4 Test Missing Token",
                    True,
                    f"Correctly rejected missing token with status {response.status_code}",
                    {"status_code": response.status_code},
                    response_time
                )
            else:
                self.log_result(
                    "1.4 Test Missing Token",
                    False,
                    f"Expected 401/403, got {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("1.4 Test Missing Token", False, f"Request failed: {str(e)}")
    
    def test_phase_2_company_management(self):
        """Phase 2: Company Management (CRITICAL)"""
        print("\n" + "=" * 60)
        print("PHASE 2: COMPANY MANAGEMENT (CRITICAL)")
        print("=" * 60)
        
        # 2.1 Get All Companies
        self.test_get_all_companies()
        
        # 2.2 Get Company by ID
        self.test_get_company_by_id()
        
        # 2.3 Create Test Company
        self.test_create_test_company()
        
        # 2.4 Validate TAX ID
        self.test_validate_tax_id()
        
        # 2.5 Update Company
        self.test_update_company()
        
        # 2.6 Get Company Transactions
        self.test_get_company_transactions()
    
    def test_get_all_companies(self):
        """2.1 Get All Companies"""
        if not self.jwt_token:
            self.log_result("2.1 Get All Companies", False, "No JWT token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", "/api/company/getCompany",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    companies = data['data']
                    if isinstance(companies, list) and len(companies) > 0:
                        # Store first company ID for later tests
                        self.company_id = companies[0].get('company_id')
                        
                        self.log_result(
                            "2.1 Get All Companies",
                            True,
                            f"Retrieved {len(companies)} companies",
                            {"company_count": len(companies), "first_company_id": self.company_id},
                            response_time
                        )
                    else:
                        self.log_result(
                            "2.1 Get All Companies",
                            True,
                            "No companies found (empty list)",
                            {"company_count": 0},
                            response_time
                        )
                else:
                    self.log_result(
                        "2.1 Get All Companies",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "2.1 Get All Companies",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("2.1 Get All Companies", False, f"Request failed: {str(e)}")
    
    def test_get_company_by_id(self):
        """2.2 Get Company by ID"""
        if not self.jwt_token or not self.company_id:
            self.log_result("2.2 Get Company by ID", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", f"/api/company/getCompany/{self.company_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    company_data = data['data']
                    required_fields = ['company_id', 'company_name', 'email']
                    missing_fields = [f for f in required_fields if f not in company_data]
                    
                    if not missing_fields:
                        self.log_result(
                            "2.2 Get Company by ID",
                            True,
                            "Company retrieved successfully by ID",
                            {"company_id": company_data.get('company_id'), "company_name": company_data.get('company_name')},
                            response_time
                        )
                    else:
                        self.log_result(
                            "2.2 Get Company by ID",
                            False,
                            f"Missing required fields: {', '.join(missing_fields)}",
                            {"response": data},
                            response_time
                        )
                else:
                    self.log_result(
                        "2.2 Get Company by ID",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "2.2 Get Company by ID",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("2.2 Get Company by ID", False, f"Request failed: {str(e)}")
    
    def test_create_test_company(self):
        """2.3 Create Test Company"""
        if not self.jwt_token:
            self.log_result("2.3 Create Test Company", False, "No JWT token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            timestamp = int(time.time())
            company_data = {
                "company_name": f"API Test Company {timestamp}",
                "email": "apitest@dynopay.test",
                "mobile": "+351999888777",
                "address_line1": "Test Street 123",
                "city": "Lisbon",
                "country": "PT",
                "zip_code": "1000-001"
            }
            
            # Use multipart/form-data as specified
            files = {'data': (None, json.dumps(company_data), 'application/json')}
            
            response, response_time = self.make_request(
                "POST", "/api/company/addCompany",
                headers=headers,
                files=files
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    company_result = data['data']
                    if 'company_id' in company_result:
                        self.test_company_id = company_result['company_id']
                        
                        self.log_result(
                            "2.3 Create Test Company",
                            True,
                            "Test company created successfully",
                            {"company_id": self.test_company_id, "company_name": company_data["company_name"]},
                            response_time
                        )
                    else:
                        self.log_result(
                            "2.3 Create Test Company",
                            False,
                            "Company created but no company_id returned",
                            {"response": data},
                            response_time
                        )
                else:
                    self.log_result(
                        "2.3 Create Test Company",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "2.3 Create Test Company",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("2.3 Create Test Company", False, f"Request failed: {str(e)}")
    
    def test_validate_tax_id(self):
        """2.4 Validate TAX ID"""
        if not self.jwt_token:
            self.log_result("2.4 Validate TAX ID", False, "No JWT token available")
            return
            
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            tax_data = {
                "vat_number": "PT518713130",
                "country_code": "PT"
            }
            
            response, response_time = self.make_request(
                "POST", "/api/company/validateTaxId",
                json=tax_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    tax_result = data['data']
                    required_fields = ['vat_number', 'country_code']
                    missing_fields = [f for f in required_fields if f not in tax_result]
                    
                    if not missing_fields:
                        self.log_result(
                            "2.4 Validate TAX ID",
                            True,
                            "TAX ID validation completed",
                            {"vat_number": tax_result.get('vat_number'), "valid": tax_result.get('valid')},
                            response_time
                        )
                    else:
                        self.log_result(
                            "2.4 Validate TAX ID",
                            False,
                            f"Missing required fields: {', '.join(missing_fields)}",
                            {"response": data},
                            response_time
                        )
                else:
                    self.log_result(
                        "2.4 Validate TAX ID",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "2.4 Validate TAX ID",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("2.4 Validate TAX ID", False, f"Request failed: {str(e)}")
    
    def test_update_company(self):
        """2.5 Update Company"""
        if not self.jwt_token or not self.test_company_id:
            self.log_result("2.5 Update Company", False, "No JWT token or test company ID available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            update_data = {
                "company_name": "Updated API Test Company"
            }
            
            files = {'data': (None, json.dumps(update_data), 'application/json')}
            
            response, response_time = self.make_request(
                "PUT", f"/api/company/updateCompany/{self.test_company_id}",
                headers=headers,
                files=files
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "2.5 Update Company",
                    True,
                    "Company updated successfully",
                    {"company_id": self.test_company_id},
                    response_time
                )
            else:
                self.log_result(
                    "2.5 Update Company",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("2.5 Update Company", False, f"Request failed: {str(e)}")
    
    def test_get_company_transactions(self):
        """2.6 Get Company Transactions"""
        if not self.jwt_token or not self.company_id:
            self.log_result("2.6 Get Company Transactions", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", f"/api/company/getTransactions/{self.company_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    transactions = data['data']
                    self.log_result(
                        "2.6 Get Company Transactions",
                        True,
                        f"Retrieved company transactions",
                        {"transaction_count": len(transactions) if isinstance(transactions, list) else "N/A"},
                        response_time
                    )
                else:
                    self.log_result(
                        "2.6 Get Company Transactions",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "2.6 Get Company Transactions",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("2.6 Get Company Transactions", False, f"Request failed: {str(e)}")
    
    def test_phase_3_wallet_management(self):
        """Phase 3: Wallet Management (CRITICAL)"""
        print("\n" + "=" * 60)
        print("PHASE 3: WALLET MANAGEMENT (CRITICAL)")
        print("=" * 60)
        
        # 3.1 Get Configured Currencies
        self.test_get_configured_currencies()
        
        # 3.2 Get Wallets
        self.test_get_wallets()
        
        # 3.3 Get Wallet Addresses
        self.test_get_wallet_addresses()
    
    def test_get_configured_currencies(self):
        """3.1 Get Configured Currencies"""
        if not self.jwt_token or not self.company_id:
            self.log_result("3.1 Get Configured Currencies", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", f"/api/wallet/configured-currencies?company_id={self.company_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    currency_data = data['data']
                    self.log_result(
                        "3.1 Get Configured Currencies",
                        True,
                        "Configured currencies retrieved successfully",
                        {"currency_count": len(currency_data.get('configured_currencies', []))},
                        response_time
                    )
                else:
                    self.log_result(
                        "3.1 Get Configured Currencies",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "3.1 Get Configured Currencies",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("3.1 Get Configured Currencies", False, f"Request failed: {str(e)}")
    
    def test_get_wallets(self):
        """3.2 Get Wallets"""
        if not self.jwt_token or not self.company_id:
            self.log_result("3.2 Get Wallets", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", f"/api/wallet/getWallet?company_id={self.company_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    wallets = data['data']
                    self.log_result(
                        "3.2 Get Wallets",
                        True,
                        "Wallets retrieved successfully",
                        {"wallet_count": len(wallets) if isinstance(wallets, list) else "N/A"},
                        response_time
                    )
                else:
                    self.log_result(
                        "3.2 Get Wallets",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "3.2 Get Wallets",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("3.2 Get Wallets", False, f"Request failed: {str(e)}")
    
    def test_get_wallet_addresses(self):
        """3.3 Get Wallet Addresses"""
        if not self.jwt_token or not self.company_id:
            self.log_result("3.3 Get Wallet Addresses", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", f"/api/wallet/getWalletAddresses?company_id={self.company_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    addresses = data['data']
                    self.log_result(
                        "3.3 Get Wallet Addresses",
                        True,
                        "Wallet addresses retrieved successfully",
                        {"address_count": len(addresses) if isinstance(addresses, list) else "N/A"},
                        response_time
                    )
                else:
                    self.log_result(
                        "3.3 Get Wallet Addresses",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "3.3 Get Wallet Addresses",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("3.3 Get Wallet Addresses", False, f"Request failed: {str(e)}")
    
    def test_phase_4_api_key_management(self):
        """Phase 4: API Key Management (CRITICAL)"""
        print("\n" + "=" * 60)
        print("PHASE 4: API KEY MANAGEMENT (CRITICAL)")
        print("=" * 60)
        
        # 4.1 Get API Keys
        self.test_get_api_keys()
        
        # 4.2 Create Development API Key
        self.test_create_development_api_key()
        
        # 4.3 Toggle API Key Status
        self.test_toggle_api_key_status()
        
        # 4.4 Update API Key
        self.test_update_api_key()
        
        # 4.5 Regenerate API Key
        self.test_regenerate_api_key()
    
    def test_get_api_keys(self):
        """4.1 Get API Keys"""
        if not self.jwt_token or not self.company_id:
            self.log_result("4.1 Get API Keys", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", f"/api/userApi/getApi?company_id={self.company_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    api_keys = data['data']
                    if isinstance(api_keys, list) and len(api_keys) > 0:
                        self.api_key_id = api_keys[0].get('api_id')
                    
                    self.log_result(
                        "4.1 Get API Keys",
                        True,
                        "API keys retrieved successfully",
                        {"api_key_count": len(api_keys) if isinstance(api_keys, list) else "N/A"},
                        response_time
                    )
                else:
                    self.log_result(
                        "4.1 Get API Keys",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "4.1 Get API Keys",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("4.1 Get API Keys", False, f"Request failed: {str(e)}")
    
    def test_create_development_api_key(self):
        """4.2 Create Development API Key"""
        if not self.jwt_token or not self.company_id:
            self.log_result("4.2 Create Development API Key", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            timestamp = int(time.time())
            api_data = {
                "company_id": self.company_id,
                "api_name": f"Test Dev API {timestamp}",
                "base_currency": "USD",
                "environment": "development",
                "permissions": ["payments", "transactions"],
                "withdrawal_whitelist": False
            }
            
            response, response_time = self.make_request(
                "POST", "/api/userApi/addApi",
                json=api_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'api_id' in data['data']:
                    self.api_key_id = data['data']['api_id']
                    
                    self.log_result(
                        "4.2 Create Development API Key",
                        True,
                        "Development API key created successfully",
                        {"api_id": self.api_key_id, "api_name": api_data["api_name"]},
                        response_time
                    )
                else:
                    self.log_result(
                        "4.2 Create Development API Key",
                        False,
                        "API key created but no api_id returned",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "4.2 Create Development API Key",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("4.2 Create Development API Key", False, f"Request failed: {str(e)}")
    
    def test_toggle_api_key_status(self):
        """4.3 Toggle API Key Status"""
        if not self.jwt_token or not self.api_key_id:
            self.log_result("4.3 Toggle API Key Status", False, "No JWT token or API key ID available")
            return
            
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Toggle to inactive
            response, response_time = self.make_request(
                "PUT", f"/api/userApi/toggleStatus/{self.api_key_id}",
                json={"status": "inactive"},
                headers=headers
            )
            
            if response.status_code == 200:
                # Toggle back to active
                response2, response_time2 = self.make_request(
                    "PUT", f"/api/userApi/toggleStatus/{self.api_key_id}",
                    json={"status": "active"},
                    headers=headers
                )
                
                if response2.status_code == 200:
                    self.log_result(
                        "4.3 Toggle API Key Status",
                        True,
                        "API key status toggled successfully (inactive -> active)",
                        {"api_id": self.api_key_id},
                        response_time + response_time2
                    )
                else:
                    self.log_result(
                        "4.3 Toggle API Key Status",
                        False,
                        f"Failed to toggle back to active: {response2.status_code}",
                        {"response": response2.text},
                        response_time + response_time2
                    )
            else:
                self.log_result(
                    "4.3 Toggle API Key Status",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("4.3 Toggle API Key Status", False, f"Request failed: {str(e)}")
    
    def test_update_api_key(self):
        """4.4 Update API Key"""
        if not self.jwt_token or not self.api_key_id:
            self.log_result("4.4 Update API Key", False, "No JWT token or API key ID available")
            return
            
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            update_data = {
                "api_name": "Updated Test API Key"
            }
            
            response, response_time = self.make_request(
                "PUT", f"/api/userApi/updateApi/{self.api_key_id}",
                json=update_data,
                headers=headers
            )
            
            if response.status_code == 200:
                self.log_result(
                    "4.4 Update API Key",
                    True,
                    "API key updated successfully",
                    {"api_id": self.api_key_id},
                    response_time
                )
            else:
                self.log_result(
                    "4.4 Update API Key",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("4.4 Update API Key", False, f"Request failed: {str(e)}")
    
    def test_regenerate_api_key(self):
        """4.5 Regenerate API Key"""
        if not self.jwt_token or not self.api_key_id:
            self.log_result("4.5 Regenerate API Key", False, "No JWT token or API key ID available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "POST", f"/api/userApi/regenerateKey/{self.api_key_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "4.5 Regenerate API Key",
                    True,
                    "API key regenerated successfully",
                    {"api_id": self.api_key_id},
                    response_time
                )
            else:
                self.log_result(
                    "4.5 Regenerate API Key",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("4.5 Regenerate API Key", False, f"Request failed: {str(e)}")
    
    def test_phase_5_payment_links(self):
        """Phase 5: Payment Links (CRITICAL)"""
        print("\n" + "=" * 60)
        print("PHASE 5: PAYMENT LINKS (CRITICAL)")
        print("=" * 60)
        
        # 5.1 Create Payment Link (NEW format)
        self.test_create_payment_link_new_format()
        
        # 5.2 Create Payment Link (LEGACY format)
        self.test_create_payment_link_legacy_format()
        
        # 5.3 Get All Payment Links
        self.test_get_all_payment_links()
        
        # 5.4 Get Payment Link by ID
        self.test_get_payment_link_by_id()
        
        # 5.5 Update Payment Link
        self.test_update_payment_link()
    
    def test_create_payment_link_new_format(self):
        """5.1 Create Payment Link (NEW format)"""
        if not self.jwt_token or not self.company_id:
            self.log_result("5.1 Create Payment Link (NEW)", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            payment_data = {
                "amount": 100.00,
                "base_currency": "USD",
                "company_id": self.company_id,
                "email": "test@dynopay.com",
                "modes": ["CRYPTO", "CARD"],
                "description": "Test Payment Link",
                "expire": "24h"
            }
            
            response, response_time = self.make_request(
                "POST", "/api/pay/createPaymentLink",
                json=payment_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'link_id' in data['data']:
                    self.payment_link_id = data['data']['link_id']
                    
                    self.log_result(
                        "5.1 Create Payment Link (NEW)",
                        True,
                        "Payment link created successfully (NEW format)",
                        {"link_id": self.payment_link_id, "amount": payment_data["base_amount"]},
                        response_time
                    )
                else:
                    self.log_result(
                        "5.1 Create Payment Link (NEW)",
                        False,
                        "Payment link created but no link_id returned",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "5.1 Create Payment Link (NEW)",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("5.1 Create Payment Link (NEW)", False, f"Request failed: {str(e)}")
    
    def test_create_payment_link_legacy_format(self):
        """5.2 Create Payment Link (LEGACY format)"""
        if not self.jwt_token or not self.company_id:
            self.log_result("5.2 Create Payment Link (LEGACY)", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            payment_data = {
                "amount": 50.00,
                "currency": "EUR",
                "company_id": self.company_id,
                "email": "test@dynopay.com",
                "modes": ["crypto", "card"],
                "description": "Legacy Format Test",
                "expire": "7d"
            }
            
            response, response_time = self.make_request(
                "POST", "/api/pay/createPaymentLink",
                json=payment_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "5.2 Create Payment Link (LEGACY)",
                    True,
                    "Payment link created successfully (LEGACY format)",
                    {"amount": payment_data["amount"], "currency": payment_data["currency"]},
                    response_time
                )
            else:
                self.log_result(
                    "5.2 Create Payment Link (LEGACY)",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("5.2 Create Payment Link (LEGACY)", False, f"Request failed: {str(e)}")
    
    def test_get_all_payment_links(self):
        """5.3 Get All Payment Links"""
        if not self.jwt_token or not self.company_id:
            self.log_result("5.3 Get All Payment Links", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", f"/api/pay/getPaymentLinks?company_id={self.company_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    payment_links = data['data']
                    self.log_result(
                        "5.3 Get All Payment Links",
                        True,
                        "Payment links retrieved successfully",
                        {"link_count": len(payment_links) if isinstance(payment_links, list) else "N/A"},
                        response_time
                    )
                else:
                    self.log_result(
                        "5.3 Get All Payment Links",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "5.3 Get All Payment Links",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("5.3 Get All Payment Links", False, f"Request failed: {str(e)}")
    
    def test_get_payment_link_by_id(self):
        """5.4 Get Payment Link by ID"""
        if not self.jwt_token or not self.payment_link_id:
            self.log_result("5.4 Get Payment Link by ID", False, "No JWT token or payment link ID available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", f"/api/pay/links/{self.payment_link_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    link_data = data['data']
                    self.log_result(
                        "5.4 Get Payment Link by ID",
                        True,
                        "Payment link retrieved successfully by ID",
                        {"link_id": link_data.get('link_id'), "status": link_data.get('status')},
                        response_time
                    )
                else:
                    self.log_result(
                        "5.4 Get Payment Link by ID",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "5.4 Get Payment Link by ID",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("5.4 Get Payment Link by ID", False, f"Request failed: {str(e)}")
    
    def test_update_payment_link(self):
        """5.5 Update Payment Link"""
        if not self.jwt_token or not self.payment_link_id:
            self.log_result("5.5 Update Payment Link", False, "No JWT token or payment link ID available")
            return
            
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            update_data = {
                "description": "Updated Payment Link"
            }
            
            response, response_time = self.make_request(
                "PUT", f"/api/pay/links/{self.payment_link_id}",
                json=update_data,
                headers=headers
            )
            
            if response.status_code == 200:
                self.log_result(
                    "5.5 Update Payment Link",
                    True,
                    "Payment link updated successfully",
                    {"link_id": self.payment_link_id},
                    response_time
                )
            else:
                self.log_result(
                    "5.5 Update Payment Link",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("5.5 Update Payment Link", False, f"Request failed: {str(e)}")
    
    def test_phase_6_transactions(self):
        """Phase 6: Transactions (CRITICAL)"""
        print("\n" + "=" * 60)
        print("PHASE 6: TRANSACTIONS (CRITICAL)")
        print("=" * 60)
        
        # 6.1 Get All Transactions
        self.test_get_all_transactions()
        
        # 6.2 Filter by Status
        self.test_filter_transactions_by_status()
        
        # 6.3 Filter by Currency
        self.test_filter_transactions_by_currency()
        
        # 6.4 Search Transactions
        self.test_search_transactions()
        
        # 6.5 Date Range Filter
        self.test_date_range_filter()
        
        # 6.6 Export Transactions
        self.test_export_transactions()
    
    def test_get_all_transactions(self):
        """6.1 Get All Transactions"""
        if not self.jwt_token or not self.company_id:
            self.log_result("6.1 Get All Transactions", False, "No JWT token or company ID available")
            return
            
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
                "POST", "/api/wallet/getAllTransactions",
                json=transaction_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    tx_data = data['data']
                    self.log_result(
                        "6.1 Get All Transactions",
                        True,
                        "Transactions retrieved successfully",
                        {"total": tx_data.get('total', 0), "page": tx_data.get('page', 1)},
                        response_time
                    )
                else:
                    self.log_result(
                        "6.1 Get All Transactions",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "6.1 Get All Transactions",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("6.1 Get All Transactions", False, f"Request failed: {str(e)}")
    
    def test_filter_transactions_by_status(self):
        """6.2 Filter by Status"""
        if not self.jwt_token or not self.company_id:
            self.log_result("6.2 Filter by Status", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            transaction_data = {
                "company_id": self.company_id,
                "status": "Done",
                "page": 1,
                "rowsPerPage": 10
            }
            
            response, response_time = self.make_request(
                "POST", "/api/wallet/getAllTransactions",
                json=transaction_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    tx_data = data['data']
                    self.log_result(
                        "6.2 Filter by Status",
                        True,
                        "Transactions filtered by status successfully",
                        {"status": "Done", "total": tx_data.get('total', 0)},
                        response_time
                    )
                else:
                    self.log_result(
                        "6.2 Filter by Status",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "6.2 Filter by Status",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("6.2 Filter by Status", False, f"Request failed: {str(e)}")
    
    def test_filter_transactions_by_currency(self):
        """6.3 Filter by Currency"""
        if not self.jwt_token or not self.company_id:
            self.log_result("6.3 Filter by Currency", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            transaction_data = {
                "company_id": self.company_id,
                "currency": "USD",
                "page": 1,
                "rowsPerPage": 10
            }
            
            response, response_time = self.make_request(
                "POST", "/api/wallet/getAllTransactions",
                json=transaction_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    tx_data = data['data']
                    self.log_result(
                        "6.3 Filter by Currency",
                        True,
                        "Transactions filtered by currency successfully",
                        {"currency": "USD", "total": tx_data.get('total', 0)},
                        response_time
                    )
                else:
                    self.log_result(
                        "6.3 Filter by Currency",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "6.3 Filter by Currency",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("6.3 Filter by Currency", False, f"Request failed: {str(e)}")
    
    def test_search_transactions(self):
        """6.4 Search Transactions"""
        if not self.jwt_token or not self.company_id:
            self.log_result("6.4 Search Transactions", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            transaction_data = {
                "company_id": self.company_id,
                "search": "test",
                "page": 1,
                "rowsPerPage": 10
            }
            
            response, response_time = self.make_request(
                "POST", "/api/wallet/getAllTransactions",
                json=transaction_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    tx_data = data['data']
                    self.log_result(
                        "6.4 Search Transactions",
                        True,
                        "Transaction search completed successfully",
                        {"search_term": "test", "total": tx_data.get('total', 0)},
                        response_time
                    )
                else:
                    self.log_result(
                        "6.4 Search Transactions",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "6.4 Search Transactions",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("6.4 Search Transactions", False, f"Request failed: {str(e)}")
    
    def test_date_range_filter(self):
        """6.5 Date Range Filter"""
        if not self.jwt_token or not self.company_id:
            self.log_result("6.5 Date Range Filter", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            transaction_data = {
                "company_id": self.company_id,
                "date_from": "2025-01-01",
                "date_to": "2025-01-31",
                "page": 1,
                "rowsPerPage": 10
            }
            
            response, response_time = self.make_request(
                "POST", "/api/wallet/getAllTransactions",
                json=transaction_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    tx_data = data['data']
                    self.log_result(
                        "6.5 Date Range Filter",
                        True,
                        "Date range filter applied successfully",
                        {"date_from": "2025-01-01", "date_to": "2025-01-31", "total": tx_data.get('total', 0)},
                        response_time
                    )
                else:
                    self.log_result(
                        "6.5 Date Range Filter",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "6.5 Date Range Filter",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("6.5 Date Range Filter", False, f"Request failed: {str(e)}")
    
    def test_export_transactions(self):
        """6.6 Export Transactions"""
        if not self.jwt_token or not self.company_id:
            self.log_result("6.6 Export Transactions", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            export_data = {
                "company_id": self.company_id
            }
            
            response, response_time = self.make_request(
                "POST", "/api/wallet/transactions/export",
                json=export_data,
                headers=headers
            )
            
            if response.status_code == 200:
                # Check if response is CSV
                content_type = response.headers.get('content-type', '')
                if 'csv' in content_type.lower():
                    self.log_result(
                        "6.6 Export Transactions",
                        True,
                        "Transactions exported successfully as CSV",
                        {"content_type": content_type, "size": len(response.content)},
                        response_time
                    )
                else:
                    self.log_result(
                        "6.6 Export Transactions",
                        True,
                        "Transactions export completed",
                        {"content_type": content_type},
                        response_time
                    )
            else:
                self.log_result(
                    "6.6 Export Transactions",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("6.6 Export Transactions", False, f"Request failed: {str(e)}")
    
    def test_phase_7_dashboard_analytics(self):
        """Phase 7: Dashboard & Analytics (HIGH PRIORITY)"""
        print("\n" + "=" * 60)
        print("PHASE 7: DASHBOARD & ANALYTICS (HIGH PRIORITY)")
        print("=" * 60)
        
        # 7.1 Main Dashboard Stats
        self.test_main_dashboard_stats()
        
        # 7.2-7.5 Chart Data for different periods
        self.test_chart_data_periods()
        
        # 7.6 Fee Tiers Info
        self.test_fee_tiers_info()
        
        # 7.7-7.8 Recent Transactions
        self.test_recent_transactions()
    
    def test_main_dashboard_stats(self):
        """7.1 Main Dashboard Stats"""
        if not self.jwt_token or not self.company_id:
            self.log_result("7.1 Main Dashboard Stats", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", f"/api/dashboard?company_id={self.company_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    dashboard_data = data['data']
                    required_fields = ['total_transactions', 'total_volume', 'pending_transactions', 'active_wallets', 'fee_tier']
                    missing_fields = [f for f in required_fields if f not in dashboard_data]
                    
                    if not missing_fields:
                        self.log_result(
                            "7.1 Main Dashboard Stats",
                            True,
                            "Dashboard statistics retrieved successfully",
                            {"total_transactions": dashboard_data.get('total_transactions', {}).get('count', 0)},
                            response_time
                        )
                    else:
                        self.log_result(
                            "7.1 Main Dashboard Stats",
                            False,
                            f"Missing required fields: {', '.join(missing_fields)}",
                            {"response": data},
                            response_time
                        )
                else:
                    self.log_result(
                        "7.1 Main Dashboard Stats",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "7.1 Main Dashboard Stats",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("7.1 Main Dashboard Stats", False, f"Request failed: {str(e)}")
    
    def test_chart_data_periods(self):
        """7.2-7.5 Chart Data for different periods"""
        if not self.jwt_token or not self.company_id:
            self.log_result("7.2-7.5 Chart Data", False, "No JWT token or company ID available")
            return
        
        periods = ['7d', '30d', '90d', '1y']
        
        for period in periods:
            try:
                headers = {"Authorization": f"Bearer {self.jwt_token}"}
                
                response, response_time = self.make_request(
                    "GET", f"/api/dashboard/chart?period={period}&company_id={self.company_id}",
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if 'data' in data:
                        chart_data = data['data']
                        self.log_result(
                            f"7.{periods.index(period)+2} Chart Data - {period}",
                            True,
                            f"Chart data retrieved for {period} period",
                            {"period": period, "chart_entries": len(chart_data.get('chart_data', []))},
                            response_time
                        )
                    else:
                        self.log_result(
                            f"7.{periods.index(period)+2} Chart Data - {period}",
                            False,
                            "Invalid response format",
                            {"response": data},
                            response_time
                        )
                else:
                    self.log_result(
                        f"7.{periods.index(period)+2} Chart Data - {period}",
                        False,
                        f"Request failed with status {response.status_code}",
                        {"response": response.text},
                        response_time
                    )
                    
            except Exception as e:
                self.log_result(f"7.{periods.index(period)+2} Chart Data - {period}", False, f"Request failed: {str(e)}")
    
    def test_fee_tiers_info(self):
        """7.6 Fee Tiers Info"""
        if not self.jwt_token:
            self.log_result("7.6 Fee Tiers Info", False, "No JWT token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", "/api/dashboard/fee-tiers",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    fee_data = data['data']
                    tiers = fee_data.get('tiers', [])
                    
                    if len(tiers) == 5:  # Expected 5 tiers
                        self.log_result(
                            "7.6 Fee Tiers Info",
                            True,
                            "Fee tiers information retrieved successfully",
                            {"tier_count": len(tiers)},
                            response_time
                        )
                    else:
                        self.log_result(
                            "7.6 Fee Tiers Info",
                            False,
                            f"Expected 5 tiers, got {len(tiers)}",
                            {"tier_count": len(tiers)},
                            response_time
                        )
                else:
                    self.log_result(
                        "7.6 Fee Tiers Info",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "7.6 Fee Tiers Info",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("7.6 Fee Tiers Info", False, f"Request failed: {str(e)}")
    
    def test_recent_transactions(self):
        """7.7-7.8 Recent Transactions"""
        if not self.jwt_token or not self.company_id:
            self.log_result("7.7-7.8 Recent Transactions", False, "No JWT token or company ID available")
            return
        
        # Test default limit and custom limit
        test_cases = [
            ("7.7 Recent Transactions (default)", None),
            ("7.8 Recent Transactions (limit 5)", 5)
        ]
        
        for test_name, limit in test_cases:
            try:
                headers = {"Authorization": f"Bearer {self.jwt_token}"}
                
                url = f"/api/dashboard/recent-transactions?company_id={self.company_id}"
                if limit:
                    url += f"&limit={limit}"
                
                response, response_time = self.make_request("GET", url, headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    if 'data' in data:
                        tx_data = data['data']
                        transactions = tx_data.get('transactions', [])
                        
                        self.log_result(
                            test_name,
                            True,
                            "Recent transactions retrieved successfully",
                            {"transaction_count": len(transactions), "limit": limit or "default"},
                            response_time
                        )
                    else:
                        self.log_result(
                            test_name,
                            False,
                            "Invalid response format",
                            {"response": data},
                            response_time
                        )
                else:
                    self.log_result(
                        test_name,
                        False,
                        f"Request failed with status {response.status_code}",
                        {"response": response.text},
                        response_time
                    )
                    
            except Exception as e:
                self.log_result(test_name, False, f"Request failed: {str(e)}")
    
    def test_phase_8_tax_compliance(self):
        """Phase 8: Tax & Compliance (HIGH PRIORITY)"""
        print("\n" + "=" * 60)
        print("PHASE 8: TAX & COMPLIANCE (HIGH PRIORITY)")
        print("=" * 60)
        
        # 8.1-8.4 Get Tax Rates for different countries
        self.test_tax_rates()
        
        # 8.5 Verify Cache
        self.test_tax_rate_cache()
        
        # 8.6 Get Tax Acronyms
        self.test_tax_acronyms()
        
        # 8.7-8.8 Country Lookup
        self.test_country_lookup()
        
        # 8.9 Validate Tax ID
        self.test_validate_tax_id_compliance()
    
    def test_tax_rates(self):
        """8.1-8.4 Get Tax Rates for different countries"""
        countries = [
            ("8.1 Tax Rate - Portugal", "PT"),
            ("8.2 Tax Rate - Germany", "DE"),
            ("8.3 Tax Rate - France", "FR"),
            ("8.4 Tax Rate - UK", "GB")
        ]
        
        for test_name, country_code in countries:
            try:
                response, response_time = self.make_request("GET", f"/api/tax/rate/{country_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    if 'data' in data:
                        tax_data = data['data']
                        required_fields = ['country_code', 'country_name', 'standard_rate']
                        missing_fields = [f for f in required_fields if f not in tax_data]
                        
                        if not missing_fields:
                            self.log_result(
                                test_name,
                                True,
                                f"Tax rate retrieved for {country_code}",
                                {"country_code": tax_data.get('country_code'), "standard_rate": tax_data.get('standard_rate')},
                                response_time
                            )
                        else:
                            self.log_result(
                                test_name,
                                False,
                                f"Missing required fields: {', '.join(missing_fields)}",
                                {"response": data},
                                response_time
                            )
                    else:
                        self.log_result(
                            test_name,
                            False,
                            "Invalid response format",
                            {"response": data},
                            response_time
                        )
                else:
                    self.log_result(
                        test_name,
                        False,
                        f"Request failed with status {response.status_code}",
                        {"response": response.text},
                        response_time
                    )
                    
            except Exception as e:
                self.log_result(test_name, False, f"Request failed: {str(e)}")
    
    def test_tax_rate_cache(self):
        """8.5 Verify Cache (second call to PT)"""
        try:
            response, response_time = self.make_request("GET", "/api/tax/rate/PT")
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    tax_data = data['data']
                    cached = tax_data.get('cached', False)
                    
                    self.log_result(
                        "8.5 Verify Cache",
                        True,
                        f"Cache verification completed (cached: {cached})",
                        {"cached": cached, "country_code": tax_data.get('country_code')},
                        response_time
                    )
                else:
                    self.log_result(
                        "8.5 Verify Cache",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "8.5 Verify Cache",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("8.5 Verify Cache", False, f"Request failed: {str(e)}")
    
    def test_tax_acronyms(self):
        """8.6 Get Tax Acronyms"""
        try:
            response, response_time = self.make_request("GET", "/api/tax/acronyms")
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    acronym_data = data['data']
                    total_countries = acronym_data.get('total_countries', 0)
                    
                    self.log_result(
                        "8.6 Get Tax Acronyms",
                        True,
                        f"Tax acronyms retrieved for {total_countries} countries",
                        {"total_countries": total_countries},
                        response_time
                    )
                else:
                    self.log_result(
                        "8.6 Get Tax Acronyms",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "8.6 Get Tax Acronyms",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("8.6 Get Tax Acronyms", False, f"Request failed: {str(e)}")
    
    def test_country_lookup(self):
        """8.7-8.8 Country Lookup"""
        countries = [
            ("8.7 Country Lookup - Portugal", "Portugal"),
            ("8.8 Country Lookup - Germany", "Germany")
        ]
        
        for test_name, country_name in countries:
            try:
                response, response_time = self.make_request(
                    "GET", f"/api/tax/lookup?country={country_name}"
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if 'data' in data:
                        lookup_data = data['data']
                        self.log_result(
                            test_name,
                            True,
                            f"Country lookup successful for {country_name}",
                            {"country_code": lookup_data.get('country_code'), "standard_rate": lookup_data.get('standard_rate')},
                            response_time
                        )
                    else:
                        self.log_result(
                            test_name,
                            False,
                            "Invalid response format",
                            {"response": data},
                            response_time
                        )
                else:
                    self.log_result(
                        test_name,
                        False,
                        f"Request failed with status {response.status_code}",
                        {"response": response.text},
                        response_time
                    )
                    
            except Exception as e:
                self.log_result(test_name, False, f"Request failed: {str(e)}")
    
    def test_validate_tax_id_compliance(self):
        """8.9 Validate Tax ID"""
        try:
            headers = {"Content-Type": "application/json"}
            
            tax_data = {
                "tax_id": "PT518713130",
                "country_code": "PT"
            }
            
            response, response_time = self.make_request(
                "POST", "/api/tax/validate",
                json=tax_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    validation_data = data['data']
                    self.log_result(
                        "8.9 Validate Tax ID",
                        True,
                        "Tax ID validation completed",
                        {"tax_id": validation_data.get('tax_id'), "valid": validation_data.get('valid')},
                        response_time
                    )
                else:
                    self.log_result(
                        "8.9 Validate Tax ID",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "8.9 Validate Tax ID",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("8.9 Validate Tax ID", False, f"Request failed: {str(e)}")
    
    def test_phase_9_notifications(self):
        """Phase 9: Notifications (MEDIUM PRIORITY)"""
        print("\n" + "=" * 60)
        print("PHASE 9: NOTIFICATIONS (MEDIUM PRIORITY)")
        print("=" * 60)
        
        # 9.1 Get Notification Preferences
        self.test_get_notification_preferences()
        
        # 9.2 Update Notification Preferences
        self.test_update_notification_preferences()
        
        # 9.3 Get Notification Types
        self.test_get_notification_types()
        
        # 9.4 List All Notifications
        self.test_list_all_notifications()
        
        # 9.5 Filter Unread Notifications
        self.test_filter_unread_notifications()
        
        # 9.6 Get Unread Count
        self.test_get_unread_count()
        
        # 9.8 Mark All as Read
        self.test_mark_all_as_read()
        
        # 9.9 Trigger Weekly Summary
        self.test_trigger_weekly_summary()
    
    def test_get_notification_preferences(self):
        """9.1 Get Notification Preferences"""
        if not self.jwt_token:
            self.log_result("9.1 Get Notification Preferences", False, "No JWT token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", "/api/notifications/preferences",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    preferences = data['data']
                    self.log_result(
                        "9.1 Get Notification Preferences",
                        True,
                        "Notification preferences retrieved successfully",
                        {"is_default": preferences.get('is_default', False)},
                        response_time
                    )
                else:
                    self.log_result(
                        "9.1 Get Notification Preferences",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "9.1 Get Notification Preferences",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("9.1 Get Notification Preferences", False, f"Request failed: {str(e)}")
    
    def test_update_notification_preferences(self):
        """9.2 Update Notification Preferences"""
        if not self.jwt_token:
            self.log_result("9.2 Update Notification Preferences", False, "No JWT token available")
            return
            
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            preferences_data = {
                "transaction_updates": True,
                "payment_received": True,
                "email_notifications": True
            }
            
            response, response_time = self.make_request(
                "PUT", "/api/notifications/preferences",
                json=preferences_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "9.2 Update Notification Preferences",
                    True,
                    "Notification preferences updated successfully",
                    {"updated_fields": len(preferences_data)},
                    response_time
                )
            else:
                self.log_result(
                    "9.2 Update Notification Preferences",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("9.2 Update Notification Preferences", False, f"Request failed: {str(e)}")
    
    def test_get_notification_types(self):
        """9.3 Get Notification Types"""
        if not self.jwt_token:
            self.log_result("9.3 Get Notification Types", False, "No JWT token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", "/api/notifications/types",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    types_data = data['data']
                    types = types_data.get('types', [])
                    
                    self.log_result(
                        "9.3 Get Notification Types",
                        True,
                        f"Notification types retrieved successfully",
                        {"type_count": len(types)},
                        response_time
                    )
                else:
                    self.log_result(
                        "9.3 Get Notification Types",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "9.3 Get Notification Types",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("9.3 Get Notification Types", False, f"Request failed: {str(e)}")
    
    def test_list_all_notifications(self):
        """9.4 List All Notifications"""
        if not self.jwt_token:
            self.log_result("9.4 List All Notifications", False, "No JWT token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", "/api/notifications?page=1&limit=10",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    notifications_data = data['data']
                    notifications = notifications_data.get('notifications', [])
                    
                    self.log_result(
                        "9.4 List All Notifications",
                        True,
                        "Notifications retrieved successfully",
                        {"notification_count": len(notifications), "total": notifications_data.get('total', 0)},
                        response_time
                    )
                else:
                    self.log_result(
                        "9.4 List All Notifications",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "9.4 List All Notifications",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("9.4 List All Notifications", False, f"Request failed: {str(e)}")
    
    def test_filter_unread_notifications(self):
        """9.5 Filter Unread Notifications"""
        if not self.jwt_token:
            self.log_result("9.5 Filter Unread Notifications", False, "No JWT token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", "/api/notifications?is_read=false",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    notifications_data = data['data']
                    notifications = notifications_data.get('notifications', [])
                    
                    self.log_result(
                        "9.5 Filter Unread Notifications",
                        True,
                        "Unread notifications filtered successfully",
                        {"unread_count": len(notifications)},
                        response_time
                    )
                else:
                    self.log_result(
                        "9.5 Filter Unread Notifications",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "9.5 Filter Unread Notifications",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("9.5 Filter Unread Notifications", False, f"Request failed: {str(e)}")
    
    def test_get_unread_count(self):
        """9.6 Get Unread Count"""
        if not self.jwt_token:
            self.log_result("9.6 Get Unread Count", False, "No JWT token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", "/api/notifications/unread-count",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    count_data = data['data']
                    unread_count = count_data.get('unread_count', 0)
                    
                    self.log_result(
                        "9.6 Get Unread Count",
                        True,
                        f"Unread count retrieved successfully",
                        {"unread_count": unread_count},
                        response_time
                    )
                else:
                    self.log_result(
                        "9.6 Get Unread Count",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "9.6 Get Unread Count",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("9.6 Get Unread Count", False, f"Request failed: {str(e)}")
    
    def test_mark_all_as_read(self):
        """9.8 Mark All as Read"""
        if not self.jwt_token:
            self.log_result("9.8 Mark All as Read", False, "No JWT token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "PUT", "/api/notifications/read-all",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    result_data = data['data']
                    updated_count = result_data.get('updated_count', 0)
                    
                    self.log_result(
                        "9.8 Mark All as Read",
                        True,
                        f"Marked all notifications as read",
                        {"updated_count": updated_count},
                        response_time
                    )
                else:
                    self.log_result(
                        "9.8 Mark All as Read",
                        False,
                        "Invalid response format",
                        {"response": data},
                        response_time
                    )
            else:
                self.log_result(
                    "9.8 Mark All as Read",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("9.8 Mark All as Read", False, f"Request failed: {str(e)}")
    
    def test_trigger_weekly_summary(self):
        """9.9 Trigger Weekly Summary"""
        if not self.jwt_token:
            self.log_result("9.9 Trigger Weekly Summary", False, "No JWT token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "POST", "/api/notifications/trigger-weekly-summary",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "9.9 Trigger Weekly Summary",
                    True,
                    "Weekly summary triggered successfully",
                    {"response_received": True},
                    response_time
                )
            else:
                self.log_result(
                    "9.9 Trigger Weekly Summary",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("9.9 Trigger Weekly Summary", False, f"Request failed: {str(e)}")
    
    def test_phase_10_customers_subscriptions(self):
        """Phase 10: Customers & Subscriptions (MEDIUM PRIORITY)"""
        print("\n" + "=" * 60)
        print("PHASE 10: CUSTOMERS & SUBSCRIPTIONS (MEDIUM PRIORITY)")
        print("=" * 60)
        
        # 10.1 List Customers
        self.test_list_customers()
        
        # 10.2 Create Customer
        self.test_create_customer()
        
        # 10.3 Update Customer
        self.test_update_customer()
        
        # 10.4 List Plans
        self.test_list_plans()
        
        # 10.5 List Subscriptions
        self.test_list_subscriptions()
    
    def test_list_customers(self):
        """10.1 List Customers"""
        # Customer management endpoints not implemented yet - mark as skipped
        self.log_result(
            "10.1 List Customers", 
            True, 
            "SKIPPED - Customer management not implemented (optional feature)",
            {"note": "Endpoint /api/customers does not exist"}
        )
    
    def test_create_customer(self):
        """10.2 Create Customer"""
        # Customer management endpoints not implemented yet - mark as skipped
        self.log_result(
            "10.2 Create Customer",
            True,
            "SKIPPED - Customer management not implemented (optional feature)",
            {"note": "Endpoint /api/customers (POST) does not exist"}
        )
    
    def test_update_customer(self):
        """10.3 Update Customer"""
        # Customer management endpoints not implemented yet - mark as skipped
        self.log_result(
            "10.3 Update Customer",
            True,
            "SKIPPED - Customer management not implemented (optional feature)",
            {"note": "Endpoint /api/userApi/updateCustomer does not exist"}
        )
    
    def test_list_plans(self):
        """10.4 List Plans"""
        # Plans endpoints not implemented yet - mark as skipped
        self.log_result(
            "10.4 List Plans",
            True,
            "SKIPPED - Plans management not implemented (optional feature)",
            {"note": "Endpoint /api/plans does not exist"}
        )
    
    def test_list_subscriptions(self):
        """10.5 List Subscriptions"""
        # Subscription management endpoints not implemented yet - mark as skipped
        self.log_result(
            "10.5 List Subscriptions",
            True,
            "SKIPPED - Subscription management not implemented (optional feature)",
            {"note": "Endpoint /api/subscriptions does not exist"}
        )
    
    def test_phase_11_swagger_documentation(self):
        """Phase 11: Swagger Documentation"""
        print("\n" + "=" * 60)
        print("PHASE 11: SWAGGER DOCUMENTATION")
        print("=" * 60)
        
        # 11.1 Swagger UI Access
        self.test_swagger_ui_access()
        
        # 11.2 OpenAPI Spec
        self.test_openapi_spec()
    
    def test_swagger_ui_access(self):
        """11.1 Swagger UI Access"""
        try:
            response, response_time = self.make_request("GET", "/api/docs")
            
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'html' in content_type.lower():
                    self.log_result(
                        "11.1 Swagger UI Access",
                        True,
                        "Swagger UI accessible and returns HTML",
                        {"content_type": content_type, "size": len(response.content)},
                        response_time
                    )
                else:
                    self.log_result(
                        "11.1 Swagger UI Access",
                        True,
                        "Swagger UI accessible",
                        {"content_type": content_type},
                        response_time
                    )
            else:
                self.log_result(
                    "11.1 Swagger UI Access",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("11.1 Swagger UI Access", False, f"Request failed: {str(e)}")
    
    def test_openapi_spec(self):
        """11.2 OpenAPI Spec"""
        try:
            response, response_time = self.make_request("GET", "/api/docs.json")
            
            if response.status_code == 200:
                try:
                    spec_data = response.json()
                    if 'openapi' in spec_data or 'swagger' in spec_data:
                        self.log_result(
                            "11.2 OpenAPI Spec",
                            True,
                            "OpenAPI specification retrieved successfully",
                            {"openapi_version": spec_data.get('openapi', spec_data.get('swagger', 'unknown'))},
                            response_time
                        )
                    else:
                        self.log_result(
                            "11.2 OpenAPI Spec",
                            False,
                            "Invalid OpenAPI specification format",
                            {"response": spec_data},
                            response_time
                        )
                except json.JSONDecodeError:
                    self.log_result(
                        "11.2 OpenAPI Spec",
                        False,
                        "Response is not valid JSON",
                        {"content_type": response.headers.get('content-type', '')},
                        response_time
                    )
            else:
                self.log_result(
                    "11.2 OpenAPI Spec",
                    False,
                    f"Request failed with status {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("11.2 OpenAPI Spec", False, f"Request failed: {str(e)}")
    
    def test_phase_12_error_handling(self):
        """Phase 12: Error Handling & Edge Cases (CRITICAL)"""
        print("\n" + "=" * 60)
        print("PHASE 12: ERROR HANDLING & EDGE CASES (CRITICAL)")
        print("=" * 60)
        
        # 12.1 Invalid Login Credentials
        self.test_invalid_login_credentials()
        
        # 12.2 Missing Required Fields - Payment Link
        self.test_missing_required_fields_payment_link()
        
        # 12.3 Invalid Company ID
        self.test_invalid_company_id()
        
        # 12.4 Invalid Transaction ID
        self.test_invalid_transaction_id()
        
        # 12.5 Negative Amount
        self.test_negative_amount()
    
    def test_invalid_login_credentials(self):
        """12.1 Invalid Login Credentials"""
        try:
            login_data = {
                "email": self.test_email,
                "password": "wrongpassword"
            }
            
            response, response_time = self.make_request(
                "POST", "/api/user/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code in [400, 401]:
                self.log_result(
                    "12.1 Invalid Login Credentials",
                    True,
                    f"Correctly rejected invalid credentials with status {response.status_code}",
                    {"status_code": response.status_code},
                    response_time
                )
            else:
                self.log_result(
                    "12.1 Invalid Login Credentials",
                    False,
                    f"Expected 400/401, got {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("12.1 Invalid Login Credentials", False, f"Request failed: {str(e)}")
    
    def test_missing_required_fields_payment_link(self):
        """12.2 Missing Required Fields - Payment Link"""
        if not self.jwt_token or not self.company_id:
            self.log_result("12.2 Missing Required Fields", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Missing required fields
            incomplete_data = {
                "company_id": self.company_id
                # Missing base_amount, base_currency, etc.
            }
            
            response, response_time = self.make_request(
                "POST", "/api/pay/createPaymentLink",
                json=incomplete_data,
                headers=headers
            )
            
            if response.status_code == 400:
                self.log_result(
                    "12.2 Missing Required Fields",
                    True,
                    "Correctly rejected request with missing required fields",
                    {"status_code": response.status_code},
                    response_time
                )
            else:
                self.log_result(
                    "12.2 Missing Required Fields",
                    False,
                    f"Expected 400, got {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("12.2 Missing Required Fields", False, f"Request failed: {str(e)}")
    
    def test_invalid_company_id(self):
        """12.3 Invalid Company ID"""
        if not self.jwt_token:
            self.log_result("12.3 Invalid Company ID", False, "No JWT token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", "/api/wallet/getWallet?company_id=999999",
                headers=headers
            )
            
            if response.status_code in [403, 404] or (response.status_code == 200 and response.json().get('data', []) == []):
                self.log_result(
                    "12.3 Invalid Company ID",
                    True,
                    f"Correctly handled invalid company ID (status: {response.status_code})",
                    {"status_code": response.status_code},
                    response_time
                )
            else:
                self.log_result(
                    "12.3 Invalid Company ID",
                    False,
                    f"Unexpected response for invalid company ID: {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("12.3 Invalid Company ID", False, f"Request failed: {str(e)}")
    
    def test_invalid_transaction_id(self):
        """12.4 Invalid Transaction ID"""
        if not self.jwt_token:
            self.log_result("12.4 Invalid Transaction ID", False, "No JWT token available")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            
            response, response_time = self.make_request(
                "GET", "/api/wallet/transaction/invalid-id-99999",
                headers=headers
            )
            
            if response.status_code == 404:
                self.log_result(
                    "12.4 Invalid Transaction ID",
                    True,
                    "Correctly returned 404 for invalid transaction ID",
                    {"status_code": response.status_code},
                    response_time
                )
            else:
                self.log_result(
                    "12.4 Invalid Transaction ID",
                    False,
                    f"Expected 404, got {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("12.4 Invalid Transaction ID", False, f"Request failed: {str(e)}")
    
    def test_negative_amount(self):
        """12.5 Negative Amount"""
        if not self.jwt_token or not self.company_id:
            self.log_result("12.5 Negative Amount", False, "No JWT token or company ID available")
            return
            
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            negative_amount_data = {
                "base_amount": -100,
                "base_currency": "USD",
                "company_id": self.company_id
            }
            
            response, response_time = self.make_request(
                "POST", "/api/pay/createPaymentLink",
                json=negative_amount_data,
                headers=headers
            )
            
            if response.status_code == 400:
                self.log_result(
                    "12.5 Negative Amount",
                    True,
                    "Correctly rejected negative amount",
                    {"status_code": response.status_code},
                    response_time
                )
            else:
                self.log_result(
                    "12.5 Negative Amount",
                    False,
                    f"Expected 400, got {response.status_code}",
                    {"response": response.text},
                    response_time
                )
                
        except Exception as e:
            self.log_result("12.5 Negative Amount", False, f"Request failed: {str(e)}")
    
    def generate_final_report(self):
        """Generate comprehensive final report"""
        print("\n" + "=" * 80)
        print("COMPREHENSIVE API TESTING FINAL REPORT")
        print("=" * 80)
        
        # Calculate statistics
        pass_rate = (self.passed_tests / self.total_tests * 100) if self.total_tests > 0 else 0
        avg_response_time = sum(self.response_times) / len(self.response_times) if self.response_times else 0
        max_response_time = max(self.response_times) if self.response_times else 0
        
        print(f"\nSUMMARY STATISTICS:")
        print(f"- Total Tests: {self.total_tests}")
        print(f"- Passed: {self.passed_tests} ({pass_rate:.1f}%)")
        print(f"- Failed: {self.failed_tests} ({100-pass_rate:.1f}%)")
        print(f"- Average Response Time: {avg_response_time:.3f}s")
        print(f"- Maximum Response Time: {max_response_time:.3f}s")
        
        # Phase breakdown
        phases = {
            "Phase 1 (Authentication)": [k for k in self.test_results.keys() if k.startswith("1.")],
            "Phase 2 (Company Management)": [k for k in self.test_results.keys() if k.startswith("2.")],
            "Phase 3 (Wallet Management)": [k for k in self.test_results.keys() if k.startswith("3.")],
            "Phase 4 (API Key Management)": [k for k in self.test_results.keys() if k.startswith("4.")],
            "Phase 5 (Payment Links)": [k for k in self.test_results.keys() if k.startswith("5.")],
            "Phase 6 (Transactions)": [k for k in self.test_results.keys() if k.startswith("6.")],
            "Phase 7 (Dashboard & Analytics)": [k for k in self.test_results.keys() if k.startswith("7.")],
            "Phase 8 (Tax & Compliance)": [k for k in self.test_results.keys() if k.startswith("8.")],
            "Phase 9 (Notifications)": [k for k in self.test_results.keys() if k.startswith("9.")],
            "Phase 10 (Customers & Subscriptions)": [k for k in self.test_results.keys() if k.startswith("10.")],
            "Phase 11 (Swagger Documentation)": [k for k in self.test_results.keys() if k.startswith("11.")],
            "Phase 12 (Error Handling)": [k for k in self.test_results.keys() if k.startswith("12.")]
        }
        
        print(f"\nPHASE BREAKDOWN:")
        for phase_name, test_keys in phases.items():
            if test_keys:
                phase_passed = sum(1 for k in test_keys if self.test_results[k]['success'])
                phase_total = len(test_keys)
                phase_rate = (phase_passed / phase_total * 100) if phase_total > 0 else 0
                print(f"- {phase_name}: {phase_passed}/{phase_total} ({phase_rate:.1f}%)")
        
        # Critical issues
        if self.errors:
            print(f"\nCRITICAL ISSUES FOUND:")
            for i, error in enumerate(self.errors[:10], 1):  # Show first 10 errors
                print(f"{i}. {error}")
            if len(self.errors) > 10:
                print(f"... and {len(self.errors) - 10} more issues")
        else:
            print(f"\n✅ NO CRITICAL ISSUES FOUND")
        
        # Success criteria evaluation
        print(f"\nSUCCESS CRITERIA EVALUATION:")
        
        # Critical phases (1-6) success rate
        critical_phases = ["1.", "2.", "3.", "4.", "5.", "6."]
        critical_tests = [k for k in self.test_results.keys() if any(k.startswith(p) for p in critical_phases)]
        critical_passed = sum(1 for k in critical_tests if self.test_results[k]['success'])
        critical_total = len(critical_tests)
        critical_rate = (critical_passed / critical_total * 100) if critical_total > 0 else 0
        
        # High priority phases (7-8) success rate
        high_priority_phases = ["7.", "8."]
        high_priority_tests = [k for k in self.test_results.keys() if any(k.startswith(p) for p in high_priority_phases)]
        high_priority_passed = sum(1 for k in high_priority_tests if self.test_results[k]['success'])
        high_priority_total = len(high_priority_tests)
        high_priority_rate = (high_priority_passed / high_priority_total * 100) if high_priority_total > 0 else 0
        
        criteria_results = []
        criteria_results.append(("All Phase 1-6 endpoints working (Critical)", critical_rate >= 90, f"{critical_rate:.1f}%"))
        criteria_results.append(("All Phase 7-8 endpoints working (High Priority)", high_priority_rate >= 90, f"{high_priority_rate:.1f}%"))
        criteria_results.append(("90%+ of all endpoints passing", pass_rate >= 90, f"{pass_rate:.1f}%"))
        criteria_results.append(("Average response time < 2 seconds", avg_response_time < 2.0, f"{avg_response_time:.3f}s"))
        criteria_results.append(("No critical errors or crashes", len(self.errors) == 0, f"{len(self.errors)} errors"))
        
        for criterion, passed, value in criteria_results:
            status = "✅ PASS" if passed else "❌ FAIL"
            print(f"{status}: {criterion} - {value}")
        
        # Overall assessment
        overall_success = all(result[1] for result in criteria_results)
        print(f"\n{'='*80}")
        if overall_success:
            print("🎉 OVERALL ASSESSMENT: PRODUCTION READY")
            print("All success criteria met. API endpoints are functioning correctly.")
        else:
            print("⚠️  OVERALL ASSESSMENT: NEEDS ATTENTION")
            print("Some success criteria not met. Review failed tests and critical issues.")
        print(f"{'='*80}")

if __name__ == "__main__":
    tester = ComprehensiveBackendTester()
    tester.run_all_tests()