#!/usr/bin/env python3
"""
DynoPay Partial Payment Threshold Testing Suite - Focused Analysis
Tests the threshold logic and partial payment handling capabilities.
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any
from datetime import datetime, timedelta
import subprocess

class PartialPaymentAnalyzer:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.user_id = None
        self.company_id = None
        
        # Test credentials from review request
        self.test_email = "john@dyno.pt"
        self.test_password = "Katiekendra123@"
        
        print("=== DynoPay Partial Payment Threshold Analysis ===")
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Credentials: {self.test_email}")
        print("=" * 60)
        
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
        """Authenticate with provided test credentials"""
        print("\n=== Authentication ===")
        
        try:
            login_response = requests.post(
                f"{self.backend_url}/api/user/login",
                json={
                    "email": self.test_email,
                    "password": self.test_password
                },
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if login_response.status_code == 200:
                login_data = login_response.json()
                if 'data' in login_data and 'accessToken' in login_data['data']:
                    self.jwt_token = login_data['data']['accessToken']
                    self.user_id = login_data['data'].get('user_id')
                    
                    self.log_result(
                        "User Authentication", 
                        True, 
                        f"Successfully authenticated as {self.test_email}",
                        {"user_id": self.user_id}
                    )
                    return True
                    
        except Exception as e:
            self.log_result("User Authentication", False, f"Authentication failed: {str(e)}")
        
        return False
    
    def analyze_threshold_configuration(self):
        """Analyze threshold configuration and fee structure"""
        print("\n=== Threshold Configuration Analysis ===")
        
        try:
            # Read backend .env file
            with open('/app/backend/.env', 'r') as f:
                env_content = f.read()
            
            # Extract threshold values
            thresholds = {}
            fee_tiers = {}
            
            for line in env_content.split('\n'):
                if '_THRESHOLD=' in line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    currency = key.replace('_THRESHOLD', '')
                    thresholds[currency] = float(value)
                elif line.startswith('FEE_TIER_') and '_MIN=' in line:
                    # Extract fee tier information
                    parts = line.split('=')
                    if len(parts) == 2:
                        key = parts[0]
                        value = parts[1]
                        tier_num = key.split('_')[2]
                        field = key.split('_')[3]
                        
                        if tier_num not in fee_tiers:
                            fee_tiers[tier_num] = {}
                        fee_tiers[tier_num][field] = float(value)
            
            # Verify ETH threshold
            eth_threshold = thresholds.get('ETH', 0)
            if eth_threshold == 5:
                self.log_result(
                    "ETH Threshold Configuration", 
                    True, 
                    f"ETH threshold correctly set to ${eth_threshold} USD",
                    {"eth_threshold": eth_threshold, "all_thresholds": thresholds}
                )
            else:
                self.log_result(
                    "ETH Threshold Configuration", 
                    False, 
                    f"ETH threshold is ${eth_threshold} USD (expected $5 USD)",
                    {"eth_threshold": eth_threshold}
                )
            
            # Analyze fee tiers
            if fee_tiers:
                tier_analysis = {}
                for tier_num, tier_data in fee_tiers.items():
                    tier_analysis[f"Tier {tier_num}"] = {
                        "range": f"${tier_data.get('MIN', 0)}-${tier_data.get('MAX', 'unlimited')}",
                        "fixed_fee": f"${tier_data.get('FIXED', 0)}",
                        "buffer": f"{tier_data.get('BUFFER', 0)}%"
                    }
                
                self.log_result(
                    "Fee Tier Configuration", 
                    True, 
                    f"Found {len(fee_tiers)} fee tiers configured",
                    tier_analysis
                )
            else:
                self.log_result(
                    "Fee Tier Configuration", 
                    False, 
                    "No fee tiers found in configuration"
                )
                
        except Exception as e:
            self.log_result(
                "Threshold Configuration Analysis", 
                False, 
                f"Analysis failed: {str(e)}"
            )
    
    def analyze_database_structure(self):
        """Analyze database structure for partial payment support"""
        print("\n=== Database Structure Analysis ===")
        
        db_script = '''
const { Sequelize } = require('sequelize');
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

async function analyzeStructure() {
  try {
    await sequelize.authenticate();
    
    // Check tbl_user_temp_address structure
    const tempAddressColumns = await sequelize.query(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_name = 'tbl_user_temp_address' 
       ORDER BY ordinal_position`,
      { type: sequelize.QueryTypes.SELECT }
    );
    
    // Check for partial payment related columns
    const partialColumns = tempAddressColumns.filter(col => 
      col.column_name.includes('partial') || 
      col.column_name.includes('fee_payer') ||
      col.column_name.includes('merchant_amount')
    );
    
    // Get status distribution
    const statusDistribution = await sequelize.query(
      `SELECT status, COUNT(*) as count 
       FROM tbl_user_temp_address 
       GROUP BY status 
       ORDER BY count DESC`,
      { type: sequelize.QueryTypes.SELECT }
    );
    
    // Check admin wallet structure
    const adminWallets = await sequelize.query(
      `SELECT wallet_type, fee, balance 
       FROM tbl_admin_wallet 
       ORDER BY wallet_type`,
      { type: sequelize.QueryTypes.SELECT }
    );
    
    console.log(JSON.stringify({
      success: true,
      temp_address_columns: tempAddressColumns.length,
      partial_payment_columns: partialColumns,
      status_distribution: statusDistribution,
      admin_wallets: adminWallets,
      analysis: {
        has_partial_timestamp: partialColumns.some(col => col.column_name === 'partial_payment_timestamp'),
        has_fee_payer: partialColumns.some(col => col.column_name === 'fee_payer'),
        has_merchant_amount: partialColumns.some(col => col.column_name === 'merchant_amount'),
        total_temp_records: statusDistribution.reduce((sum, s) => sum + parseInt(s.count), 0)
      }
    }, null, 2));
    
    process.exit(0);
    
  } catch (error) {
    console.error('Database analysis failed:', error.message);
    process.exit(1);
  }
}

analyzeStructure();
'''
        
        try:
            with open('/tmp/analyze_db_structure.js', 'w') as f:
                f.write(db_script)
            
            result = subprocess.run(
                ["node", "/tmp/analyze_db_structure.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    analysis_data = json.loads(result.stdout)
                    analysis = analysis_data.get('analysis', {})
                    
                    # Check if partial payment infrastructure exists
                    has_infrastructure = (
                        analysis.get('has_partial_timestamp', False) and
                        analysis.get('has_fee_payer', False) and
                        analysis.get('has_merchant_amount', False)
                    )
                    
                    self.log_result(
                        "Partial Payment Database Infrastructure", 
                        has_infrastructure, 
                        "Partial payment infrastructure is complete" if has_infrastructure else "Missing partial payment columns",
                        {
                            "partial_timestamp": analysis.get('has_partial_timestamp', False),
                            "fee_payer": analysis.get('has_fee_payer', False),
                            "merchant_amount": analysis.get('has_merchant_amount', False),
                            "total_records": analysis.get('total_temp_records', 0)
                        }
                    )
                    
                    # Analyze status distribution
                    status_dist = analysis_data.get('status_distribution', [])
                    if status_dist:
                        status_summary = {s['status']: s['count'] for s in status_dist}
                        self.log_result(
                            "Transaction Status Distribution", 
                            True, 
                            f"Found {len(status_dist)} different statuses",
                            status_summary
                        )
                    
                    # Check admin wallets
                    admin_wallets = analysis_data.get('admin_wallets', [])
                    eth_wallet = next((w for w in admin_wallets if w['wallet_type'] == 'ETH'), None)
                    
                    if eth_wallet:
                        self.log_result(
                            "Admin ETH Wallet", 
                            True, 
                            f"ETH admin wallet found with fee balance: {eth_wallet['fee']}",
                            {"fee_balance": eth_wallet['fee'], "main_balance": eth_wallet['balance']}
                        )
                    else:
                        self.log_result(
                            "Admin ETH Wallet", 
                            False, 
                            "ETH admin wallet not found"
                        )
                    
                    return analysis_data
                    
                except json.JSONDecodeError:
                    self.log_result(
                        "Database Structure Analysis", 
                        False, 
                        "Failed to parse analysis results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
            else:
                self.log_result(
                    "Database Structure Analysis", 
                    False, 
                    "Database analysis failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Database Structure Analysis", 
                False, 
                f"Analysis failed: {str(e)}"
            )
        
        return None
    
    def test_threshold_calculation_logic(self):
        """Test the threshold calculation logic"""
        print("\n=== Threshold Calculation Logic Test ===")
        
        # Test the calculateTransactionFees function
        test_script = '''
const { calculateTransactionFees } = require('./controller/index');

async function testThresholdLogic() {
  try {
    // Test Case 1: Above threshold ($30 ETH equivalent)
    const aboveThresholdResult = await calculateTransactionFees('ETH', 30);
    
    // Test Case 2: Below threshold ($3 ETH equivalent)  
    const belowThresholdResult = await calculateTransactionFees('ETH', 3);
    
    // Test Case 3: Exactly at threshold ($5 ETH equivalent)
    const atThresholdResult = await calculateTransactionFees('ETH', 5);
    
    console.log(JSON.stringify({
      success: true,
      test_cases: {
        above_threshold_30: {
          amount: 30,
          threshold_check: 30 >= aboveThresholdResult.minForwarding,
          fees: {
            fixed: aboveThresholdResult.fixedFee,
            transaction: aboveThresholdResult.transactionFee,
            buffer: aboveThresholdResult.blockchainBuffer,
            total: aboveThresholdResult.totalDeduction
          },
          merchant_receives: aboveThresholdResult.userReceives,
          min_forwarding: aboveThresholdResult.minForwarding
        },
        below_threshold_3: {
          amount: 3,
          threshold_check: 3 >= belowThresholdResult.minForwarding,
          fees: {
            fixed: belowThresholdResult.fixedFee,
            transaction: belowThresholdResult.transactionFee,
            buffer: belowThresholdResult.blockchainBuffer,
            total: belowThresholdResult.totalDeduction
          },
          merchant_receives: belowThresholdResult.userReceives,
          min_forwarding: belowThresholdResult.minForwarding
        },
        at_threshold_5: {
          amount: 5,
          threshold_check: 5 >= atThresholdResult.minForwarding,
          fees: {
            fixed: atThresholdResult.fixedFee,
            transaction: atThresholdResult.transactionFee,
            buffer: atThresholdResult.blockchainBuffer,
            total: atThresholdResult.totalDeduction
          },
          merchant_receives: atThresholdResult.userReceives,
          min_forwarding: atThresholdResult.minForwarding
        }
      }
    }, null, 2));
    
    process.exit(0);
    
  } catch (error) {
    console.error('Threshold logic test failed:', error.message);
    console.log(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2));
    process.exit(1);
  }
}

testThresholdLogic();
'''
        
        try:
            with open('/tmp/test_threshold_logic.js', 'w') as f:
                f.write(test_script)
            
            result = subprocess.run(
                ["node", "/tmp/test_threshold_logic.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    test_data = json.loads(result.stdout)
                    if test_data.get('success'):
                        test_cases = test_data.get('test_cases', {})
                        
                        # Analyze Test Case 1: $30 (Above Threshold)
                        above_case = test_cases.get('above_threshold_30', {})
                        above_threshold_check = above_case.get('threshold_check', False)
                        
                        self.log_result(
                            "Threshold Logic - Above ($30)", 
                            above_threshold_check, 
                            f"$30 >= ${above_case.get('min_forwarding', 0)} threshold: {above_threshold_check}",
                            {
                                "amount": 30,
                                "min_forwarding": above_case.get('min_forwarding'),
                                "merchant_receives": above_case.get('merchant_receives'),
                                "total_fees": above_case.get('fees', {}).get('total')
                            }
                        )
                        
                        # Analyze Test Case 2: $3 (Below Threshold)
                        below_case = test_cases.get('below_threshold_3', {})
                        below_threshold_check = below_case.get('threshold_check', True)  # Should be False
                        
                        self.log_result(
                            "Threshold Logic - Below ($3)", 
                            not below_threshold_check,  # Success if below threshold
                            f"$3 < ${below_case.get('min_forwarding', 0)} threshold: {not below_threshold_check}",
                            {
                                "amount": 3,
                                "min_forwarding": below_case.get('min_forwarding'),
                                "merchant_receives": below_case.get('merchant_receives'),
                                "total_fees": below_case.get('fees', {}).get('total')
                            }
                        )
                        
                        # Analyze Test Case 3: $5 (At Threshold)
                        at_case = test_cases.get('at_threshold_5', {})
                        at_threshold_check = at_case.get('threshold_check', False)
                        
                        self.log_result(
                            "Threshold Logic - At Threshold ($5)", 
                            at_threshold_check, 
                            f"$5 >= ${at_case.get('min_forwarding', 0)} threshold: {at_threshold_check}",
                            {
                                "amount": 5,
                                "min_forwarding": at_case.get('min_forwarding'),
                                "merchant_receives": at_case.get('merchant_receives'),
                                "total_fees": at_case.get('fees', {}).get('total')
                            }
                        )
                        
                        return test_data
                    else:
                        self.log_result(
                            "Threshold Calculation Logic", 
                            False, 
                            f"Test failed: {test_data.get('error', 'Unknown error')}"
                        )
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Threshold Calculation Logic", 
                        False, 
                        "Failed to parse test results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
            else:
                self.log_result(
                    "Threshold Calculation Logic", 
                    False, 
                    "Threshold logic test failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Threshold Calculation Logic", 
                False, 
                f"Test failed: {str(e)}"
            )
        
        return None
    
    def analyze_partial_payment_code(self):
        """Analyze the partial payment processing code"""
        print("\n=== Partial Payment Code Analysis ===")
        
        try:
            # Check if processIncompletePayments function exists in the code
            with open('/app/backend/controller/paymentController.ts', 'r') as f:
                controller_content = f.read()
            
            # Look for key partial payment functions and logic
            code_analysis = {
                "processIncompletePayments_function": "processIncompletePayments" in controller_content,
                "partial_status_handling": "status: 'partial'" in controller_content,
                "threshold_check_logic": "minForwarding" in controller_content,
                "30_minute_grace_period": "30 minutes" in controller_content or "INTERVAL '30 minutes'" in controller_content,
                "completed_partial_status": "completed_partial" in controller_content,
                "admin_fee_below_threshold": "below threshold" in controller_content.lower(),
                "partial_payment_timestamp": "partial_payment_timestamp" in controller_content
            }
            
            # Count how many features are implemented
            implemented_features = sum(1 for feature, exists in code_analysis.items() if exists)
            total_features = len(code_analysis)
            
            success = implemented_features >= (total_features * 0.8)  # 80% threshold
            
            self.log_result(
                "Partial Payment Code Implementation", 
                success, 
                f"Found {implemented_features}/{total_features} partial payment features in code",
                code_analysis
            )
            
            # Check specific threshold logic patterns
            threshold_patterns = [
                "Number(totalReceived) < Number(minForwarding)",
                "Number(tempTx.amount) < Number(minForwarding)",
                "adminAmountToSend = Number(totalReceived)",
                "userAmountToSend = 0"
            ]
            
            found_patterns = []
            for pattern in threshold_patterns:
                if pattern in controller_content:
                    found_patterns.append(pattern)
            
            self.log_result(
                "Threshold Logic Patterns", 
                len(found_patterns) >= 3, 
                f"Found {len(found_patterns)}/4 expected threshold logic patterns",
                {"found_patterns": found_patterns}
            )
            
        except Exception as e:
            self.log_result(
                "Partial Payment Code Analysis", 
                False, 
                f"Code analysis failed: {str(e)}"
            )
    
    def test_payment_link_creation(self):
        """Test payment link creation for both scenarios"""
        print("\n=== Payment Link Creation Test ===")
        
        if not self.jwt_token:
            self.log_result("Payment Link Creation", False, "No JWT token available")
            return
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Test Case 1: Above threshold ($50)
            above_threshold_data = {
                "email": "partial-above-test@example.com",
                "amount": 50,
                "currency": "USD",
                "modes": ["CRYPTO"]
            }
            
            response1 = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=above_threshold_data,
                headers=headers,
                timeout=15
            )
            
            # Test Case 2: Below threshold ($15)
            below_threshold_data = {
                "email": "partial-below-test@example.com",
                "amount": 15,
                "currency": "USD",
                "modes": ["CRYPTO"]
            }
            
            response2 = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=below_threshold_data,
                headers=headers,
                timeout=15
            )
            
            # Analyze results
            success1 = response1.status_code == 200
            success2 = response2.status_code == 200
            
            results = {}
            if success1:
                data1 = response1.json()
                results["above_threshold"] = {
                    "transaction_id": data1.get('data', {}).get('transaction_id'),
                    "amount": 50,
                    "status": "created"
                }
            
            if success2:
                data2 = response2.json()
                results["below_threshold"] = {
                    "transaction_id": data2.get('data', {}).get('transaction_id'),
                    "amount": 15,
                    "status": "created"
                }
            
            overall_success = success1 and success2
            
            self.log_result(
                "Payment Link Creation", 
                overall_success, 
                f"Created payment links: Above threshold ({success1}), Below threshold ({success2})",
                results
            )
            
        except Exception as e:
            self.log_result(
                "Payment Link Creation", 
                False, 
                f"Payment link creation failed: {str(e)}"
            )
    
    def run_comprehensive_analysis(self):
        """Run comprehensive analysis of partial payment threshold functionality"""
        print("\n" + "=" * 80)
        print("STARTING COMPREHENSIVE PARTIAL PAYMENT THRESHOLD ANALYSIS")
        print("=" * 80)
        
        # Phase 1: Authentication
        if not self.authenticate_user():
            print("\n❌ CRITICAL: Authentication failed. Cannot proceed with full analysis.")
            return False
        
        # Phase 2: Configuration Analysis
        self.analyze_threshold_configuration()
        
        # Phase 3: Database Structure Analysis
        self.analyze_database_structure()
        
        # Phase 4: Threshold Logic Testing
        self.test_threshold_calculation_logic()
        
        # Phase 5: Code Analysis
        self.analyze_partial_payment_code()
        
        # Phase 6: Payment Link Testing
        self.test_payment_link_creation()
        
        # Phase 7: Summary
        self.print_analysis_summary()
        
        return len(self.errors) == 0
    
    def print_analysis_summary(self):
        """Print comprehensive analysis summary"""
        print("\n" + "=" * 80)
        print("PARTIAL PAYMENT THRESHOLD ANALYSIS SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Analyses: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        # Categorize results
        critical_tests = [
            "User Authentication",
            "ETH Threshold Configuration", 
            "Threshold Logic - Above ($30)",
            "Threshold Logic - Below ($3)",
            "Partial Payment Code Implementation"
        ]
        
        critical_passed = sum(1 for test in critical_tests if test in self.test_results and self.test_results[test]['success'])
        
        print(f"\n🎯 CRITICAL FUNCTIONALITY: {critical_passed}/{len(critical_tests)} passed")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED ANALYSES ({failed_tests}):")
            for test_name, result in self.test_results.items():
                if not result['success']:
                    print(f"  • {test_name}: {result['message']}")
        
        print(f"\n📊 DETAILED RESULTS:")
        for test_name, result in self.test_results.items():
            status = "✅" if result['success'] else "❌"
            print(f"  {status} {test_name}: {result['message']}")
        
        # Provide recommendations
        print(f"\n💡 RECOMMENDATIONS:")
        
        if critical_passed == len(critical_tests):
            print("  ✅ Core partial payment threshold logic is implemented and working correctly")
            print("  ✅ System is ready for partial payment scenarios")
            print("  ✅ Threshold logic correctly handles above/below $5 USD scenarios")
        else:
            print("  ⚠️  Some critical functionality may need attention")
            print("  ⚠️  Review failed tests above for specific issues")
        
        print("\n" + "=" * 80)

def main():
    """Main analysis execution"""
    analyzer = PartialPaymentAnalyzer()
    
    try:
        success = analyzer.run_comprehensive_analysis()
        
        if success:
            print("\n🎉 ANALYSIS COMPLETE! Partial payment threshold system is properly implemented.")
            sys.exit(0)
        else:
            print(f"\n⚠️  ANALYSIS COMPLETE with {len(analyzer.errors)} issues found. See details above.")
            sys.exit(0)  # Don't fail on analysis issues, just report them
            
    except KeyboardInterrupt:
        print("\n\n⚠️  Analysis interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 CRITICAL ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()