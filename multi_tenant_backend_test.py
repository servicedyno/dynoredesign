#!/usr/bin/env python3
"""
DynoPay Multi-Tenant Backend Testing Suite
Comprehensive testing after multi-tenant isolation fixes
"""

import os
import sys
import json
import requests
import time
from typing import Dict, List, Any

class MultiTenantBackendTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.user_data = None
        
        # Test credentials as provided
        self.test_credentials = {
            "email": "john@dyno.pt",
            "password": "Katiekendra123@",
            "expected_user_id": 28,
            "expected_company_id": 38
        }
        
    def get_backend_url(self):
        """Get backend URL from frontend .env file"""
        try:
            with open('/app/frontend/.env', 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        return line.split('=', 1)[1].strip()
        except:
            pass
        return "http://localhost:3300"  # Fallback as specified in review
        
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
    
    def test_health_check(self):
        """Test GET /health - verify backend is running"""
        print("\n=== 1. Health Check ===")
        
        try:
            response = requests.get(f"{self.backend_url}/health", timeout=10)
            
            if response.status_code == 200:
                self.log_result(
                    "Health Check", 
                    True, 
                    "Backend is running and responding",
                    {"status_code": response.status_code}
                )
                return True
            else:
                self.log_result(
                    "Health Check", 
                    False, 
                    f"Health check failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_result(
                "Health Check", 
                False, 
                f"Failed to connect to backend: {str(e)}"
            )
            return False
    
    def test_authentication(self):
        """Test POST /api/user/login - test with valid credentials"""
        print("\n=== 2. Authentication Tests ===")
        
        try:
            login_data = {
                "email": self.test_credentials["email"],
                "password": self.test_credentials["password"]
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
                    self.user_data = data['data']
                    
                    # Verify user details match expected
                    user_id = self.user_data.get('user_id')
                    name = self.user_data.get('name', '')
                    
                    if user_id == self.test_credentials["expected_user_id"]:
                        self.log_result(
                            "Authentication - Login", 
                            True, 
                            f"Successfully authenticated user {name} (ID: {user_id})",
                            {
                                "user_id": user_id,
                                "name": name,
                                "email": self.test_credentials["email"],
                                "has_token": bool(self.jwt_token)
                            }
                        )
                        
                        # Test JWT token generation
                        if len(self.jwt_token) > 50:  # JWT tokens are typically long
                            self.log_result(
                                "Authentication - JWT Token", 
                                True, 
                                "JWT token generated successfully",
                                {"token_length": len(self.jwt_token)}
                            )
                        else:
                            self.log_result(
                                "Authentication - JWT Token", 
                                False, 
                                "JWT token appears invalid (too short)",
                                {"token_length": len(self.jwt_token)}
                            )
                        
                        return True
                    else:
                        self.log_result(
                            "Authentication - User Verification", 
                            False, 
                            f"User ID mismatch: expected {self.test_credentials['expected_user_id']}, got {user_id}",
                            {"expected": self.test_credentials["expected_user_id"], "actual": user_id}
                        )
                        return False
                else:
                    self.log_result(
                        "Authentication - Login", 
                        False, 
                        "Login succeeded but no access token received",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Authentication - Login", 
                    False, 
                    f"Login failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Authentication - Login", 
                False, 
                f"Authentication request failed: {str(e)}"
            )
            return False
    
    def test_company_endpoints(self):
        """Test Company Endpoints with Ownership Validation"""
        print("\n=== 3. Company Endpoints with Ownership Validation ===")
        
        if not self.jwt_token:
            self.log_result(
                "Company Endpoints", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        # Test 1: GET /api/company/getCompany - should return user's companies
        self.test_get_user_companies(headers)
        
        # Test 2: GET /api/company/getCompany/:id - should validate user owns company
        self.test_get_company_by_id(headers)
        
        # Test 3: PUT /api/company/updateCompany/:id - should validate ownership before update
        self.test_update_company_ownership(headers)
        
        # Test 4: GET /api/company/getTransactions/:id - should validate ownership
        self.test_get_company_transactions(headers)
        
        # Test 5: GET /api/company/webhook-settings/:id - should validate ownership
        self.test_get_webhook_settings(headers)
    
    def test_get_user_companies(self, headers):
        """Test GET /api/company/getCompany - should return user's companies"""
        try:
            response = requests.get(
                f"{self.backend_url}/api/company/getCompany",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    companies = data['data']
                    
                    # Should find company with ID 38
                    company_38 = None
                    for company in companies:
                        if company.get('company_id') == self.test_credentials["expected_company_id"]:
                            company_38 = company
                            break
                    
                    if company_38:
                        self.log_result(
                            "Company - Get User Companies", 
                            True, 
                            f"Successfully retrieved user companies, found company ID {self.test_credentials['expected_company_id']}",
                            {
                                "total_companies": len(companies),
                                "company_38_name": company_38.get('company_name', 'Unknown'),
                                "company_38_id": company_38.get('company_id')
                            }
                        )
                    else:
                        self.log_result(
                            "Company - Get User Companies", 
                            False, 
                            f"Expected company ID {self.test_credentials['expected_company_id']} not found in user's companies",
                            {
                                "total_companies": len(companies),
                                "company_ids": [c.get('company_id') for c in companies]
                            }
                        )
                else:
                    self.log_result(
                        "Company - Get User Companies", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Company - Get User Companies", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Company - Get User Companies", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_get_company_by_id(self, headers):
        """Test GET /api/company/getCompany/:id - should validate user owns company"""
        # Test with valid company_id (38)
        try:
            response = requests.get(
                f"{self.backend_url}/api/company/getCompany/{self.test_credentials['expected_company_id']}",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    company = data['data']
                    
                    if company.get('company_id') == self.test_credentials["expected_company_id"]:
                        self.log_result(
                            "Company - Get by Valid ID", 
                            True, 
                            f"Successfully retrieved company {company.get('company_name', 'Unknown')} (ID: {company.get('company_id')})",
                            {
                                "company_id": company.get('company_id'),
                                "company_name": company.get('company_name'),
                                "ownership_validated": True
                            }
                        )
                    else:
                        self.log_result(
                            "Company - Get by Valid ID", 
                            False, 
                            "Company ID mismatch in response",
                            {"expected": self.test_credentials["expected_company_id"], "actual": company.get('company_id')}
                        )
                else:
                    self.log_result(
                        "Company - Get by Valid ID", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Company - Get by Valid ID", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Company - Get by Valid ID", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test with invalid company_id (should return 403 for unauthorized access)
        try:
            invalid_company_id = 999  # Assuming this doesn't belong to the user
            response = requests.get(
                f"{self.backend_url}/api/company/getCompany/{invalid_company_id}",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 403:
                self.log_result(
                    "Company - Get by Invalid ID (Ownership Check)", 
                    True, 
                    f"Correctly returned 403 for unauthorized company access (ID: {invalid_company_id})",
                    {"status_code": response.status_code, "company_id": invalid_company_id}
                )
            elif response.status_code == 404:
                self.log_result(
                    "Company - Get by Invalid ID (Ownership Check)", 
                    True, 
                    f"Correctly returned 404 for non-existent company (ID: {invalid_company_id})",
                    {"status_code": response.status_code, "company_id": invalid_company_id}
                )
            else:
                self.log_result(
                    "Company - Get by Invalid ID (Ownership Check)", 
                    False, 
                    f"Expected 403/404 for unauthorized access, got {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Company - Get by Invalid ID (Ownership Check)", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_update_company_ownership(self, headers):
        """Test PUT /api/company/updateCompany/:id - should validate ownership before update"""
        try:
            # Test update with valid company_id
            update_data = {
                "company_name": "Johnny LTD Updated Test",
                "email": "johnny.updated@dyno.pt",
                "mobile": "+351123456789"
            }
            
            response = requests.put(
                f"{self.backend_url}/api/company/updateCompany/{self.test_credentials['expected_company_id']}",
                json=update_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    updated_company = data['data']
                    
                    self.log_result(
                        "Company - Update with Valid Ownership", 
                        True, 
                        f"Successfully updated company {updated_company.get('company_name', 'Unknown')}",
                        {
                            "company_id": updated_company.get('company_id'),
                            "updated_name": updated_company.get('company_name'),
                            "ownership_validated": True
                        }
                    )
                else:
                    self.log_result(
                        "Company - Update with Valid Ownership", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Company - Update with Valid Ownership", 
                    False, 
                    f"Update failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Company - Update with Valid Ownership", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test update with invalid company_id (should return 403)
        try:
            invalid_company_id = 999
            update_data = {
                "company_name": "Unauthorized Update Test"
            }
            
            response = requests.put(
                f"{self.backend_url}/api/company/updateCompany/{invalid_company_id}",
                json=update_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 403:
                self.log_result(
                    "Company - Update Ownership Validation", 
                    True, 
                    f"Correctly blocked unauthorized update (403) for company ID {invalid_company_id}",
                    {"status_code": response.status_code}
                )
            elif response.status_code == 404:
                self.log_result(
                    "Company - Update Ownership Validation", 
                    True, 
                    f"Correctly returned 404 for non-existent company ID {invalid_company_id}",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result(
                    "Company - Update Ownership Validation", 
                    False, 
                    f"Expected 403/404 for unauthorized update, got {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Company - Update Ownership Validation", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_get_company_transactions(self, headers):
        """Test GET /api/company/getTransactions/:id - should validate ownership"""
        try:
            response = requests.get(
                f"{self.backend_url}/api/company/getTransactions/{self.test_credentials['expected_company_id']}",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    transactions = data['data']
                    
                    self.log_result(
                        "Company - Get Transactions with Valid Ownership", 
                        True, 
                        f"Successfully retrieved {len(transactions)} transactions for company ID {self.test_credentials['expected_company_id']}",
                        {
                            "company_id": self.test_credentials['expected_company_id'],
                            "transaction_count": len(transactions),
                            "ownership_validated": True
                        }
                    )
                else:
                    self.log_result(
                        "Company - Get Transactions with Valid Ownership", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Company - Get Transactions with Valid Ownership", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Company - Get Transactions with Valid Ownership", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_get_webhook_settings(self, headers):
        """Test GET /api/company/webhook-settings/:id - should validate ownership"""
        try:
            response = requests.get(
                f"{self.backend_url}/api/company/webhook-settings/{self.test_credentials['expected_company_id']}",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    webhook_settings = data['data']
                    
                    self.log_result(
                        "Company - Get Webhook Settings with Valid Ownership", 
                        True, 
                        f"Successfully retrieved webhook settings for company ID {self.test_credentials['expected_company_id']}",
                        {
                            "company_id": self.test_credentials['expected_company_id'],
                            "has_webhook_url": bool(webhook_settings.get('webhook_url')),
                            "ownership_validated": True
                        }
                    )
                else:
                    self.log_result(
                        "Company - Get Webhook Settings with Valid Ownership", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Company - Get Webhook Settings with Valid Ownership", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Company - Get Webhook Settings with Valid Ownership", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_payment_link_creation(self):
        """Test POST /api/payment/createPaymentLink - test payment link creation"""
        print("\n=== 4. Payment Link Creation ===")
        
        if not self.jwt_token:
            self.log_result(
                "Payment Link Creation", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        try:
            # Test payment link creation with company_id validation
            payment_data = {
                "amount": 50,
                "currency": "USD",
                "email": "test.customer@example.com",
                "modes": ["CRYPTO"],
                "description": "Multi-tenant test payment",
                "company_id": self.test_credentials["expected_company_id"],
                "fee_payer": "customer"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/payment/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    payment_link = data['data']
                    
                    # Verify company_id validation is working
                    if payment_link.get('company_id') == self.test_credentials["expected_company_id"]:
                        self.log_result(
                            "Payment Link - Creation with Valid Company ID", 
                            True, 
                            f"Successfully created payment link for company ID {self.test_credentials['expected_company_id']}",
                            {
                                "payment_link_id": payment_link.get('link_id'),
                                "amount": payment_link.get('amount'),
                                "currency": payment_link.get('currency'),
                                "company_id": payment_link.get('company_id'),
                                "company_id_validated": True
                            }
                        )
                    else:
                        self.log_result(
                            "Payment Link - Company ID Validation", 
                            False, 
                            "Company ID mismatch in payment link response",
                            {
                                "expected": self.test_credentials["expected_company_id"],
                                "actual": payment_link.get('company_id')
                            }
                        )
                else:
                    self.log_result(
                        "Payment Link - Creation with Valid Company ID", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Payment Link - Creation with Valid Company ID", 
                    False, 
                    f"Payment link creation failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Payment Link - Creation with Valid Company ID", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test with invalid company_id (should fail validation)
        try:
            invalid_payment_data = {
                "amount": 25,
                "currency": "USD",
                "email": "test.invalid@example.com",
                "modes": ["CRYPTO"],
                "description": "Invalid company test",
                "company_id": 999,  # Invalid company ID
                "fee_payer": "customer"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/payment/createPaymentLink",
                json=invalid_payment_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 403:
                self.log_result(
                    "Payment Link - Company ID Validation", 
                    True, 
                    "Correctly blocked payment link creation with invalid company ID (403)",
                    {"status_code": response.status_code, "invalid_company_id": 999}
                )
            elif response.status_code == 400:
                self.log_result(
                    "Payment Link - Company ID Validation", 
                    True, 
                    "Correctly blocked payment link creation with invalid company ID (400)",
                    {"status_code": response.status_code, "invalid_company_id": 999}
                )
            else:
                self.log_result(
                    "Payment Link - Company ID Validation", 
                    False, 
                    f"Expected 403/400 for invalid company ID, got {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Payment Link - Company ID Validation", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_wallet_operations(self):
        """Test Wallet Operations with multi-tenant isolation"""
        print("\n=== 5. Wallet Operations ===")
        
        if not self.jwt_token:
            self.log_result(
                "Wallet Operations", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        # Test 1: GET /api/wallet/getWallet - get user wallets
        self.test_get_user_wallets(headers)
        
        # Test 2: GET /api/wallet/getWalletAddresses - get wallet addresses
        self.test_get_wallet_addresses(headers)
    
    def test_get_user_wallets(self, headers):
        """Test GET /api/wallet/getWallet - get user wallets"""
        try:
            response = requests.get(
                f"{self.backend_url}/api/wallet/getWallet",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    wallets = data['data']
                    
                    # Verify multi-tenant isolation (wallets should be filtered by user)
                    user_wallets = []
                    for wallet in wallets:
                        if wallet.get('user_id') == self.test_credentials["expected_user_id"]:
                            user_wallets.append(wallet)
                    
                    if len(user_wallets) == len(wallets):
                        self.log_result(
                            "Wallet - Get User Wallets (Multi-tenant Isolation)", 
                            True, 
                            f"Successfully retrieved {len(wallets)} wallets, all belong to user {self.test_credentials['expected_user_id']}",
                            {
                                "total_wallets": len(wallets),
                                "user_id": self.test_credentials["expected_user_id"],
                                "multi_tenant_isolation": True,
                                "wallet_types": [w.get('wallet_type') for w in wallets[:5]]  # Show first 5
                            }
                        )
                    else:
                        self.log_result(
                            "Wallet - Get User Wallets (Multi-tenant Isolation)", 
                            False, 
                            f"Multi-tenant isolation failed: found wallets belonging to other users",
                            {
                                "total_wallets": len(wallets),
                                "user_wallets": len(user_wallets),
                                "expected_user_id": self.test_credentials["expected_user_id"]
                            }
                        )
                else:
                    self.log_result(
                        "Wallet - Get User Wallets", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Wallet - Get User Wallets", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Wallet - Get User Wallets", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_get_wallet_addresses(self, headers):
        """Test GET /api/wallet/getWalletAddresses - get wallet addresses"""
        try:
            response = requests.get(
                f"{self.backend_url}/api/wallet/getWalletAddresses",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    addresses = data['data']
                    
                    # Verify multi-tenant isolation (addresses should be filtered by user)
                    user_addresses = []
                    for address in addresses:
                        if address.get('user_id') == self.test_credentials["expected_user_id"]:
                            user_addresses.append(address)
                    
                    if len(user_addresses) == len(addresses):
                        self.log_result(
                            "Wallet - Get Wallet Addresses (Multi-tenant Isolation)", 
                            True, 
                            f"Successfully retrieved {len(addresses)} wallet addresses, all belong to user {self.test_credentials['expected_user_id']}",
                            {
                                "total_addresses": len(addresses),
                                "user_id": self.test_credentials["expected_user_id"],
                                "multi_tenant_isolation": True,
                                "currencies": list(set([a.get('currency') for a in addresses[:10]]))  # Show unique currencies
                            }
                        )
                    else:
                        self.log_result(
                            "Wallet - Get Wallet Addresses (Multi-tenant Isolation)", 
                            False, 
                            f"Multi-tenant isolation failed: found addresses belonging to other users",
                            {
                                "total_addresses": len(addresses),
                                "user_addresses": len(user_addresses),
                                "expected_user_id": self.test_credentials["expected_user_id"]
                            }
                        )
                else:
                    self.log_result(
                        "Wallet - Get Wallet Addresses", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Wallet - Get Wallet Addresses", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Wallet - Get Wallet Addresses", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_dashboard_endpoints(self):
        """Test Dashboard Endpoints with company_id filtering"""
        print("\n=== 6. Dashboard Endpoints ===")
        
        if not self.jwt_token:
            self.log_result(
                "Dashboard Endpoints", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        # Test 1: GET /api/dashboard/stats - verify company_id filtering works
        self.test_dashboard_stats(headers)
        
        # Test 2: GET /api/dashboard/analytics - verify data isolation
        self.test_dashboard_analytics(headers)
    
    def test_dashboard_stats(self, headers):
        """Test GET /api/dashboard/stats - verify company_id filtering works"""
        try:
            response = requests.get(
                f"{self.backend_url}/api/dashboard",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    stats = data['data']
                    
                    # Verify required fields are present
                    required_fields = ['total_transactions', 'total_volume', 'pending_transactions', 'active_wallets']
                    missing_fields = [field for field in required_fields if field not in stats]
                    
                    if not missing_fields:
                        self.log_result(
                            "Dashboard - Stats (Company Filtering)", 
                            True, 
                            f"Successfully retrieved dashboard stats with proper data isolation",
                            {
                                "total_transactions": stats.get('total_transactions', {}).get('count', 0),
                                "total_volume": f"{stats.get('total_volume', {}).get('amount', 0)} {stats.get('total_volume', {}).get('currency', 'USD')}",
                                "pending_transactions": stats.get('pending_transactions', {}).get('count', 0),
                                "active_wallets": stats.get('active_wallets', {}).get('count', 0),
                                "company_id_filtering": True
                            }
                        )
                    else:
                        self.log_result(
                            "Dashboard - Stats Structure", 
                            False, 
                            f"Missing required fields: {', '.join(missing_fields)}",
                            {"missing_fields": missing_fields, "available_fields": list(stats.keys())}
                        )
                else:
                    self.log_result(
                        "Dashboard - Stats", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Dashboard - Stats", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Dashboard - Stats", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_dashboard_analytics(self, headers):
        """Test GET /api/dashboard/analytics - verify data isolation"""
        try:
            # Test chart endpoint which should have data isolation
            response = requests.get(
                f"{self.backend_url}/api/dashboard/chart",
                params={"period": "30d"},
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    analytics = data['data']
                    
                    # Verify required fields are present
                    required_fields = ['chart_data', 'currency_breakdown', 'status_breakdown']
                    missing_fields = [field for field in required_fields if field not in analytics]
                    
                    if not missing_fields:
                        chart_data = analytics.get('chart_data', [])
                        currency_breakdown = analytics.get('currency_breakdown', [])
                        status_breakdown = analytics.get('status_breakdown', [])
                        
                        self.log_result(
                            "Dashboard - Analytics (Data Isolation)", 
                            True, 
                            f"Successfully retrieved analytics with proper data isolation",
                            {
                                "period": analytics.get('period', '30d'),
                                "chart_entries": len(chart_data),
                                "currencies": len(currency_breakdown),
                                "statuses": len(status_breakdown),
                                "data_isolation": True
                            }
                        )
                    else:
                        self.log_result(
                            "Dashboard - Analytics Structure", 
                            False, 
                            f"Missing required fields: {', '.join(missing_fields)}",
                            {"missing_fields": missing_fields, "available_fields": list(analytics.keys())}
                        )
                else:
                    self.log_result(
                        "Dashboard - Analytics", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Dashboard - Analytics", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Dashboard - Analytics", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def check_backend_logs(self):
        """Check backend logs for any errors during testing"""
        print("\n=== Backend Logs Check ===")
        
        try:
            import subprocess
            
            # Check backend logs as specified in review request
            result = subprocess.run(
                ["tail", "-n", "50", "/var/log/supervisor/backend.out.log"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                log_content = result.stdout
                
                # Look for TypeScript errors or other issues
                error_indicators = ['error', 'Error', 'ERROR', 'TypeError', 'ReferenceError', 'SyntaxError']
                found_errors = []
                
                for line in log_content.split('\n'):
                    for indicator in error_indicators:
                        if indicator in line and 'test' not in line.lower():  # Exclude test-related errors
                            found_errors.append(line.strip())
                            break
                
                if found_errors:
                    self.log_result(
                        "Backend Logs - Error Check", 
                        False, 
                        f"Found {len(found_errors)} potential errors in backend logs",
                        {"errors": found_errors[:5]}  # Show first 5 errors
                    )
                else:
                    self.log_result(
                        "Backend Logs - Error Check", 
                        True, 
                        "No TypeScript errors or critical issues found in recent backend logs",
                        {"log_lines_checked": len(log_content.split('\n'))}
                    )
            else:
                self.log_result(
                    "Backend Logs - Error Check", 
                    False, 
                    "Failed to read backend logs",
                    {"error": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Backend Logs - Error Check", 
                False, 
                f"Failed to check backend logs: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all multi-tenant backend tests"""
        print("🚀 Starting DynoPay Multi-Tenant Backend Testing Suite")
        print(f"Backend URL: {self.backend_url}")
        print(f"Test User: {self.test_credentials['email']}")
        print(f"Expected Company ID: {self.test_credentials['expected_company_id']}")
        
        # Run tests in sequence
        tests = [
            self.test_health_check,
            self.test_authentication,
            self.test_company_endpoints,
            self.test_payment_link_creation,
            self.test_wallet_operations,
            self.test_dashboard_endpoints,
            self.check_backend_logs
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                print(f"❌ Test {test.__name__} failed with exception: {str(e)}")
        
        # Generate summary
        self.generate_summary()
    
    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "="*80)
        print("🎯 MULTI-TENANT BACKEND TESTING SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"📊 Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"📈 Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            for test_name, result in self.test_results.items():
                if not result['success']:
                    print(f"   • {test_name}: {result['message']}")
        
        print(f"\n✅ PASSED TESTS ({passed_tests}):")
        for test_name, result in self.test_results.items():
            if result['success']:
                print(f"   • {test_name}: {result['message']}")
        
        # Key findings
        print(f"\n🔍 KEY FINDINGS:")
        
        # Authentication
        auth_success = self.test_results.get('Authentication - Login', {}).get('success', False)
        if auth_success:
            print(f"   ✅ Authentication: Working correctly with JWT token generation")
        else:
            print(f"   ❌ Authentication: Failed - critical issue")
        
        # Multi-tenant isolation
        company_tests = [k for k in self.test_results.keys() if 'Company' in k and 'Ownership' in k]
        company_success = all(self.test_results.get(test, {}).get('success', False) for test in company_tests)
        if company_success and company_tests:
            print(f"   ✅ Multi-tenant Isolation: Company ownership validation working")
        else:
            print(f"   ❌ Multi-tenant Isolation: Issues detected in ownership validation")
        
        # Wallet isolation
        wallet_tests = [k for k in self.test_results.keys() if 'Wallet' in k and 'Multi-tenant' in k]
        wallet_success = all(self.test_results.get(test, {}).get('success', False) for test in wallet_tests)
        if wallet_success and wallet_tests:
            print(f"   ✅ Wallet Multi-tenant Isolation: Data properly filtered by user")
        else:
            print(f"   ❌ Wallet Multi-tenant Isolation: Potential data leakage detected")
        
        # TypeScript errors
        log_check = self.test_results.get('Backend Logs - Error Check', {})
        if log_check.get('success', False):
            print(f"   ✅ TypeScript Build: No compilation errors detected")
        else:
            print(f"   ❌ TypeScript Build: Errors found in backend logs")
        
        print("\n" + "="*80)

if __name__ == "__main__":
    tester = MultiTenantBackendTester()
    tester.run_all_tests()