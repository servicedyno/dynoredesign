#!/usr/bin/env python3
"""
API Key Base Currency Functionality Testing
Tests if API key base_currency field is properly working and being used in payment processing.
"""

import os
import sys
import json
import requests
import subprocess
from typing import Dict, List, Any

class ApiKeyBaseCurrencyTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.test_user_credentials = {
            "email": "nomadly@moxx.co",
            "password": "Katiekendra123@"
        }
        
    def get_backend_url(self):
        """Get backend URL from frontend .env file"""
        try:
            with open('/app/frontend/.env', 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        return line.split('=', 1)[1].strip()
        except:
            pass
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
        """Authenticate with provided credentials"""
        print("\n=== Authenticating User ===")
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json=self.test_user_credentials,
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
                        f"Successfully authenticated user {self.test_user_credentials['email']}",
                        {"has_token": bool(self.jwt_token)}
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
    
    def test_api_key_creation_different_currencies(self):
        """TEST 1: Create API keys with different base currencies (USD, EUR, GBP)"""
        print("\n=== TEST 1: API Key Creation with Different Base Currencies ===")
        
        if not self.jwt_token:
            self.log_result("API Key Creation Test", False, "No JWT token available")
            return
        
        # Test currencies as specified in review request
        test_currencies = [
            {"base_currency": "USD", "api_name": "Test_USD_Key"},
            {"base_currency": "EUR", "api_name": "Test_EUR_Key"},
            {"base_currency": "GBP", "api_name": "Test_GBP_Key"}
        ]
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        created_apis = []
        
        for currency_test in test_currencies:
            try:
                payload = {
                    "api_name": currency_test["api_name"],
                    "environment": "production",
                    "company_id": 1,
                    "base_currency": currency_test["base_currency"]
                }
                
                response = requests.post(
                    f"{self.backend_url}/api/userApi/addApi",
                    json=payload,
                    headers=headers,
                    timeout=15
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if 'data' in data:
                        api_data = data['data']
                        created_apis.append({
                            "api_id": api_data.get('api_id'),
                            "base_currency": api_data.get('base_currency'),
                            "api_name": api_data.get('api_name')
                        })
                        
                        self.log_result(
                            f"API Key Creation - {currency_test['base_currency']}", 
                            True, 
                            f"Successfully created API key with base currency {currency_test['base_currency']}",
                            {
                                "api_id": api_data.get('api_id'),
                                "base_currency": api_data.get('base_currency'),
                                "api_name": api_data.get('api_name'),
                                "environment": api_data.get('environment')
                            }
                        )
                    else:
                        self.log_result(
                            f"API Key Creation - {currency_test['base_currency']}", 
                            False, 
                            "API created but invalid response format",
                            {"response": data}
                        )
                else:
                    # Check if it's a duplicate key error (which is expected if keys already exist)
                    if response.status_code == 400 and "already exists" in response.text:
                        self.log_result(
                            f"API Key Creation - {currency_test['base_currency']}", 
                            True, 
                            f"API key for {currency_test['base_currency']} already exists (expected)",
                            {"status_code": response.status_code}
                        )
                    else:
                        self.log_result(
                            f"API Key Creation - {currency_test['base_currency']}", 
                            False, 
                            f"API creation failed with status {response.status_code}",
                            {"response": response.text}
                        )
                        
            except Exception as e:
                self.log_result(
                    f"API Key Creation - {currency_test['base_currency']}", 
                    False, 
                    f"Request failed: {str(e)}"
                )
        
        return created_apis
    
    def test_database_api_keys_query(self):
        """TEST 2: Check Database for Existing API Keys"""
        print("\n=== TEST 2: Database Query for Existing API Keys ===")
        
        # Create a Node.js script to query the database
        query_script = '''
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

async function queryApiKeys() {
  try {
    await sequelize.authenticate();
    
    // Query API keys for user_id = 4 as specified in review request
    const apiKeys = await sequelize.query(
      `SELECT api_id, api_name, base_currency, company_id, environment, status, created_at
       FROM tbl_api 
       WHERE user_id = 4 
       ORDER BY api_id DESC 
       LIMIT 10`,
      { type: QueryTypes.SELECT }
    );
    
    // Also get count by base_currency
    const currencyStats = await sequelize.query(
      `SELECT base_currency, COUNT(*) as count
       FROM tbl_api 
       WHERE user_id = 4 
       GROUP BY base_currency
       ORDER BY count DESC`,
      { type: QueryTypes.SELECT }
    );
    
    console.log(JSON.stringify({
      total_api_keys: apiKeys.length,
      api_keys: apiKeys,
      currency_distribution: currencyStats,
      default_base_currency: apiKeys.length > 0 ? apiKeys[0].base_currency : null
    }, null, 2));
    
    process.exit(0);
    
  } catch (error) {
    console.error('Database query failed:', error.message);
    process.exit(1);
  }
}

queryApiKeys();
'''
        
        try:
            # Write query script to temporary file
            with open('/tmp/query_api_keys.js', 'w') as f:
                f.write(query_script)
            
            # Run the query script
            result = subprocess.run(
                ["node", "/tmp/query_api_keys.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    api_data = json.loads(result.stdout)
                    total_keys = api_data.get('total_api_keys', 0)
                    currency_dist = api_data.get('currency_distribution', [])
                    
                    if total_keys > 0:
                        currencies_used = [item['base_currency'] for item in currency_dist]
                        self.log_result(
                            "Database API Keys Query", 
                            True, 
                            f"Found {total_keys} API keys with currencies: {', '.join(currencies_used)}",
                            {
                                "total_keys": total_keys,
                                "currencies": currencies_used,
                                "currency_distribution": currency_dist,
                                "sample_keys": api_data.get('api_keys', [])[:3]
                            }
                        )
                    else:
                        self.log_result(
                            "Database API Keys Query", 
                            False, 
                            "No API keys found for user_id = 4",
                            {"total_keys": total_keys}
                        )
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Database API Keys Query", 
                        False, 
                        "Failed to parse database query results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
            else:
                self.log_result(
                    "Database API Keys Query", 
                    False, 
                    "Database query script failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Database API Keys Query", 
                False, 
                f"Database query failed: {str(e)}"
            )
    
    def test_get_api_keys_endpoint(self):
        """TEST 3: Verify base_currency in GET /api/userApi/getApi response"""
        print("\n=== TEST 3: Verify Base Currency in API Keys Retrieval ===")
        
        if not self.jwt_token:
            self.log_result("API Keys Retrieval Test", False, "No JWT token available")
            return
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.get(
                f"{self.backend_url}/api/userApi/getApi",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    api_data = data['data']
                    all_apis = api_data.get('all', [])
                    
                    if all_apis:
                        # Check if base_currency field is present in each API
                        currencies_found = []
                        missing_base_currency = []
                        
                        for api in all_apis:
                            if 'base_currency' in api:
                                currencies_found.append(api['base_currency'])
                            else:
                                missing_base_currency.append(api.get('api_id', 'unknown'))
                        
                        if not missing_base_currency:
                            unique_currencies = list(set(currencies_found))
                            self.log_result(
                                "API Keys Base Currency Field", 
                                True, 
                                f"All {len(all_apis)} API keys have base_currency field. Currencies: {', '.join(unique_currencies)}",
                                {
                                    "total_apis": len(all_apis),
                                    "currencies_found": currencies_found,
                                    "unique_currencies": unique_currencies,
                                    "sample_api": {
                                        "api_id": all_apis[0].get('api_id'),
                                        "api_name": all_apis[0].get('api_name'),
                                        "base_currency": all_apis[0].get('base_currency'),
                                        "environment": all_apis[0].get('environment')
                                    }
                                }
                            )
                        else:
                            self.log_result(
                                "API Keys Base Currency Field", 
                                False, 
                                f"Some API keys missing base_currency field: {missing_base_currency}",
                                {"missing_apis": missing_base_currency}
                            )
                    else:
                        self.log_result(
                            "API Keys Base Currency Field", 
                            False, 
                            "No API keys found in response",
                            {"api_data": api_data}
                        )
                else:
                    self.log_result(
                        "API Keys Retrieval Test", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "API Keys Retrieval Test", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "API Keys Retrieval Test", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_payment_processing_base_currency_usage(self):
        """TEST 4: Verify Base Currency Usage in Payment Processing"""
        print("\n=== TEST 4: Payment Processing Base Currency Usage ===")
        
        # Analyze the payment controller code to verify base_currency usage
        payment_controller_analysis = '''
const fs = require('fs');

try {
  const paymentControllerPath = '/app/backend/controller/paymentController.ts';
  const content = fs.readFileSync(paymentControllerPath, 'utf8');
  
  // Look for the specific lines mentioned in the review request
  const lines = content.split('\\n');
  
  // Find line 1609-1614 (currency conversion with customerData.base_currency)
  const mainConversionLines = [];
  for (let i = 1608; i <= 1615; i++) {
    if (lines[i]) {
      mainConversionLines.push({
        line_number: i + 1,
        content: lines[i].trim()
      });
    }
  }
  
  // Find line 1839-1844 (overpayment conversion hardcoded to USD)
  const overpaymentLines = [];
  for (let i = 1838; i <= 1845; i++) {
    if (lines[i]) {
      overpaymentLines.push({
        line_number: i + 1,
        content: lines[i].trim()
      });
    }
  }
  
  // Search for all occurrences of base_currency usage
  const baseCurrencyUsages = [];
  lines.forEach((line, index) => {
    if (line.includes('base_currency') || line.includes('customerData?.base_currency')) {
      baseCurrencyUsages.push({
        line_number: index + 1,
        content: line.trim()
      });
    }
  });
  
  // Search for hardcoded USD usage in currency conversion
  const hardcodedUsdUsages = [];
  lines.forEach((line, index) => {
    if (line.includes('currency: ["USD"]') || line.includes("currency: ['USD']")) {
      hardcodedUsdUsages.push({
        line_number: index + 1,
        content: line.trim()
      });
    }
  });
  
  console.log(JSON.stringify({
    main_conversion_lines: mainConversionLines,
    overpayment_conversion_lines: overpaymentLines,
    base_currency_usages: baseCurrencyUsages,
    hardcoded_usd_usages: hardcodedUsdUsages,
    analysis: {
      uses_base_currency_for_main_conversion: mainConversionLines.some(l => 
        l.content.includes('customerData?.base_currency')
      ),
      has_hardcoded_usd_for_overpayment: overpaymentLines.some(l => 
        l.content.includes('currency: ["USD"]')
      )
    }
  }, null, 2));
  
} catch (error) {
  console.error('Code analysis failed:', error.message);
  process.exit(1);
}
'''
        
        try:
            # Write analysis script
            with open('/tmp/analyze_payment_code.js', 'w') as f:
                f.write(payment_controller_analysis)
            
            # Run the analysis
            result = subprocess.run(
                ["node", "/tmp/analyze_payment_code.js"],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    analysis_data = json.loads(result.stdout)
                    analysis = analysis_data.get('analysis', {})
                    
                    # Check main conversion (should use base_currency)
                    uses_base_currency = analysis.get('uses_base_currency_for_main_conversion', False)
                    if uses_base_currency:
                        self.log_result(
                            "Payment Processing - Main Conversion", 
                            True, 
                            "✅ Main payment conversion uses customerData.base_currency (line 1611)",
                            {"main_conversion_lines": analysis_data.get('main_conversion_lines', [])}
                        )
                    else:
                        self.log_result(
                            "Payment Processing - Main Conversion", 
                            False, 
                            "❌ Main payment conversion does not use base_currency",
                            {"main_conversion_lines": analysis_data.get('main_conversion_lines', [])}
                        )
                    
                    # Check overpayment conversion (bug: hardcoded to USD)
                    has_hardcoded_usd = analysis.get('has_hardcoded_usd_for_overpayment', False)
                    if has_hardcoded_usd:
                        self.log_result(
                            "Payment Processing - Overpayment Bug", 
                            True, 
                            "🐛 CONFIRMED BUG: Overpayment conversion hardcoded to USD (line 1841)",
                            {"overpayment_lines": analysis_data.get('overpayment_conversion_lines', [])}
                        )
                    else:
                        self.log_result(
                            "Payment Processing - Overpayment Bug", 
                            False, 
                            "Overpayment conversion bug not found at expected location",
                            {"overpayment_lines": analysis_data.get('overpayment_conversion_lines', [])}
                        )
                    
                    # Summary of all base_currency usages
                    base_currency_usages = analysis_data.get('base_currency_usages', [])
                    hardcoded_usd_usages = analysis_data.get('hardcoded_usd_usages', [])
                    
                    self.log_result(
                        "Payment Processing - Code Analysis Summary", 
                        True, 
                        f"Found {len(base_currency_usages)} base_currency usages and {len(hardcoded_usd_usages)} hardcoded USD usages",
                        {
                            "base_currency_usage_count": len(base_currency_usages),
                            "hardcoded_usd_count": len(hardcoded_usd_usages),
                            "base_currency_lines": [f"Line {u['line_number']}: {u['content']}" for u in base_currency_usages[:5]],
                            "hardcoded_usd_lines": [f"Line {u['line_number']}: {u['content']}" for u in hardcoded_usd_usages]
                        }
                    )
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Payment Processing Code Analysis", 
                        False, 
                        "Failed to parse code analysis results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
            else:
                self.log_result(
                    "Payment Processing Code Analysis", 
                    False, 
                    "Code analysis script failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Payment Processing Code Analysis", 
                False, 
                f"Code analysis failed: {str(e)}"
            )
    
    def test_currency_conversion_function(self):
        """TEST 5: Test Currency Conversion Function Usage"""
        print("\n=== TEST 5: Currency Conversion Function Analysis ===")
        
        # Test if currencyConvert function exists and analyze its usage
        currency_convert_test = '''
const fs = require('fs');
const path = require('path');

try {
  // Look for currencyConvert function definition
  const helperPath = '/app/backend/helper/index.ts';
  let currencyConvertExists = false;
  let currencyConvertCode = '';
  
  if (fs.existsSync(helperPath)) {
    const helperContent = fs.readFileSync(helperPath, 'utf8');
    if (helperContent.includes('currencyConvert')) {
      currencyConvertExists = true;
      // Extract the function definition
      const lines = helperContent.split('\\n');
      const startIndex = lines.findIndex(line => line.includes('export const currencyConvert') || line.includes('const currencyConvert'));
      if (startIndex !== -1) {
        // Get function definition (approximate)
        currencyConvertCode = lines.slice(startIndex, startIndex + 20).join('\\n');
      }
    }
  }
  
  // Also check if it's imported in paymentController
  const paymentControllerPath = '/app/backend/controller/paymentController.ts';
  let importedInPaymentController = false;
  
  if (fs.existsSync(paymentControllerPath)) {
    const paymentContent = fs.readFileSync(paymentControllerPath, 'utf8');
    importedInPaymentController = paymentContent.includes('currencyConvert');
  }
  
  console.log(JSON.stringify({
    currency_convert_exists: currencyConvertExists,
    imported_in_payment_controller: importedInPaymentController,
    function_preview: currencyConvertCode.substring(0, 500) + (currencyConvertCode.length > 500 ? '...' : ''),
    analysis: {
      function_available: currencyConvertExists,
      used_in_payments: importedInPaymentController
    }
  }, null, 2));
  
} catch (error) {
  console.error('Currency convert analysis failed:', error.message);
  process.exit(1);
}
'''
        
        try:
            # Write currency convert analysis script
            with open('/tmp/analyze_currency_convert.js', 'w') as f:
                f.write(currency_convert_test)
            
            # Run the analysis
            result = subprocess.run(
                ["node", "/tmp/analyze_currency_convert.js"],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    convert_data = json.loads(result.stdout)
                    analysis = convert_data.get('analysis', {})
                    
                    function_available = analysis.get('function_available', False)
                    used_in_payments = analysis.get('used_in_payments', False)
                    
                    if function_available and used_in_payments:
                        self.log_result(
                            "Currency Conversion Function", 
                            True, 
                            "✅ currencyConvert function exists and is used in payment processing",
                            {
                                "function_exists": function_available,
                                "used_in_payments": used_in_payments,
                                "function_preview": convert_data.get('function_preview', '')[:200] + '...'
                            }
                        )
                    else:
                        issues = []
                        if not function_available:
                            issues.append("currencyConvert function not found")
                        if not used_in_payments:
                            issues.append("not imported in payment controller")
                        
                        self.log_result(
                            "Currency Conversion Function", 
                            False, 
                            f"❌ Issues found: {', '.join(issues)}",
                            {
                                "function_exists": function_available,
                                "used_in_payments": used_in_payments
                            }
                        )
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Currency Conversion Function", 
                        False, 
                        "Failed to parse currency convert analysis results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
            else:
                self.log_result(
                    "Currency Conversion Function", 
                    False, 
                    "Currency convert analysis script failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Currency Conversion Function", 
                False, 
                f"Currency convert analysis failed: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all API key base currency tests"""
        print("🔍 API KEY BASE CURRENCY FUNCTIONALITY TESTING")
        print("=" * 60)
        
        # Step 1: Authenticate
        if not self.authenticate_user():
            print("\n❌ CRITICAL: Authentication failed. Cannot proceed with tests.")
            return False
        
        # Step 2: Test API key creation with different currencies
        self.test_api_key_creation_different_currencies()
        
        # Step 3: Check database for existing API keys
        self.test_database_api_keys_query()
        
        # Step 4: Verify base_currency in API retrieval
        self.test_get_api_keys_endpoint()
        
        # Step 5: Verify base_currency usage in payment processing
        self.test_payment_processing_base_currency_usage()
        
        # Step 6: Test currency conversion function
        self.test_currency_conversion_function()
        
        return True
    
    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 60)
        print("📊 API KEY BASE CURRENCY TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\n🚨 FAILED TESTS:")
            for error in self.errors:
                print(f"  • {error}")
        
        # Expected findings summary
        print(f"\n🔍 EXPECTED FINDINGS VERIFICATION:")
        
        findings = {
            "✅ API key model HAS base_currency field": any("base_currency field" in result['message'] and result['success'] for result in self.test_results.values()),
            "✅ base_currency can be set during API key creation": any("Successfully created API key with base currency" in result['message'] for result in self.test_results.values()),
            "✅ base_currency is used for main payment amount conversion": any("Main payment conversion uses customerData.base_currency" in result['message'] for result in self.test_results.values()),
            "🐛 base_currency NOT used for overpayment conversion (BUG!)": any("CONFIRMED BUG: Overpayment conversion hardcoded to USD" in result['message'] for result in self.test_results.values())
        }
        
        for finding, verified in findings.items():
            status = "✅ VERIFIED" if verified else "❌ NOT VERIFIED"
            print(f"  {finding}: {status}")
        
        return passed_tests == total_tests

def main():
    """Main test execution"""
    tester = ApiKeyBaseCurrencyTester()
    
    try:
        success = tester.run_all_tests()
        tester.generate_summary()
        
        # Exit with appropriate code
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Test execution interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n💥 Test execution failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()