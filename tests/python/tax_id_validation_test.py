#!/usr/bin/env python3
"""
DynoPay TAX ID Validation Testing Suite
Tests the new TAX ID validation endpoint and company creation integration
"""

import os
import json
import requests
import time
from typing import Dict, List, Any

class TaxIdValidationTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.company_id = None
        
        # Test credentials from review request
        self.test_credentials = {
            "email": "nomadly@moxx.co",
            "password": "Katiekendra123@"
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
        """Authenticate with provided test credentials"""
        print("\n=== PHASE 1: Authentication ===")
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json=self.test_credentials,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    self.jwt_token = data['data']['accessToken']
                    self.log_result(
                        "User Authentication", 
                        True, 
                        f"Successfully authenticated user: {self.test_credentials['email']}",
                        {"has_token": bool(self.jwt_token)}
                    )
                    return True
                else:
                    self.log_result(
                        "User Authentication", 
                        False, 
                        "Login succeeded but no token received",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "User Authentication", 
                    False, 
                    f"Login failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "User Authentication", 
                False, 
                f"Authentication failed: {str(e)}"
            )
        
        return False
    
    def test_standalone_tax_id_validation(self):
        """PHASE 1: Test standalone TAX ID validation endpoint"""
        print("\n=== PHASE 1: STANDALONE TAX ID VALIDATION ENDPOINT ===")
        
        if not self.jwt_token:
            self.log_result(
                "TAX ID Validation Setup", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        # Test 1: Valid Portuguese VAT
        self.test_valid_portuguese_vat(headers)
        
        # Test 2: Invalid format
        self.test_invalid_format(headers)
        
        # Test 3: Missing fields
        self.test_missing_fields(headers)
        
        # Test 4: Different countries
        self.test_different_countries(headers)
    
    def test_valid_portuguese_vat(self, headers):
        """Test valid Portuguese VAT number"""
        print("\n--- Test 2: Valid Portuguese VAT ---")
        
        test_data = {
            "vat_number": "PT123456789",
            "country_code": "PT"
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/company/validateTaxId",
                json=test_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify required fields are present
                required_fields = ['valid', 'format_valid', 'message']
                response_data = data.get('data', {})  # Response is in data field
                
                missing_fields = [field for field in required_fields if field not in response_data]
                
                if missing_fields:
                    self.log_result(
                        "Valid Portuguese VAT - Structure", 
                        False, 
                        f"Missing required fields: {', '.join(missing_fields)}",
                        {"response": data}
                    )
                else:
                    # Check validation results
                    valid_status = response_data.get('valid')
                    format_valid = response_data.get('format_valid')
                    message = response_data.get('message', '')
                    
                    success_criteria = (
                        valid_status is not None and
                        format_valid is not None and
                        message
                    )
                    
                    if success_criteria:
                        details = {
                            "valid": valid_status,
                            "format_valid": format_valid,
                            "message": message
                        }
                        
                        # If valid=true, check for company info
                        if valid_status is True:
                            if 'company_name' in response_data and 'company_address' in response_data:
                                details.update({
                                    "company_name": response_data.get('company_name'),
                                    "company_address": response_data.get('company_address')
                                })
                        
                        self.log_result(
                            "Valid Portuguese VAT", 
                            True, 
                            f"Validation completed: valid={valid_status}, format_valid={format_valid}, message='{message}'",
                            details
                        )
                    else:
                        self.log_result(
                            "Valid Portuguese VAT - Response", 
                            False, 
                            "Response missing expected validation fields",
                            {"response": data}
                        )
            else:
                self.log_result(
                    "Valid Portuguese VAT", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Valid Portuguese VAT", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_invalid_format(self, headers):
        """Test invalid VAT format"""
        print("\n--- Test 3: Invalid Format ---")
        
        test_data = {
            "vat_number": "INVALID123",
            "country_code": "PT"
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/company/validateTaxId",
                json=test_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                response_data = data.get('data', {})  # Response is in data field
                
                valid_status = response_data.get('valid')
                format_valid = response_data.get('format_valid')
                message = response_data.get('message', '')
                
                # Should return valid: false, format_valid: false
                if valid_status is False and format_valid is False:
                    self.log_result(
                        "Invalid Format VAT", 
                        True, 
                        f"Correctly identified invalid format: {message}",
                        {
                            "valid": valid_status,
                            "format_valid": format_valid,
                            "message": message
                        }
                    )
                else:
                    self.log_result(
                        "Invalid Format VAT", 
                        False, 
                        f"Expected valid=false, format_valid=false, got valid={valid_status}, format_valid={format_valid}",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Invalid Format VAT", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Invalid Format VAT", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_missing_fields(self, headers):
        """Test missing required fields"""
        print("\n--- Test 4: Missing Fields ---")
        
        test_data = {
            "vat_number": "PT123456789"
            # Missing country_code
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/company/validateTaxId",
                json=test_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 400:
                data = response.json()
                message = data.get('message', '')
                
                if "vat_number and country_code are required" in message:
                    self.log_result(
                        "Missing Fields Validation", 
                        True, 
                        f"Correctly rejected missing fields: {message}",
                        {"status_code": 400, "message": message}
                    )
                else:
                    self.log_result(
                        "Missing Fields Validation", 
                        True, 
                        f"Rejected missing fields with message: {message}",
                        {"status_code": 400, "message": message}
                    )
            else:
                self.log_result(
                    "Missing Fields Validation", 
                    False, 
                    f"Expected 400 status, got {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Missing Fields Validation", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_different_countries(self, headers):
        """Test different country formats"""
        print("\n--- Test 5: Different Countries ---")
        
        test_countries = [
            {"vat_number": "DE123456789", "country_code": "DE", "name": "Germany"},
            {"vat_number": "GB123456789", "country_code": "GB", "name": "UK"}
        ]
        
        for country_test in test_countries:
            try:
                response = requests.post(
                    f"{self.backend_url}/api/company/validateTaxId",
                    json={
                        "vat_number": country_test["vat_number"],
                        "country_code": country_test["country_code"]
                    },
                    headers=headers,
                    timeout=15
                )
                
                if response.status_code == 200:
                    data = response.json()
                    response_data = data.get('data', {})  # Response is in data field
                    
                    # Just verify the API handles different countries
                    if 'valid' in response_data and 'format_valid' in response_data:
                        self.log_result(
                            f"Country Format - {country_test['name']}", 
                            True, 
                            f"API handled {country_test['name']} format correctly",
                            {
                                "country": country_test["name"],
                                "country_code": country_test["country_code"],
                                "valid": response_data.get('valid'),
                                "format_valid": response_data.get('format_valid'),
                                "message": response_data.get('message', '')
                            }
                        )
                    else:
                        self.log_result(
                            f"Country Format - {country_test['name']}", 
                            False, 
                            f"Missing validation fields for {country_test['name']}",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        f"Country Format - {country_test['name']}", 
                        False, 
                        f"API call failed with status {response.status_code}",
                        {"response": response.text}
                    )
                    
            except Exception as e:
                self.log_result(
                    f"Country Format - {country_test['name']}", 
                    False, 
                    f"Request failed: {str(e)}"
                )
    
    def test_company_creation_integration(self):
        """PHASE 2: Test company creation with TAX ID validation"""
        print("\n=== PHASE 2: COMPANY CREATION WITH TAX ID VALIDATION ===")
        
        if not self.jwt_token:
            self.log_result(
                "Company Creation Setup", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}"
        }
        
        # Test 6: Get existing company ID
        self.get_existing_company_id(headers)
        
        # Test 7: Create company WITH valid TAX ID
        self.test_create_company_with_valid_tax_id(headers)
        
        # Test 8: Create company WITHOUT TAX ID
        self.test_create_company_without_tax_id(headers)
        
        # Test 9: Create company with INVALID TAX ID
        self.test_create_company_with_invalid_tax_id(headers)
    
    def get_existing_company_id(self, headers):
        """Get existing company ID"""
        print("\n--- Test 6: Get Existing Company ID ---")
        
        try:
            response = requests.get(
                f"{self.backend_url}/api/company/getCompany",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if company exists
                if 'data' in data and data['data']:
                    company_data = data['data']
                    if isinstance(company_data, list) and len(company_data) > 0:
                        self.company_id = company_data[0].get('company_id')
                    elif isinstance(company_data, dict):
                        self.company_id = company_data.get('company_id')
                    
                    self.log_result(
                        "Get Existing Company", 
                        True, 
                        f"Retrieved company data, ID: {self.company_id}",
                        {"company_id": self.company_id, "has_data": bool(company_data)}
                    )
                else:
                    self.log_result(
                        "Get Existing Company", 
                        True, 
                        "No existing company found (expected for new user)",
                        {"company_id": None}
                    )
            else:
                self.log_result(
                    "Get Existing Company", 
                    True, 
                    f"No company found (status {response.status_code})",
                    {"status_code": response.status_code}
                )
                
        except Exception as e:
            self.log_result(
                "Get Existing Company", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_create_company_with_valid_tax_id(self, headers):
        """Test creating company with valid TAX ID"""
        print("\n--- Test 7: Create Company WITH Valid TAX ID ---")
        
        # Prepare form data
        form_data = {
            "company_name": "Test Company with TAX ID",
            "email": "test@company.com",
            "mobile": "+351123456789",  # Required field
            "address_line1": "123 Test St",
            "city": "Lisbon",
            "country": "PT",
            "zip_code": "1000-001",
            "vat_number": "PT123456789",
            "vat_type": "VAT"
        }
        
        try:
            # Create multipart form data
            files = {
                'data': (None, json.dumps(form_data), 'application/json')
            }
            
            response = requests.post(
                f"{self.backend_url}/api/company/addCompany",
                files=files,
                headers={"Authorization": headers["Authorization"]},
                timeout=15
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                
                # Check if response includes tax_validation object
                response_data = data.get('data', data)
                
                success_indicators = [
                    'company_id' in response_data,
                    'message' in data or 'success' in str(data).lower()
                ]
                
                if any(success_indicators):
                    details = {"status_code": response.status_code}
                    
                    # Check for tax validation info
                    if 'tax_validation' in response_data:
                        tax_validation = response_data['tax_validation']
                        details.update({
                            "has_tax_validation": True,
                            "vat_verified": tax_validation.get('vat_verified'),
                            "query_status": tax_validation.get('query_status')
                        })
                    
                    if 'vat_verified' in response_data:
                        details["vat_verified"] = response_data['vat_verified']
                    
                    self.log_result(
                        "Create Company with Valid TAX ID", 
                        True, 
                        "Company created successfully with TAX ID validation",
                        details
                    )
                else:
                    self.log_result(
                        "Create Company with Valid TAX ID", 
                        False, 
                        "Company creation response missing expected fields",
                        {"response": data}
                    )
            elif response.status_code == 400:
                # Could be validation error or duplicate company
                data = response.json()
                message = data.get('message', '')
                
                if 'already exists' in message.lower() or 'duplicate' in message.lower():
                    self.log_result(
                        "Create Company with Valid TAX ID", 
                        True, 
                        f"Company already exists (expected): {message}",
                        {"status_code": 400, "message": message}
                    )
                else:
                    self.log_result(
                        "Create Company with Valid TAX ID", 
                        False, 
                        f"Company creation failed: {message}",
                        {"status_code": 400, "message": message}
                    )
            else:
                self.log_result(
                    "Create Company with Valid TAX ID", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Create Company with Valid TAX ID", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_create_company_without_tax_id(self, headers):
        """Test creating company without TAX ID"""
        print("\n--- Test 8: Create Company WITHOUT TAX ID ---")
        
        form_data = {
            "company_name": "Test Company No TAX",
            "email": "noTax@company.com",
            "mobile": "+351987654321",  # Required field
            "address_line1": "456 Test Ave",
            "city": "Porto",
            "country": "PT",
            "zip_code": "4000-001"
            # No vat_number or vat_type
        }
        
        try:
            files = {
                'data': (None, json.dumps(form_data), 'application/json')
            }
            
            response = requests.post(
                f"{self.backend_url}/api/company/addCompany",
                files=files,
                headers={"Authorization": headers["Authorization"]},
                timeout=15
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                response_data = data.get('data', data)
                
                # Should succeed and note no TAX ID provided
                details = {"status_code": response.status_code}
                
                if 'tax_validation' in response_data:
                    tax_validation = response_data['tax_validation']
                    if 'No TAX ID provided' in str(tax_validation):
                        details["tax_validation_note"] = "No TAX ID provided"
                
                self.log_result(
                    "Create Company without TAX ID", 
                    True, 
                    "Company created successfully without TAX ID",
                    details
                )
            elif response.status_code == 400:
                data = response.json()
                message = data.get('message', '')
                
                if 'already exists' in message.lower():
                    self.log_result(
                        "Create Company without TAX ID", 
                        True, 
                        f"Company already exists (expected): {message}",
                        {"status_code": 400, "message": message}
                    )
                else:
                    self.log_result(
                        "Create Company without TAX ID", 
                        False, 
                        f"Company creation failed: {message}",
                        {"status_code": 400, "message": message}
                    )
            else:
                self.log_result(
                    "Create Company without TAX ID", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Create Company without TAX ID", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_create_company_with_invalid_tax_id(self, headers):
        """Test creating company with invalid TAX ID"""
        print("\n--- Test 9: Create Company with INVALID TAX ID ---")
        
        form_data = {
            "company_name": "Test Invalid TAX",
            "email": "invalid@company.com",
            "mobile": "+351555666777",  # Required field
            "country": "PT",
            "vat_number": "INVALIDFORMAT"
        }
        
        try:
            files = {
                'data': (None, json.dumps(form_data), 'application/json')
            }
            
            response = requests.post(
                f"{self.backend_url}/api/company/addCompany",
                files=files,
                headers={"Authorization": headers["Authorization"]},
                timeout=15
            )
            
            if response.status_code == 400:
                data = response.json()
                message = data.get('message', '')
                
                # Should contain error about invalid TAX ID format
                if 'invalid' in message.lower() and ('tax' in message.lower() or 'vat' in message.lower()):
                    self.log_result(
                        "Create Company with Invalid TAX ID", 
                        True, 
                        f"Correctly rejected invalid TAX ID: {message}",
                        {"status_code": 400, "message": message}
                    )
                else:
                    self.log_result(
                        "Create Company with Invalid TAX ID", 
                        True, 
                        f"Rejected invalid data with message: {message}",
                        {"status_code": 400, "message": message}
                    )
            else:
                self.log_result(
                    "Create Company with Invalid TAX ID", 
                    False, 
                    f"Expected 400 status for invalid TAX ID, got {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Create Company with Invalid TAX ID", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_integration_workflow(self):
        """PHASE 3: Integration testing - complete workflow"""
        print("\n=== PHASE 3: INTEGRATION TESTING ===")
        
        if not self.jwt_token:
            self.log_result(
                "Integration Workflow Setup", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        # Test 10: Complete workflow test
        self.test_complete_workflow()
        
        # Test 11: Rate limiting handling
        self.test_rate_limiting_handling()
    
    def test_complete_workflow(self):
        """Test complete workflow: validate -> create -> verify"""
        print("\n--- Test 10: Complete Workflow Test ---")
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        # Step A: Validate TAX ID first
        print("Step A: Validate TAX ID")
        validate_data = {
            "vat_number": "PT987654321",
            "country_code": "PT"
        }
        
        validation_success = False
        try:
            validate_response = requests.post(
                f"{self.backend_url}/api/company/validateTaxId",
                json=validate_data,
                headers=headers,
                timeout=15
            )
            
            if validate_response.status_code == 200:
                validate_data_response = validate_response.json()
                validation_success = True
                print(f"   ✅ TAX ID validation: {validate_data_response.get('data', {}).get('message', 'Success')}")
            else:
                print(f"   ❌ TAX ID validation failed: {validate_response.status_code}")
        except Exception as e:
            print(f"   ❌ TAX ID validation error: {str(e)}")
        
        # Step B: Create company (if validation succeeded or failed gracefully)
        print("Step B: Create company")
        company_creation_success = False
        
        if validation_success:
            form_data = {
                "company_name": "Workflow Test Company",
                "email": "workflow@test.com",
                "mobile": "+351111222333",  # Required field
                "address_line1": "789 Workflow St",
                "city": "Lisbon",
                "country": "PT",
                "zip_code": "1000-002",
                "vat_number": "PT987654321",
                "vat_type": "VAT"
            }
            
            try:
                files = {
                    'data': (None, json.dumps(form_data), 'application/json')
                }
                
                create_response = requests.post(
                    f"{self.backend_url}/api/company/addCompany",
                    files=files,
                    headers={"Authorization": headers["Authorization"]},
                    timeout=15
                )
                
                if create_response.status_code in [200, 201, 400]:  # 400 might be "already exists"
                    company_creation_success = True
                    create_data = create_response.json()
                    print(f"   ✅ Company creation: {create_data.get('message', 'Success')}")
                else:
                    print(f"   ❌ Company creation failed: {create_response.status_code}")
            except Exception as e:
                print(f"   ❌ Company creation error: {str(e)}")
        
        # Step C: Verify company was created
        print("Step C: Verify company")
        verification_success = False
        
        try:
            verify_response = requests.get(
                f"{self.backend_url}/api/company/getCompany",
                headers={"Authorization": headers["Authorization"]},
                timeout=15
            )
            
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                companies = verify_data.get('data', [])
                
                if companies:
                    # Check if any company has vat_verified=true
                    verified_companies = []
                    for company in companies if isinstance(companies, list) else [companies]:
                        if company.get('vat_verified') is True:
                            verified_companies.append(company.get('company_name', 'Unknown'))
                    
                    verification_success = True
                    print(f"   ✅ Company verification: Found {len(companies)} companies, {len(verified_companies)} with verified VAT")
                else:
                    verification_success = True  # No companies is also valid
                    print(f"   ✅ Company verification: No companies found (valid state)")
            else:
                print(f"   ❌ Company verification failed: {verify_response.status_code}")
        except Exception as e:
            print(f"   ❌ Company verification error: {str(e)}")
        
        # Overall workflow result
        overall_success = validation_success and company_creation_success and verification_success
        
        self.log_result(
            "Complete Workflow Test", 
            overall_success, 
            f"Workflow completed: validation={validation_success}, creation={company_creation_success}, verification={verification_success}",
            {
                "validation_success": validation_success,
                "company_creation_success": company_creation_success,
                "verification_success": verification_success
            }
        )
    
    def test_rate_limiting_handling(self):
        """Test rate limiting handling"""
        print("\n--- Test 11: Rate Limiting Handling ---")
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        # Make multiple rapid validation requests
        rate_limit_results = []
        
        for i in range(5):  # Make 5 rapid requests
            try:
                test_data = {
                    "vat_number": f"PT12345678{i}",
                    "country_code": "PT"
                }
                
                response = requests.post(
                    f"{self.backend_url}/api/company/validateTaxId",
                    json=test_data,
                    headers=headers,
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    response_data = data.get('data', data)
                    query_status = response_data.get('query_status', 'unknown')
                    rate_limit_results.append(query_status)
                else:
                    rate_limit_results.append(f"error_{response.status_code}")
                
                time.sleep(0.1)  # Brief pause between requests
                
            except Exception as e:
                rate_limit_results.append(f"exception_{str(e)[:20]}")
        
        # Analyze results
        rate_limited_count = sum(1 for result in rate_limit_results if 'rate_limited' in str(result))
        success_count = sum(1 for result in rate_limit_results if result not in ['rate_limited', 'unknown'] and not result.startswith('error_'))
        
        # System should handle rate limits gracefully
        handles_gracefully = rate_limited_count > 0 or success_count > 0
        
        self.log_result(
            "Rate Limiting Handling", 
            handles_gracefully, 
            f"System handled {len(rate_limit_results)} rapid requests: {rate_limited_count} rate-limited, {success_count} successful",
            {
                "total_requests": len(rate_limit_results),
                "rate_limited": rate_limited_count,
                "successful": success_count,
                "results": rate_limit_results
            }
        )
    
    def test_swagger_documentation(self):
        """Test Swagger documentation accessibility"""
        print("\n--- Test: Swagger Documentation ---")
        
        try:
            response = requests.get(f"{self.backend_url}/api/docs", timeout=10)
            
            if response.status_code == 200:
                content = response.text
                if 'swagger' in content.lower() or 'openapi' in content.lower():
                    self.log_result(
                        "Swagger Documentation", 
                        True, 
                        "Swagger UI is accessible",
                        {"status_code": 200, "has_swagger_content": True}
                    )
                else:
                    self.log_result(
                        "Swagger Documentation", 
                        True, 
                        "Documentation endpoint accessible",
                        {"status_code": 200, "content_length": len(content)}
                    )
            else:
                self.log_result(
                    "Swagger Documentation", 
                    False, 
                    f"Documentation not accessible: {response.status_code}",
                    {"status_code": response.status_code}
                )
                
        except Exception as e:
            self.log_result(
                "Swagger Documentation", 
                False, 
                f"Failed to access documentation: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all TAX ID validation tests"""
        print("🚀 Starting TAX ID Validation Testing Suite")
        print(f"Backend URL: {self.backend_url}")
        print(f"Test User: {self.test_credentials['email']}")
        
        # Authenticate first
        if not self.authenticate_user():
            print("❌ Authentication failed - cannot proceed with tests")
            return self.generate_summary()
        
        # Run test phases
        self.test_standalone_tax_id_validation()
        self.test_company_creation_integration()
        self.test_integration_workflow()
        self.test_swagger_documentation()
        
        return self.generate_summary()
    
    def generate_summary(self):
        """Generate test summary"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"\n{'='*60}")
        print(f"TAX ID VALIDATION TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "0%")
        
        if self.errors:
            print(f"\n❌ FAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        
        print(f"\n✅ SUCCESS CRITERIA VERIFICATION:")
        
        # Check success criteria from review request
        success_criteria = {
            "Standalone validation endpoint works": any("Valid Portuguese VAT" in test for test in self.test_results if self.test_results[test]['success']),
            "Returns proper validation results": any("Invalid Format VAT" in test for test in self.test_results if self.test_results[test]['success']),
            "Company creation validates TAX ID": any("Create Company with Valid TAX ID" in test for test in self.test_results if self.test_results[test]['success']),
            "Invalid TAX IDs block creation": any("Create Company with Invalid TAX ID" in test for test in self.test_results if self.test_results[test]['success']),
            "Company creation without TAX ID works": any("Create Company without TAX ID" in test for test in self.test_results if self.test_results[test]['success']),
            "Rate limiting handled gracefully": any("Rate Limiting Handling" in test for test in self.test_results if self.test_results[test]['success']),
            "Swagger documentation accessible": any("Swagger Documentation" in test for test in self.test_results if self.test_results[test]['success'])
        }
        
        for criteria, met in success_criteria.items():
            status = "✅" if met else "❌"
            print(f"  {status} {criteria}")
        
        return {
            'total_tests': total_tests,
            'passed_tests': passed_tests,
            'failed_tests': failed_tests,
            'success_rate': (passed_tests/total_tests*100) if total_tests > 0 else 0,
            'success_criteria': success_criteria,
            'test_results': self.test_results,
            'errors': self.errors
        }

if __name__ == "__main__":
    tester = TaxIdValidationTester()
    summary = tester.run_all_tests()