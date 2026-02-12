#!/usr/bin/env python3
"""
Backend API Testing for DynoPay - Swagger API Documentation Overhaul + New Endpoints
Testing suite for the comprehensive API documentation and endpoint verification
"""

import requests
import json
import sys
import time
from typing import Dict, Any, List, Union

# Base URL from environment - using the actual backend URL
BASE_URL = "https://build-ready-3.preview.emergentagent.com"

class ApiTester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'DynoPay-Backend-Test/1.0'
        })
        self.test_results = []
        
    def log(self, message: str, test_name: str = "", status: str = "INFO"):
        """Log test results with proper formatting"""
        timestamp = time.strftime("%H:%M:%S")
        if test_name:
            print(f"[{timestamp}] {status}: TEST {test_name} - {message}")
        else:
            print(f"[{timestamp}] {status}: {message}")
        
        if test_name and status in ["PASS", "FAIL"]:
            self.test_results.append({
                "test": test_name,
                "status": status,
                "message": message
            })
    
    def get_json_safely(self, url: str, timeout: int = 10) -> Dict[str, Any]:
        """Safely fetch JSON from URL with error handling"""
        try:
            response = self.session.get(url, timeout=timeout)
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"HTTP {response.status_code}", "content": response.text[:200]}
        except requests.exceptions.Timeout:
            return {"error": "Request timeout"}
        except requests.exceptions.RequestException as e:
            return {"error": f"Request failed: {str(e)}"}
        except json.JSONDecodeError as e:
            return {"error": f"JSON decode failed: {str(e)}", "content": response.text[:200]}
    
    def test_backend_health(self) -> bool:
        """TEST 1: Backend healthy — GET /health returns 200 with status 'healthy'"""
        test_name = "1"
        try:
            response = self.session.get(f"{self.base_url}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log(f"Backend healthy: {data.get('service', 'Unknown service')}", test_name, "PASS")
                    return True
                else:
                    self.log(f"Backend not healthy: status={data.get('status')}", test_name, "FAIL")
                    return False
            else:
                self.log(f"Health check failed: HTTP {response.status_code}", test_name, "FAIL")
                return False
                
        except Exception as e:
            self.log(f"Health check error: {str(e)}", test_name, "FAIL")
            return False
    
    def test_swagger_spec_loads(self) -> Union[Dict[str, Any], None]:
        """TEST 2: Swagger spec loads — GET /api/docs.json returns valid JSON with 'paths' key"""
        test_name = "2"
        try:
            response = self.session.get(f"{self.base_url}/api/docs.json", timeout=15)
            
            if response.status_code == 200:
                try:
                    swagger_spec = response.json()
                    if "paths" in swagger_spec:
                        path_count = len(swagger_spec["paths"])
                        self.log(f"Swagger spec loaded successfully with {path_count} paths", test_name, "PASS")
                        return swagger_spec
                    else:
                        self.log("Swagger spec missing 'paths' key", test_name, "FAIL")
                        return None
                except json.JSONDecodeError as e:
                    self.log(f"Invalid JSON in swagger spec: {str(e)}", test_name, "FAIL")
                    return None
            else:
                self.log(f"Swagger spec not accessible: HTTP {response.status_code}", test_name, "FAIL")
                return None
                
        except Exception as e:
            self.log(f"Swagger spec load error: {str(e)}", test_name, "FAIL")
            return None
    
    def test_total_path_count(self, swagger_spec: Dict[str, Any]) -> bool:
        """TEST 3: Total path count — should be >= 190 paths"""
        test_name = "3"
        if not swagger_spec or "paths" not in swagger_spec:
            self.log("No swagger spec available for path count test", test_name, "FAIL")
            return False
            
        path_count = len(swagger_spec["paths"])
        if path_count >= 190:
            self.log(f"Path count sufficient: {path_count} paths (≥190 required)", test_name, "PASS")
            return True
        else:
            self.log(f"Insufficient paths: {path_count} paths (<190 required)", test_name, "FAIL")
            return False
    
    def test_company_methods(self, swagger_spec: Dict[str, Any]) -> bool:
        """TEST 4: Company methods correct verification"""
        test_name = "4"
        if not swagger_spec or "paths" not in swagger_spec:
            self.log("No swagger spec available for company methods test", test_name, "FAIL")
            return False
        
        paths = swagger_spec["paths"]
        issues = []
        
        # Check /api/company/addCompany should have POST but NOT GET
        add_company_path = "/api/company/addCompany"
        if add_company_path in paths:
            methods = list(paths[add_company_path].keys())
            if "post" in methods and "get" not in methods:
                pass  # Correct
            elif "post" not in methods:
                issues.append(f"{add_company_path} missing POST method")
            elif "get" in methods:
                issues.append(f"{add_company_path} has GET method (should not)")
        else:
            issues.append(f"{add_company_path} path not found")
        
        # Check /api/company/updateCompany/{id} should have PUT but NOT GET and NOT POST
        update_company_path = "/api/company/updateCompany/{id}"
        if update_company_path in paths:
            methods = list(paths[update_company_path].keys())
            if "put" in methods and "get" not in methods and "post" not in methods:
                pass  # Correct
            else:
                method_issues = []
                if "put" not in methods:
                    method_issues.append("missing PUT")
                if "get" in methods:
                    method_issues.append("has GET (should not)")
                if "post" in methods:
                    method_issues.append("has POST (should not)")
                issues.append(f"{update_company_path}: {', '.join(method_issues)}")
        else:
            issues.append(f"{update_company_path} path not found")
        
        # Check /api/company/deleteCompany/{id} should have DELETE but NOT GET
        delete_company_path = "/api/company/deleteCompany/{id}"
        if delete_company_path in paths:
            methods = list(paths[delete_company_path].keys())
            if "delete" in methods and "get" not in methods:
                pass  # Correct
            else:
                method_issues = []
                if "delete" not in methods:
                    method_issues.append("missing DELETE")
                if "get" in methods:
                    method_issues.append("has GET (should not)")
                issues.append(f"{delete_company_path}: {', '.join(method_issues)}")
        else:
            issues.append(f"{delete_company_path} path not found")
        
        if not issues:
            self.log("Company methods correctly configured", test_name, "PASS")
            return True
        else:
            self.log(f"Company method issues: {'; '.join(issues)}", test_name, "FAIL")
            return False
    
    def test_new_conversion_endpoints(self) -> bool:
        """TEST 5: New conversion detail endpoint — /api/company/conversion/1 should return JSON with 401 status (auth required)"""
        test_name = "5"
        try:
            # Test conversion detail endpoint
            response = self.session.get(f"{self.base_url}/api/company/conversion/1", timeout=10)
            
            if response.status_code == 401:
                try:
                    data = response.json()
                    self.log("Conversion detail endpoint correctly requires authentication (401)", test_name, "PASS")
                    return True
                except json.JSONDecodeError:
                    self.log("Conversion detail endpoint returns 401 but not JSON", test_name, "FAIL")
                    return False
            else:
                self.log(f"Conversion detail endpoint unexpected status: {response.status_code}", test_name, "FAIL")
                return False
                
        except Exception as e:
            self.log(f"Conversion detail endpoint error: {str(e)}", test_name, "FAIL")
            return False
    
    def test_new_retry_endpoint(self) -> bool:
        """TEST 6: New retry endpoint — POST /api/company/conversion/1/retry should return JSON with 401 status (auth required)"""
        test_name = "6"
        try:
            response = self.session.post(f"{self.base_url}/api/company/conversion/1/retry", timeout=10)
            
            if response.status_code == 401:
                try:
                    data = response.json()
                    self.log("Conversion retry endpoint correctly requires authentication (401)", test_name, "PASS")
                    return True
                except json.JSONDecodeError:
                    self.log("Conversion retry endpoint returns 401 but not JSON", test_name, "FAIL")
                    return False
            else:
                self.log(f"Conversion retry endpoint unexpected status: {response.status_code}", test_name, "FAIL")
                return False
                
        except Exception as e:
            self.log(f"Conversion retry endpoint error: {str(e)}", test_name, "FAIL")
            return False
    
    def test_admin_methods(self, swagger_spec: Dict[str, Any]) -> bool:
        """TEST 7: Admin methods correct verification"""
        test_name = "7"
        if not swagger_spec or "paths" not in swagger_spec:
            self.log("No swagger spec available for admin methods test", test_name, "FAIL")
            return False
        
        paths = swagger_spec["paths"]
        issues = []
        
        # Check /api/admin/login should have POST but NOT GET
        admin_login_path = "/api/admin/login"
        if admin_login_path in paths:
            methods = list(paths[admin_login_path].keys())
            if "post" in methods and "get" not in methods:
                pass  # Correct
            else:
                method_issues = []
                if "post" not in methods:
                    method_issues.append("missing POST")
                if "get" in methods:
                    method_issues.append("has GET (should not)")
                issues.append(f"{admin_login_path}: {', '.join(method_issues)}")
        else:
            issues.append(f"{admin_login_path} path not found")
        
        # Check /api/admin/changePassword should have PUT but NOT GET
        change_password_path = "/api/admin/changePassword"
        if change_password_path in paths:
            methods = list(paths[change_password_path].keys())
            if "put" in methods and "get" not in methods:
                pass  # Correct
            else:
                method_issues = []
                if "put" not in methods:
                    method_issues.append("missing PUT")
                if "get" in methods:
                    method_issues.append("has GET (should not)")
                issues.append(f"{change_password_path}: {', '.join(method_issues)}")
        else:
            issues.append(f"{change_password_path} path not found")
        
        if not issues:
            self.log("Admin methods correctly configured", test_name, "PASS")
            return True
        else:
            self.log(f"Admin method issues: {'; '.join(issues)}", test_name, "FAIL")
            return False
    
    def test_merchant_api_endpoints(self, swagger_spec: Dict[str, Any]) -> bool:
        """TEST 8: Merchant API missing endpoints present verification"""
        test_name = "8"
        if not swagger_spec or "paths" not in swagger_spec:
            self.log("No swagger spec available for merchant API test", test_name, "FAIL")
            return False
        
        paths = swagger_spec["paths"]
        required_endpoints = [
            "/api/user/createPayment",
            "/api/user/addFunds",
            "/api/user/useWallet",
            "/api/user/getSingleTransaction/{id}",
            "/api/user/getCryptoTransaction/{address}"
        ]
        
        missing_endpoints = []
        for endpoint in required_endpoints:
            if endpoint not in paths:
                missing_endpoints.append(endpoint)
        
        if not missing_endpoints:
            self.log(f"All {len(required_endpoints)} merchant API endpoints present", test_name, "PASS")
            return True
        else:
            self.log(f"Missing merchant API endpoints: {', '.join(missing_endpoints)}", test_name, "FAIL")
            return False
    
    def test_wallet_endpoints(self, swagger_spec: Dict[str, Any]) -> bool:
        """TEST 9: Missing wallet endpoints present verification"""
        test_name = "9"
        if not swagger_spec or "paths" not in swagger_spec:
            self.log("No swagger spec available for wallet endpoints test", test_name, "FAIL")
            return False
        
        paths = swagger_spec["paths"]
        required_endpoints = [
            "/api/wallet/getWalletAddresses",
            "/api/wallet/withdrawAssets",
            "/api/wallet/exchangeCreate",
            "/api/wallet/confirmExchange"
        ]
        
        missing_endpoints = []
        for endpoint in required_endpoints:
            if endpoint not in paths:
                missing_endpoints.append(endpoint)
        
        if not missing_endpoints:
            self.log(f"All {len(required_endpoints)} wallet endpoints present", test_name, "PASS")
            return True
        else:
            self.log(f"Missing wallet endpoints: {', '.join(missing_endpoints)}", test_name, "FAIL")
            return False
    
    def test_subscription_crud(self, swagger_spec: Dict[str, Any]) -> bool:
        """TEST 10: Subscription CRUD verification"""
        test_name = "10"
        if not swagger_spec or "paths" not in swagger_spec:
            self.log("No swagger spec available for subscription CRUD test", test_name, "FAIL")
            return False
        
        paths = swagger_spec["paths"]
        issues = []
        
        # Check /api/subscriptions should have both GET and POST methods
        subscriptions_path = "/api/subscriptions"
        if subscriptions_path in paths:
            methods = list(paths[subscriptions_path].keys())
            if "get" not in methods:
                issues.append(f"{subscriptions_path} missing GET method")
            if "post" not in methods:
                issues.append(f"{subscriptions_path} missing POST method")
        else:
            issues.append(f"{subscriptions_path} path not found")
        
        # Check /api/subscriptions/{id} should have GET, PUT, and DELETE methods
        subscription_id_path = "/api/subscriptions/{id}"
        if subscription_id_path in paths:
            methods = list(paths[subscription_id_path].keys())
            if "get" not in methods:
                issues.append(f"{subscription_id_path} missing GET method")
            if "put" not in methods:
                issues.append(f"{subscription_id_path} missing PUT method")
            if "delete" not in methods:
                issues.append(f"{subscription_id_path} missing DELETE method")
        else:
            issues.append(f"{subscription_id_path} path not found")
        
        if not issues:
            self.log("Subscription CRUD methods correctly configured", test_name, "PASS")
            return True
        else:
            self.log(f"Subscription CRUD issues: {'; '.join(issues)}", test_name, "FAIL")
            return False
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all backend API tests"""
        self.log("=" * 80)
        self.log("DynoPay Backend API Testing - Swagger API Documentation Overhaul + New Endpoints")
        self.log(f"Testing against: {self.base_url}")
        self.log("=" * 80)
        
        # TEST 1: Backend Health
        health_ok = self.test_backend_health()
        
        # TEST 2: Swagger Spec
        swagger_spec = self.test_swagger_spec_loads()
        
        # TEST 3: Path Count
        if swagger_spec:
            self.test_total_path_count(swagger_spec)
        
        # TEST 4: Company Methods
        if swagger_spec:
            self.test_company_methods(swagger_spec)
        
        # TEST 5: New Conversion Detail Endpoint
        self.test_new_conversion_endpoints()
        
        # TEST 6: New Retry Endpoint
        self.test_new_retry_endpoint()
        
        # TEST 7: Admin Methods
        if swagger_spec:
            self.test_admin_methods(swagger_spec)
        
        # TEST 8: Merchant API Endpoints
        if swagger_spec:
            self.test_merchant_api_endpoints(swagger_spec)
        
        # TEST 9: Wallet Endpoints
        if swagger_spec:
            self.test_wallet_endpoints(swagger_spec)
        
        # TEST 10: Subscription CRUD
        if swagger_spec:
            self.test_subscription_crud(swagger_spec)
        
        # Summary
        self.log("=" * 80)
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["status"] == "PASS"])
        failed_tests = total_tests - passed_tests
        
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        self.log(f"TESTING COMPLETE: {passed_tests}/{total_tests} tests passed ({success_rate:.1f}%)")
        
        if failed_tests > 0:
            self.log("FAILED TESTS:")
            for result in self.test_results:
                if result["status"] == "FAIL":
                    self.log(f"  TEST {result['test']}: {result['message']}")
        
        return {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "success_rate": success_rate,
            "results": self.test_results,
            "backend_healthy": health_ok,
            "swagger_available": swagger_spec is not None
        }

def main():
    """Main test execution"""
    tester = ApiTester(BASE_URL)
    results = tester.run_all_tests()
    
    # Exit with error code if tests failed
    if results["failed_tests"] > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()