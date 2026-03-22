#!/usr/bin/env python3
"""
DynoPay Backend API Testing Script
Tests the trial payment link creation endpoints as requested.
"""

import os
import sys
import requests
import json
import time
from typing import Dict, Any, Optional

# Backend URL from environment
BACKEND_URL = "https://initial-config-19.preview.emergentagent.com"
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
        self.trial_slug = None  # Store slug from first test for reuse
    
    def run_all_tests(self):
        """Run all API tests as specified in the request."""
        log_test("=" * 70)
        log_test("STARTING DYNOPAY TRIAL PAYMENT LINK TESTS")
        log_test(f"Backend URL: {BACKEND_URL}")
        log_test("=" * 70)
        
        # Test sequence as specified in the review request
        self.test_create_trial_link()
        self.test_get_trial_link()
        self.test_create_trial_link_reuse_email()
        
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

    def test_create_trial_link(self):
        """Test 1: POST /api/public/create-trial-link with body: {"amount": "10", "currency": "USD", "email": "test-trial-xyz123@mailinator.com"}"""
        log_test("Test 1: Create trial payment link")
        
        endpoint = f"{BASE_API_URL}/public/create-trial-link"
        payload = {
            "amount": "10",
            "currency": "USD", 
            "email": "test-trial-xyz123@mailinator.com"
        }
        
        try:
            response = requests.post(endpoint, json=payload, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "POST /api/public/create-trial-link")
            
            if response.status_code == 201:
                try:
                    data = response.json()
                    
                    # Check required fields in response
                    required_fields = ['checkout_url', 'slug', 'accepted_currencies', 'manage_url']
                    missing_fields = [field for field in required_fields if field not in data.get('data', {})]
                    
                    if missing_fields:
                        self.add_result("Create trial link", False, f"Missing required fields: {missing_fields}")
                        return
                    
                    response_data = data.get('data', {})
                    
                    # Validate checkout_url contains /pay?d=
                    checkout_url = response_data.get('checkout_url', '')
                    if '/pay?d=' not in checkout_url:
                        self.add_result("Create trial link", False, f"checkout_url doesn't contain /pay?d=: {checkout_url}")
                        return
                    
                    # Validate accepted_currencies is ["BTC"]
                    accepted_currencies = response_data.get('accepted_currencies', [])
                    if accepted_currencies != ["BTC"]:
                        self.add_result("Create trial link", False, f"Expected accepted_currencies=['BTC'], got {accepted_currencies}")
                        return
                    
                    # Store slug for next test
                    self.trial_slug = response_data.get('slug')
                    if not self.trial_slug:
                        self.add_result("Create trial link", False, "No slug returned in response")
                        return
                    
                    # Validate manage_url exists
                    manage_url = response_data.get('manage_url', '')
                    if not manage_url:
                        self.add_result("Create trial link", False, "No manage_url returned in response")
                        return
                    
                    self.add_result("Create trial link", True, f"Successfully created trial link with slug: {self.trial_slug}")
                    
                except json.JSONDecodeError:
                    self.add_result("Create trial link", False, "Response is not valid JSON")
            else:
                self.add_result("Create trial link", False, f"Expected 201, got {response.status_code}")
                
        except requests.RequestException as e:
            self.add_result("Create trial link", False, f"Request failed: {e}")

    def test_get_trial_link(self):
        """Test 2: GET /api/public/trial/{slug} using slug from step 1"""
        log_test("Test 2: Get trial link details")
        
        if not self.trial_slug:
            self.add_result("Get trial link", False, "No slug available from previous test")
            return
        
        endpoint = f"{BASE_API_URL}/public/trial/{self.trial_slug}"
        
        try:
            response = requests.get(endpoint, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, f"GET /api/public/trial/{self.trial_slug}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    response_data = data.get('data', {})
                    
                    # Check that checkout_url is non-null
                    checkout_url = response_data.get('checkout_url')
                    if checkout_url is None:
                        self.add_result("Get trial link", False, "checkout_url is null in response")
                        return
                    
                    # Validate checkout_url contains /pay?d=
                    if '/pay?d=' not in checkout_url:
                        self.add_result("Get trial link", False, f"checkout_url doesn't contain /pay?d=: {checkout_url}")
                        return
                    
                    self.add_result("Get trial link", True, f"Successfully retrieved trial link with checkout_url: {checkout_url}")
                    
                except json.JSONDecodeError:
                    self.add_result("Get trial link", False, "Response is not valid JSON")
            else:
                self.add_result("Get trial link", False, f"Expected 200, got {response.status_code}")
                
        except requests.RequestException as e:
            self.add_result("Get trial link", False, f"Request failed: {e}")

    def test_create_trial_link_reuse_email(self):
        """Test 3: POST /api/public/create-trial-link with same email to test reuse"""
        log_test("Test 3: Create trial link with same email (test reuse)")
        
        endpoint = f"{BASE_API_URL}/public/create-trial-link"
        payload = {
            "amount": "15",
            "currency": "USD", 
            "email": "test-trial-xyz123@mailinator.com"
        }
        
        try:
            response = requests.post(endpoint, json=payload, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "POST /api/public/create-trial-link (reuse email)")
            
            if response.status_code == 201:
                try:
                    data = response.json()
                    response_data = data.get('data', {})
                    
                    # Should successfully reuse the provisional user
                    if 'slug' in response_data and 'checkout_url' in response_data:
                        self.add_result("Create trial link (reuse email)", True, "Successfully reused provisional user for same email")
                    else:
                        self.add_result("Create trial link (reuse email)", False, "Missing required fields in reuse response")
                    
                except json.JSONDecodeError:
                    self.add_result("Create trial link (reuse email)", False, "Response is not valid JSON")
            else:
                self.add_result("Create trial link (reuse email)", False, f"Expected 201, got {response.status_code} - should reuse provisional user, not error")
                
        except requests.RequestException as e:
            self.add_result("Create trial link (reuse email)", False, f"Request failed: {e}")

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
            log_test("✅ DynoPay trial payment link API is working correctly")
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