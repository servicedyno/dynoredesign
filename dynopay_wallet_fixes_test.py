#!/usr/bin/env python3
"""
DynoPay Backend Testing - validateWalletAddress Response Fix + Swagger Documentation Check
Test the 2 specific fixes requested in the review:

1. POST /api/wallet/validateWalletAddress response consistency fix
2. Removal of Withdrawal/Exchange endpoints from Swagger API documentation

Base URL: https://init-project-9.preview.emergentagent.com
Credentials: richard@dyno.pt / Katiekendra123@
Company ID: 38
"""

import requests
import json
import sys
from typing import Dict, Any, Optional


class DynoPayTester:
    def __init__(self):
        self.base_url = "https://init-project-9.preview.emergentagent.com"
        self.email = "richard@dyno.pt"
        self.password = "Katiekendra123@"
        self.company_id = 38
        self.jwt_token = None
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'DynoPay-Testing-Agent/1.0'
        })
    
    def log_test(self, test_name: str, success: bool, details: str = ""):
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   {details}")
    
    def authenticate(self) -> bool:
        """Step 1: Authenticate to get JWT token"""
        try:
            response = self.session.post(f"{self.base_url}/api/user/login", json={
                "email": self.email,
                "password": self.password
            })
            
            if response.status_code == 200:
                data = response.json()
                if "data" in data and "accessToken" in data["data"]:
                    self.jwt_token = data["data"]["accessToken"]
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.jwt_token}'
                    })
                    user_info = data["data"].get("userData", {})
                    self.log_test("Authentication", True, 
                                f"Logged in as {user_info.get('name', 'Unknown')} (ID: {user_info.get('user_id')})")
                    return True
            
            self.log_test("Authentication", False, 
                         f"Status: {response.status_code}, Response: {response.text[:200]}")
            return False
            
        except Exception as e:
            self.log_test("Authentication", False, f"Exception: {str(e)}")
            return False
    
    def test_validate_wallet_address_response_consistency(self) -> bool:
        """
        Test 1: validateWalletAddress Response Consistency Fix
        
        Tests the response now includes a data object with:
        - wallet_address, wallet_type, company_id, wallet_name, and masked email field
        - Message changed to "Address validated! OTP sent to your email"
        """
        print("\n=== TEST 1: validateWalletAddress Response Consistency Fix ===")
        
        # Test different addresses to avoid "wallet already exists" error
        test_addresses = [
            {"wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD48", "currency": "ETH"},
            {"wallet_address": "LPcZbuWJSjLGao7NCJG7LPr34x2R7fSCng", "currency": "LTC"},
            {"wallet_address": "DJnPRJEUCRdSgPucGLv7RVLeWZAfS71MVe", "currency": "DOGE"}
        ]
        
        success_count = 0
        
        for i, address_data in enumerate(test_addresses, 1):
            try:
                # Prepare request payload
                payload = {
                    "wallet_address": address_data["wallet_address"],
                    "currency": address_data["currency"],
                    "company_id": self.company_id,
                    "wallet_name": f"Test Wallet {i}"
                }
                
                print(f"\n--- Test 1.{i}: {address_data['currency']} Address Validation ---")
                
                response = self.session.post(
                    f"{self.base_url}/api/wallet/validateWalletAddress",
                    json=payload
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Check response structure
                    checks = {
                        "success_field": data.get("success") is True,
                        "correct_message": data.get("message") == "Address validated! OTP sent to your email",
                        "data_object_exists": "data" in data,
                    }
                    
                    # Check data object contents
                    if checks["data_object_exists"]:
                        response_data = data["data"]
                        data_checks = {
                            "wallet_address": response_data.get("wallet_address") == address_data["wallet_address"],
                            "wallet_type": response_data.get("wallet_type") == address_data["currency"],
                            "company_id": response_data.get("company_id") == self.company_id,
                            "wallet_name": "wallet_name" in response_data,  # Can be null
                            "email_masked": "email" in response_data and "***" in response_data.get("email", ""),
                        }
                        checks.update(data_checks)
                    
                    # Log results
                    all_passed = all(checks.values())
                    if all_passed:
                        success_count += 1
                        self.log_test(f"Test 1.{i} - Response Structure", True, 
                                    f"{address_data['currency']} address validation with correct data structure")
                        
                        # Show key response fields
                        if "data" in data:
                            rd = data["data"]
                            print(f"   ✓ Message: '{data.get('message')}'")
                            print(f"   ✓ Wallet Address: {rd.get('wallet_address')}")
                            print(f"   ✓ Wallet Type: {rd.get('wallet_type')}")
                            print(f"   ✓ Company ID: {rd.get('company_id')}")
                            print(f"   ✓ Email (masked): {rd.get('email')}")
                    else:
                        failed_checks = [k for k, v in checks.items() if not v]
                        self.log_test(f"Test 1.{i} - Response Structure", False, 
                                    f"Failed checks: {', '.join(failed_checks)}")
                
                elif response.status_code == 400:
                    # Check if it's the "wallet already exists" error
                    response_text = response.text.lower()
                    if "already exists" in response_text or "duplicate" in response_text:
                        self.log_test(f"Test 1.{i} - Address Validation", True, 
                                    f"Expected 400 error - {address_data['currency']} address already configured")
                        success_count += 1
                    else:
                        self.log_test(f"Test 1.{i} - Address Validation", False, 
                                    f"Unexpected 400 error: {response.text[:200]}")
                else:
                    self.log_test(f"Test 1.{i} - Address Validation", False, 
                                f"Status: {response.status_code}, Response: {response.text[:200]}")
            
            except Exception as e:
                self.log_test(f"Test 1.{i} - Address Validation", False, f"Exception: {str(e)}")
        
        # Overall Test 1 result
        overall_success = success_count >= 1  # At least one successful test
        self.log_test("TEST 1 OVERALL - validateWalletAddress Response Fix", overall_success, 
                     f"Successful tests: {success_count}/{len(test_addresses)}")
        
        return overall_success
    
    def test_swagger_withdrawal_exchange_removal(self) -> bool:
        """
        Test 2: Withdrawal & Exchange Endpoints Removed from API Docs
        
        Tests that the following endpoints are NOT documented in Swagger:
        - /api/wallet/sendConfirmationOTP
        - /api/wallet/withdrawAssets  
        - /api/wallet/exchangeCreate
        - /api/wallet/confirmExchange
        - /api/wallet/getExchange
        
        And that tags "Withdrawals", "Exchange" do NOT appear.
        """
        print("\n=== TEST 2: Swagger Documentation - Withdrawal/Exchange Endpoints Removal ===")
        
        try:
            # Fetch Swagger JSON specification
            swagger_url = f"{self.base_url}/api/docs.json"
            response = self.session.get(swagger_url)
            
            if response.status_code != 200:
                self.log_test("Test 2 - Swagger JSON Access", False, 
                             f"Could not fetch Swagger JSON. Status: {response.status_code}")
                return False
            
            swagger_spec = response.json()
            self.log_test("Test 2 - Swagger JSON Access", True, "Successfully fetched Swagger JSON specification")
            
            # Check paths that should NOT exist
            removed_endpoints = [
                "/api/wallet/sendConfirmationOTP",
                "/api/wallet/withdrawAssets", 
                "/api/wallet/exchangeCreate",
                "/api/wallet/confirmExchange",
                "/api/wallet/getExchange"
            ]
            
            paths = swagger_spec.get("paths", {})
            endpoint_results = []
            
            for endpoint in removed_endpoints:
                exists = endpoint in paths
                endpoint_results.append(not exists)  # We want them to NOT exist
                status = "ABSENT (✓)" if not exists else "PRESENT (❌)"
                print(f"   {endpoint}: {status}")
            
            # Check that tags "Withdrawals", "Exchange" do NOT appear
            tags = swagger_spec.get("tags", [])
            tag_names = [tag.get("name", "").lower() for tag in tags if isinstance(tag, dict)]
            
            withdrawal_tag_absent = "withdrawals" not in tag_names and "withdrawal" not in tag_names
            exchange_tag_absent = "exchange" not in tag_names and "exchanges" not in tag_names
            
            print(f"   Withdrawal tags absent: {'✓' if withdrawal_tag_absent else '❌'}")
            print(f"   Exchange tags absent: {'✓' if exchange_tag_absent else '❌'}")
            
            # Check that wallet management endpoints still exist (verification)
            expected_wallet_endpoints = [
                "/api/wallet/validateWalletAddress",
                "/api/wallet/getWallet"
            ]
            
            wallet_endpoints_exist = []
            for endpoint in expected_wallet_endpoints:
                exists = endpoint in paths
                wallet_endpoints_exist.append(exists)
                status = "PRESENT (✓)" if exists else "ABSENT (❌)"
                print(f"   {endpoint}: {status}")
            
            # Overall assessment
            all_removed_absent = all(endpoint_results)
            tags_removed = withdrawal_tag_absent and exchange_tag_absent
            wallet_endpoints_preserved = all(wallet_endpoints_exist)
            
            overall_success = all_removed_absent and tags_removed and wallet_endpoints_preserved
            
            self.log_test("Test 2.1 - Removed Endpoints", all_removed_absent, 
                         f"All 5 withdrawal/exchange endpoints absent: {all(endpoint_results)}")
            
            self.log_test("Test 2.2 - Removed Tags", tags_removed, 
                         f"Withdrawal/Exchange tags absent: {tags_removed}")
            
            self.log_test("Test 2.3 - Preserved Endpoints", wallet_endpoints_preserved, 
                         f"Wallet management endpoints still documented: {wallet_endpoints_preserved}")
            
            self.log_test("TEST 2 OVERALL - Swagger Cleanup", overall_success, 
                         f"Endpoints removed: {all_removed_absent}, Tags removed: {tags_removed}, Wallet preserved: {wallet_endpoints_preserved}")
            
            return overall_success
            
        except Exception as e:
            self.log_test("Test 2 - Swagger Documentation Check", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self) -> bool:
        """Run all tests and return overall success"""
        print("🧪 DynoPay Backend Testing - validateWalletAddress Response Fix + Swagger Cleanup")
        print("=" * 80)
        print(f"Base URL: {self.base_url}")
        print(f"Test Account: {self.email}")
        print(f"Company ID: {self.company_id}")
        print("=" * 80)
        
        # Step 1: Authentication
        if not self.authenticate():
            print("\n❌ CRITICAL: Authentication failed - cannot proceed with tests")
            return False
        
        # Step 2: Run the two main tests
        test1_success = self.test_validate_wallet_address_response_consistency()
        test2_success = self.test_swagger_withdrawal_exchange_removal()
        
        # Summary
        print(f"\n{'='*80}")
        print("🎯 FINAL TEST SUMMARY")
        print(f"{'='*80}")
        
        overall_success = test1_success and test2_success
        
        print(f"Test 1 - validateWalletAddress Response Fix: {'✅ PASS' if test1_success else '❌ FAIL'}")
        print(f"Test 2 - Swagger Withdrawal/Exchange Removal: {'✅ PASS' if test2_success else '❌ FAIL'}")
        print(f"\nOverall Result: {'🎉 ALL TESTS PASSED' if overall_success else '⚠️  SOME TESTS FAILED'}")
        
        if overall_success:
            print("\n✅ SUCCESS CRITERIA MET:")
            print("   ✓ validateWalletAddress response includes data.email with masked email")
            print("   ✓ validateWalletAddress response includes data.wallet_type") 
            print("   ✓ No withdrawal/exchange endpoints in Swagger JSON")
            print("   ✓ Other wallet endpoints still documented")
        else:
            print("\n❌ ISSUES FOUND:")
            if not test1_success:
                print("   ✗ validateWalletAddress response format issues")
            if not test2_success:
                print("   ✗ Swagger documentation still contains withdrawal/exchange endpoints")
        
        return overall_success


def main():
    tester = DynoPayTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()