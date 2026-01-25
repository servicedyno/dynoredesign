#!/usr/bin/env python3
"""
DynoPay TAX ID PT518713130 Verification Test
Specific test for the updated TAX_DATA_API_KEY and Portuguese TAX ID PT518713130
"""

import os
import json
import requests
import time
from typing import Dict, Any

class TaxIdPT518713130Tester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        
        # Test credentials from review request
        self.test_credentials = {
            "email": "nomadly@moxx.co",
            "password": "Katiekendra123@"
        }
        
        # Target TAX ID for testing
        self.target_tax_id = "PT518713130"
        self.target_country = "PT"
        
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
        """Step 1: Login to get JWT token"""
        print("\n=== STEP 1: User Authentication ===")
        
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
                        "User Login", 
                        True, 
                        f"Successfully authenticated user {self.test_credentials['email']}",
                        {"email": self.test_credentials['email'], "has_token": bool(self.jwt_token)}
                    )
                    return True
                else:
                    self.log_result(
                        "User Login", 
                        False, 
                        "Login succeeded but no JWT token received",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "User Login", 
                    False, 
                    f"Login failed with status {response.status_code}",
                    {"response": response.text, "credentials": self.test_credentials['email']}
                )
                
        except Exception as e:
            self.log_result(
                "User Login", 
                False, 
                f"Authentication request failed: {str(e)}"
            )
        
        return False
    
    def test_tax_id_validation_basic(self):
        """Step 2: Verify Portuguese TAX ID PT518713130 - Basic Format"""
        print(f"\n=== STEP 2: TAX ID Validation - {self.target_tax_id} ===")
        
        if not self.jwt_token:
            self.log_result(
                "TAX ID Validation", 
                False, 
                "No JWT token available for authentication"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "vat_number": self.target_tax_id,
                "country_code": self.target_country
            }
            
            response = requests.post(
                f"{self.backend_url}/api/company/validateTaxId",
                json=payload,
                headers=headers,
                timeout=20
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    validation_result = data['data']
                    
                    # Critical checks as specified in review request
                    required_fields = ['vat_number', 'country_code', 'valid', 'format_valid', 'message']
                    missing_fields = [field for field in required_fields if field not in validation_result]
                    
                    if missing_fields:
                        self.log_result(
                            "TAX ID Validation - Structure", 
                            False, 
                            f"Missing required fields: {', '.join(missing_fields)}",
                            {"response": data, "missing_fields": missing_fields}
                        )
                        return False
                    
                    # Check if API is NOT rate limited anymore (with new key)
                    message = validation_result.get('message', '')
                    if "rate limit" in message.lower():
                        self.log_result(
                            "TAX ID Validation - Rate Limit Check", 
                            False, 
                            "API is still rate limited - new TAX_DATA_API_KEY may not be working",
                            {"message": message}
                        )
                        return False
                    
                    # Extract validation results
                    is_valid = validation_result.get('valid')
                    format_valid = validation_result.get('format_valid')
                    company_name = validation_result.get('company_name')
                    company_address = validation_result.get('company_address')
                    message = validation_result.get('message')
                    
                    # Log detailed results
                    validation_details = {
                        "vat_number": validation_result.get('vat_number'),
                        "country_code": validation_result.get('country_code'),
                        "valid": is_valid,
                        "format_valid": format_valid,
                        "message": message
                    }
                    
                    if is_valid is True:
                        validation_details.update({
                            "company_name": company_name,
                            "company_address": company_address
                        })
                    
                    # Determine success based on completion (not validity)
                    if not ("rate limit" in message.lower() or "unavailable" in message.lower()):
                        self.log_result(
                            "TAX ID Validation - PT518713130", 
                            True, 
                            f"Validation completed successfully. Valid: {is_valid}, Format Valid: {format_valid}",
                            validation_details
                        )
                        
                        # Store results for company creation test
                        self.validation_result = validation_result
                        return True
                    else:
                        self.log_result(
                            "TAX ID Validation - PT518713130", 
                            False, 
                            f"Validation did not complete successfully. Message: {message}",
                            validation_details
                        )
                        return False
                        
                else:
                    self.log_result(
                        "TAX ID Validation - PT518713130", 
                        False, 
                        "Invalid response format - missing 'data' field",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "TAX ID Validation - PT518713130", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text, "payload": payload}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "TAX ID Validation - PT518713130", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_tax_id_variations(self):
        """Step 4: Test TAX ID with variations to ensure robustness"""
        print(f"\n=== STEP 4: TAX ID Variations Testing ===")
        
        if not self.jwt_token:
            self.log_result(
                "TAX ID Variations", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        # Test variations as specified in review request
        variations = [
            {"name": "Without PT prefix", "vat_number": "518713130", "country_code": "PT"},
            {"name": "With spaces", "vat_number": "PT 518 713 130", "country_code": "PT"},
            {"name": "Lowercase", "vat_number": "pt518713130", "country_code": "PT"}
        ]
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        for variation in variations:
            try:
                payload = {
                    "vat_number": variation["vat_number"],
                    "country_code": variation["country_code"]
                }
                
                response = requests.post(
                    f"{self.backend_url}/api/company/validateTaxId",
                    json=payload,
                    headers=headers,
                    timeout=20
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if 'data' in data:
                        validation_result = data['data']
                        query_status = validation_result.get('query_status')
                        is_valid = validation_result.get('valid')
                        format_valid = validation_result.get('format_valid')
                        
                        if query_status == "completed":
                            self.log_result(
                                f"TAX ID Variation - {variation['name']}", 
                                True, 
                                f"Variation handled correctly. Valid: {is_valid}, Format Valid: {format_valid}",
                                {
                                    "input": variation["vat_number"],
                                    "valid": is_valid,
                                    "format_valid": format_valid,
                                    "query_status": query_status
                                }
                            )
                        elif query_status == "rate_limited":
                            self.log_result(
                                f"TAX ID Variation - {variation['name']}", 
                                True, 
                                "Rate limited but handled gracefully",
                                {"query_status": query_status, "input": variation["vat_number"]}
                            )
                        else:
                            self.log_result(
                                f"TAX ID Variation - {variation['name']}", 
                                False, 
                                f"Unexpected query status: {query_status}",
                                {"query_status": query_status, "input": variation["vat_number"]}
                            )
                    else:
                        self.log_result(
                            f"TAX ID Variation - {variation['name']}", 
                            False, 
                            "Invalid response format",
                            {"response": data, "input": variation["vat_number"]}
                        )
                else:
                    self.log_result(
                        f"TAX ID Variation - {variation['name']}", 
                        False, 
                        f"API call failed with status {response.status_code}",
                        {"response": response.text, "input": variation["vat_number"]}
                    )
                    
            except Exception as e:
                self.log_result(
                    f"TAX ID Variation - {variation['name']}", 
                    False, 
                    f"Request failed: {str(e)}"
                )
    
    def test_company_creation_with_tax_id(self):
        """Step 5: Create test company with TAX ID PT518713130"""
        print(f"\n=== STEP 5: Company Creation with TAX ID ===")
        
        if not self.jwt_token:
            self.log_result(
                "Company Creation with TAX ID", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        if not hasattr(self, 'validation_result'):
            self.log_result(
                "Company Creation with TAX ID", 
                False, 
                "No validation result available from previous test"
            )
            return
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}"
            }
            
            # Prepare form data as specified in review request
            form_data = {
                "data": json.dumps({
                    "company_name": "Test Company PT518713130",
                    "email": "test518713130@company.com",
                    "mobile": "+351912345678",
                    "address_line1": "Test Address",
                    "city": "Lisbon",
                    "country": "PT",
                    "zip_code": "1000-001",
                    "vat_number": self.target_tax_id,
                    "vat_type": "VAT"
                })
            }
            
            response = requests.post(
                f"{self.backend_url}/api/company/addCompany",
                data=form_data,
                headers=headers,
                timeout=20
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    company_data = data['data']
                    
                    # Check if company was created successfully
                    company_id = company_data.get('company_id')
                    vat_verified = company_data.get('vat_verified')
                    tax_validation = company_data.get('tax_validation')
                    
                    if company_id:
                        # Determine expected vat_verified based on validation result
                        expected_vat_verified = self.validation_result.get('valid', False)
                        
                        if vat_verified == expected_vat_verified:
                            self.log_result(
                                "Company Creation - VAT Verification", 
                                True, 
                                f"Company created with correct vat_verified={vat_verified}",
                                {
                                    "company_id": company_id,
                                    "vat_verified": vat_verified,
                                    "tax_validation": tax_validation,
                                    "expected_vat_verified": expected_vat_verified
                                }
                            )
                        else:
                            self.log_result(
                                "Company Creation - VAT Verification", 
                                False, 
                                f"vat_verified mismatch: expected {expected_vat_verified}, got {vat_verified}",
                                {
                                    "company_id": company_id,
                                    "vat_verified": vat_verified,
                                    "expected_vat_verified": expected_vat_verified
                                }
                            )
                        
                        # Check tax_validation object
                        if tax_validation:
                            self.log_result(
                                "Company Creation - Tax Validation Object", 
                                True, 
                                "tax_validation object included in response",
                                {"tax_validation": tax_validation}
                            )
                        else:
                            self.log_result(
                                "Company Creation - Tax Validation Object", 
                                False, 
                                "tax_validation object missing from response",
                                {"company_data": company_data}
                            )
                            
                        # Store company ID for potential cleanup
                        self.created_company_id = company_id
                        
                    else:
                        self.log_result(
                            "Company Creation", 
                            False, 
                            "Company creation succeeded but no company_id returned",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "Company Creation", 
                        False, 
                        "Invalid response format - missing 'data' field",
                        {"response": data}
                    )
            elif response.status_code == 400:
                # This might be expected if TAX ID is invalid
                data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"error": response.text}
                
                validation_valid = self.validation_result.get('valid', False)
                if not validation_valid:
                    # If TAX ID was invalid, 400 error is expected
                    self.log_result(
                        "Company Creation - Invalid TAX ID Handling", 
                        True, 
                        "Company creation correctly blocked for invalid TAX ID",
                        {"status_code": 400, "response": data, "tax_id_was_valid": validation_valid}
                    )
                else:
                    # If TAX ID was valid, 400 error is unexpected
                    self.log_result(
                        "Company Creation - Unexpected Error", 
                        False, 
                        "Company creation failed despite valid TAX ID",
                        {"status_code": 400, "response": data, "tax_id_was_valid": validation_valid}
                    )
            else:
                self.log_result(
                    "Company Creation", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Company Creation", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def run_comprehensive_test(self):
        """Run the complete TAX ID PT518713130 verification test sequence"""
        print("=" * 80)
        print("DynoPay TAX ID PT518713130 Verification Test")
        print("Testing updated TAX_DATA_API_KEY and Portuguese TAX ID validation")
        print("=" * 80)
        
        # Step 1: Authentication
        if not self.authenticate_user():
            print("\n❌ CRITICAL: Authentication failed - cannot proceed with tests")
            return False
        
        # Step 2: Basic TAX ID validation
        if not self.test_tax_id_validation_basic():
            print("\n❌ CRITICAL: Basic TAX ID validation failed")
            return False
        
        # Step 3: TAX ID variations (robustness test)
        self.test_tax_id_variations()
        
        # Step 4: Company creation with TAX ID
        self.test_company_creation_with_tax_id()
        
        # Summary
        self.print_test_summary()
        
        return len(self.errors) == 0
    
    def print_test_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "=" * 80)
        print("TAX ID PT518713130 VERIFICATION TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
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
        
        # Key findings about PT518713130
        if hasattr(self, 'validation_result'):
            print(f"\n🔍 KEY FINDINGS FOR TAX ID {self.target_tax_id}:")
            vr = self.validation_result
            print(f"  • Valid: {vr.get('valid')}")
            print(f"  • Format Valid: {vr.get('format_valid')}")
            print(f"  • Query Status: {vr.get('query_status')}")
            if vr.get('company_name'):
                print(f"  • Company Name: {vr.get('company_name')}")
            if vr.get('company_address'):
                print(f"  • Company Address: {vr.get('company_address')}")
            print(f"  • Message: {vr.get('message')}")
        
        print("\n" + "=" * 80)

if __name__ == "__main__":
    tester = TaxIdPT518713130Tester()
    success = tester.run_comprehensive_test()
    exit(0 if success else 1)