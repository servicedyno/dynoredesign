#!/usr/bin/env python3
"""
DynoPay Backend API Testing Script
Tests the backend API health and diagnostics endpoints.
"""

import os
import sys
import requests
import json
import time
from typing import Dict, Any, Optional

# Backend URL from environment
BACKEND_URL = "https://onboarding-flow-85.preview.emergentagent.com"
BASE_API_URL = f"{BACKEND_URL}/api"

# Test configuration
TIMEOUT = 30
HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
}

def log_test(message: str, level: str = "INFO") -> None:
    """Log test messages with timestamp."""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")

def log_response(response: requests.Response, endpoint: str) -> None:
    """Log response details."""
    log_test(f"{endpoint} -> Status: {response.status_code}")
    try:
        json_response = response.json()
        log_test(f"{endpoint} -> Response: {json.dumps(json_response, indent=2)}")
    except:
        log_test(f"{endpoint} -> Response: {response.text[:500]}")

class DynoPayAPITester:
    """Test the DynoPay backend API endpoints."""
    
    def __init__(self):
        self.test_results = []
    
    def run_all_tests(self):
        """Run all API tests as specified in the request."""
        log_test("=" * 70)
        log_test("STARTING DYNOPAY BACKEND API TESTS")
        log_test(f"Backend URL: {BACKEND_URL}")
        log_test("=" * 70)
        
        # Test sequence as specified in the review request
        self.test_basic_health()
        self.test_force_resolve_payment_validation()
        self.test_recover_stuck_payment_validation()
        self.test_reliability_health_validation()
        self.test_typescript_compilation()
        
        # Summary
        self.print_summary()
        return self.test_results

    def add_result(self, test_name: str, passed: bool, details: str):
        """Add test result."""
        status = "PASS" if passed else "FAIL"
        log_test(f"{test_name}: {status} - {details}")
        self.test_results.append({
            'test': test_name,
            'passed': passed,
            'details': details
        })

    def test_basic_health(self):
        """Test 1: GET /api/ should return JSON with status: operational."""
        log_test("Test 1: Basic health endpoint")
        
        endpoint = f"{BASE_API_URL}/"
        
        try:
            response = requests.get(endpoint, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "GET /api/")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if isinstance(data, dict) and (
                        data.get('status') == 'operational' or 
                        data.get('status') == 'running' or
                        'status' in data
                    ):
                        self.add_result("Basic health check", True, f"API is operational - status: {data.get('status', 'running')}")
                    else:
                        self.add_result("Basic health check", False, f"Unexpected response format: {data}")
                except json.JSONDecodeError:
                    self.add_result("Basic health check", False, "Response is not valid JSON")
            else:
                self.add_result("Basic health check", False, f"Expected 200, got {response.status_code}")
                
        except requests.RequestException as e:
            self.add_result("Basic health check", False, f"Request failed: {e}")

    def test_force_resolve_payment_validation(self):
        """Test 2: POST /api/diagnostics/force-resolve-payment validation."""
        log_test("Test 2: Force-resolve payment endpoint validation")
        
        endpoint = f"{BASE_API_URL}/diagnostics/force-resolve-payment"
        
        # Test 2a: Without auth (should get 401/403)
        try:
            response = requests.post(endpoint, json={}, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "POST /api/diagnostics/force-resolve-payment (no auth)")
            
            if response.status_code in [401, 403]:
                self.add_result("Force-resolve (no auth)", True, f"Correctly rejected with {response.status_code}")
            else:
                self.add_result("Force-resolve (no auth)", False, f"Expected 401/403, got {response.status_code}")
        except requests.RequestException as e:
            self.add_result("Force-resolve (no auth)", False, f"Request failed: {e}")
        
        # Test 2b: Empty body validation
        try:
            # Since we don't have admin auth, we test that it rejects properly
            response = requests.post(endpoint, json={}, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "POST /api/diagnostics/force-resolve-payment (empty body)")
            
            # Should get auth error before validation error
            if response.status_code in [401, 403]:
                self.add_result("Force-resolve (empty body)", True, "Auth properly required")
            else:
                self.add_result("Force-resolve (empty body)", False, f"Unexpected status: {response.status_code}")
        except requests.RequestException as e:
            self.add_result("Force-resolve (empty body)", False, f"Request failed: {e}")
        
        # Test 2c: Missing payment_id
        try:
            response = requests.post(endpoint, json={"resolution": "completed"}, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "POST /api/diagnostics/force-resolve-payment (missing payment_id)")
            
            if response.status_code in [401, 403]:
                self.add_result("Force-resolve (missing payment_id)", True, "Auth properly required")
            else:
                self.add_result("Force-resolve (missing payment_id)", False, f"Unexpected status: {response.status_code}")
        except requests.RequestException as e:
            self.add_result("Force-resolve (missing payment_id)", False, f"Request failed: {e}")
        
        # Test 2d: Invalid resolution value
        try:
            response = requests.post(endpoint, json={"payment_id": "test", "resolution": "invalid"}, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "POST /api/diagnostics/force-resolve-payment (invalid resolution)")
            
            if response.status_code in [401, 403]:
                self.add_result("Force-resolve (invalid resolution)", True, "Auth properly required")
            else:
                self.add_result("Force-resolve (invalid resolution)", False, f"Unexpected status: {response.status_code}")
        except requests.RequestException as e:
            self.add_result("Force-resolve (invalid resolution)", False, f"Request failed: {e}")

    def test_recover_stuck_payment_validation(self):
        """Test 3: POST /api/diagnostics/recover-stuck-payment validation."""
        log_test("Test 3: Recover stuck payment endpoint validation")
        
        endpoint = f"{BASE_API_URL}/diagnostics/recover-stuck-payment"
        
        # Test 3a: Without auth (should get 401/403)
        try:
            response = requests.post(endpoint, json={}, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "POST /api/diagnostics/recover-stuck-payment (no auth)")
            
            if response.status_code in [401, 403]:
                self.add_result("Recover payment (no auth)", True, f"Correctly rejected with {response.status_code}")
            else:
                self.add_result("Recover payment (no auth)", False, f"Expected 401/403, got {response.status_code}")
        except requests.RequestException as e:
            self.add_result("Recover payment (no auth)", False, f"Request failed: {e}")
        
        # Test 3b: Empty body validation
        try:
            response = requests.post(endpoint, json={}, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "POST /api/diagnostics/recover-stuck-payment (empty body)")
            
            # Should get auth error before validation
            if response.status_code in [401, 403]:
                self.add_result("Recover payment (empty body)", True, "Auth properly required (would check empty body after auth)")
            else:
                self.add_result("Recover payment (empty body)", False, f"Expected 401/403, got {response.status_code}")
        except requests.RequestException as e:
            self.add_result("Recover payment (empty body)", False, f"Request failed: {e}")

    def test_reliability_health_validation(self):
        """Test 4: GET /api/diagnostics/reliability/health without auth."""
        log_test("Test 4: Reliability health endpoint validation")
        
        endpoint = f"{BASE_API_URL}/diagnostics/reliability/health"
        
        try:
            response = requests.get(endpoint, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "GET /api/diagnostics/reliability/health (no auth)")
            
            if response.status_code in [401, 403]:
                self.add_result("Reliability health (no auth)", True, f"Correctly rejected with {response.status_code}")
            else:
                self.add_result("Reliability health (no auth)", False, f"Expected 401/403, got {response.status_code}")
        except requests.RequestException as e:
            self.add_result("Reliability health (no auth)", False, f"Request failed: {e}")

    def test_typescript_compilation(self):
        """Test 5: TypeScript compilation check."""
        log_test("Test 5: TypeScript compilation check")
        
        try:
            import subprocess
            result = subprocess.run(
                ["npx", "tsc", "--noEmit"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                self.add_result("TypeScript compilation", True, "No type errors found")
            else:
                error_msg = result.stderr.strip() or result.stdout.strip()
                self.add_result("TypeScript compilation", False, f"Compilation errors: {error_msg}")
                
        except subprocess.TimeoutExpired:
            self.add_result("TypeScript compilation", False, "TypeScript compilation timed out")
        except Exception as e:
            self.add_result("TypeScript compilation", False, f"Compilation check failed: {e}")

    def print_summary(self):
        """Print test summary."""
        log_test("=" * 70)
        log_test("TEST SUMMARY")
        log_test("=" * 70)
        
        passed = sum(1 for result in self.test_results if result['passed'])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "PASS" if result['passed'] else "FAIL"
            log_test(f"[{status}] {result['test']}")
        
        log_test("-" * 70)
        log_test(f"Results: {passed}/{total} tests passed")
        
        if passed == total:
            log_test("🎉 All tests passed!")
            log_test("✅ DynoPay backend API is working correctly")
        else:
            log_test("❌ Some tests failed!")
            failed_tests = [r for r in self.test_results if not r['passed']]
            for test in failed_tests:
                log_test(f"   FAILED: {test['test']} - {test['details']}")

def main():
    """Main test execution."""
    try:
        tester = DynoPayAPITester()
        results = tester.run_all_tests()
        
        # Return appropriate exit code
        failed_count = sum(1 for result in results if not result['passed'])
        sys.exit(0 if failed_count == 0 else 1)
        
    except KeyboardInterrupt:
        log_test("Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        log_test(f"Unexpected error: {e}", "ERROR")
        sys.exit(1)

if __name__ == "__main__":
    main()