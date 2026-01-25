#!/usr/bin/env python3
"""
DynoPay Failed Endpoints Debug - Detailed Investigation
Investigating 16 failed tests from comprehensive suite as requested
"""

import os
import json
import requests
import time
from typing import Dict, List, Any

class FailedEndpointsDebugger:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.company_id = None
        
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
    
    def authenticate_and_get_company_id(self):
        """Step 1: Login and get token + company_id"""
        print("=== STEP 1: LOGIN AND GET TOKEN ===")
        
        try:
            login_data = {
                "email": self.test_email,
                "password": self.test_password
            }
            
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json=login_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            print(f"Login Request: POST {self.backend_url}/api/user/login")
            print(f"Request Body: {json.dumps(login_data, indent=2)}")
            print(f"Response Status: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response Body: {json.dumps(data, indent=2)}")
                
                if 'data' in data and 'accessToken' in data['data']:
                    self.jwt_token = data['data']['accessToken']
                    # Try to get company_id from response
                    if 'company_id' in data['data']:
                        self.company_id = data['data']['company_id']
                    elif 'user' in data['data'] and 'company_id' in data['data']['user']:
                        self.company_id = data['data']['user']['company_id']
                    
                    self.log_result(
                        "Authentication", 
                        True, 
                        f"Successfully authenticated user {self.test_email}",
                        {
                            "has_token": bool(self.jwt_token),
                            "company_id": self.company_id,
                            "token_length": len(self.jwt_token) if self.jwt_token else 0
                        }
                    )
                    return True
                else:
                    self.log_result(
                        "Authentication", 
                        False, 
                        "Login succeeded but no access token in response",
                        {"response": data}
                    )
            else:
                response_text = response.text
                self.log_result(
                    "Authentication", 
                    False, 
                    f"Login failed with status {response.status_code}",
                    {"response": response_text, "status_code": response.status_code}
                )
                
        except Exception as e:
            self.log_result(
                "Authentication", 
                False, 
                f"Login request failed: {str(e)}"
            )
        
        return False
    
    def investigate_company_creation(self):
        """INVESTIGATE: Company Creation (FAILED 2.3)"""
        print("=== INVESTIGATING: COMPANY CREATION (FAILED 2.3) ===")
        
        if not self.jwt_token:
            self.log_result("Company Creation", False, "No JWT token available")
            return
        
        # Test multipart/form-data format as specified in review request
        company_data = {
            "company_name": "Debug Test Company",
            "email": "debugtest@company.com",
            "mobile": "+351999000111"
        }
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}"
            }
            
            # Prepare multipart form data
            files = {
                'data': (None, json.dumps(company_data), 'application/json')
            }
            
            print(f"Company Creation Request: POST {self.backend_url}/api/company/addCompany")
            print(f"Headers: {headers}")
            print(f"Form Data: {json.dumps(company_data, indent=2)}")
            
            response = requests.post(
                f"{self.backend_url}/api/company/addCompany",
                headers=headers,
                files=files,
                timeout=15
            )
            
            print(f"Response Status: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            
            response_text = response.text
            print(f"Response Body: {response_text}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if 'data' in data and 'company_id' in data['data']:
                        self.company_id = data['data']['company_id']
                        self.log_result(
                            "Company Creation", 
                            True, 
                            "Company created successfully",
                            {
                                "company_id": self.company_id,
                                "company_name": data['data'].get('company_name'),
                                "response": data
                            }
                        )
                    else:
                        self.log_result(
                            "Company Creation", 
                            False, 
                            "Company creation succeeded but no company_id in response",
                            {"response": data}
                        )
                except json.JSONDecodeError:
                    self.log_result(
                        "Company Creation", 
                        False, 
                        "Company creation returned non-JSON response",
                        {"response": response_text}
                    )
            else:
                self.log_result(
                    "Company Creation", 
                    False, 
                    f"Company creation failed with status {response.status_code}",
                    {
                        "status_code": response.status_code,
                        "response": response_text,
                        "error_analysis": self.analyze_error_response(response_text)
                    }
                )
                
        except Exception as e:
            self.log_result(
                "Company Creation", 
                False, 
                f"Company creation request failed: {str(e)}"
            )
    
    def investigate_tax_id_validation(self):
        """INVESTIGATE: TAX ID Validation (FAILED 2.4)"""
        print("=== INVESTIGATING: TAX ID VALIDATION (FAILED 2.4) ===")
        
        if not self.jwt_token:
            self.log_result("TAX ID Validation", False, "No JWT token available")
            return
        
        # Test data from review request
        tax_data = {
            "vat_number": "PT518713130",
            "country_code": "PT"
        }
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            print(f"TAX ID Validation Request: POST {self.backend_url}/api/company/validateTaxId")
            print(f"Headers: {headers}")
            print(f"Request Body: {json.dumps(tax_data, indent=2)}")
            
            response = requests.post(
                f"{self.backend_url}/api/company/validateTaxId",
                json=tax_data,
                headers=headers,
                timeout=15
            )
            
            print(f"Response Status: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            
            response_text = response.text
            print(f"Response Body: {response_text}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    self.log_result(
                        "TAX ID Validation", 
                        True, 
                        "TAX ID validation endpoint working",
                        {
                            "vat_number": tax_data["vat_number"],
                            "country_code": tax_data["country_code"],
                            "response": data
                        }
                    )
                except json.JSONDecodeError:
                    self.log_result(
                        "TAX ID Validation", 
                        False, 
                        "TAX ID validation returned non-JSON response",
                        {"response": response_text}
                    )
            else:
                self.log_result(
                    "TAX ID Validation", 
                    False, 
                    f"TAX ID validation failed with status {response.status_code}",
                    {
                        "status_code": response.status_code,
                        "response": response_text,
                        "error_analysis": self.analyze_error_response(response_text)
                    }
                )
                
        except Exception as e:
            self.log_result(
                "TAX ID Validation", 
                False, 
                f"TAX ID validation request failed: {str(e)}"
            )
    
    def investigate_api_key_creation(self):
        """INVESTIGATE: API Key Creation (FAILED 4.2)"""
        print("=== INVESTIGATING: API KEY CREATION (FAILED 4.2) ===")
        
        if not self.jwt_token:
            self.log_result("API Key Creation", False, "No JWT token available")
            return
        
        if not self.company_id:
            self.log_result("API Key Creation", False, "No company_id available")
            return
        
        # Test data from review request
        api_data = {
            "company_id": self.company_id,
            "api_name": "Debug Test API",
            "base_currency": "USD",
            "environment": "development",
            "permissions": ["payments", "transactions"]
        }
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            print(f"API Key Creation Request: POST {self.backend_url}/api/userApi/addApi")
            print(f"Headers: {headers}")
            print(f"Request Body: {json.dumps(api_data, indent=2)}")
            
            response = requests.post(
                f"{self.backend_url}/api/userApi/addApi",
                json=api_data,
                headers=headers,
                timeout=15
            )
            
            print(f"Response Status: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            
            response_text = response.text
            print(f"Response Body: {response_text}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    self.log_result(
                        "API Key Creation", 
                        True, 
                        "API key created successfully",
                        {
                            "company_id": self.company_id,
                            "api_name": api_data["api_name"],
                            "response": data
                        }
                    )
                except json.JSONDecodeError:
                    self.log_result(
                        "API Key Creation", 
                        False, 
                        "API key creation returned non-JSON response",
                        {"response": response_text}
                    )
            else:
                self.log_result(
                    "API Key Creation", 
                    False, 
                    f"API key creation failed with status {response.status_code}",
                    {
                        "status_code": response.status_code,
                        "response": response_text,
                        "error_analysis": self.analyze_error_response(response_text)
                    }
                )
                
        except Exception as e:
            self.log_result(
                "API Key Creation", 
                False, 
                f"API key creation request failed: {str(e)}"
            )
    
    def investigate_payment_link_creation(self):
        """INVESTIGATE: Payment Link Creation (FAILED 5.1, 5.2)"""
        print("=== INVESTIGATING: PAYMENT LINK CREATION (FAILED 5.1, 5.2) ===")
        
        if not self.jwt_token:
            self.log_result("Payment Link Creation", False, "No JWT token available")
            return
        
        if not self.company_id:
            self.log_result("Payment Link Creation", False, "No company_id available")
            return
        
        # Test A - NEW format from review request
        print("\n--- Testing NEW format (Test A) ---")
        new_format_data = {
            "base_amount": 100.00,
            "base_currency": "USD",
            "company_id": self.company_id,
            "description": "Debug test"
        }
        
        self.test_payment_link_format("NEW Format", new_format_data)
        
        # Test B - LEGACY format from review request
        print("\n--- Testing LEGACY format (Test B) ---")
        legacy_format_data = {
            "amount": 50.00,
            "currency": "USD",
            "company_id": self.company_id,
            "description": "Debug test"
        }
        
        self.test_payment_link_format("LEGACY Format", legacy_format_data)
    
    def test_payment_link_format(self, format_name: str, payment_data: Dict):
        """Test specific payment link format"""
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            print(f"Payment Link {format_name} Request: POST {self.backend_url}/api/pay/createPaymentLink")
            print(f"Headers: {headers}")
            print(f"Request Body: {json.dumps(payment_data, indent=2)}")
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=15
            )
            
            print(f"Response Status: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            
            response_text = response.text
            print(f"Response Body: {response_text}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    self.log_result(
                        f"Payment Link Creation - {format_name}", 
                        True, 
                        f"Payment link created successfully with {format_name}",
                        {
                            "format": format_name,
                            "request_data": payment_data,
                            "response": data
                        }
                    )
                except json.JSONDecodeError:
                    self.log_result(
                        f"Payment Link Creation - {format_name}", 
                        False, 
                        f"Payment link creation returned non-JSON response",
                        {"response": response_text}
                    )
            else:
                self.log_result(
                    f"Payment Link Creation - {format_name}", 
                    False, 
                    f"Payment link creation failed with status {response.status_code}",
                    {
                        "format": format_name,
                        "status_code": response.status_code,
                        "request_data": payment_data,
                        "response": response_text,
                        "error_analysis": self.analyze_error_response(response_text)
                    }
                )
                
        except Exception as e:
            self.log_result(
                f"Payment Link Creation - {format_name}", 
                False, 
                f"Payment link creation request failed: {str(e)}"
            )
    
    def investigate_customer_endpoints(self):
        """INVESTIGATE: Customer Endpoints (FAILED 10.1-10.4)"""
        print("=== INVESTIGATING: CUSTOMER ENDPOINTS (FAILED 10.1-10.4) ===")
        
        if not self.jwt_token:
            self.log_result("Customer Endpoints", False, "No JWT token available")
            return
        
        if not self.company_id:
            self.log_result("Customer Endpoints", False, "No company_id available")
            return
        
        # Test GET /api/customers
        print("\n--- Testing GET /api/customers ---")
        self.test_customer_get_endpoint()
        
        # Test POST /api/customers
        print("\n--- Testing POST /api/customers ---")
        self.test_customer_post_endpoint()
    
    def test_customer_get_endpoint(self):
        """Test GET /api/customers endpoint"""
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Test with company_id query parameter
            url = f"{self.backend_url}/api/customers?company_id={self.company_id}"
            
            print(f"Customer GET Request: GET {url}")
            print(f"Headers: {headers}")
            
            response = requests.get(
                url,
                headers=headers,
                timeout=15
            )
            
            print(f"Response Status: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            
            response_text = response.text
            print(f"Response Body: {response_text}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    self.log_result(
                        "Customer GET Endpoint", 
                        True, 
                        "Customer GET endpoint working",
                        {
                            "company_id": self.company_id,
                            "response": data
                        }
                    )
                except json.JSONDecodeError:
                    self.log_result(
                        "Customer GET Endpoint", 
                        False, 
                        "Customer GET returned non-JSON response",
                        {"response": response_text}
                    )
            elif response.status_code == 404:
                self.log_result(
                    "Customer GET Endpoint", 
                    False, 
                    "Customer GET endpoint not found (404)",
                    {
                        "status_code": response.status_code,
                        "response": response_text,
                        "url": url
                    }
                )
            else:
                self.log_result(
                    "Customer GET Endpoint", 
                    False, 
                    f"Customer GET failed with status {response.status_code}",
                    {
                        "status_code": response.status_code,
                        "response": response_text,
                        "error_analysis": self.analyze_error_response(response_text)
                    }
                )
                
        except Exception as e:
            self.log_result(
                "Customer GET Endpoint", 
                False, 
                f"Customer GET request failed: {str(e)}"
            )
    
    def test_customer_post_endpoint(self):
        """Test POST /api/customers endpoint"""
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            customer_data = {
                "name": "Debug Test Customer",
                "email": "debugcustomer@test.com",
                "company_id": self.company_id
            }
            
            print(f"Customer POST Request: POST {self.backend_url}/api/customers")
            print(f"Headers: {headers}")
            print(f"Request Body: {json.dumps(customer_data, indent=2)}")
            
            response = requests.post(
                f"{self.backend_url}/api/customers",
                json=customer_data,
                headers=headers,
                timeout=15
            )
            
            print(f"Response Status: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            
            response_text = response.text
            print(f"Response Body: {response_text}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    self.log_result(
                        "Customer POST Endpoint", 
                        True, 
                        "Customer POST endpoint working",
                        {
                            "request_data": customer_data,
                            "response": data
                        }
                    )
                except json.JSONDecodeError:
                    self.log_result(
                        "Customer POST Endpoint", 
                        False, 
                        "Customer POST returned non-JSON response",
                        {"response": response_text}
                    )
            elif response.status_code == 404:
                self.log_result(
                    "Customer POST Endpoint", 
                    False, 
                    "Customer POST endpoint not found (404)",
                    {
                        "status_code": response.status_code,
                        "response": response_text
                    }
                )
            else:
                self.log_result(
                    "Customer POST Endpoint", 
                    False, 
                    f"Customer POST failed with status {response.status_code}",
                    {
                        "status_code": response.status_code,
                        "request_data": customer_data,
                        "response": response_text,
                        "error_analysis": self.analyze_error_response(response_text)
                    }
                )
                
        except Exception as e:
            self.log_result(
                "Customer POST Endpoint", 
                False, 
                f"Customer POST request failed: {str(e)}"
            )
    
    def investigate_invalid_login(self):
        """INVESTIGATE: Invalid Login (FAILED 12.1)"""
        print("=== INVESTIGATING: INVALID LOGIN (FAILED 12.1) ===")
        
        # Test with wrong password
        invalid_login_data = {
            "email": self.test_email,
            "password": "wrongpassword"
        }
        
        try:
            print(f"Invalid Login Request: POST {self.backend_url}/api/user/login")
            print(f"Request Body: {json.dumps(invalid_login_data, indent=2)}")
            
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json=invalid_login_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            print(f"Response Status: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            
            response_text = response.text
            print(f"Response Body: {response_text}")
            
            # Analyze the response
            if response.status_code == 401:
                self.log_result(
                    "Invalid Login Test", 
                    True, 
                    "Invalid login correctly returned 401 Unauthorized",
                    {
                        "expected_status": "401",
                        "actual_status": response.status_code,
                        "response": response_text
                    }
                )
            elif response.status_code == 400:
                self.log_result(
                    "Invalid Login Test", 
                    True, 
                    "Invalid login returned 400 Bad Request (acceptable)",
                    {
                        "expected_status": "401 or 400",
                        "actual_status": response.status_code,
                        "response": response_text
                    }
                )
            elif response.status_code == 520:
                self.log_result(
                    "Invalid Login Test", 
                    False, 
                    "Invalid login returned 520 (unexpected) - possible backend error",
                    {
                        "expected_status": "401 or 400",
                        "actual_status": response.status_code,
                        "response": response_text,
                        "error_analysis": "520 suggests backend error, not proper authentication failure"
                    }
                )
            else:
                self.log_result(
                    "Invalid Login Test", 
                    False, 
                    f"Invalid login returned unexpected status {response.status_code}",
                    {
                        "expected_status": "401 or 400",
                        "actual_status": response.status_code,
                        "response": response_text,
                        "error_analysis": self.analyze_error_response(response_text)
                    }
                )
                
        except Exception as e:
            self.log_result(
                "Invalid Login Test", 
                False, 
                f"Invalid login request failed: {str(e)}"
            )
    
    def analyze_error_response(self, response_text: str) -> Dict:
        """Analyze error response to provide insights"""
        analysis = {
            "response_type": "unknown",
            "likely_cause": "unknown",
            "suggestions": []
        }
        
        try:
            # Try to parse as JSON
            data = json.loads(response_text)
            analysis["response_type"] = "json"
            
            if "error" in data:
                error_msg = data["error"].lower()
                if "validation" in error_msg or "required" in error_msg:
                    analysis["likely_cause"] = "validation_error"
                    analysis["suggestions"].append("Check required fields")
                elif "authentication" in error_msg or "token" in error_msg:
                    analysis["likely_cause"] = "authentication_error"
                    analysis["suggestions"].append("Check JWT token validity")
                elif "not found" in error_msg:
                    analysis["likely_cause"] = "endpoint_not_found"
                    analysis["suggestions"].append("Check endpoint path")
                elif "database" in error_msg or "sql" in error_msg:
                    analysis["likely_cause"] = "database_error"
                    analysis["suggestions"].append("Check database connection and schema")
            
        except json.JSONDecodeError:
            analysis["response_type"] = "non_json"
            
            if "404" in response_text or "Not Found" in response_text:
                analysis["likely_cause"] = "endpoint_not_found"
                analysis["suggestions"].append("Endpoint may not exist or be properly routed")
            elif "500" in response_text or "Internal Server Error" in response_text:
                analysis["likely_cause"] = "server_error"
                analysis["suggestions"].append("Check backend logs for detailed error")
            elif "502" in response_text or "Bad Gateway" in response_text:
                analysis["likely_cause"] = "proxy_error"
                analysis["suggestions"].append("Backend service may be down")
        
        return analysis
    
    def check_backend_logs(self):
        """Check backend logs for errors"""
        print("=== CHECKING BACKEND LOGS ===")
        
        try:
            import subprocess
            
            # Check supervisor backend logs
            result = subprocess.run(
                ["tail", "-n", "50", "/var/log/supervisor/backend.err.log"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                logs = result.stdout
                if logs.strip():
                    self.log_result(
                        "Backend Error Logs", 
                        True, 
                        "Retrieved backend error logs",
                        {"logs": logs}
                    )
                else:
                    self.log_result(
                        "Backend Error Logs", 
                        True, 
                        "No recent errors in backend logs",
                        {"logs": "No errors found"}
                    )
            else:
                self.log_result(
                    "Backend Error Logs", 
                    False, 
                    "Failed to retrieve backend logs",
                    {"error": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Backend Error Logs", 
                False, 
                f"Failed to check backend logs: {str(e)}"
            )
    
    def run_investigation(self):
        """Run the complete investigation"""
        print("╔══════════════════════════════════════════════════════════╗")
        print("║  DynoPay Failed Endpoints Debug - Detailed Investigation ║")
        print("║  Investigating 16 failed tests from comprehensive suite  ║")
        print("╚══════════════════════════════════════════════════════════╝")
        print()
        
        # Step 1: Authentication
        if not self.authenticate_and_get_company_id():
            print("❌ Authentication failed - cannot proceed with other tests")
            return
        
        # Step 2: Investigate each failed endpoint
        self.investigate_company_creation()
        self.investigate_tax_id_validation()
        self.investigate_api_key_creation()
        self.investigate_payment_link_creation()
        self.investigate_customer_endpoints()
        self.investigate_invalid_login()
        
        # Step 3: Check backend logs
        self.check_backend_logs()
        
        # Step 4: Generate summary
        self.generate_investigation_summary()
    
    def generate_investigation_summary(self):
        """Generate detailed investigation summary"""
        print("\n" + "="*80)
        print("INVESTIGATION SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print()
        
        if failed_tests > 0:
            print("FAILED TESTS ANALYSIS:")
            print("-" * 40)
            for test_name, result in self.test_results.items():
                if not result['success']:
                    print(f"❌ {test_name}")
                    print(f"   Error: {result['message']}")
                    if 'details' in result and 'error_analysis' in result['details']:
                        analysis = result['details']['error_analysis']
                        print(f"   Likely Cause: {analysis.get('likely_cause', 'unknown')}")
                        if analysis.get('suggestions'):
                            print(f"   Suggestions: {', '.join(analysis['suggestions'])}")
                    print()
        
        if passed_tests > 0:
            print("PASSED TESTS:")
            print("-" * 40)
            for test_name, result in self.test_results.items():
                if result['success']:
                    print(f"✅ {test_name}: {result['message']}")
        
        print("\nDETAILED RESULTS:")
        print("-" * 40)
        print(json.dumps(self.test_results, indent=2))

if __name__ == "__main__":
    debugger = FailedEndpointsDebugger()
    debugger.run_investigation()