#!/usr/bin/env python3
"""
DynoPay P2 Changes Testing
Tests the two P2 changes:
1. Verify api-service directory deleted
2. Verify API versioning (backward compatible)
"""

import requests
import json
import time
import sys
import os
import glob
from typing import Dict, Any

class DynoPayP2Tester:
    def __init__(self, base_url: str, email: str, password: str):
        self.base_url = base_url.rstrip('/')
        self.email = email
        self.password = password
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'DynoPay-Webhook-Bug-Fix-Tester/1.0'
        })
        self.jwt_token = None
        self.api_key = None
        self.customer_token = None
        
    def log(self, message: str):
        """Log test messages with timestamp"""
        print(f"[{time.strftime('%H:%M:%S')}] {message}")
    
    def test_backend_health(self) -> bool:
        """Test backend health endpoint"""
        self.log("🏥 Testing backend health...")
        try:
            response = self.session.get(f"{self.base_url}/health")
            if response.status_code == 200:
                self.log("✅ Backend health check passed")
                return True
            else:
                self.log(f"❌ Backend health check failed: HTTP {response.status_code}")
                self.log(f"   Response: {response.text[:200]}")
                return False
        except Exception as e:
            self.log(f"❌ Backend health check failed: {e}")
            return False

    def test_api_service_directory_deleted(self) -> Dict[str, Any]:
        """TASK 1: Verify api-service directory deleted"""
        self.log("📂 Testing api-service directory deletion...")
        results = {
            "directory_not_exists": False,
            "no_typescript_imports": False,
            "backend_healthy": False
        }
        
        # 1. Check directory doesn't exist
        api_service_path = "/app/backend/api-service/"
        if not os.path.exists(api_service_path):
            self.log("✅ api-service directory does NOT exist")
            results["directory_not_exists"] = True
        else:
            self.log("❌ api-service directory still exists")
        
        # 2. Check for TypeScript imports (grep for "from.*api-service")
        self.log("🔍 Checking for TypeScript imports referencing api-service...")
        try:
            backend_path = "/app/backend"
            ts_files = glob.glob(f"{backend_path}/**/*.ts", recursive=True)
            api_service_imports = []
            
            for file_path in ts_files:
                if "node_modules" in file_path:
                    continue
                try:
                    with open(file_path, 'r') as f:
                        content = f.read()
                        lines = content.split('\n')
                        for line_num, line in enumerate(lines, 1):
                            if 'from' in line and 'api-service' in line and not line.strip().startswith('//'):
                                api_service_imports.append(f"{file_path}:{line_num}: {line.strip()}")
                except Exception:
                    continue
            
            if not api_service_imports:
                self.log("✅ No active TypeScript imports reference 'api-service'")
                results["no_typescript_imports"] = True
            else:
                self.log(f"❌ Found {len(api_service_imports)} TypeScript imports referencing api-service:")
                for imp in api_service_imports[:5]:  # Show first 5
                    self.log(f"   {imp}")
        
        except Exception as e:
            self.log(f"⚠️  Could not check TypeScript imports: {e}")
        
        # 3. Backend health
        results["backend_healthy"] = self.test_backend_health()
        
        return results

    def test_api_versioning(self) -> Dict[str, Any]:
        """TASK 2: Verify API versioning (backward compatible)"""
        self.log("🔄 Testing API versioning...")
        results = {
            "api_root_returns_v1": False,
            "api_v1_identical": False,
            "login_api_works": False,
            "login_v1_works": False,
            "docs_accessible": False,
            "docs_json_has_v1": False,
            "api_root_response": None,
            "api_v1_response": None
        }
        
        # 1. GET /api should return JSON with api_version="v1" and versioning object
        self.log("📡 Testing GET /api...")
        try:
            response = self.session.get(f"{self.base_url}/api")
            if response.status_code == 200:
                data = response.json()
                results["api_root_response"] = data
                
                api_version = data.get("api_version")
                versioning = data.get("versioning")
                
                if api_version == "v1" and versioning:
                    self.log("✅ GET /api returns api_version='v1' and versioning object")
                    results["api_root_returns_v1"] = True
                    self.log(f"   Versioning fields: {list(versioning.keys()) if versioning else 'None'}")
                else:
                    self.log(f"❌ GET /api missing required fields - api_version: {api_version}, versioning: {bool(versioning)}")
            else:
                self.log(f"❌ GET /api failed: HTTP {response.status_code}")
        except Exception as e:
            self.log(f"❌ GET /api failed: {e}")
        
        # 2. GET /api/v1 should return IDENTICAL JSON to GET /api
        self.log("📡 Testing GET /api/v1...")
        try:
            response = self.session.get(f"{self.base_url}/api/v1")
            if response.status_code == 200:
                data = response.json()
                results["api_v1_response"] = data
                
                # Compare with /api response
                if results["api_root_response"] and data == results["api_root_response"]:
                    self.log("✅ GET /api/v1 returns IDENTICAL JSON to GET /api")
                    results["api_v1_identical"] = True
                else:
                    self.log("❌ GET /api/v1 response differs from GET /api")
                    if results["api_root_response"]:
                        self.log("   Differences found in response structure")
            else:
                self.log(f"❌ GET /api/v1 failed: HTTP {response.status_code}")
        except Exception as e:
            self.log(f"❌ GET /api/v1 failed: {e}")
        
        # 3. POST /api/user/login should return 200 with accessToken
        self.log("🔐 Testing POST /api/user/login...")
        try:
            login_data = {
                "email": "richard@dyno.pt",
                "password": "Katiekendra123@"
            }
            response = self.session.post(f"{self.base_url}/api/user/login", json=login_data)
            if response.status_code == 200:
                data = response.json()
                access_token = data.get('data', {}).get('accessToken') or data.get('access_token')
                if access_token:
                    self.log("✅ POST /api/user/login returns 200 with accessToken")
                    results["login_api_works"] = True
                else:
                    self.log("❌ POST /api/user/login missing accessToken in response")
            else:
                self.log(f"❌ POST /api/user/login failed: HTTP {response.status_code}")
        except Exception as e:
            self.log(f"❌ POST /api/user/login failed: {e}")
        
        # 4. POST /api/v1/user/login should return 200 with accessToken (same endpoint via versioned path)
        self.log("🔐 Testing POST /api/v1/user/login...")
        try:
            login_data = {
                "email": "richard@dyno.pt",
                "password": "Katiekendra123@"
            }
            response = self.session.post(f"{self.base_url}/api/v1/user/login", json=login_data)
            if response.status_code == 200:
                data = response.json()
                access_token = data.get('data', {}).get('accessToken') or data.get('access_token')
                if access_token:
                    self.log("✅ POST /api/v1/user/login returns 200 with accessToken")
                    results["login_v1_works"] = True
                else:
                    self.log("❌ POST /api/v1/user/login missing accessToken in response")
            else:
                self.log(f"❌ POST /api/v1/user/login failed: HTTP {response.status_code}")
        except Exception as e:
            self.log(f"❌ POST /api/v1/user/login failed: {e}")
        
        # 5. GET /api/docs should return 200 (Swagger UI loads)
        self.log("📚 Testing GET /api/docs...")
        try:
            response = self.session.get(f"{self.base_url}/api/docs")
            if response.status_code == 200 and "swagger" in response.text.lower():
                self.log("✅ GET /api/docs returns 200 (Swagger UI loads)")
                results["docs_accessible"] = True
            else:
                self.log(f"❌ GET /api/docs failed or not Swagger UI: HTTP {response.status_code}")
        except Exception as e:
            self.log(f"❌ GET /api/docs failed: {e}")
        
        # 6. GET /api/docs.json should contain "v1" in the info.description field
        self.log("📄 Testing GET /api/docs.json...")
        try:
            response = self.session.get(f"{self.base_url}/api/docs.json")
            if response.status_code == 200:
                data = response.json()
                description = data.get('info', {}).get('description', '')
                if 'v1' in description:
                    self.log("✅ GET /api/docs.json contains 'v1' in info.description")
                    results["docs_json_has_v1"] = True
                else:
                    self.log(f"❌ GET /api/docs.json missing 'v1' in description: {description[:100]}...")
            else:
                self.log(f"❌ GET /api/docs.json failed: HTTP {response.status_code}")
        except Exception as e:
            self.log(f"❌ GET /api/docs.json failed: {e}")
        
        return results
    
    def run_p2_tests(self) -> Dict[str, Any]:
        """Run P2 changes comprehensive test"""
        self.log("🧪 Starting DynoPay P2 Changes Testing...")
        self.log(f"   Base URL: {self.base_url}")
        self.log("")
        
        results = {
            "test_start_time": time.strftime('%Y-%m-%d %H:%M:%S'),
            "task1_api_service_deleted": {},
            "task2_api_versioning": {},
            "overall_success": False,
            "errors": []
        }
        
        try:
            # TASK 1: Verify api-service directory deleted
            self.log("="*50)
            self.log("TASK 1: Verify api-service directory deleted")
            self.log("="*50)
            results["task1_api_service_deleted"] = self.test_api_service_directory_deleted()
            
            self.log("")
            
            # TASK 2: Verify API versioning (backward compatible)
            self.log("="*50)
            self.log("TASK 2: Verify API versioning (backward compatible)")
            self.log("="*50)
            results["task2_api_versioning"] = self.test_api_versioning()
            
            # Overall success assessment
            task1_success = all([
                results["task1_api_service_deleted"].get("directory_not_exists", False),
                results["task1_api_service_deleted"].get("no_typescript_imports", False),
                results["task1_api_service_deleted"].get("backend_healthy", False)
            ])
            
            task2_success = all([
                results["task2_api_versioning"].get("api_root_returns_v1", False),
                results["task2_api_versioning"].get("api_v1_identical", False),
                results["task2_api_versioning"].get("login_api_works", False),
                results["task2_api_versioning"].get("login_v1_works", False),
                results["task2_api_versioning"].get("docs_accessible", False),
                results["task2_api_versioning"].get("docs_json_has_v1", False)
            ])
            
            results["task1_success"] = task1_success
            results["task2_success"] = task2_success
            results["overall_success"] = task1_success and task2_success
            
        except Exception as e:
            error_msg = f"Test suite failed with exception: {e}"
            self.log(f"❌ {error_msg}")
            results["errors"].append(error_msg)
        
        return results
    
    def print_summary(self, results: Dict[str, Any]):
        """Print test summary"""
        self.log("\n" + "="*60)
        self.log("📊 DYNOPAY P2 CHANGES TEST SUMMARY")
        self.log("="*60)
        
        test_status = "✅ PASSED" if results["overall_success"] else "❌ FAILED"
        self.log(f"Overall Status: {test_status}")
        
        # TASK 1 Results
        task1 = results["task1_api_service_deleted"]
        task1_success = results.get("task1_success", False)
        self.log(f"\nTASK 1 - API Service Directory Deleted: {'✅ PASSED' if task1_success else '❌ FAILED'}")
        self.log(f"  1. Directory does NOT exist: {'✅' if task1.get('directory_not_exists') else '❌'}")
        self.log(f"  2. No TypeScript imports: {'✅' if task1.get('no_typescript_imports') else '❌'}")
        self.log(f"  3. Backend healthy (GET /health): {'✅' if task1.get('backend_healthy') else '❌'}")
        
        # TASK 2 Results
        task2 = results["task2_api_versioning"]
        task2_success = results.get("task2_success", False)
        self.log(f"\nTASK 2 - API Versioning (Backward Compatible): {'✅ PASSED' if task2_success else '❌ FAILED'}")
        self.log(f"  1. GET /api returns JSON with api_version='v1': {'✅' if task2.get('api_root_returns_v1') else '❌'}")
        self.log(f"  2. GET /api/v1 identical to GET /api: {'✅' if task2.get('api_v1_identical') else '❌'}")
        self.log(f"  3. POST /api/user/login works: {'✅' if task2.get('login_api_works') else '❌'}")
        self.log(f"  4. POST /api/v1/user/login works: {'✅' if task2.get('login_v1_works') else '❌'}")
        self.log(f"  5. GET /api/docs accessible: {'✅' if task2.get('docs_accessible') else '❌'}")
        self.log(f"  6. GET /api/docs.json has 'v1': {'✅' if task2.get('docs_json_has_v1') else '❌'}")
        
        # Show API responses if available
        if task2.get('api_root_response'):
            api_resp = task2['api_root_response']
            self.log(f"\nAPI Root Response Preview:")
            self.log(f"  api_version: {api_resp.get('api_version')}")
            if api_resp.get('versioning'):
                versioning_keys = list(api_resp['versioning'].keys()) if isinstance(api_resp['versioning'], dict) else []
                self.log(f"  versioning keys: {versioning_keys}")
        
        if results.get("errors"):
            self.log(f"\nErrors Encountered:")
            for error in results["errors"]:
                self.log(f"  ❌ {error}")
        
        self.log("\n" + "="*60)

def main():
    # Test configuration from review request
    BASE_URL = "https://init-stack.preview.emergentagent.com"
    EMAIL = "richard@dyno.pt"
    PASSWORD = "Katiekendra123@"
    
    print("🧪 DynoPay Webhook URL Bug Fix Testing")
    print(f"Testing the webhook_url bug fix implementation...")
    print(f"Target: {BASE_URL}")
    print()
    
    tester = DynoPayTester(BASE_URL, EMAIL, PASSWORD)
    results = tester.run_comprehensive_test()
    tester.print_summary(results)
    
    # Return appropriate exit code
    sys.exit(0 if results["overall_success"] else 1)

if __name__ == "__main__":
    main()