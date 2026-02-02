#!/usr/bin/env python3
"""
SIMPLIFIED PARTIAL PAYMENT THRESHOLD TEST
Direct database approach as suggested in the review request (Option A)

This test directly inserts partial payment records and verifies the threshold logic
without relying on complex webhook simulation.
"""

import os
import sys
import json
import time
import requests
import subprocess
from typing import Dict, List, Any
from datetime import datetime, timedelta

class SimplifiedPartialPaymentTester:
    def __init__(self):
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        
        # Test credentials from existing tests
        self.test_user_email = "john@dyno.pt"
        self.test_user_password = "Katiekendra123@"
        
        print("🚀 SIMPLIFIED PARTIAL PAYMENT THRESHOLD TEST")
        print("=" * 60)
        print("Using Direct Database Approach (Option A)")
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
        """Authenticate with test credentials"""
        print("\n=== Authentication ===")
        
        try:
            login_response = requests.post(
                f"{self.backend_url}/api/user/login",
                json={
                    "email": self.test_user_email,
                    "password": self.test_user_password
                },
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if login_response.status_code == 200:
                login_data = login_response.json()
                if 'data' in login_data and 'accessToken' in login_data['data']:
                    self.jwt_token = login_data['data']['accessToken']
                    self.log_result(
                        "Authentication", 
                        True, 
                        f"Successfully authenticated {self.test_user_email}",
                        {"email": self.test_user_email}
                    )
                    return True
                    
        except Exception as e:
            self.log_result(
                "Authentication", 
                False, 
                f"Authentication failed: {str(e)}"
            )
        
        return False
    
    def verify_threshold_configuration(self):
        """Verify ETH threshold is set to $5"""
        print("\n=== Threshold Configuration ===")
        
        try:
            with open('/app/backend/.env', 'r') as f:
                env_content = f.read()
                
            eth_threshold = None
            for line in env_content.split('\n'):
                if line.startswith('ETH_THRESHOLD='):
                    eth_threshold = line.split('=', 1)[1].strip()
                    break
            
            if eth_threshold == "5":
                self.log_result(
                    "ETH Threshold Configuration", 
                    True, 
                    f"ETH_THRESHOLD correctly set to $5 USD",
                    {"threshold": eth_threshold}
                )
                return True
            else:
                self.log_result(
                    "ETH Threshold Configuration", 
                    False, 
                    f"ETH_THRESHOLD is {eth_threshold}, expected 5"
                )
                
        except Exception as e:
            self.log_result(
                "ETH Threshold Configuration", 
                False, 
                f"Failed to verify threshold: {str(e)}"
            )
        
        return False
    
    def insert_test_partial_payments(self):
        """Insert test partial payment records directly into database"""
        print("\n=== Inserting Test Partial Payment Records ===")
        
        # Generate test addresses and transaction IDs
        import random
        import string
        
        def generate_eth_address():
            return "0x" + ''.join(random.choices(string.hexdigits.lower(), k=40))
        
        def generate_tx_id():
            return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8)) + '-' + \
                   ''.join(random.choices(string.ascii_lowercase + string.digits, k=4)) + '-' + \
                   ''.join(random.choices(string.ascii_lowercase + string.digits, k=4)) + '-' + \
                   ''.join(random.choices(string.ascii_lowercase + string.digits, k=4)) + '-' + \
                   ''.join(random.choices(string.ascii_lowercase + string.digits, k=12))
        
        # Test scenarios
        scenarios = [
            {
                "name": "Above Threshold",
                "address": generate_eth_address(),
                "tx_id": generate_tx_id(),
                "amount": "0.0103",  # $30 worth of ETH
                "expected_amount": "0.017",  # $50 worth of ETH
                "user_id": 28,
                "company_id": 3,
                "wallet_type": "ETH"
            },
            {
                "name": "Below Threshold", 
                "address": generate_eth_address(),
                "tx_id": generate_tx_id(),
                "amount": "0.00103",  # $3 worth of ETH
                "expected_amount": "0.00514",  # $15 worth of ETH
                "user_id": 28,
                "company_id": 3,
                "wallet_type": "ETH"
            }
        ]
        
        insert_script = f'''
const {{ Sequelize, QueryTypes }} = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.USER_NAME,
  process.env.PASSWORD,
  {{
    host: process.env.HOST,
    port: Number(process.env.DB_PORT),
    dialect: "postgres",
    logging: false
  }}
);

async function insertTestRecords() {{
  try {{
    await sequelize.authenticate();
    
    const scenarios = {json.dumps(scenarios)};
    const results = [];
    
    // Set timestamp to 31 minutes ago to trigger processing
    const expiryTime = new Date(Date.now() - 31 * 60 * 1000);
    
    for (const scenario of scenarios) {{
      try {{
        const [result] = await sequelize.query(
          `INSERT INTO tbl_user_temp_address 
           (wallet_address, "txId", amount, expected_amount, status, 
            partial_payment_timestamp, user_id, company_id, wallet_type,
            "createdAt", "updatedAt")
           VALUES 
           (:address, :tx_id, :amount, :expected_amount, 'partial',
            :expiry_time, :user_id, :company_id, :wallet_type,
            NOW(), NOW())
           RETURNING *`,
          {{
            replacements: {{
              address: scenario.address,
              tx_id: scenario.tx_id,
              amount: scenario.amount,
              expected_amount: scenario.expected_amount,
              expiry_time: expiryTime,
              user_id: scenario.user_id,
              company_id: scenario.company_id,
              wallet_type: scenario.wallet_type
            }},
            type: QueryTypes.INSERT
          }}
        );
        
        results.push({{
          scenario: scenario.name,
          success: true,
          address: scenario.address,
          tx_id: scenario.tx_id,
          amount: scenario.amount
        }});
        
      }} catch (error) {{
        results.push({{
          scenario: scenario.name,
          success: false,
          error: error.message
        }});
      }}
    }}
    
    console.log(JSON.stringify({{
      success: true,
      results: results,
      scenarios: scenarios
    }}, null, 2));
    
    process.exit(0);
    
  }} catch (error) {{
    console.error('Database insertion failed:', error.message);
    process.exit(1);
  }}
}}

insertTestRecords();
'''
        
        try:
            # Write insertion script
            with open('/tmp/insert_partial_payments.js', 'w') as f:
                f.write(insert_script)
            
            # Run the insertion script
            result = subprocess.run(
                ["node", "/tmp/insert_partial_payments.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    insert_data = json.loads(result.stdout)
                    
                    if insert_data.get('success', False):
                        results = insert_data.get('results', [])
                        successful_inserts = [r for r in results if r.get('success', False)]
                        
                        self.log_result(
                            "Test Record Insertion", 
                            True, 
                            f"Successfully inserted {len(successful_inserts)}/2 test partial payment records",
                            {"scenarios": [r['scenario'] for r in successful_inserts]}
                        )
                        
                        # Store scenarios for later verification
                        self.test_scenarios = insert_data.get('scenarios', [])
                        return True
                    else:
                        self.log_result(
                            "Test Record Insertion", 
                            False, 
                            "Database insertion reported failure"
                        )
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Test Record Insertion", 
                        False, 
                        "Failed to parse insertion results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
            else:
                self.log_result(
                    "Test Record Insertion", 
                    False, 
                    "Database insertion script failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Test Record Insertion", 
                False, 
                f"Database insertion failed: {str(e)}"
            )
        
        return False
    
    def wait_for_cron_processing(self):
        """Wait for the next cron run or trigger manual processing"""
        print("\n=== Waiting for Cron Processing ===")
        
        # The processIncompletePayments cron runs every 10 minutes
        # We'll wait up to 2 minutes for it to process our records
        
        self.log_result(
            "Cron Processing Wait", 
            True, 
            "Waiting for processIncompletePayments cron (runs every 10 minutes)",
            {"wait_time": "120 seconds"}
        )
        
        print("Waiting 2 minutes for cron processing...")
        time.sleep(120)
        
        return True
    
    def verify_threshold_processing_results(self):
        """Verify that partial payments were processed according to threshold logic"""
        print("\n=== Verifying Threshold Processing Results ===")
        
        if not hasattr(self, 'test_scenarios'):
            self.log_result(
                "Results Verification", 
                False, 
                "No test scenarios available for verification"
            )
            return False
        
        verification_script = f'''
const {{ Sequelize, QueryTypes }} = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.USER_NAME,
  process.env.PASSWORD,
  {{
    host: process.env.HOST,
    port: Number(process.env.DB_PORT),
    dialect: "postgres",
    logging: false
  }}
);

async function verifyResults() {{
  try {{
    await sequelize.authenticate();
    
    const scenarios = {json.dumps(self.test_scenarios)};
    const results = [];
    
    for (const scenario of scenarios) {{
      try {{
        // Get temp address record
        const tempRecords = await sequelize.query(
          `SELECT * FROM tbl_user_temp_address 
           WHERE wallet_address = :address`,
          {{
            replacements: {{ address: scenario.address }},
            type: QueryTypes.SELECT
          }}
        );
        
        // Get merchant transaction if exists
        const merchantTx = await sequelize.query(
          `SELECT * FROM tbl_user_transaction 
           WHERE transaction_reference LIKE '%' || :tx_id || '%'
           ORDER BY "createdAt" DESC 
           LIMIT 1`,
          {{
            replacements: {{ tx_id: scenario.tx_id }},
            type: QueryTypes.SELECT
          }}
        );
        
        const tempRecord = tempRecords[0] || null;
        const merchantTransaction = merchantTx[0] || null;
        
        results.push({{
          scenario: scenario.name,
          address: scenario.address,
          tx_id: scenario.tx_id,
          original_amount: scenario.amount,
          temp_record: tempRecord,
          merchant_transaction: merchantTransaction,
          has_temp_record: !!tempRecord,
          has_merchant_tx: !!merchantTransaction,
          status: tempRecord ? tempRecord.status : null,
          admin_status: tempRecord ? tempRecord.admin_status : null,
          pending_admin_fee: tempRecord ? tempRecord.pending_admin_fee : null
        }});
        
      }} catch (error) {{
        results.push({{
          scenario: scenario.name,
          error: error.message
        }});
      }}
    }}
    
    console.log(JSON.stringify({{
      success: true,
      results: results
    }}, null, 2));
    
    process.exit(0);
    
  }} catch (error) {{
    console.error('Results verification failed:', error.message);
    process.exit(1);
  }}
}}

verifyResults();
'''
        
        try:
            # Write verification script
            with open('/tmp/verify_results.js', 'w') as f:
                f.write(verification_script)
            
            # Run the verification script
            result = subprocess.run(
                ["node", "/tmp/verify_results.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    verify_data = json.loads(result.stdout)
                    
                    if verify_data.get('success', False):
                        results = verify_data.get('results', [])
                        
                        # Analyze each scenario
                        for result_data in results:
                            scenario_name = result_data.get('scenario', 'Unknown')
                            temp_record = result_data.get('temp_record')
                            merchant_tx = result_data.get('merchant_transaction')
                            
                            if temp_record:
                                status = temp_record.get('status')
                                admin_status = temp_record.get('admin_status')
                                pending_admin_fee = temp_record.get('pending_admin_fee', 0)
                                
                                # Determine expected behavior based on scenario
                                if scenario_name == "Above Threshold":
                                    # $30 >= $5 threshold - should have merchant transaction
                                    expected_merchant_tx = True
                                    threshold_check = "$30 >= $5"
                                else:
                                    # $3 < $5 threshold - entire amount to admin
                                    expected_merchant_tx = False
                                    threshold_check = "$3 < $5"
                                
                                # Verify results
                                success = True
                                issues = []
                                
                                if status not in ['completed_partial', 'incomplete_expired']:
                                    success = False
                                    issues.append(f"Unexpected status: {status}")
                                
                                if expected_merchant_tx and not merchant_tx:
                                    success = False
                                    issues.append("Missing expected merchant transaction")
                                elif not expected_merchant_tx and merchant_tx:
                                    success = False
                                    issues.append("Unexpected merchant transaction found")
                                
                                if success:
                                    self.log_result(
                                        f"Threshold Logic - {scenario_name}", 
                                        True, 
                                        f"✅ {threshold_check} - Threshold logic working correctly",
                                        {
                                            "status": status,
                                            "admin_status": admin_status,
                                            "pending_admin_fee": pending_admin_fee,
                                            "has_merchant_tx": bool(merchant_tx),
                                            "merchant_amount": merchant_tx.get('base_amount') if merchant_tx else 0
                                        }
                                    )
                                else:
                                    self.log_result(
                                        f"Threshold Logic - {scenario_name}", 
                                        False, 
                                        f"Threshold logic issues: {'; '.join(issues)}",
                                        {
                                            "temp_record": temp_record,
                                            "merchant_tx": merchant_tx,
                                            "issues": issues
                                        }
                                    )
                            else:
                                self.log_result(
                                    f"Threshold Logic - {scenario_name}", 
                                    False, 
                                    "No temp address record found - may not have been processed yet"
                                )
                        
                        return True
                    else:
                        self.log_result(
                            "Results Verification", 
                            False, 
                            "Verification reported failure"
                        )
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Results Verification", 
                        False, 
                        "Failed to parse verification results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
            else:
                self.log_result(
                    "Results Verification", 
                    False, 
                    "Verification script failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Results Verification", 
                False, 
                f"Results verification failed: {str(e)}"
            )
        
        return False
    
    def check_backend_logs_for_processing(self):
        """Check backend logs for processIncompletePayments execution"""
        print("\n=== Checking Backend Logs ===")
        
        try:
            # Check supervisor logs for backend
            result = subprocess.run(
                ["tail", "-n", "100", "/var/log/supervisor/backend.out.log"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                log_content = result.stdout
                
                # Look for processIncompletePayments logs
                processing_lines = []
                for line in log_content.split('\n'):
                    if "processIncompletePayments" in line or "incomplete payments" in line.lower():
                        processing_lines.append(line.strip())
                
                if processing_lines:
                    self.log_result(
                        "Backend Logs - Processing Evidence", 
                        True, 
                        f"Found {len(processing_lines)} processIncompletePayments log entries",
                        {"recent_logs": processing_lines[-3:]}  # Show last 3 entries
                    )
                else:
                    self.log_result(
                        "Backend Logs - Processing Evidence", 
                        False, 
                        "No processIncompletePayments execution found in recent logs"
                    )
            else:
                self.log_result(
                    "Backend Logs Check", 
                    False, 
                    "Failed to read backend logs",
                    {"stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Backend Logs Check", 
                False, 
                f"Log check failed: {str(e)}"
            )
    
    def run_comprehensive_test(self):
        """Run the complete simplified partial payment test"""
        print("Starting Simplified Partial Payment Threshold Test...")
        
        # Phase 1: Authentication
        if not self.authenticate_user():
            print("❌ Authentication failed - cannot proceed")
            return False
        
        # Phase 2: Verify Configuration
        self.verify_threshold_configuration()
        
        # Phase 3: Insert Test Records
        if not self.insert_test_partial_payments():
            print("❌ Failed to insert test records - cannot proceed")
            return False
        
        # Phase 4: Wait for Processing
        self.wait_for_cron_processing()
        
        # Phase 5: Verify Results
        self.verify_threshold_processing_results()
        
        # Phase 6: Check Logs
        self.check_backend_logs_for_processing()
        
        # Generate Summary
        self.generate_test_summary()
        
        return len(self.errors) == 0
    
    def generate_test_summary(self):
        """Generate comprehensive test summary"""
        print("\n" + "=" * 70)
        print("📊 SIMPLIFIED PARTIAL PAYMENT TEST SUMMARY")
        print("=" * 70)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for error in self.errors:
                print(f"  • {error}")
        
        print(f"\n🎯 THRESHOLD LOGIC RESULTS:")
        
        # Check threshold logic results
        above_threshold_tests = [name for name in self.test_results.keys() if "Above Threshold" in name]
        below_threshold_tests = [name for name in self.test_results.keys() if "Below Threshold" in name]
        
        above_passed = sum(1 for name in above_threshold_tests if self.test_results[name]['success'])
        below_passed = sum(1 for name in below_threshold_tests if self.test_results[name]['success'])
        
        print(f"  📈 Above Threshold ($30 >= $5): {above_passed}/{len(above_threshold_tests)} tests passed")
        print(f"  📉 Below Threshold ($3 < $5): {below_passed}/{len(below_threshold_tests)} tests passed")
        
        print(f"\n📋 DETAILED RESULTS:")
        for test_name, result in self.test_results.items():
            status = "✅ PASS" if result['success'] else "❌ FAIL"
            print(f"  {status}: {test_name}")
            if not result['success']:
                print(f"    └─ {result['message']}")

if __name__ == "__main__":
    tester = SimplifiedPartialPaymentTester()
    success = tester.run_comprehensive_test()
    
    if success:
        print(f"\n🎉 ALL TESTS PASSED - Partial payment threshold logic verified!")
        sys.exit(0)
    else:
        print(f"\n💥 SOME TESTS FAILED - Check the summary above for details")
        sys.exit(1)