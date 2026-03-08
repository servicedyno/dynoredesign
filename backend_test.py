#!/usr/bin/env python3
"""
DynoPay Backend Testing Suite - Review Request Focus

Testing specific endpoints mentioned in review request:

1. **Login API** - POST /api/user/login with body {"email":"nomadly@moxx.co","password":"Katiekendra123@"}
   - Verify response has `data.userData.referral_code` that is short (≤12 chars, format DYNO-XXXXXX)
   - Verify response has `data.userData.last_company_id` field (should be 3)
   - Save the `data.accessToken` for subsequent authenticated requests

2. **Last Company Endpoint** - PUT /api/user/last-company with body {"company_id":3}
   - Requires Bearer token from login
   - Should return success with `data.last_company_id`
   - Test with invalid company_id (999) → should return 404
   - Test without company_id → should return 400

3. **Company Fetch** - GET /api/company/getCompany
   - Requires Bearer token
   - Should return list of companies
"""

import requests
import json
import sys
import os
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BACKEND_URL = "https://6f7f3775-d165-4bd6-8635-d660e9c3ab44.preview.emergentagent.com"

class DynoPayBackendTester:
    def __init__(self):
        self.backend_url = BACKEND_URL
        self.session = requests.Session()
        self.test_results = []
        self.access_token = None
        
        # Test credentials from review request
        self.test_credentials = {
            "email": "nomadly@moxx.co",
            "password": "Katiekendra123@"
        }
        
    def log_result(self, test_name: str, status: str, details: str):
        """Log test results"""
        result = {
            'test': test_name,
            'status': status,  # 'PASS' or 'FAIL'
            'details': details
        }
        self.test_results.append(result)
        status_symbol = "✅" if status == "PASS" else "❌"
        print(f"{status_symbol} {test_name}: {details}")
    
    def test_login_api(self):
        """Test POST /api/user/login with specified credentials"""
        try:
            print("\n🔐 Testing Login API...")
            
            # First get CSRF token
            csrf_response = self.session.get(f"{self.backend_url}/api/csrf-token", timeout=10)
            csrf_token = None
            
            if csrf_response.status_code == 200:
                csrf_data = csrf_response.json()
                csrf_token = csrf_data.get('csrf_token')
                print(f"📝 CSRF token obtained: {csrf_token[:20]}..." if csrf_token else "❌ No CSRF token received")
            
            # Prepare headers
            headers = {
                'Content-Type': 'application/json',
            }
            if csrf_token:
                headers['x-csrf-token'] = csrf_token
                
            # Login request
            response = self.session.post(
                f"{self.backend_url}/api/user/login",
                json=self.test_credentials,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    # Check response structure - DynoPay uses message + data format
                    if data.get('message') != "Login Successful!":
                        self.log_result(
                            "Login API - Response Structure", 
                            "FAIL", 
                            f"Unexpected message: {data.get('message', 'No message')}"
                        )
                        return
                    
                    response_data = data.get('data', {})
                    user_data = response_data.get('userData', {})
                    access_token = response_data.get('accessToken')
                    
                    # Store token for later tests
                    if access_token:
                        self.access_token = access_token
                        print(f"🎫 Access token stored: {access_token[:20]}...")
                    
                    # Check referral_code format
                    referral_code = user_data.get('referral_code')
                    if referral_code:
                        if len(referral_code) <= 12 and referral_code.startswith('DYNO-'):
                            self.log_result(
                                "Login API - Referral Code", 
                                "PASS", 
                                f"Referral code format correct: {referral_code} (length: {len(referral_code)})"
                            )
                        else:
                            self.log_result(
                                "Login API - Referral Code", 
                                "FAIL", 
                                f"Referral code format invalid: {referral_code} (length: {len(referral_code)})"
                            )
                    else:
                        self.log_result(
                            "Login API - Referral Code", 
                            "FAIL", 
                            "No referral_code field in response"
                        )
                    
                    # Check last_company_id field
                    last_company_id = user_data.get('last_company_id')
                    if last_company_id is not None:
                        self.log_result(
                            "Login API - Last Company ID", 
                            "PASS", 
                            f"last_company_id field present: {last_company_id}"
                        )
                    else:
                        self.log_result(
                            "Login API - Last Company ID", 
                            "FAIL", 
                            "No last_company_id field in userData"
                        )
                    
                    # Overall login success
                    if access_token:
                        self.log_result(
                            "Login API - Overall", 
                            "PASS", 
                            "Login successful with access token"
                        )
                    else:
                        self.log_result(
                            "Login API - Overall", 
                            "FAIL", 
                            "Login response missing access token"
                        )
                        
                except ValueError as e:
                    self.log_result(
                        "Login API", 
                        "FAIL", 
                        f"Invalid JSON response: {str(e)}"
                    )
            elif response.status_code == 401:
                self.log_result(
                    "Login API", 
                    "FAIL", 
                    "Invalid credentials - check if test user exists in database"
                )
            else:
                self.log_result(
                    "Login API", 
                    "FAIL", 
                    f"Unexpected status {response.status_code}: {response.text[:300]}"
                )
                
        except Exception as e:
            self.log_result(
                "Login API", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_last_company_endpoint(self):
        """Test PUT /api/user/last-company endpoint"""
        if not self.access_token:
            self.log_result(
                "Last Company Endpoint", 
                "FAIL", 
                "No access token available (login failed)"
            )
            return
            
        try:
            print("\n🏢 Testing Last Company Endpoint...")
            
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.access_token}'
            }
            
            # Test 1: Valid company_id (3)
            response = self.session.put(
                f"{self.backend_url}/api/user/last-company",
                json={"company_id": 3},
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if data.get('message') and 'updated' in data.get('message', '').lower() and data.get('data', {}).get('last_company_id') == 3:
                        self.log_result(
                            "Last Company - Valid ID", 
                            "PASS", 
                            f"Successfully updated to company_id: 3"
                        )
                    else:
                        self.log_result(
                            "Last Company - Valid ID", 
                            "FAIL", 
                            f"Unexpected response structure: {data}"
                        )
                except ValueError:
                    self.log_result(
                        "Last Company - Valid ID", 
                        "FAIL", 
                        f"Invalid JSON: {response.text[:200]}"
                    )
            elif response.status_code == 404:
                self.log_result(
                    "Last Company - Valid ID", 
                    "FAIL", 
                    "Company ID 3 not found for user (404)"
                )
            else:
                self.log_result(
                    "Last Company - Valid ID", 
                    "FAIL", 
                    f"Status {response.status_code}: {response.text[:200]}"
                )
            
            # Test 2: Invalid company_id (999) - should return 404
            response = self.session.put(
                f"{self.backend_url}/api/user/last-company",
                json={"company_id": 999},
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 404:
                self.log_result(
                    "Last Company - Invalid ID", 
                    "PASS", 
                    "Correctly returned 404 for invalid company_id (999)"
                )
            else:
                self.log_result(
                    "Last Company - Invalid ID", 
                    "FAIL", 
                    f"Expected 404, got {response.status_code}: {response.text[:200]}"
                )
            
            # Test 3: Missing company_id - should return 400
            response = self.session.put(
                f"{self.backend_url}/api/user/last-company",
                json={},
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 400:
                self.log_result(
                    "Last Company - Missing ID", 
                    "PASS", 
                    "Correctly returned 400 for missing company_id"
                )
            else:
                self.log_result(
                    "Last Company - Missing ID", 
                    "FAIL", 
                    f"Expected 400, got {response.status_code}: {response.text[:200]}"
                )
                
        except Exception as e:
            self.log_result(
                "Last Company Endpoint", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_company_fetch_endpoint(self):
        """Test GET /api/company/getCompany endpoint"""
        if not self.access_token:
            self.log_result(
                "Company Fetch Endpoint", 
                "FAIL", 
                "No access token available (login failed)"
            )
            return
            
        try:
            print("\n🏬 Testing Company Fetch Endpoint...")
            
            headers = {
                'Authorization': f'Bearer {self.access_token}'
            }
            
            response = self.session.get(
                f"{self.backend_url}/api/company/getCompany",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if data.get('message'):
                        companies = data.get('data', [])
                        if isinstance(companies, list):
                            self.log_result(
                                "Company Fetch", 
                                "PASS", 
                                f"Successfully retrieved {len(companies)} companies"
                            )
                        else:
                            self.log_result(
                                "Company Fetch", 
                                "FAIL", 
                                f"Data is not a list: {type(companies)}"
                            )
                    else:
                        self.log_result(
                            "Company Fetch", 
                            "FAIL", 
                            f"No message field: {data}"
                        )
                except ValueError:
                    self.log_result(
                        "Company Fetch", 
                        "FAIL", 
                        f"Invalid JSON: {response.text[:200]}"
                    )
            elif response.status_code == 401:
                self.log_result(
                    "Company Fetch", 
                    "FAIL", 
                    "Authentication failed (401) - token may be invalid"
                )
            else:
                self.log_result(
                    "Company Fetch", 
                    "FAIL", 
                    f"Status {response.status_code}: {response.text[:200]}"
                )
                
        except Exception as e:
            self.log_result(
                "Company Fetch Endpoint", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all backend tests for DynoPay review request"""
        print(f"\n🧪 Testing DynoPay Backend API at {self.backend_url}")
        print("="*80)
        print("Testing specific endpoints from review request:")
        print("1. Login API with credentials nomadly@moxx.co/Katiekendra123@")
        print("2. Last Company Endpoint - PUT /api/user/last-company")
        print("3. Company Fetch - GET /api/company/getCompany")
        print("="*80)
        
        # Test in sequence (login first, then authenticated endpoints)
        self.test_login_api()
        self.test_last_company_endpoint()
        self.test_company_fetch_endpoint()
        
        # Summary
        print("\n📊 Test Summary:")
        print("="*80)
        
        passed = sum(1 for result in self.test_results if result['status'] == 'PASS')
        failed = sum(1 for result in self.test_results if result['status'] == 'FAIL')
        
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        if passed + failed > 0:
            print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        if failed > 0:
            print(f"\n🔍 Failed Tests:")
            for result in self.test_results:
                if result['status'] == 'FAIL':
                    print(f"  • {result['test']}: {result['details']}")
        
        return passed, failed

if __name__ == "__main__":
    tester = DynoPayBackendTester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)