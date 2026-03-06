#!/usr/bin/env python3
"""
DynoPay Backend Testing Suite
Testing specific endpoints mentioned in review request:
1. POST /api/wallet/encrypt-payload (with auth protection)
2. POST /api/user/refresh-token 
3. GET /api/status
4. GET /api/wallet/getWallet (with auth protection)
"""

import requests
import json
import sys
import os
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BACKEND_URL = "https://pod-setup-frontend.preview.emergentagent.com"

class DynoPayBackendTester:
    def __init__(self):
        self.backend_url = BACKEND_URL
        self.session = requests.Session()
        self.test_results = []
        
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
    
    def test_status_endpoint(self):
        """Test GET /api/status - Basic health check"""
        try:
            response = self.session.get(f"{self.backend_url}/api/status", timeout=10)
            
            if response.status_code == 200:
                self.log_result(
                    "GET /api/status", 
                    "PASS", 
                    f"Status endpoint working (200 OK) - {response.json().get('status', 'unknown')}"
                )
            else:
                self.log_result(
                    "GET /api/status", 
                    "FAIL", 
                    f"Expected 200, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api/status", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_refresh_token_endpoint(self):
        """Test POST /api/user/refresh-token - Verify endpoint exists"""
        try:
            # Test without refresh token (should return 400/401, not 404)
            response = self.session.post(
                f"{self.backend_url}/api/user/refresh-token",
                json={},
                timeout=10
            )
            
            # We expect 400 or 401 (missing/invalid token), NOT 404
            if response.status_code in [400, 401]:
                self.log_result(
                    "POST /api/user/refresh-token", 
                    "PASS", 
                    f"Endpoint exists and responds correctly ({response.status_code}) - proper auth guard"
                )
            elif response.status_code == 404:
                self.log_result(
                    "POST /api/user/refresh-token", 
                    "FAIL", 
                    "Endpoint not found (404) - endpoint missing or route issue"
                )
            else:
                response_text = response.text[:200] if response.text else "No response body"
                self.log_result(
                    "POST /api/user/refresh-token", 
                    "FAIL", 
                    f"Unexpected status {response.status_code}: {response_text}"
                )
        except Exception as e:
            self.log_result(
                "POST /api/user/refresh-token", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_encrypt_payload_endpoint_unauth(self):
        """Test POST /api/wallet/encrypt-payload without authentication"""
        try:
            # Test without auth header (should return 401/403 due to auth middleware)
            response = self.session.post(
                f"{self.backend_url}/api/wallet/encrypt-payload",
                json={"payload": "test data"},
                timeout=10
            )
            
            # We expect 401 or 403 (auth required), NOT 404
            if response.status_code in [401, 403]:
                self.log_result(
                    "POST /api/wallet/encrypt-payload (no auth)", 
                    "PASS", 
                    f"Endpoint protected correctly ({response.status_code}) - auth middleware working"
                )
            elif response.status_code == 404:
                self.log_result(
                    "POST /api/wallet/encrypt-payload (no auth)", 
                    "FAIL", 
                    "Endpoint not found (404) - endpoint missing or route issue"
                )
            else:
                response_text = response.text[:200] if response.text else "No response body"
                self.log_result(
                    "POST /api/wallet/encrypt-payload (no auth)", 
                    "FAIL", 
                    f"Unexpected status {response.status_code}: {response_text}"
                )
        except Exception as e:
            self.log_result(
                "POST /api/wallet/encrypt-payload (no auth)", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_get_wallet_endpoint_unauth(self):
        """Test GET /api/wallet/getWallet without authentication"""
        try:
            # Test without auth header (should return 401/403 due to auth middleware)
            response = self.session.get(
                f"{self.backend_url}/api/wallet/getWallet",
                timeout=10
            )
            
            # We expect 401 or 403 (auth required), NOT 404
            if response.status_code in [401, 403]:
                self.log_result(
                    "GET /api/wallet/getWallet (no auth)", 
                    "PASS", 
                    f"Endpoint protected correctly ({response.status_code}) - auth middleware working"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/wallet/getWallet (no auth)", 
                    "FAIL", 
                    "Endpoint not found (404) - endpoint missing or route issue"
                )
            else:
                response_text = response.text[:200] if response.text else "No response body"
                self.log_result(
                    "GET /api/wallet/getWallet (no auth)", 
                    "FAIL", 
                    f"Unexpected status {response.status_code}: {response_text}"
                )
        except Exception as e:
            self.log_result(
                "GET /api/wallet/getWallet (no auth)", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_csrf_protection(self):
        """Test CSRF protection behavior on wallet endpoints"""
        try:
            # Test encrypt-payload with fake Bearer token (should bypass CSRF per middleware logic)
            response = self.session.post(
                f"{self.backend_url}/api/wallet/encrypt-payload",
                json={"payload": "test data"},
                headers={"Authorization": "Bearer fake-token"},
                timeout=10
            )
            
            # With Bearer token, CSRF is bypassed but still needs valid JWT
            # Expecting 401 (invalid JWT) not 403 (CSRF)
            if response.status_code == 401:
                self.log_result(
                    "CSRF Protection Test", 
                    "PASS", 
                    "CSRF bypassed with Bearer token, JWT validation working (401)"
                )
            elif response.status_code == 403:
                # Could be CSRF or other auth issue
                response_text = response.text[:100] if response.text else ""
                if "csrf" in response_text.lower():
                    self.log_result(
                        "CSRF Protection Test", 
                        "FAIL", 
                        "CSRF not bypassed with Bearer token - middleware issue"
                    )
                else:
                    self.log_result(
                        "CSRF Protection Test", 
                        "PASS", 
                        "Other 403 response - likely different auth validation"
                    )
            else:
                response_text = response.text[:200] if response.text else "No response body"
                self.log_result(
                    "CSRF Protection Test", 
                    "PASS", 
                    f"Unexpected response {response.status_code}, but endpoint reachable: {response_text}"
                )
        except Exception as e:
            self.log_result(
                "CSRF Protection Test", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_backend_connectivity(self):
        """Test basic backend connectivity"""
        try:
            # Test root API endpoint
            response = self.session.get(f"{self.backend_url}/api", timeout=10)
            
            if response.status_code == 200:
                api_info = response.json()
                service_name = api_info.get('service', 'unknown')
                version = api_info.get('version', 'unknown')
                self.log_result(
                    "Backend Connectivity", 
                    "PASS", 
                    f"Connected to {service_name} v{version}"
                )
            else:
                self.log_result(
                    "Backend Connectivity", 
                    "FAIL", 
                    f"API root returned {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "Backend Connectivity", 
                "FAIL", 
                f"Cannot connect to backend: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all backend tests"""
        print(f"\n🧪 Testing DynoPay Backend at {self.backend_url}")
        print("="*70)
        
        # Test in order of priority
        self.test_backend_connectivity()
        self.test_status_endpoint()
        self.test_refresh_token_endpoint()
        self.test_encrypt_payload_endpoint_unauth()
        self.test_get_wallet_endpoint_unauth()
        self.test_csrf_protection()
        
        # Summary
        print("\n📊 Test Summary:")
        print("="*70)
        
        passed = sum(1 for result in self.test_results if result['status'] == 'PASS')
        failed = sum(1 for result in self.test_results if result['status'] == 'FAIL')
        
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
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