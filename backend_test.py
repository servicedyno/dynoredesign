#!/usr/bin/env python3
"""
DynoPay Backend Testing Script
Tests the trial payment link system endpoints.
"""

import os
import sys
import requests
import json
import time
from typing import Dict, Any, Optional

# Backend URL from environment
BACKEND_URL = "https://setup-wizard-127.preview.emergentagent.com"
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

class TrialLinkTester:
    """Test the trial payment link system."""
    
    def __init__(self):
        self.test_results = []
        self.created_slug = None
        self.claim_token = None
    
    def run_all_tests(self):
        """Run all trial link tests."""
        log_test("=" * 60)
        log_test("STARTING DYNOPAY TRIAL PAYMENT LINK TESTS")
        log_test(f"Backend URL: {BACKEND_URL}")
        log_test("=" * 60)
        
        # Test sequence as specified in the request
        self.test_create_trial_link_valid()
        self.test_create_trial_link_validation()
        self.test_get_trial_link_valid()
        self.test_get_trial_link_invalid()
        self.test_list_trial_links()
        self.test_claim_funds_wrong_token()
        self.test_status_endpoint()
        
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

    def test_create_trial_link_valid(self):
        """Test 1: POST /api/public/create-trial-link with valid data."""
        log_test("Test 1: Create trial link with valid data")
        
        endpoint = f"{BASE_API_URL}/public/create-trial-link"
        payload = {
            "amount": 42,
            "currency": "USD", 
            "description": "Test payment"
        }
        
        try:
            response = requests.post(endpoint, json=payload, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "POST /api/public/create-trial-link")
            
            if response.status_code == 201:
                data = response.json().get('data', {})
                required_fields = ['id', 'slug', 'link_url', 'amount', 'currency', 'claim_token', 'expires_at', 'accepted_currencies', 'status']
                
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    # Store for subsequent tests
                    self.created_slug = data.get('slug')
                    self.claim_token = data.get('claim_token')
                    
                    # Verify data values
                    if (data.get('amount') == 42 and 
                        data.get('currency') == 'USD' and 
                        data.get('status') == 'active' and
                        isinstance(data.get('accepted_currencies'), list)):
                        self.add_result("Create trial link", True, f"Successfully created with slug: {self.created_slug}")
                    else:
                        self.add_result("Create trial link", False, "Data values don't match expected")
                else:
                    self.add_result("Create trial link", False, f"Missing required fields: {missing_fields}")
            else:
                self.add_result("Create trial link", False, f"Expected 201, got {response.status_code}")
                
        except requests.RequestException as e:
            self.add_result("Create trial link", False, f"Request failed: {e}")

    def test_create_trial_link_validation(self):
        """Test validation rules for create-trial-link."""
        log_test("Test 2: Create trial link validation tests")
        
        endpoint = f"{BASE_API_URL}/public/create-trial-link"
        
        # Test cases: amount < 5, amount > 500, missing amount
        test_cases = [
            ({"amount": 3, "currency": "USD"}, 400, "amount < 5"),
            ({"amount": 600, "currency": "USD"}, 400, "amount > 500"), 
            ({"currency": "USD"}, 400, "missing amount")
        ]
        
        validation_passed = True
        for payload, expected_status, description in test_cases:
            try:
                response = requests.post(endpoint, json=payload, headers=HEADERS, timeout=TIMEOUT)
                log_test(f"Validation test ({description}): Status {response.status_code}")
                
                if response.status_code != expected_status:
                    validation_passed = False
                    log_test(f"FAIL: Expected {expected_status}, got {response.status_code} for {description}")
                    
            except requests.RequestException as e:
                validation_passed = False
                log_test(f"FAIL: Request error for {description}: {e}")
        
        self.add_result("Create trial link validation", validation_passed, 
                       "All validation rules working correctly" if validation_passed else "Some validation rules failed")

    def test_get_trial_link_valid(self):
        """Test 3: GET /api/public/trial/:slug with valid slug."""
        log_test("Test 3: Get trial link with valid slug")
        
        if not self.created_slug:
            self.add_result("Get trial link (valid)", False, "No slug available from create test")
            return
            
        endpoint = f"{BASE_API_URL}/public/trial/{self.created_slug}"
        
        try:
            response = requests.get(endpoint, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, f"GET /api/public/trial/{self.created_slug}")
            
            if response.status_code == 200:
                data = response.json().get('data', {})
                
                # Check required fields and flags
                expected_fields = ['id', 'slug', 'amount', 'fiat_currency', 'status', 'accepted_currencies', 'is_expired', 'is_paid', 'is_claimed']
                missing_fields = [field for field in expected_fields if field not in data]
                
                if not missing_fields:
                    if (data.get('is_expired') == False and 
                        data.get('is_paid') == False and 
                        data.get('is_claimed') == False and
                        data.get('slug') == self.created_slug):
                        self.add_result("Get trial link (valid)", True, "All expected fields and flags present")
                    else:
                        self.add_result("Get trial link (valid)", False, "Flag values incorrect")
                else:
                    self.add_result("Get trial link (valid)", False, f"Missing fields: {missing_fields}")
            else:
                self.add_result("Get trial link (valid)", False, f"Expected 200, got {response.status_code}")
                
        except requests.RequestException as e:
            self.add_result("Get trial link (valid)", False, f"Request failed: {e}")

    def test_get_trial_link_invalid(self):
        """Test 4: GET /api/public/trial/nonexistent-slug."""
        log_test("Test 4: Get trial link with invalid slug")
        
        endpoint = f"{BASE_API_URL}/public/trial/nonexistent-slug"
        
        try:
            response = requests.get(endpoint, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "GET /api/public/trial/nonexistent-slug")
            
            if response.status_code == 404:
                self.add_result("Get trial link (invalid)", True, "Correctly returned 404 for nonexistent slug")
            else:
                self.add_result("Get trial link (invalid)", False, f"Expected 404, got {response.status_code}")
                
        except requests.RequestException as e:
            self.add_result("Get trial link (invalid)", False, f"Request failed: {e}")

    def test_list_trial_links(self):
        """Test 5: GET /api/public/trial-links."""
        log_test("Test 5: List trial links")
        
        endpoint = f"{BASE_API_URL}/public/trial-links"
        
        try:
            response = requests.get(endpoint, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "GET /api/public/trial-links")
            
            if response.status_code == 200:
                data = response.json().get('data')
                if isinstance(data, list):
                    self.add_result("List trial links", True, f"Successfully returned array with {len(data)} links")
                else:
                    self.add_result("List trial links", False, "Response data is not an array")
            else:
                self.add_result("List trial links", False, f"Expected 200, got {response.status_code}")
                
        except requests.RequestException as e:
            self.add_result("List trial links", False, f"Request failed: {e}")

    def test_claim_funds_wrong_token(self):
        """Test 6: POST /api/public/claim-funds with wrong token."""
        log_test("Test 6: Claim funds with wrong token")
        
        if not self.created_slug:
            self.add_result("Claim funds (wrong token)", False, "No slug available from create test")
            return
            
        endpoint = f"{BASE_API_URL}/public/claim-funds"
        payload = {
            "slug": self.created_slug,
            "claim_token": "wrong-token",
            "email": "test@test.com",
            "password": "testpass123"
        }
        
        try:
            response = requests.post(endpoint, json=payload, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "POST /api/public/claim-funds")
            
            if response.status_code == 400:
                # Check if it's because payment not received (status is "active")
                response_data = response.json()
                message = response_data.get('message', '').lower()
                if 'payment' in message and 'not' in message and 'received' in message:
                    self.add_result("Claim funds (wrong token)", True, "Correctly rejected - payment not received yet")
                elif 'invalid' in message and 'token' in message:
                    # This would mean it checked token first, which is also valid
                    self.add_result("Claim funds (wrong token)", True, "Correctly rejected - invalid token")
                else:
                    self.add_result("Claim funds (wrong token)", True, f"Rejected with 400: {message}")
            else:
                self.add_result("Claim funds (wrong token)", False, f"Expected 400, got {response.status_code}")
                
        except requests.RequestException as e:
            self.add_result("Claim funds (wrong token)", False, f"Request failed: {e}")

    def test_status_endpoint(self):
        """Test 7: GET /api/status."""
        log_test("Test 7: Status endpoint")
        
        endpoint = f"{BASE_API_URL}/status"
        
        try:
            response = requests.get(endpoint, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "GET /api/status")
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data or 'overall_status' in data or 'status' in data:
                    self.add_result("Status endpoint", True, "Status endpoint operational")
                else:
                    self.add_result("Status endpoint", True, "Status endpoint returned 200 (assuming operational)")
            else:
                self.add_result("Status endpoint", False, f"Expected 200, got {response.status_code}")
                
        except requests.RequestException as e:
            self.add_result("Status endpoint", False, f"Request failed: {e}")

    def print_summary(self):
        """Print test summary."""
        log_test("=" * 60)
        log_test("TEST SUMMARY")
        log_test("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['passed'])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "PASS" if result['passed'] else "FAIL"
            log_test(f"[{status}] {result['test']}")
        
        log_test("-" * 60)
        log_test(f"Results: {passed}/{total} tests passed")
        
        if passed == total:
            log_test("🎉 All tests passed!")
        else:
            log_test("❌ Some tests failed!")
            failed_tests = [r for r in self.test_results if not r['passed']]
            for test in failed_tests:
                log_test(f"   FAILED: {test['test']} - {test['details']}")

def main():
    """Main test execution."""
    try:
        tester = TrialLinkTester()
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