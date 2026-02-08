#!/usr/bin/env python3

"""
DynoPay Backend API Testing - Swagger Documentation Updates
Testing Agent for verifying Swagger API documentation changes
"""

import json
import requests
from typing import Dict, List, Any
import sys
import time

class DynoPaySwaggerTester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.timeout = 30
        self.results = {
            'total_tests': 0,
            'passed_tests': 0,
            'failed_tests': [],
            'test_details': []
        }

    def log_test(self, test_name: str, success: bool, details: str = "", error: str = ""):
        """Log test results"""
        self.results['total_tests'] += 1
        if success:
            self.results['passed_tests'] += 1
            status = "✅ PASS"
        else:
            self.results['failed_tests'].append({
                'test': test_name,
                'error': error,
                'details': details
            })
            status = "❌ FAIL"
        
        test_result = {
            'name': test_name,
            'status': status,
            'details': details,
            'error': error
        }
        self.results['test_details'].append(test_result)
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if error:
            print(f"   Error: {error}")

    def test_openapi_spec_endpoint(self):
        """Test 1: Verify /api/docs.json returns 200 with valid JSON"""
        test_name = "OpenAPI Spec Endpoint (/api/docs.json)"
        try:
            response = self.session.get(f"{self.base_url}/api/docs.json")
            
            if response.status_code != 200:
                self.log_test(test_name, False, 
                             f"Status code: {response.status_code}", 
                             f"Expected 200, got {response.status_code}")
                return None
            
            # Verify it's valid JSON
            try:
                spec_data = response.json()
            except json.JSONDecodeError as e:
                self.log_test(test_name, False, 
                             "Invalid JSON response", 
                             f"JSON decode error: {str(e)}")
                return None
            
            # Verify it's an OpenAPI spec
            if 'openapi' not in spec_data and 'swagger' not in spec_data:
                self.log_test(test_name, False, 
                             "Not a valid OpenAPI spec", 
                             "Missing 'openapi' or 'swagger' field")
                return None
            
            self.log_test(test_name, True, 
                         f"Status: {response.status_code}, Valid OpenAPI spec returned")
            return spec_data
            
        except Exception as e:
            self.log_test(test_name, False, 
                         "Request failed", str(e))
            return None

    def test_total_paths_count(self, spec_data: Dict):
        """Test 2: Verify spec has 178 total paths"""
        test_name = "Total Paths Count (178 paths)"
        try:
            if not spec_data or 'paths' not in spec_data:
                self.log_test(test_name, False, 
                             "No paths found in spec", 
                             "Spec data missing or no 'paths' field")
                return
            
            total_paths = len(spec_data['paths'])
            
            if total_paths == 178:
                self.log_test(test_name, True, 
                             f"Found exactly {total_paths} paths as expected")
            else:
                self.log_test(test_name, False, 
                             f"Found {total_paths} paths", 
                             f"Expected 178 paths, got {total_paths}")
                
        except Exception as e:
            self.log_test(test_name, False, 
                         "Failed to count paths", str(e))

    def test_crypto_payment_descriptions(self, spec_data: Dict):
        """Test 3: Verify /api/user/cryptoPayment POST endpoint field descriptions"""
        test_name = "CryptoPayment Field Descriptions"
        try:
            if not spec_data or 'paths' not in spec_data:
                self.log_test(test_name, False, 
                             "No paths found in spec", 
                             "Spec data missing or no 'paths' field")
                return
            
            crypto_payment_path = spec_data['paths'].get('/api/user/cryptoPayment')
            if not crypto_payment_path:
                self.log_test(test_name, False, 
                             "/api/user/cryptoPayment path not found", 
                             "Missing cryptoPayment endpoint in API spec")
                return
            
            post_method = crypto_payment_path.get('post')
            if not post_method:
                self.log_test(test_name, False, 
                             "POST method not found for cryptoPayment", 
                             "Missing POST method in cryptoPayment endpoint")
                return
            
            # Get request body schema
            request_body = post_method.get('requestBody', {})
            content = request_body.get('content', {})
            json_content = content.get('application/json', {})
            schema = json_content.get('schema', {})
            properties = schema.get('properties', {})
            
            # Check redirect_uri description
            redirect_uri_found = False
            callback_url_found = False
            webhook_url_found = False
            
            redirect_uri = properties.get('redirect_uri', {})
            if redirect_uri:
                description = redirect_uri.get('description', '').lower()
                if 'not a webhook' in description:
                    redirect_uri_found = True
                    self.log_test("redirect_uri description", True, 
                                 f"Contains 'NOT a webhook': {redirect_uri.get('description', '')}")
                else:
                    self.log_test("redirect_uri description", False, 
                                 f"Description: {redirect_uri.get('description', '')}", 
                                 "Missing 'NOT a webhook' warning")
            
            # Check callback_url description
            callback_url = properties.get('callback_url', {})
            if callback_url:
                description = callback_url.get('description', '').lower()
                if 'server-to-server' in description:
                    callback_url_found = True
                    self.log_test("callback_url description", True, 
                                 f"Contains 'server-to-server': {callback_url.get('description', '')}")
                else:
                    self.log_test("callback_url description", False, 
                                 f"Description: {callback_url.get('description', '')}", 
                                 "Missing 'server-to-server' description")
            
            # Check webhook_url description
            webhook_url = properties.get('webhook_url', {})
            if webhook_url:
                description = webhook_url.get('description', '').lower()
                if 'most merchants need' in description and 'merchant_amount' in description:
                    webhook_url_found = True
                    self.log_test("webhook_url description", True, 
                                 f"Contains 'MOST MERCHANTS NEED' and 'merchant_amount': {webhook_url.get('description', '')}")
                else:
                    self.log_test("webhook_url description", False, 
                                 f"Description: {webhook_url.get('description', '')}", 
                                 "Missing 'MOST MERCHANTS NEED' or 'merchant_amount'")
            
            # Overall test result
            all_descriptions_correct = redirect_uri_found and callback_url_found and webhook_url_found
            if all_descriptions_correct:
                self.log_test(test_name, True, 
                             "All field descriptions correctly updated")
            else:
                missing_fields = []
                if not redirect_uri_found:
                    missing_fields.append("redirect_uri")
                if not callback_url_found:
                    missing_fields.append("callback_url")
                if not webhook_url_found:
                    missing_fields.append("webhook_url")
                    
                self.log_test(test_name, False, 
                             f"Some field descriptions incorrect", 
                             f"Issues with fields: {', '.join(missing_fields)}")
                
        except Exception as e:
            self.log_test(test_name, False, 
                         "Failed to check field descriptions", str(e))

    def test_dashboard_endpoints(self, spec_data: Dict):
        """Test 4: Verify new dashboard endpoints exist (4 endpoints)"""
        test_name = "Dashboard Endpoints (4 endpoints)"
        try:
            if not spec_data or 'paths' not in spec_data:
                self.log_test(test_name, False, 
                             "No paths found in spec", 
                             "Spec data missing or no 'paths' field")
                return
            
            expected_dashboard_endpoints = [
                '/api/dashboard',
                '/api/dashboard/chart',
                '/api/dashboard/fee-tiers',
                '/api/dashboard/recent-transactions'
            ]
            
            found_endpoints = []
            missing_endpoints = []
            
            for endpoint in expected_dashboard_endpoints:
                if endpoint in spec_data['paths']:
                    found_endpoints.append(endpoint)
                else:
                    missing_endpoints.append(endpoint)
            
            if len(found_endpoints) == 4:
                self.log_test(test_name, True, 
                             f"All 4 dashboard endpoints found: {', '.join(found_endpoints)}")
            else:
                self.log_test(test_name, False, 
                             f"Found {len(found_endpoints)}/4 endpoints: {', '.join(found_endpoints)}", 
                             f"Missing endpoints: {', '.join(missing_endpoints)}")
                
        except Exception as e:
            self.log_test(test_name, False, 
                         "Failed to check dashboard endpoints", str(e))

    def test_invoice_endpoints(self, spec_data: Dict):
        """Test 5: Verify new invoice endpoints exist (4 endpoints)"""
        test_name = "Invoice Endpoints (4 endpoints)"
        try:
            if not spec_data or 'paths' not in spec_data:
                self.log_test(test_name, False, 
                             "No paths found in spec", 
                             "Spec data missing or no 'paths' field")
                return
            
            expected_invoice_endpoints = [
                '/api/invoices',
                '/api/invoices/{id}',
                '/api/invoices/{id}/pdf',
                '/api/transactions/{id}/invoice'
            ]
            
            found_endpoints = []
            missing_endpoints = []
            
            for endpoint in expected_invoice_endpoints:
                if endpoint in spec_data['paths']:
                    found_endpoints.append(endpoint)
                else:
                    missing_endpoints.append(endpoint)
            
            if len(found_endpoints) == 4:
                self.log_test(test_name, True, 
                             f"All 4 invoice endpoints found: {', '.join(found_endpoints)}")
            else:
                self.log_test(test_name, False, 
                             f"Found {len(found_endpoints)}/4 endpoints: {', '.join(found_endpoints)}", 
                             f"Missing endpoints: {', '.join(missing_endpoints)}")
                
        except Exception as e:
            self.log_test(test_name, False, 
                         "Failed to check invoice endpoints", str(e))

    def test_swagger_ui(self):
        """Test 6: Verify Swagger UI loads at /api/docs"""
        test_name = "Swagger UI Loading (/api/docs)"
        try:
            response = self.session.get(f"{self.base_url}/api/docs")
            
            if response.status_code != 200:
                self.log_test(test_name, False, 
                             f"Status code: {response.status_code}", 
                             f"Expected 200, got {response.status_code}")
                return
            
            # Check if it's HTML content (Swagger UI)
            content_type = response.headers.get('content-type', '').lower()
            if 'html' not in content_type:
                self.log_test(test_name, False, 
                             f"Content-Type: {content_type}", 
                             "Expected HTML content for Swagger UI")
                return
            
            # Check if response contains Swagger UI indicators
            content = response.text.lower()
            if 'swagger' in content or 'openapi' in content:
                self.log_test(test_name, True, 
                             f"Status: {response.status_code}, HTML content with Swagger UI loaded")
            else:
                self.log_test(test_name, False, 
                             "HTML returned but no Swagger UI indicators", 
                             "Content doesn't appear to be Swagger UI")
                
        except Exception as e:
            self.log_test(test_name, False, 
                         "Request failed", str(e))

    def run_all_tests(self):
        """Run all Swagger documentation tests"""
        print("🚀 STARTING DYNOPAY SWAGGER API DOCUMENTATION TESTING")
        print("=" * 70)
        print(f"Backend URL: {self.base_url}")
        print("=" * 70)

        # Test 1: Get OpenAPI spec
        spec_data = self.test_openapi_spec_endpoint()
        
        if spec_data:
            # Test 2: Count paths
            self.test_total_paths_count(spec_data)
            
            # Test 3: Check field descriptions
            self.test_crypto_payment_descriptions(spec_data)
            
            # Test 4: Check dashboard endpoints
            self.test_dashboard_endpoints(spec_data)
            
            # Test 5: Check invoice endpoints
            self.test_invoice_endpoints(spec_data)
        
        # Test 6: Check Swagger UI
        self.test_swagger_ui()
        
        # Summary
        print("\n" + "=" * 70)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 70)
        
        success_rate = (self.results['passed_tests'] / self.results['total_tests'] * 100) if self.results['total_tests'] > 0 else 0
        print(f"Total Tests: {self.results['total_tests']}")
        print(f"Passed: {self.results['passed_tests']}")
        print(f"Failed: {len(self.results['failed_tests'])}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if self.results['failed_tests']:
            print("\n❌ FAILED TESTS:")
            for failed in self.results['failed_tests']:
                print(f"  • {failed['test']}: {failed['error']}")
        else:
            print("\n✅ ALL TESTS PASSED!")
        
        return success_rate >= 80

def main():
    # Backend URL from environment
    backend_url = "https://init-install.preview.emergentagent.com"
    
    tester = DynoPaySwaggerTester(backend_url)
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 SWAGGER API DOCUMENTATION TESTING COMPLETED SUCCESSFULLY!")
        return 0
    else:
        print("\n⚠️ SWAGGER API DOCUMENTATION TESTING COMPLETED WITH ISSUES!")
        return 1

if __name__ == "__main__":
    sys.exit(main())