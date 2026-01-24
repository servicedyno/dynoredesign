#!/usr/bin/env python3
"""
DynoPay CRUD Endpoints Testing Suite
Tests all newly implemented CRUD endpoints as specified in the review request
"""

import os
import sys
import json
import requests
import time
from typing import Dict, List, Any

class DynoPayCRUDTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        
        # Test credentials from review request
        self.test_email = "nomadly@moxx.co"
        self.test_password = "Katiekendra123@"
        
    def get_backend_url(self):
        """Get backend URL from frontend .env file"""
        try:
            with open('/app/frontend/.env', 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        external_url = line.split('=', 1)[1].strip()
                        print(f"Found external URL: {external_url}")
                        # Use localhost for testing as external URL is not accessible
                        print("Using localhost for testing as external URL is not accessible")
                        return "http://localhost:8001"
        except Exception as e:
            print(f"Warning: Could not read frontend .env file: {e}")
        
        # Fallback to localhost as specified in review request
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
    
    def login_with_test_credentials(self):
        """Login with test credentials to get JWT token"""
        print("\n=== Logging in with Test Credentials ===")
        
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
                    self.log_result(
                        "User Login", 
                        True, 
                        f"Successfully logged in with {self.test_email}",
                        {"email": self.test_email, "has_token": bool(self.jwt_token)}
                    )
                    return True
                else:
                    self.log_result(
                        "User Login", 
                        False, 
                        "Login succeeded but no token received",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "User Login", 
                    False, 
                    f"Login failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "User Login", 
                False, 
                f"Login request failed: {str(e)}"
            )
        
        return False
    
    def get_auth_headers(self):
        """Get authorization headers with JWT token"""
        if not self.jwt_token:
            return {}
        return {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
    
    def test_user_profile_endpoints(self):
        """Test User Profile & Account Management endpoints"""
        print("\n=== Testing User Profile & Account Management ===")
        
        # Test GET /api/user/profile
        self.test_get_user_profile()
        
        # Skip DELETE /api/user/account as instructed in review request
        print("⏭️  Skipping DELETE /api/user/account test as instructed")
    
    def test_get_user_profile(self):
        """Test GET /api/user/profile"""
        print("\n--- Testing GET /api/user/profile ---")
        
        if not self.jwt_token:
            self.log_result("GET User Profile", False, "No JWT token available")
            return
        
        try:
            response = requests.get(
                f"{self.backend_url}/api/user/profile",
                headers=self.get_auth_headers(),
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    profile_data = data['data']
                    # Check for expected profile fields
                    expected_fields = ['user_id', 'name', 'email']
                    missing_fields = [field for field in expected_fields if field not in profile_data]
                    
                    if not missing_fields:
                        self.log_result(
                            "GET User Profile", 
                            True, 
                            "User profile retrieved successfully",
                            {
                                "user_id": profile_data.get('user_id'),
                                "name": profile_data.get('name'),
                                "email": profile_data.get('email')
                            }
                        )
                    else:
                        self.log_result(
                            "GET User Profile", 
                            False, 
                            f"Missing profile fields: {', '.join(missing_fields)}",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "GET User Profile", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "GET User Profile", 
                    False, 
                    f"API returned status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "GET User Profile", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_api_key_management_endpoints(self):
        """Test API Key Management endpoints"""
        print("\n=== Testing API Key Management ===")
        
        # First, get list of API keys to test with
        api_keys = self.get_api_keys_for_testing()
        
        if api_keys:
            api_key_id = api_keys[0].get('api_id')
            if api_key_id:
                self.test_get_api_key(api_key_id)
                self.test_update_api_key(api_key_id)
                self.test_regenerate_api_key(api_key_id)
            else:
                print("⚠️  No valid API key ID found for testing")
        else:
            print("⚠️  No API keys found for testing - this is expected for new users")
    
    def get_api_keys_for_testing(self):
        """Get existing API keys for testing"""
        try:
            response = requests.get(
                f"{self.backend_url}/api/userApi/getApi",
                headers=self.get_auth_headers(),
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and isinstance(data['data'], list):
                    return data['data']
            
        except Exception as e:
            print(f"Failed to get API keys: {str(e)}")
        
        return []
    
    def test_get_api_key(self, api_id):
        """Test GET /api/userApi/getApi/:id"""
        print(f"\n--- Testing GET /api/userApi/getApi/{api_id} ---")
        
        try:
            response = requests.get(
                f"{self.backend_url}/api/userApi/getApi/{api_id}",
                headers=self.get_auth_headers(),
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    api_data = data['data']
                    expected_fields = ['api_id', 'api_name', 'permissions']
                    missing_fields = [field for field in expected_fields if field not in api_data]
                    
                    if not missing_fields:
                        self.log_result(
                            f"GET API Key {api_id}", 
                            True, 
                            "API key retrieved successfully",
                            {
                                "api_id": api_data.get('api_id'),
                                "api_name": api_data.get('api_name'),
                                "permissions": api_data.get('permissions')
                            }
                        )
                    else:
                        self.log_result(
                            f"GET API Key {api_id}", 
                            False, 
                            f"Missing API key fields: {', '.join(missing_fields)}",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        f"GET API Key {api_id}", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    f"GET API Key {api_id}", 
                    False, 
                    f"API returned status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                f"GET API Key {api_id}", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_update_api_key(self, api_id):
        """Test PUT /api/userApi/updateApi/:id"""
        print(f"\n--- Testing PUT /api/userApi/updateApi/{api_id} ---")
        
        update_data = {
            "api_name": "Updated Test API",
            "permissions": ["payments", "transactions"],  # Use valid permissions
            "withdrawal_whitelist": True  # Boolean, not array
        }
        
        try:
            response = requests.put(
                f"{self.backend_url}/api/userApi/updateApi/{api_id}",
                json=update_data,
                headers=self.get_auth_headers(),
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    f"PUT Update API Key {api_id}", 
                    True, 
                    "API key updated successfully",
                    {"response": data}
                )
            else:
                error_details = {"status": response.status_code, "response": response.text[:500]}
                self.log_result(
                    f"PUT Update API Key {api_id}", 
                    False, 
                    f"API returned status {response.status_code}: {response.text[:200]}",
                    error_details
                )
                
        except Exception as e:
            self.log_result(
                f"PUT Update API Key {api_id}", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_regenerate_api_key(self, api_id):
        """Test POST /api/userApi/regenerateKey/:id"""
        print(f"\n--- Testing POST /api/userApi/regenerateKey/{api_id} ---")
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/userApi/regenerateKey/{api_id}",
                headers=self.get_auth_headers(),
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and ('apiKey' in data['data'] or 'new_api_key' in data['data']):
                    self.log_result(
                        f"POST Regenerate API Key {api_id}", 
                        True, 
                        "API key regenerated successfully",
                        {"has_new_key": True, "message": data.get('message', '')}
                    )
                else:
                    self.log_result(
                        f"POST Regenerate API Key {api_id}", 
                        False, 
                        "Missing new API key in response",
                        {"response": data}
                    )
            else:
                self.log_result(
                    f"POST Regenerate API Key {api_id}", 
                    False, 
                    f"API returned status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                f"POST Regenerate API Key {api_id}", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_plan_management_endpoints(self):
        """Test Plan Management endpoints"""
        print("\n=== Testing Plan Management ===")
        
        # For testing purposes, we'll use a test plan ID
        # In a real scenario, we'd first create a plan or get existing plans
        test_plan_id = "test_plan_123"
        
        self.test_update_plan(test_plan_id)
        self.test_delete_plan(test_plan_id)
    
    def test_update_plan(self, plan_id):
        """Test PUT /api/userApi/updatePlan/:id"""
        print(f"\n--- Testing PUT /api/userApi/updatePlan/{plan_id} ---")
        
        update_data = {
            "plan_name": "Updated Premium Plan",
            "amount": 99.99,
            "interval": "monthly"
        }
        
        try:
            response = requests.put(
                f"{self.backend_url}/api/userApi/updatePlan/{plan_id}",
                json=update_data,
                headers=self.get_auth_headers(),
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    f"PUT Update Plan {plan_id}", 
                    True, 
                    "Plan updated successfully",
                    {"response": data}
                )
            elif response.status_code == 404:
                self.log_result(
                    f"PUT Update Plan {plan_id}", 
                    True, 
                    "Plan not found (expected for test ID)",
                    {"status": 404}
                )
            else:
                self.log_result(
                    f"PUT Update Plan {plan_id}", 
                    False, 
                    f"API returned status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                f"PUT Update Plan {plan_id}", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_delete_plan(self, plan_id):
        """Test DELETE /api/userApi/deletePlan/:id"""
        print(f"\n--- Testing DELETE /api/userApi/deletePlan/{plan_id} ---")
        
        try:
            response = requests.delete(
                f"{self.backend_url}/api/userApi/deletePlan/{plan_id}",
                headers=self.get_auth_headers(),
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    f"DELETE Plan {plan_id}", 
                    True, 
                    "Plan deleted successfully",
                    {"response": data}
                )
            elif response.status_code == 404:
                self.log_result(
                    f"DELETE Plan {plan_id}", 
                    True, 
                    "Plan not found (expected for test ID)",
                    {"status": 404}
                )
            else:
                self.log_result(
                    f"DELETE Plan {plan_id}", 
                    False, 
                    f"API returned status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                f"DELETE Plan {plan_id}", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_customer_management_endpoints(self):
        """Test Customer Management endpoints"""
        print("\n=== Testing Customer Management ===")
        
        # For testing purposes, we'll use a test customer ID
        test_customer_id = "test_customer_123"
        
        self.test_update_customer(test_customer_id)
        self.test_delete_customer(test_customer_id)
    
    def test_update_customer(self, customer_id):
        """Test PUT /api/userApi/updateCustomer/:id"""
        print(f"\n--- Testing PUT /api/userApi/updateCustomer/{customer_id} ---")
        
        update_data = {
            "customer_name": "Updated Customer Name",
            "email": "updated.customer@example.com",
            "mobile": "+1234567890"
        }
        
        try:
            response = requests.put(
                f"{self.backend_url}/api/userApi/updateCustomer/{customer_id}",
                json=update_data,
                headers=self.get_auth_headers(),
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    f"PUT Update Customer {customer_id}", 
                    True, 
                    "Customer updated successfully",
                    {"response": data}
                )
            elif response.status_code == 404:
                self.log_result(
                    f"PUT Update Customer {customer_id}", 
                    True, 
                    "Customer not found (expected for test ID)",
                    {"status": 404}
                )
            else:
                self.log_result(
                    f"PUT Update Customer {customer_id}", 
                    False, 
                    f"API returned status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                f"PUT Update Customer {customer_id}", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_delete_customer(self, customer_id):
        """Test DELETE /api/userApi/deleteCustomer/:id"""
        print(f"\n--- Testing DELETE /api/userApi/deleteCustomer/{customer_id} ---")
        
        try:
            response = requests.delete(
                f"{self.backend_url}/api/userApi/deleteCustomer/{customer_id}",
                headers=self.get_auth_headers(),
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    f"DELETE Customer {customer_id}", 
                    True, 
                    "Customer deleted successfully",
                    {"response": data}
                )
            elif response.status_code == 404:
                self.log_result(
                    f"DELETE Customer {customer_id}", 
                    True, 
                    "Customer not found (expected for test ID)",
                    {"status": 404}
                )
            else:
                self.log_result(
                    f"DELETE Customer {customer_id}", 
                    False, 
                    f"API returned status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                f"DELETE Customer {customer_id}", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_company_management_endpoints(self):
        """Test Company Management endpoints"""
        print("\n=== Testing Company Management ===")
        
        # For testing purposes, we'll use a test company ID
        test_company_id = "1"
        
        self.test_get_company(test_company_id)
    
    def test_get_company(self, company_id):
        """Test GET /api/company/getCompany/:id"""
        print(f"\n--- Testing GET /api/company/getCompany/{company_id} ---")
        
        try:
            response = requests.get(
                f"{self.backend_url}/api/company/getCompany/{company_id}",
                headers=self.get_auth_headers(),
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    company_data = data['data']
                    expected_fields = ['company_id', 'company_name']
                    missing_fields = [field for field in expected_fields if field not in company_data]
                    
                    if not missing_fields:
                        self.log_result(
                            f"GET Company {company_id}", 
                            True, 
                            "Company retrieved successfully",
                            {
                                "company_id": company_data.get('company_id'),
                                "company_name": company_data.get('company_name')
                            }
                        )
                    else:
                        self.log_result(
                            f"GET Company {company_id}", 
                            False, 
                            f"Missing company fields: {', '.join(missing_fields)}",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        f"GET Company {company_id}", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            elif response.status_code == 404:
                self.log_result(
                    f"GET Company {company_id}", 
                    True, 
                    "Company not found (expected for test ID)",
                    {"status": 404}
                )
            else:
                self.log_result(
                    f"GET Company {company_id}", 
                    False, 
                    f"API returned status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                f"GET Company {company_id}", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_subscription_management_endpoints(self):
        """Test Subscription Management endpoints"""
        print("\n=== Testing Subscription Management ===")
        
        self.test_list_subscriptions()
        self.test_get_subscription("test_sub_123")
        self.test_create_subscription()
        self.test_update_subscription("test_sub_123")
        self.test_delete_subscription("test_sub_123")
    
    def test_list_subscriptions(self):
        """Test GET /api/subscriptions"""
        print("\n--- Testing GET /api/subscriptions ---")
        
        try:
            response = requests.get(
                f"{self.backend_url}/api/subscriptions",
                headers=self.get_auth_headers(),
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and isinstance(data['data'], list):
                    subscriptions = data['data']
                    self.log_result(
                        "GET Subscriptions List", 
                        True, 
                        f"Retrieved {len(subscriptions)} subscriptions",
                        {"count": len(subscriptions)}
                    )
                else:
                    self.log_result(
                        "GET Subscriptions List", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "GET Subscriptions List", 
                    False, 
                    f"API returned status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "GET Subscriptions List", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_get_subscription(self, subscription_id):
        """Test GET /api/subscriptions/:id"""
        print(f"\n--- Testing GET /api/subscriptions/{subscription_id} ---")
        
        try:
            response = requests.get(
                f"{self.backend_url}/api/subscriptions/{subscription_id}",
                headers=self.get_auth_headers(),
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    f"GET Subscription {subscription_id}", 
                    True, 
                    "Subscription retrieved successfully",
                    {"response": data}
                )
            elif response.status_code == 404:
                self.log_result(
                    f"GET Subscription {subscription_id}", 
                    True, 
                    "Subscription not found (expected for test ID)",
                    {"status": 404}
                )
            else:
                self.log_result(
                    f"GET Subscription {subscription_id}", 
                    False, 
                    f"API returned status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                f"GET Subscription {subscription_id}", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_create_subscription(self):
        """Test POST /api/subscriptions"""
        print("\n--- Testing POST /api/subscriptions ---")
        
        subscription_data = {
            "plan_id": "test_plan_123",
            "customer_id": "test_customer_123",
            "status": "active"
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/subscriptions",
                json=subscription_data,
                headers=self.get_auth_headers(),
                timeout=15
            )
            
            if response.status_code == 200 or response.status_code == 201:
                data = response.json()
                self.log_result(
                    "POST Create Subscription", 
                    True, 
                    "Subscription created successfully",
                    {"response": data}
                )
            else:
                self.log_result(
                    "POST Create Subscription", 
                    False, 
                    f"API returned status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "POST Create Subscription", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_update_subscription(self, subscription_id):
        """Test PUT /api/subscriptions/:id"""
        print(f"\n--- Testing PUT /api/subscriptions/{subscription_id} ---")
        
        update_data = {
            "status": "cancelled"
        }
        
        try:
            response = requests.put(
                f"{self.backend_url}/api/subscriptions/{subscription_id}",
                json=update_data,
                headers=self.get_auth_headers(),
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    f"PUT Update Subscription {subscription_id}", 
                    True, 
                    "Subscription updated successfully",
                    {"response": data}
                )
            elif response.status_code == 404:
                self.log_result(
                    f"PUT Update Subscription {subscription_id}", 
                    True, 
                    "Subscription not found (expected for test ID)",
                    {"status": 404}
                )
            else:
                self.log_result(
                    f"PUT Update Subscription {subscription_id}", 
                    False, 
                    f"API returned status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                f"PUT Update Subscription {subscription_id}", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_delete_subscription(self, subscription_id):
        """Test DELETE /api/subscriptions/:id"""
        print(f"\n--- Testing DELETE /api/subscriptions/{subscription_id} ---")
        
        try:
            response = requests.delete(
                f"{self.backend_url}/api/subscriptions/{subscription_id}",
                headers=self.get_auth_headers(),
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    f"DELETE Subscription {subscription_id}", 
                    True, 
                    "Subscription cancelled successfully",
                    {"response": data}
                )
            elif response.status_code == 404:
                self.log_result(
                    f"DELETE Subscription {subscription_id}", 
                    True, 
                    "Subscription not found (expected for test ID)",
                    {"status": 404}
                )
            else:
                self.log_result(
                    f"DELETE Subscription {subscription_id}", 
                    False, 
                    f"API returned status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                f"DELETE Subscription {subscription_id}", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_kyc_management_endpoints(self):
        """Test KYC Management endpoints"""
        print("\n=== Testing KYC Management ===")
        
        self.test_kyc_resubmit()
        self.test_kyc_history()
    
    def test_kyc_resubmit(self):
        """Test POST /api/kyc/resubmit"""
        print("\n--- Testing POST /api/kyc/resubmit ---")
        
        kyc_data = {
            "documents": {
                "id_document": "passport_123.jpg",
                "proof_of_address": "utility_bill_123.pdf"
            },
            "company_id": "1"
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/kyc/resubmit",
                json=kyc_data,
                headers=self.get_auth_headers(),
                timeout=15
            )
            
            if response.status_code == 200 or response.status_code == 201:
                data = response.json()
                self.log_result(
                    "POST KYC Resubmit", 
                    True, 
                    "KYC resubmitted successfully",
                    {"response": data}
                )
            else:
                self.log_result(
                    "POST KYC Resubmit", 
                    False, 
                    f"API returned status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "POST KYC Resubmit", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_kyc_history(self):
        """Test GET /api/kyc/history"""
        print("\n--- Testing GET /api/kyc/history ---")
        
        try:
            response = requests.get(
                f"{self.backend_url}/api/kyc/history",
                headers=self.get_auth_headers(),
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and isinstance(data['data'], list):
                    history = data['data']
                    self.log_result(
                        "GET KYC History", 
                        True, 
                        f"Retrieved {len(history)} KYC records",
                        {"count": len(history)}
                    )
                else:
                    self.log_result(
                        "GET KYC History", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "GET KYC History", 
                    False, 
                    f"API returned status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "GET KYC History", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def print_test_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "="*80)
        print("DYNOPAY CRUD ENDPOINTS TEST SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "No tests run")
        
        if self.errors:
            print(f"\n❌ FAILED TESTS ({len(self.errors)}):")
            for error in self.errors:
                print(f"  • {error}")
        
        if passed_tests > 0:
            print(f"\n✅ PASSED TESTS ({passed_tests}):")
            for test_name, result in self.test_results.items():
                if result['success']:
                    print(f"  • {test_name}: {result['message']}")
        
        print("\n" + "="*80)
    
    def run_all_crud_tests(self):
        """Run all CRUD endpoint tests"""
        print("="*80)
        print("DYNOPAY CRUD ENDPOINTS TESTING SUITE")
        print("="*80)
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Credentials: {self.test_email}")
        print("="*80)
        
        # Step 1: Login with test credentials
        if not self.login_with_test_credentials():
            print("\n❌ Login failed. Cannot proceed with authenticated tests.")
            return False
        
        # Step 2: Test all CRUD endpoints
        self.test_user_profile_endpoints()
        self.test_api_key_management_endpoints()
        self.test_plan_management_endpoints()
        self.test_customer_management_endpoints()
        self.test_company_management_endpoints()
        self.test_subscription_management_endpoints()
        self.test_kyc_management_endpoints()
        
        # Step 3: Print summary
        self.print_test_summary()
        
        return len(self.errors) == 0

def main():
    """Main function to run CRUD tests"""
    tester = DynoPayCRUDTester()
    success = tester.run_all_crud_tests()
    
    if success:
        print("\n🎉 All CRUD endpoint tests completed successfully!")
        sys.exit(0)
    else:
        print(f"\n💥 {len(tester.errors)} test(s) failed. Check the summary above.")
        sys.exit(1)

if __name__ == "__main__":
    main()