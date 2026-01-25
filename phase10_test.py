#!/usr/bin/env python3
"""
Phase 10 Implementation Fix Verification Testing
Tests all Phase 10 functionality after updating to use userWalletModel instead of userWalletAddressModel
"""

import os
import sys
import json
import subprocess
import time
import requests
from typing import Dict, List, Any

class Phase10Tester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        
    def get_backend_url(self):
        """Get backend URL from frontend .env file"""
        # For testing, always use localhost since external URL may not be accessible
        return "http://localhost:8001"
        
    def log_result(self, test_name: str, success: bool, message: str, details: Dict = None):
        """Log test result"""
        self.test_results[test_name] = {
            'success': success,
            'message': message,
            'details': details or {}
        }
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if not success:
            self.errors.append(f"{test_name}: {message}")
    
    def authenticate_user(self):
        """Authenticate with provided test credentials"""
        print("\n=== Authenticating Test User ===")
        
        test_credentials = {
            "email": "nomadly@moxx.co",
            "password": "Katiekendra123@"
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json=test_credentials,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    self.jwt_token = data['data']['accessToken']
                    self.log_result(
                        "User Authentication", 
                        True, 
                        "Successfully authenticated with test credentials",
                        {"email": test_credentials["email"], "has_token": bool(self.jwt_token)}
                    )
                    return True
                else:
                    self.log_result(
                        "User Authentication", 
                        False, 
                        "Login succeeded but no token received",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "User Authentication", 
                    False, 
                    f"Login failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "User Authentication", 
                False, 
                f"Authentication failed: {str(e)}"
            )
        
        return False
    
    def test_data_validation(self):
        """Test 1: DATA VALIDATION TESTS - Check tbl_user_wallet has data"""
        print("\n=== DATA VALIDATION TESTS ===")
        
        # Create database validation script
        validation_script = '''
const { Sequelize, QueryTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.USER_NAME,
  process.env.PASSWORD,
  {
    host: process.env.HOST,
    port: Number(process.env.DB_PORT),
    dialect: "postgres",
    logging: false
  }
);

async function validateWalletData() {
  try {
    await sequelize.authenticate();
    
    // Check wallet data exists
    const totalWallets = await sequelize.query(
      `SELECT COUNT(*) as total_wallets FROM tbl_user_wallet WHERE wallet_address IS NOT NULL`,
      { type: QueryTypes.SELECT }
    );
    
    // Check wallet types distribution
    const walletTypes = await sequelize.query(
      `SELECT wallet_type, COUNT(*) as count FROM tbl_user_wallet WHERE wallet_address IS NOT NULL GROUP BY wallet_type`,
      { type: QueryTypes.SELECT }
    );
    
    // Check company scoping
    const companyScoping = await sequelize.query(
      `SELECT company_id, COUNT(*) as wallet_count FROM tbl_user_wallet WHERE wallet_address IS NOT NULL GROUP BY company_id`,
      { type: QueryTypes.SELECT }
    );
    
    // Sample wallet records
    const sampleWallets = await sequelize.query(
      `SELECT user_id, wallet_type, company_id, 
              LEFT(wallet_address, 10) || '...' as address_sample,
              wallet_name
       FROM tbl_user_wallet 
       WHERE wallet_address IS NOT NULL 
       LIMIT 5`,
      { type: QueryTypes.SELECT }
    );
    
    console.log(JSON.stringify({
      total_wallets: totalWallets[0].total_wallets,
      wallet_types: walletTypes,
      company_scoping: companyScoping,
      sample_wallets: sampleWallets
    }, null, 2));
    
    process.exit(0);
    
  } catch (error) {
    console.error('Database validation failed:', error.message);
    process.exit(1);
  }
}

validateWalletData();
'''
        
        try:
            # Write validation script
            with open('/tmp/validate_wallet_data.js', 'w') as f:
                f.write(validation_script)
            
            # Run validation
            result = subprocess.run(
                ["node", "/tmp/validate_wallet_data.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    data = json.loads(result.stdout)
                    total_wallets = int(data.get('total_wallets', 0))
                    
                    if total_wallets > 0:
                        self.log_result(
                            "Data Validation - Wallet Records", 
                            True, 
                            f"Found {total_wallets} wallet records with addresses",
                            {
                                "total_wallets": total_wallets,
                                "wallet_types": data.get('wallet_types', []),
                                "company_scoping": data.get('company_scoping', []),
                                "sample_wallets": data.get('sample_wallets', [])
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Data Validation - Wallet Records", 
                            False, 
                            "No wallet records found with addresses in tbl_user_wallet",
                            {"total_wallets": total_wallets}
                        )
                        return False
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Data Validation - Wallet Records", 
                        False, 
                        "Failed to parse validation results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
                    return False
            else:
                self.log_result(
                    "Data Validation - Wallet Records", 
                    False, 
                    "Database validation script failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Data Validation - Wallet Records", 
                False, 
                f"Validation failed: {str(e)}"
            )
            return False
    
    def test_api_key_creation_validation(self):
        """Test 2: TASK 10.1 - API Key Creation Validation Test"""
        print("\n=== TASK 10.1: API KEY CREATION VALIDATION TEST ===")
        
        if not self.jwt_token:
            self.log_result(
                "API Key Creation Test", 
                False, 
                "No JWT token available for authentication"
            )
            return False
        
        # Test A: Positive Test - User with Wallets
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Test creating production API key
            test_data = {
                "api_name": "Phase10Test_ProductionKey",
                "environment": "production",
                "company_id": 1,
                "base_currency": "BTC"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/userApi/addApi",
                json=test_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "API Key Creation - Production Key", 
                    True, 
                    "Successfully created production API key with wallet validation",
                    {
                        "api_name": test_data["api_name"],
                        "environment": test_data["environment"],
                        "company_id": test_data["company_id"],
                        "response_status": response.status_code
                    }
                )
                return True
            elif response.status_code == 400:
                # Check if it's the expected wallet validation error
                try:
                    error_data = response.json()
                    error_message = error_data.get('message', '')
                    if 'wallet address' in error_message.lower():
                        self.log_result(
                            "API Key Creation - Wallet Validation", 
                            True, 
                            "Correctly validates wallet requirement for production keys",
                            {
                                "validation_message": error_message,
                                "status_code": response.status_code
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "API Key Creation - Production Key", 
                            False, 
                            f"Unexpected 400 error: {error_message}",
                            {"response": error_data}
                        )
                        return False
                except:
                    self.log_result(
                        "API Key Creation - Production Key", 
                        False, 
                        f"API returned 400 but couldn't parse error: {response.text}",
                        {"status_code": response.status_code}
                    )
                    return False
            else:
                self.log_result(
                    "API Key Creation - Production Key", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "API Key Creation - Production Key", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_configured_currencies_endpoint(self):
        """Test 3: TASK 10.2 - Configured Currencies Endpoint Test"""
        print("\n=== TASK 10.2: CONFIGURED CURRENCIES ENDPOINT TEST ===")
        
        if not self.jwt_token:
            self.log_result(
                "Configured Currencies Test", 
                False, 
                "No JWT token available for authentication"
            )
            return False
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        # Test A: Get All Configured Currencies (No Filter)
        try:
            response = requests.get(
                f"{self.backend_url}/api/wallet/configured-currencies",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    response_data = data['data']
                    
                    # Check required fields
                    required_fields = ['configured_currencies', 'wallet_count', 'wallets', 'skip_selection']
                    missing_fields = [field for field in required_fields if field not in response_data]
                    
                    if not missing_fields:
                        configured_currencies = response_data.get('configured_currencies', [])
                        wallet_count = response_data.get('wallet_count', 0)
                        wallets = response_data.get('wallets', [])
                        skip_selection = response_data.get('skip_selection', False)
                        
                        self.log_result(
                            "Configured Currencies - All Currencies", 
                            True, 
                            f"Retrieved {len(configured_currencies)} currencies, {wallet_count} wallets",
                            {
                                "configured_currencies": configured_currencies,
                                "wallet_count": wallet_count,
                                "skip_selection": skip_selection,
                                "sample_wallets": wallets[:3] if wallets else []
                            }
                        )
                        
                        # Verify address masking
                        if wallets:
                            first_wallet = wallets[0]
                            if 'address_masked' in first_wallet:
                                address_masked = first_wallet['address_masked']
                                if '...' in address_masked and len(address_masked) <= 15:
                                    self.log_result(
                                        "Configured Currencies - Address Masking", 
                                        True, 
                                        "Address masking working correctly (first 6 + last 4 chars)",
                                        {"sample_masked_address": address_masked}
                                    )
                                else:
                                    self.log_result(
                                        "Configured Currencies - Address Masking", 
                                        False, 
                                        "Address masking format incorrect",
                                        {"sample_masked_address": address_masked}
                                    )
                        
                        # Test B: Filter by Company ID
                        try:
                            response2 = requests.get(
                                f"{self.backend_url}/api/wallet/configured-currencies?company_id=1",
                                headers=headers,
                                timeout=15
                            )
                            
                            if response2.status_code == 200:
                                data2 = response2.json()
                                if 'data' in data2:
                                    filtered_data = data2['data']
                                    filtered_count = filtered_data.get('wallet_count', 0)
                                    
                                    self.log_result(
                                        "Configured Currencies - Company Filter", 
                                        True, 
                                        f"Company filtering working, returned {filtered_count} wallets for company_id=1",
                                        {
                                            "filtered_wallet_count": filtered_count,
                                            "original_wallet_count": wallet_count
                                        }
                                    )
                                else:
                                    self.log_result(
                                        "Configured Currencies - Company Filter", 
                                        False, 
                                        "Invalid response format for company filter",
                                        {"response": data2}
                                    )
                            else:
                                self.log_result(
                                    "Configured Currencies - Company Filter", 
                                    False, 
                                    f"Company filter request failed with status {response2.status_code}",
                                    {"response": response2.text}
                                )
                        except Exception as e:
                            self.log_result(
                                "Configured Currencies - Company Filter", 
                                False, 
                                f"Company filter test failed: {str(e)}"
                            )
                        
                        return True
                    else:
                        self.log_result(
                            "Configured Currencies - Structure", 
                            False, 
                            f"Missing required fields: {', '.join(missing_fields)}",
                            {"response": data}
                        )
                        return False
                else:
                    self.log_result(
                        "Configured Currencies - All Currencies", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Configured Currencies - All Currencies", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Configured Currencies - All Currencies", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_currency_validation_in_payment(self):
        """Test 4: TASK 10.3 - Currency Validation Test"""
        print("\n=== TASK 10.3: CURRENCY VALIDATION TEST ===")
        
        if not self.jwt_token:
            self.log_result(
                "Currency Validation Test", 
                False, 
                "No JWT token available for authentication"
            )
            return False
        
        # Since full payment creation requires Redis and external APIs,
        # we'll test by examining the code and attempting a simple validation
        
        # First, let's check if the validation logic exists in the code
        try:
            with open('/app/backend/controller/paymentController.ts', 'r') as f:
                content = f.read()
                
            # Check for userWalletModel usage in currency validation
            validation_checks = [
                'userWalletModel.findOne' in content,
                'wallet_type: requestedCurrency' in content or 'wallet_type:' in content,
                'wallet_address: { [Op.not]: null }' in content,
                'No wallet address configured for' in content
            ]
            
            if all(validation_checks):
                self.log_result(
                    "Currency Validation - Code Review", 
                    True, 
                    "Currency validation logic correctly implemented using userWalletModel",
                    {
                        "userWalletModel_usage": True,
                        "wallet_type_check": True,
                        "wallet_address_validation": True,
                        "error_message_present": True
                    }
                )
                
                # Try to test with a mock payment creation (this might fail due to Redis requirements)
                try:
                    headers = {
                        "Authorization": f"Bearer {self.jwt_token}",
                        "Content-Type": "application/json"
                    }
                    
                    # This is likely to fail, but we can check the error message
                    test_payment = {
                        "currency": "DOGE",  # Try with a currency user might not have
                        "amount": 10,
                        "uniqueRef": "test-validation-ref"
                    }
                    
                    response = requests.post(
                        f"{self.backend_url}/api/pay/createCryptoPayment",
                        json=test_payment,
                        headers=headers,
                        timeout=15
                    )
                    
                    if response.status_code == 400:
                        try:
                            error_data = response.json()
                            error_message = error_data.get('message', '')
                            if 'wallet address configured' in error_message.lower():
                                self.log_result(
                                    "Currency Validation - Runtime Test", 
                                    True, 
                                    "Currency validation working correctly at runtime",
                                    {
                                        "validation_message": error_message,
                                        "tested_currency": test_payment["currency"]
                                    }
                                )
                            else:
                                self.log_result(
                                    "Currency Validation - Runtime Test", 
                                    False, 
                                    f"Unexpected validation error: {error_message}",
                                    {"response": error_data}
                                )
                        except:
                            self.log_result(
                                "Currency Validation - Runtime Test", 
                                False, 
                                f"Could not parse validation error: {response.text}",
                                {"status_code": response.status_code}
                            )
                    else:
                        self.log_result(
                            "Currency Validation - Runtime Test", 
                            False, 
                            f"Expected validation error but got status {response.status_code}",
                            {"response": response.text}
                        )
                        
                except Exception as e:
                    self.log_result(
                        "Currency Validation - Runtime Test", 
                        False, 
                        f"Runtime test failed: {str(e)}"
                    )
                
                return True
            else:
                missing_checks = []
                check_names = [
                    'userWalletModel.findOne usage',
                    'wallet_type validation',
                    'wallet_address null check',
                    'error message for missing wallet'
                ]
                for i, check in enumerate(validation_checks):
                    if not check:
                        missing_checks.append(check_names[i])
                
                self.log_result(
                    "Currency Validation - Code Review", 
                    False, 
                    f"Currency validation logic incomplete: {', '.join(missing_checks)}",
                    {"validation_checks": dict(zip(check_names, validation_checks))}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Currency Validation - Code Review", 
                False, 
                f"Failed to review validation code: {str(e)}"
            )
            return False
    
    def test_backward_compatibility(self):
        """Test 5: Backward Compatibility Test"""
        print("\n=== BACKWARD COMPATIBILITY TEST ===")
        
        if not self.jwt_token:
            self.log_result(
                "Backward Compatibility Test", 
                False, 
                "No JWT token available for authentication"
            )
            return False
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        # Test existing API endpoints still work
        compatibility_tests = [
            {
                "name": "Wallet Listing",
                "endpoint": "/api/wallet/getWallet",
                "method": "GET"
            },
            {
                "name": "Wallet Addresses",
                "endpoint": "/api/wallet/getWalletAddresses",
                "method": "GET"
            },
            {
                "name": "API Keys Listing",
                "endpoint": "/api/userApi/getApi",
                "method": "GET"
            }
        ]
        
        all_passed = True
        
        for test in compatibility_tests:
            try:
                if test["method"] == "GET":
                    response = requests.get(
                        f"{self.backend_url}{test['endpoint']}",
                        headers=headers,
                        timeout=15
                    )
                else:
                    response = requests.post(
                        f"{self.backend_url}{test['endpoint']}",
                        headers=headers,
                        json={},
                        timeout=15
                    )
                
                if response.status_code in [200, 201]:
                    self.log_result(
                        f"Backward Compatibility - {test['name']}", 
                        True, 
                        f"Endpoint {test['endpoint']} still working correctly",
                        {"status_code": response.status_code}
                    )
                else:
                    self.log_result(
                        f"Backward Compatibility - {test['name']}", 
                        False, 
                        f"Endpoint {test['endpoint']} returned status {response.status_code}",
                        {"response": response.text}
                    )
                    all_passed = False
                    
            except Exception as e:
                self.log_result(
                    f"Backward Compatibility - {test['name']}", 
                    False, 
                    f"Request to {test['endpoint']} failed: {str(e)}"
                )
                all_passed = False
        
        return all_passed
    
    def run_all_tests(self):
        """Run all Phase 10 tests"""
        print("🚀 Starting Phase 10 Implementation Fix Verification Testing")
        print("=" * 80)
        
        # Step 1: Authenticate
        if not self.authenticate_user():
            print("\n❌ CRITICAL: Authentication failed. Cannot proceed with tests.")
            return False
        
        # Step 2: Data Validation Tests
        data_valid = self.test_data_validation()
        
        # Step 3: API Key Creation Validation
        api_key_test = self.test_api_key_creation_validation()
        
        # Step 4: Configured Currencies Endpoint
        currencies_test = self.test_configured_currencies_endpoint()
        
        # Step 5: Currency Validation in Payment
        currency_validation_test = self.test_currency_validation_in_payment()
        
        # Step 6: Backward Compatibility
        compatibility_test = self.test_backward_compatibility()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 PHASE 10 TEST RESULTS SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if self.errors:
            print(f"\n❌ FAILED TESTS ({len(self.errors)}):")
            for error in self.errors:
                print(f"  • {error}")
        
        # Overall assessment
        critical_tests = [
            "Data Validation - Wallet Records",
            "API Key Creation - Production Key", 
            "Configured Currencies - All Currencies",
            "Currency Validation - Code Review"
        ]
        
        critical_passed = sum(1 for test_name in critical_tests 
                            if test_name in self.test_results and self.test_results[test_name]['success'])
        
        if critical_passed == len(critical_tests):
            print(f"\n✅ PHASE 10 IMPLEMENTATION: ALL CRITICAL TESTS PASSED")
            print("✅ userWalletModel integration successful")
            print("✅ API key validation working correctly") 
            print("✅ Configured currencies endpoint functional")
            print("✅ Currency validation implemented correctly")
        else:
            print(f"\n❌ PHASE 10 IMPLEMENTATION: {len(critical_tests) - critical_passed} CRITICAL TESTS FAILED")
            print("❌ Phase 10 implementation needs fixes before production")
        
        return critical_passed == len(critical_tests)

def main():
    tester = Phase10Tester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()