#!/usr/bin/env python3
"""
API Key Base Currency Functionality Testing - Database & Code Analysis
Tests if API key base_currency field is properly working and being used in payment processing.
"""

import os
import sys
import json
import subprocess
from typing import Dict, List, Any

class ApiKeyBaseCurrencyAnalyzer:
    def __init__(self):
        self.test_results = {}
        self.errors = []
        
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
    
    def test_database_api_keys_analysis(self):
        """TEST 1: Database Analysis - Check existing API keys and their base currencies"""
        print("\n=== TEST 1: Database Analysis - API Keys with Base Currencies ===")
        
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

async function analyzeApiKeys() {
  try {
    await sequelize.authenticate();
    
    // Get all API keys with base_currency information
    const apiKeys = await sequelize.query(
      `SELECT api_id, api_name, base_currency, user_id, company_id, environment, status, created_at
       FROM tbl_api 
       ORDER BY api_id DESC 
       LIMIT 20`,
      { type: QueryTypes.SELECT }
    );
    
    // Get currency distribution
    const currencyStats = await sequelize.query(
      `SELECT base_currency, COUNT(*) as count, environment
       FROM tbl_api 
       GROUP BY base_currency, environment
       ORDER BY count DESC`,
      { type: QueryTypes.SELECT }
    );
    
    // Check if base_currency column exists and its properties
    const columnInfo = await sequelize.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns 
       WHERE table_name = 'tbl_api' AND column_name = 'base_currency'`,
      { type: QueryTypes.SELECT }
    );
    
    // Get default base_currency value
    const defaultCurrencyCount = await sequelize.query(
      `SELECT COUNT(*) as count FROM tbl_api WHERE base_currency = 'USD'`,
      { type: QueryTypes.SELECT }
    );
    
    console.log(JSON.stringify({
      total_api_keys: apiKeys.length,
      api_keys_sample: apiKeys.slice(0, 10),
      currency_distribution: currencyStats,
      base_currency_column_info: columnInfo,
      default_usd_count: defaultCurrencyCount[0]?.count || 0,
      unique_currencies: [...new Set(apiKeys.map(api => api.base_currency))],
      analysis: {
        base_currency_field_exists: columnInfo.length > 0,
        has_multiple_currencies: currencyStats.length > 1,
        default_currency: apiKeys.length > 0 ? 'USD' : null
      }
    }, null, 2));
    
    process.exit(0);
    
  } catch (error) {
    console.error('Database analysis failed:', error.message);
    process.exit(1);
  }
}

analyzeApiKeys();
'''
        
        try:
            with open('/tmp/analyze_api_keys_db.js', 'w') as f:
                f.write(query_script)
            
            result = subprocess.run(
                ["node", "/tmp/analyze_api_keys_db.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    db_data = json.loads(result.stdout)
                    analysis = db_data.get('analysis', {})
                    
                    # Check if base_currency field exists
                    field_exists = analysis.get('base_currency_field_exists', False)
                    has_multiple_currencies = analysis.get('has_multiple_currencies', False)
                    unique_currencies = db_data.get('unique_currencies', [])
                    currency_distribution = db_data.get('currency_distribution', [])
                    
                    if field_exists:
                        self.log_result(
                            "Database - base_currency Field", 
                            True, 
                            f"✅ base_currency field exists in tbl_api table",
                            {"column_info": db_data.get('base_currency_column_info', [])}
                        )
                    else:
                        self.log_result(
                            "Database - base_currency Field", 
                            False, 
                            "❌ base_currency field not found in tbl_api table"
                        )
                    
                    if has_multiple_currencies:
                        self.log_result(
                            "Database - Multiple Currencies", 
                            True, 
                            f"✅ API keys support multiple base currencies: {', '.join(unique_currencies)}",
                            {
                                "unique_currencies": unique_currencies,
                                "currency_distribution": currency_distribution,
                                "total_keys": db_data.get('total_api_keys', 0)
                            }
                        )
                    else:
                        self.log_result(
                            "Database - Multiple Currencies", 
                            False, 
                            f"Only one currency found: {unique_currencies[0] if unique_currencies else 'None'}",
                            {"unique_currencies": unique_currencies}
                        )
                    
                    # Show sample API keys
                    sample_keys = db_data.get('api_keys_sample', [])
                    if sample_keys:
                        self.log_result(
                            "Database - Sample API Keys", 
                            True, 
                            f"Found {len(sample_keys)} API keys with base_currency data",
                            {
                                "sample_keys": [
                                    {
                                        "api_id": key.get('api_id'),
                                        "base_currency": key.get('base_currency'),
                                        "environment": key.get('environment'),
                                        "api_name": key.get('api_name') or 'No name'
                                    } for key in sample_keys[:5]
                                ]
                            }
                        )
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Database Analysis", 
                        False, 
                        "Failed to parse database analysis results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
            else:
                self.log_result(
                    "Database Analysis", 
                    False, 
                    "Database analysis script failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Database Analysis", 
                False, 
                f"Database analysis failed: {str(e)}"
            )
    
    def test_api_model_structure(self):
        """TEST 2: Verify API Model Structure"""
        print("\n=== TEST 2: API Model Structure Analysis ===")
        
        try:
            # Read the API model file
            with open('/app/backend/models/apiModels/apiModel.ts', 'r') as f:
                model_content = f.read()
            
            # Check for base_currency field definition
            has_base_currency = 'base_currency:' in model_content
            has_default_usd = 'defaultValue: "USD"' in model_content
            has_environment_field = 'environment:' in model_content
            has_status_field = 'status:' in model_content
            
            # Extract base_currency field definition
            lines = model_content.split('\n')
            base_currency_lines = []
            for i, line in enumerate(lines):
                if 'base_currency:' in line:
                    # Get the field definition (current line + next few lines)
                    base_currency_lines = lines[i:i+4]
                    break
            
            if has_base_currency:
                self.log_result(
                    "API Model - base_currency Field", 
                    True, 
                    "✅ base_currency field defined in API model",
                    {
                        "has_default_usd": has_default_usd,
                        "field_definition": base_currency_lines
                    }
                )
            else:
                self.log_result(
                    "API Model - base_currency Field", 
                    False, 
                    "❌ base_currency field not found in API model"
                )
            
            # Check for other relevant fields
            model_features = {
                "environment_field": has_environment_field,
                "status_field": has_status_field,
                "base_currency_field": has_base_currency,
                "default_usd": has_default_usd
            }
            
            self.log_result(
                "API Model - Structure", 
                True, 
                f"API model analysis complete",
                {"features": model_features}
            )
            
        except Exception as e:
            self.log_result(
                "API Model Structure", 
                False, 
                f"Failed to analyze API model: {str(e)}"
            )
    
    def test_payment_controller_analysis(self):
        """TEST 3: Payment Controller Base Currency Usage Analysis"""
        print("\n=== TEST 3: Payment Controller Base Currency Usage ===")
        
        try:
            # Read the payment controller file
            with open('/app/backend/controller/paymentController.ts', 'r') as f:
                controller_content = f.read()
            
            lines = controller_content.split('\n')
            
            # Find specific lines mentioned in review request
            main_conversion_found = False
            overpayment_bug_found = False
            
            # Look for line 1609-1614 (main conversion)
            for i in range(1608, min(1615, len(lines))):
                if i < len(lines) and 'customerData?.base_currency' in lines[i]:
                    main_conversion_found = True
                    break
            
            # Look for line 1839-1844 (overpayment bug)
            for i in range(1838, min(1845, len(lines))):
                if i < len(lines) and 'currency: ["USD"]' in lines[i]:
                    overpayment_bug_found = True
                    break
            
            # Count all base_currency usages
            base_currency_usages = []
            hardcoded_usd_usages = []
            
            for i, line in enumerate(lines):
                if 'base_currency' in line or 'customerData?.base_currency' in line:
                    base_currency_usages.append({
                        "line_number": i + 1,
                        "content": line.strip()
                    })
                
                if 'currency: ["USD"]' in line or "currency: ['USD']" in line:
                    hardcoded_usd_usages.append({
                        "line_number": i + 1,
                        "content": line.strip()
                    })
            
            # Test results
            if main_conversion_found:
                self.log_result(
                    "Payment Controller - Main Conversion", 
                    True, 
                    "✅ Main payment conversion uses customerData.base_currency",
                    {"line_found": True}
                )
            else:
                self.log_result(
                    "Payment Controller - Main Conversion", 
                    False, 
                    "❌ Main payment conversion does not use customerData.base_currency"
                )
            
            if overpayment_bug_found:
                self.log_result(
                    "Payment Controller - Overpayment Bug", 
                    True, 
                    "🐛 CONFIRMED BUG: Overpayment conversion hardcoded to USD",
                    {"bug_confirmed": True}
                )
            else:
                self.log_result(
                    "Payment Controller - Overpayment Bug", 
                    False, 
                    "Overpayment conversion bug not found at expected location"
                )
            
            self.log_result(
                "Payment Controller - Usage Summary", 
                True, 
                f"Found {len(base_currency_usages)} base_currency usages and {len(hardcoded_usd_usages)} hardcoded USD usages",
                {
                    "base_currency_count": len(base_currency_usages),
                    "hardcoded_usd_count": len(hardcoded_usd_usages),
                    "base_currency_lines": [f"Line {u['line_number']}: {u['content'][:80]}..." for u in base_currency_usages[:3]],
                    "hardcoded_usd_lines": [f"Line {u['line_number']}: {u['content'][:80]}..." for u in hardcoded_usd_usages[:3]]
                }
            )
            
        except Exception as e:
            self.log_result(
                "Payment Controller Analysis", 
                False, 
                f"Failed to analyze payment controller: {str(e)}"
            )
    
    def test_api_controller_analysis(self):
        """TEST 4: API Controller Base Currency Support"""
        print("\n=== TEST 4: API Controller Base Currency Support ===")
        
        try:
            # Read the API controller file
            with open('/app/backend/controller/apiController.ts', 'r') as f:
                controller_content = f.read()
            
            # Check for base_currency support in API creation
            has_base_currency_param = 'base_currency' in controller_content
            has_currency_validation = 'base_currency,' in controller_content
            has_api_creation = 'addApi' in controller_content
            
            # Look for specific base_currency handling
            lines = controller_content.split('\n')
            base_currency_lines = []
            
            for i, line in enumerate(lines):
                if 'base_currency' in line:
                    base_currency_lines.append({
                        "line_number": i + 1,
                        "content": line.strip()
                    })
            
            if has_base_currency_param:
                self.log_result(
                    "API Controller - Base Currency Support", 
                    True, 
                    "✅ API controller supports base_currency parameter",
                    {
                        "has_base_currency_param": has_base_currency_param,
                        "has_api_creation": has_api_creation,
                        "usage_count": len(base_currency_lines)
                    }
                )
            else:
                self.log_result(
                    "API Controller - Base Currency Support", 
                    False, 
                    "❌ API controller does not support base_currency parameter"
                )
            
            # Show sample base_currency usage lines
            if base_currency_lines:
                self.log_result(
                    "API Controller - Base Currency Usage", 
                    True, 
                    f"Found {len(base_currency_lines)} base_currency references in API controller",
                    {
                        "sample_lines": [f"Line {line['line_number']}: {line['content'][:80]}..." for line in base_currency_lines[:5]]
                    }
                )
            
        except Exception as e:
            self.log_result(
                "API Controller Analysis", 
                False, 
                f"Failed to analyze API controller: {str(e)}"
            )
    
    def test_currency_conversion_analysis(self):
        """TEST 5: Currency Conversion Function Analysis"""
        print("\n=== TEST 5: Currency Conversion Function Analysis ===")
        
        try:
            # Check if currencyConvert function exists
            helper_files = [
                '/app/backend/helper/index.ts',
                '/app/backend/helper/currencyHelper.ts',
                '/app/backend/utils/currencyConvert.ts'
            ]
            
            currency_convert_found = False
            function_content = ""
            
            for helper_file in helper_files:
                try:
                    with open(helper_file, 'r') as f:
                        content = f.read()
                        if 'currencyConvert' in content:
                            currency_convert_found = True
                            # Extract function definition
                            lines = content.split('\n')
                            for i, line in enumerate(lines):
                                if 'export const currencyConvert' in line or 'const currencyConvert' in line:
                                    function_content = '\n'.join(lines[i:i+10])
                                    break
                            break
                except FileNotFoundError:
                    continue
            
            if currency_convert_found:
                self.log_result(
                    "Currency Conversion - Function Exists", 
                    True, 
                    "✅ currencyConvert function found",
                    {"function_preview": function_content[:300] + "..."}
                )
            else:
                self.log_result(
                    "Currency Conversion - Function Exists", 
                    False, 
                    "❌ currencyConvert function not found in helper files"
                )
            
            # Check if it's imported in payment controller
            with open('/app/backend/controller/paymentController.ts', 'r') as f:
                payment_content = f.read()
                imported_in_payment = 'currencyConvert' in payment_content
            
            if imported_in_payment:
                self.log_result(
                    "Currency Conversion - Payment Integration", 
                    True, 
                    "✅ currencyConvert function is used in payment controller"
                )
            else:
                self.log_result(
                    "Currency Conversion - Payment Integration", 
                    False, 
                    "❌ currencyConvert function not imported in payment controller"
                )
            
        except Exception as e:
            self.log_result(
                "Currency Conversion Analysis", 
                False, 
                f"Failed to analyze currency conversion: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all API key base currency tests"""
        print("🔍 API KEY BASE CURRENCY FUNCTIONALITY ANALYSIS")
        print("=" * 60)
        
        # Test 1: Database analysis
        self.test_database_api_keys_analysis()
        
        # Test 2: API model structure
        self.test_api_model_structure()
        
        # Test 3: Payment controller analysis
        self.test_payment_controller_analysis()
        
        # Test 4: API controller analysis
        self.test_api_controller_analysis()
        
        # Test 5: Currency conversion analysis
        self.test_currency_conversion_analysis()
        
        return True
    
    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 60)
        print("📊 API KEY BASE CURRENCY ANALYSIS SUMMARY")
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
        
        # Expected findings verification
        print(f"\n🔍 EXPECTED FINDINGS VERIFICATION:")
        
        findings = {
            "✅ API key model HAS base_currency field": any("base_currency field defined in API model" in result['message'] or "base_currency field exists in tbl_api table" in result['message'] for result in self.test_results.values()),
            "✅ base_currency can be set during API key creation": any("API controller supports base_currency parameter" in result['message'] for result in self.test_results.values()),
            "✅ base_currency is used for main payment amount conversion": any("Main payment conversion uses customerData.base_currency" in result['message'] for result in self.test_results.values()),
            "🐛 base_currency NOT used for overpayment conversion (BUG!)": any("CONFIRMED BUG: Overpayment conversion hardcoded to USD" in result['message'] for result in self.test_results.values())
        }
        
        for finding, verified in findings.items():
            status = "✅ VERIFIED" if verified else "❌ NOT VERIFIED"
            print(f"  {finding}: {status}")
        
        # Recommendations
        print(f"\n💡 RECOMMENDATIONS:")
        
        if findings["🐛 base_currency NOT used for overpayment conversion (BUG!)"]:
            print("  🔧 FIX REQUIRED: Update overpayment conversion in paymentController.ts line ~1841")
            print("     Change: currency: [\"USD\"] → currency: [customerData?.base_currency]")
        
        if not findings["✅ base_currency can be set during API key creation"]:
            print("  🔧 ENHANCEMENT: Ensure API creation endpoint accepts base_currency parameter")
        
        return passed_tests == total_tests

def main():
    """Main test execution"""
    analyzer = ApiKeyBaseCurrencyAnalyzer()
    
    try:
        success = analyzer.run_all_tests()
        analyzer.generate_summary()
        
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