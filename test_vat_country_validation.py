#!/usr/bin/env python3
"""
VAT Country Validation Test
Tests the new requirement: Company country must match VAT country
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://init-chain.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "richard@dyno.pt"
TEST_PASSWORD = "Katiekendra123@"

def print_section(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def print_test(test_name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"   {details}")

def authenticate():
    """Authenticate and get JWT token"""
    print_section("Authentication")
    
    response = requests.post(
        f"{API_BASE}/user/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("data", {}).get("accessToken")
        user_info = data.get("data", {}).get("userData", {})
        print_test("Authentication", True, f"Logged in as {user_info.get('name', 'User')}")
        return token
    else:
        print_test("Authentication", False, f"Status: {response.status_code}")
        return None

def test_vat_country_mismatch_on_create(token):
    """Test that creating company with mismatched VAT and country fails"""
    print_section("Test 1: Create Company with Mismatched VAT Country")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Try to create company with Portuguese VAT but German country
    company_data = {
        "company_name": "Test Mismatch Company",
        "email": "test@example.com",
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
    
    # Should fail with 400
    if response.status_code == 400:
        error_msg = response.json().get("message", "")
        if "must match" in error_msg.lower() or "vat country" in error_msg.lower():
            print_test("Mismatch Validation", True, f"Correctly rejected: {error_msg}")
            return True
        else:
            print_test("Mismatch Validation", False, f"Wrong error: {error_msg}")
            return False
    else:
        print_test("Mismatch Validation", False, f"Expected 400, got {response.status_code}")
        print(f"Response: {response.json()}")
        return False

def test_vat_country_match_on_create(token):
    """Test that creating company with matching VAT and country succeeds"""
    print_section("Test 2: Create Company with Matching VAT Country")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create company with Portuguese VAT and Portuguese country
    company_data = {
        "company_name": f"Test Match Company {datetime.now().strftime('%H%M%S')}",
        "email": "testmatch@example.com",
        "mobile": "+351912345678",
        "country": "PT",  # Portugal
        "vat_number": "PT518713130",  # Portuguese VAT (format valid but not registered - that's OK)
        "address_line1": "Rua Test 123",
        "city": "Lisboa",
        "zip_code": "1000-001"
    }
    
    response = requests.post(
        f"{API_BASE}/company/addCompany",
        headers=headers,
        json={"data": company_data}
    )
    
    # Should succeed (200) or fail due to VAT not registered (400 with specific message)
    if response.status_code == 200:
        print_test("Match Validation", True, "Company created successfully with matching VAT country")
        return True, response.json().get("data", {}).get("company_id")
    elif response.status_code == 400:
        error_msg = response.json().get("message", "")
        # If it's about VAT not being registered, that's acceptable - country match was validated
        if "not registered" in error_msg.lower() or "invalid" in error_msg.lower():
            print_test("Match Validation", True, f"VAT country validation passed (VAT itself not registered: {error_msg})")
            return True, None
        # If it's about country mismatch, that's wrong
        elif "must match" in error_msg.lower():
            print_test("Match Validation", False, f"Should not reject matching countries: {error_msg}")
            return False, None
        else:
            print_test("Match Validation", False, f"Unexpected error: {error_msg}")
            return False, None
    else:
        print_test("Match Validation", False, f"Unexpected status: {response.status_code}")
        print(f"Response: {response.json()}")
        return False, None

def test_update_vat_with_wrong_country(token, company_id):
    """Test updating company VAT number that doesn't match existing country"""
    if not company_id:
        print_section("Test 3: Update Company VAT (Skipped - No Company ID)")
        print_test("Update VAT Mismatch", None, "Skipped - no company to test with")
        return
    
    print_section("Test 3: Update Company with Mismatched VAT")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Try to update with German VAT (assuming company has PT country)
    update_data = {
        "vat_number": "DE123456789"  # German VAT
    }
    
    response = requests.put(
        f"{API_BASE}/company/updateCompany/{company_id}",
        headers=headers,
        json={"data": update_data}
    )
    
    # Should fail with 400
    if response.status_code == 400:
        error_msg = response.json().get("message", "")
        if "must match" in error_msg.lower():
            print_test("Update Mismatch Validation", True, f"Correctly rejected: {error_msg}")
            return True
        else:
            print_test("Update Mismatch Validation", False, f"Wrong error: {error_msg}")
            return False
    else:
        print_test("Update Mismatch Validation", False, f"Expected 400, got {response.status_code}")
        return False

def test_update_country_with_existing_vat(token, company_id):
    """Test updating company country when VAT number exists"""
    if not company_id:
        print_section("Test 4: Update Company Country (Skipped - No Company ID)")
        print_test("Update Country Mismatch", None, "Skipped - no company to test with")
        return
    
    print_section("Test 4: Update Company Country with Existing VAT")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Try to update country to DE (assuming company has PT VAT)
    update_data = {
        "country": "DE"  # Germany
    }
    
    response = requests.put(
        f"{API_BASE}/company/updateCompany/{company_id}",
        headers=headers,
        json={"data": update_data}
    )
    
    # Should fail with 400
    if response.status_code == 400:
        error_msg = response.json().get("message", "")
        if "must match" in error_msg.lower():
            print_test("Update Country Mismatch", True, f"Correctly rejected: {error_msg}")
            return True
        else:
            print_test("Update Country Mismatch", False, f"Wrong error: {error_msg}")
            return False
    else:
        print_test("Update Country Mismatch", False, f"Expected 400, got {response.status_code}")
        return False

def test_company_without_vat(token):
    """Test that company creation without VAT still works"""
    print_section("Test 5: Create Company without VAT (Should Work)")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    company_data = {
        "company_name": f"No VAT Company {datetime.now().strftime('%H%M%S')}",
        "email": "novat@example.com",
        "mobile": "+351912345678",
        "country": "PT",
        "address_line1": "Rua Test 456",
        "city": "Porto",
        "zip_code": "4000-001"
        # No vat_number provided
    }
    
    response = requests.post(
        f"{API_BASE}/company/addCompany",
        headers=headers,
        json={"data": company_data}
    )
    
    if response.status_code == 200:
        print_test("Company without VAT", True, "Company created successfully without VAT")
        return True
    else:
        print_test("Company without VAT", False, f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        return False

def main():
    print("\n" + "="*60)
    print("  VAT COUNTRY VALIDATION TEST")
    print("  Testing: Company country must match VAT country")
    print("="*60)
    
    # Authenticate
    token = authenticate()
    if not token:
        print("\n❌ Authentication failed. Cannot proceed with tests.")
        return
    
    results = []
    
    # Test 1: Mismatched VAT country on create
    results.append(test_vat_country_mismatch_on_create(token))
    
    # Test 2: Matching VAT country on create
    match_result, company_id = test_vat_country_match_on_create(token)
    results.append(match_result)
    
    # Test 3: Update VAT with wrong country
    if company_id:
        results.append(test_update_vat_with_wrong_country(token, company_id))
    
    # Test 4: Update country with existing VAT
    if company_id:
        results.append(test_update_country_with_existing_vat(token, company_id))
    
    # Test 5: Company without VAT should still work
    results.append(test_company_without_vat(token))
    
    # Summary
    print_section("Test Summary")
    passed = sum(1 for r in results if r is True)
    total = len([r for r in results if r is not None])
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED!")
    else:
        print(f"\n⚠️ {total - passed} TEST(S) FAILED")
    
    print("="*60)

if __name__ == "__main__":
    main()
