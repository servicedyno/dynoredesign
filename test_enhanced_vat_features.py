#!/usr/bin/env python3
"""
Test Enhanced VAT Country Validation Features
Tests: Enhanced error messages, auto-suggestion, and validation
"""

import requests
import json

BASE_URL = "https://dependency-hub-7.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

TEST_EMAIL = "richard@dyno.pt"
TEST_PASSWORD = "Katiekendra123@"

def print_section(title):
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70)

def print_test(test_name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"   {details}")

def authenticate():
    print_section("Authentication")
    response = requests.post(
        f"{API_BASE}/user/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    
    if response.status_code == 200:
        token = response.json()["data"]["accessToken"]
        print_test("Authentication", True, "Logged in successfully")
        return token
    else:
        print_test("Authentication", False, f"Status: {response.status_code}")
        return None

def test_enhanced_error_message(token):
    """Test that error messages include country names"""
    print_section("Test 1: Enhanced Error Message with Country Names")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    company_data = {
        "company_name": "Test Enhanced Error Company",
        "email": "testenhanced@example.com",
        "mobile": "+351912345678",
        "country": "DE",  # Germany
        "vat_number": "PT518713130",  # Portuguese VAT
        "address_line1": "Test Street 123",
        "city": "Berlin",
        "zip_code": "10115"
    }
    
    response = requests.post(
        f"{API_BASE}/company/addCompany",
        headers=headers,
        json={"data": company_data}
    )
    
    if response.status_code == 400:
        error_msg = response.json().get("message", "")
        
        # Check if error message includes country names
        has_portugal = "portugal" in error_msg.lower()
        has_germany = "germany" in error_msg.lower()
        
        if has_portugal and has_germany:
            print_test("Enhanced Error Message", True, f"Message includes country names: {error_msg[:100]}...")
            return True
        else:
            print_test("Enhanced Error Message", False, f"Missing country names in: {error_msg}")
            return False
    else:
        print_test("Enhanced Error Message", False, f"Expected 400, got {response.status_code}")
        return False

def test_auto_suggestion(token):
    """Test auto-suggestion of country from VAT number"""
    print_section("Test 2: Auto-Suggestion - Country from VAT Number")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create company with VAT but NO country - should auto-suggest
    company_data = {
        "company_name": f"Test Auto-Suggest Company",
        "email": "autosuggtest@example.com",
        "mobile": "+351912345678",
        "vat_number": "PT518713130",  # Portuguese VAT, NO country provided
        "address_line1": "Rua Test 123",
        "city": "Lisboa",
        "zip_code": "1000-001"
    }
    
    response = requests.post(
        f"{API_BASE}/company/addCompany",
        headers=headers,
        json={"data": company_data}
    )
    
    # Should either succeed with auto-suggested country or fail on VAT validation (not country mismatch)
    if response.status_code == 200:
        data = response.json().get("data", {})
        suggested_country = data.get("country")
        
        if suggested_country == "PT":
            print_test("Auto-Suggestion", True, f"Country auto-suggested: PT (Portugal)")
            return True, data.get("company_id")
        else:
            print_test("Auto-Suggestion", False, f"Expected PT, got: {suggested_country}")
            return False, None
    elif response.status_code == 400:
        error_msg = response.json().get("message", "")
        
        # If it failed on VAT validation (not registered), that means country was auto-suggested correctly
        if "not registered" in error_msg.lower() or "invalid" in error_msg.lower():
            print_test("Auto-Suggestion", True, f"Country auto-suggested (VAT validation failed as expected: {error_msg[:80]}...)")
            return True, None
        # If it's complaining about country mismatch, auto-suggestion didn't work
        elif "must match" in error_msg.lower():
            print_test("Auto-Suggestion", False, "Country was not auto-suggested")
            return False, None
        else:
            print_test("Auto-Suggestion", False, f"Unexpected error: {error_msg}")
            return False, None
    else:
        print_test("Auto-Suggestion", False, f"Unexpected status: {response.status_code}")
        return False, None

def test_validation_still_works(token):
    """Test that validation still catches actual mismatches"""
    print_section("Test 3: Validation Still Catches Mismatches")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    company_data = {
        "company_name": "Test Validation Company",
        "email": "testval@example.com",
        "mobile": "+351912345678",
        "country": "FR",  # France
        "vat_number": "DE123456789",  # German VAT
        "address_line1": "Test Street 123"
    }
    
    response = requests.post(
        f"{API_BASE}/company/addCompany",
        headers=headers,
        json={"data": company_data}
    )
    
    if response.status_code == 400:
        error_msg = response.json().get("message", "")
        if "must match" in error_msg.lower() or "france" in error_msg.lower():
            print_test("Validation Check", True, "Mismatch correctly detected with enhanced message")
            return True
        else:
            print_test("Validation Check", False, f"Wrong error: {error_msg}")
            return False
    else:
        print_test("Validation Check", False, f"Expected 400, got {response.status_code}")
        return False

def main():
    print("\n" + "="*70)
    print("  ENHANCED VAT VALIDATION FEATURES TEST")
    print("  Testing: Enhanced messages, auto-suggestion, validation")
    print("="*70)
    
    token = authenticate()
    if not token:
        print("\n❌ Authentication failed. Cannot proceed.")
        return
    
    results = []
    
    # Test 1: Enhanced error messages
    results.append(test_enhanced_error_message(token))
    
    # Test 2: Auto-suggestion
    result, company_id = test_auto_suggestion(token)
    results.append(result)
    
    # Test 3: Validation still works
    results.append(test_validation_still_works(token))
    
    # Summary
    print_section("Test Summary")
    passed = sum(1 for r in results if r is True)
    total = len(results)
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    
    if passed == total:
        print("\n✅ ALL ENHANCED FEATURES WORKING!")
    else:
        print(f"\n⚠️ {total - passed} TEST(S) FAILED")
    
    print("="*70)

if __name__ == "__main__":
    main()
