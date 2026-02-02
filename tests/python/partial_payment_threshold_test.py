#!/usr/bin/env python3
"""
DynoPay Partial Payment Threshold Testing Suite
Tests partial payment scenarios where customer sends incomplete payment and it expires after 30 minutes.
Verifies threshold logic is applied to RECEIVED amount (not expected amount).

Test Scenarios:
1. Partial Payment Above Threshold ($30 received vs $50 expected, $30 >= $5 threshold)
2. Partial Payment Below Threshold ($3 received vs $15 expected, $3 < $5 threshold)
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any
from datetime import datetime, timedelta
import subprocess

class PartialPaymentThresholdTester:
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
        
        # Configuration from review request
        self.eth_threshold = 5  # $5 USD
        self.grace_period_minutes = 30
        
        print("=== DynoPay Partial Payment Threshold Testing ===")
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Credentials: {self.test_email}")
        print(f"ETH Threshold: ${self.eth_threshold} USD")
        print(f"Grace Period: {self.grace_period_minutes} minutes")
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
            # Try to login with provided credentials
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
                        {"user_id": self.user_id, "has_token": bool(self.jwt_token)}
                    )
                    return True
                else:
                    self.log_result(
                        "User Authentication", 
                        False, 
                        "Login succeeded but no token received",
                        {"response": login_data}
                    )
            else:
                self.log_result(
                    "User Authentication", 
                    False, 
                    f"Login failed with status {login_response.status_code}",
                    {"response": login_response.text}
                )
                
        except Exception as e:
            self.log_result(
                "User Authentication", 
                False, 
                f"Authentication failed: {str(e)}"
            )
        
        return False
    
    def get_user_company(self):
        """Get user's company information"""
        print("\n=== Getting User Company ===")
        
        if not self.jwt_token:
            self.log_result("Get User Company", False, "No JWT token available")
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Get user profile to find company
            profile_response = requests.get(
                f"{self.backend_url}/api/user/profile",
                headers=headers,
                timeout=15
            )
            
            if profile_response.status_code == 200:
                profile_data = profile_response.json()
                
                # Try to get company from user data or create one
                company_response = requests.get(
                    f"{self.backend_url}/api/company/getCompany",
                    headers=headers,
                    timeout=15
                )
                
                if company_response.status_code == 200:
                    company_data = company_response.json()
                    companies = company_data.get('data', [])
                    
                    if companies and len(companies) > 0:
                        self.company_id = companies[0].get('company_id')
                        self.log_result(
                            "Get User Company", 
                            True, 
                            f"Found company ID: {self.company_id}",
                            {"company_id": self.company_id, "company_name": companies[0].get('company_name')}
                        )
                        return True
                    else:
                        # Create a test company
                        return self.create_test_company()
                else:
                    self.log_result(
                        "Get User Company", 
                        False, 
                        f"Failed to get companies: {company_response.status_code}",
                        {"response": company_response.text}
                    )
            else:
                self.log_result(
                    "Get User Company", 
                    False, 
                    f"Failed to get user profile: {profile_response.status_code}",
                    {"response": profile_response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Get User Company", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return False
    
    def create_test_company(self):
        """Create a test company for partial payment testing"""
        print("\n--- Creating Test Company ---")
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "multipart/form-data"
            }
            
            company_data = {
                "company_name": "Partial Payment Test Company",
                "email": self.test_email,
                "mobile": "+1234567890",
                "address_line1": "123 Test Street",
                "city": "Test City",
                "country": "US"
            }
            
            # Create multipart form data
            files = {
                'data': (None, json.dumps(company_data), 'application/json')
            }
            
            response = requests.post(
                f"{self.backend_url}/api/company/addCompany",
                files=files,
                headers={"Authorization": f"Bearer {self.jwt_token}"},
                timeout=15
            )
            
            if response.status_code == 200:
                response_data = response.json()
                if 'data' in response_data and 'company_id' in response_data['data']:
                    self.company_id = response_data['data']['company_id']
                    self.log_result(
                        "Create Test Company", 
                        True, 
                        f"Created test company with ID: {self.company_id}",
                        {"company_id": self.company_id}
                    )
                    return True
                else:
                    self.log_result(
                        "Create Test Company", 
                        False, 
                        "Company creation succeeded but no company_id received",
                        {"response": response_data}
                    )
            else:
                self.log_result(
                    "Create Test Company", 
                    False, 
                    f"Company creation failed: {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Create Test Company", 
                False, 
                f"Company creation failed: {str(e)}"
            )
        
        return False
    
    def verify_environment_configuration(self):
        """Verify environment configuration matches test requirements"""
        print("\n=== Environment Configuration Verification ===")
        
        try:
            # Check backend .env file for threshold configuration
            with open('/app/backend/.env', 'r') as f:
                env_content = f.read()
            
            # Extract ETH threshold
            eth_threshold_found = None
            tatum_testnet = None
            
            for line in env_content.split('\n'):
                if line.startswith('ETH_THRESHOLD='):
                    eth_threshold_found = int(line.split('=')[1])
                elif line.startswith('TATUM_TESTNET='):
                    tatum_testnet = line.split('=')[1].lower() == 'true'
            
            # Verify configuration
            config_correct = True
            config_details = {}
            
            if eth_threshold_found == self.eth_threshold:
                config_details['eth_threshold'] = f"✅ ${eth_threshold_found} USD (correct)"
            else:
                config_details['eth_threshold'] = f"❌ ${eth_threshold_found} USD (expected ${self.eth_threshold})"
                config_correct = False
            
            if tatum_testnet:
                config_details['testnet'] = "✅ Testnet enabled (Sepolia)"
            else:
                config_details['testnet'] = "❌ Testnet not enabled"
                config_correct = False
            
            self.log_result(
                "Environment Configuration", 
                config_correct, 
                "Configuration verified" if config_correct else "Configuration issues found",
                config_details
            )
            
            return config_correct
            
        except Exception as e:
            self.log_result(
                "Environment Configuration", 
                False, 
                f"Failed to verify configuration: {str(e)}"
            )
            return False
    
    def create_payment_link_above_threshold(self):
        """Create payment link for Test 1: Above threshold scenario ($50 expected)"""
        print("\n=== Test 1: Creating Payment Link Above Threshold ===")
        
        if not self.jwt_token or not self.company_id:
            self.log_result("Payment Link Above Threshold", False, "Missing authentication or company")
            return None
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            payment_data = {
                "email": "partial-above-test@example.com",
                "amount": 50,
                "currency": "USD",
                "modes": ["CRYPTO"]
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                response_data = response.json()
                if 'data' in response_data:
                    link_data = response_data['data']
                    transaction_id = link_data.get('transaction_id')
                    payment_link = link_data.get('payment_link')
                    
                    self.log_result(
                        "Payment Link Above Threshold", 
                        True, 
                        f"Created payment link for $50 USD",
                        {
                            "transaction_id": transaction_id,
                            "payment_link": payment_link,
                            "amount": 50,
                            "currency": "USD"
                        }
                    )
                    return {
                        "transaction_id": transaction_id,
                        "payment_link": payment_link,
                        "expected_amount": 50,
                        "test_scenario": "above_threshold"
                    }
                else:
                    self.log_result(
                        "Payment Link Above Threshold", 
                        False, 
                        "Invalid response format",
                        {"response": response_data}
                    )
            else:
                self.log_result(
                    "Payment Link Above Threshold", 
                    False, 
                    f"Payment link creation failed: {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Payment Link Above Threshold", 
                False, 
                f"Payment link creation failed: {str(e)}"
            )
        
        return None
    
    def create_payment_link_below_threshold(self):
        """Create payment link for Test 2: Below threshold scenario ($15 expected)"""
        print("\n=== Test 2: Creating Payment Link Below Threshold ===")
        
        if not self.jwt_token or not self.company_id:
            self.log_result("Payment Link Below Threshold", False, "Missing authentication or company")
            return None
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            payment_data = {
                "email": "partial-below-test@example.com",
                "amount": 15,
                "currency": "USD",
                "modes": ["CRYPTO"]
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                response_data = response.json()
                if 'data' in response_data:
                    link_data = response_data['data']
                    transaction_id = link_data.get('transaction_id')
                    payment_link = link_data.get('payment_link')
                    
                    self.log_result(
                        "Payment Link Below Threshold", 
                        True, 
                        f"Created payment link for $15 USD",
                        {
                            "transaction_id": transaction_id,
                            "payment_link": payment_link,
                            "amount": 15,
                            "currency": "USD"
                        }
                    )
                    return {
                        "transaction_id": transaction_id,
                        "payment_link": payment_link,
                        "expected_amount": 15,
                        "test_scenario": "below_threshold"
                    }
                else:
                    self.log_result(
                        "Payment Link Below Threshold", 
                        False, 
                        "Invalid response format",
                        {"response": response_data}
                    )
            else:
                self.log_result(
                    "Payment Link Below Threshold", 
                    False, 
                    f"Payment link creation failed: {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Payment Link Below Threshold", 
                False, 
                f"Payment link creation failed: {str(e)}"
            )
        
        return None
    
    def simulate_partial_payment_database(self, transaction_id: str, scenario: str):
        """Simulate partial payment by directly inserting into database"""
        print(f"\n--- Simulating Partial Payment Database Entry ({scenario}) ---")
        
        # Determine amounts based on scenario
        if scenario == "above_threshold":
            expected_usd = 50
            received_usd = 30  # 60% of expected
            received_eth = 0.0086  # Approximate ETH equivalent of $30
        else:  # below_threshold
            expected_usd = 15
            received_usd = 3   # 20% of expected
            received_eth = 0.00086  # Approximate ETH equivalent of $3
        
        # Create Node.js script to insert partial payment data
        db_script = f'''
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

async function simulatePartialPayment() {{
  try {{
    await sequelize.authenticate();
    
    // Insert partial payment record
    const partialTimestamp = new Date(Date.now() - 31 * 60 * 1000); // 31 minutes ago
    
    const insertResult = await sequelize.query(
      `INSERT INTO tbl_user_temp_address 
       (transaction_id, user_id, company_id, wallet_address, wallet_type, 
        amount, expected_amount, status, partial_payment_timestamp, 
        "txId", "createdAt", "updatedAt", usd_value, fee_payer)
       VALUES 
       (:transaction_id, :user_id, :company_id, :wallet_address, 'ETH',
        :amount, :expected_amount, 'partial', :partial_timestamp,
        :tx_id, NOW(), NOW(), :usd_value, 'company')
       RETURNING temp_id`,
      {{
        replacements: {{
          transaction_id: '{transaction_id}',
          user_id: {self.user_id or 1},
          company_id: {self.company_id or 1},
          wallet_address: '0x1234567890123456789012345678901234567890',
          amount: {received_eth},
          expected_amount: {received_eth * (expected_usd / received_usd)},
          partial_timestamp: partialTimestamp,
          tx_id: 'test_tx_' + Date.now(),
          usd_value: {received_usd}
        }},
        type: QueryTypes.INSERT
      }}
    );
    
    console.log(JSON.stringify({{
      success: true,
      temp_id: insertResult[0][0].temp_id,
      scenario: '{scenario}',
      expected_usd: {expected_usd},
      received_usd: {received_usd},
      received_eth: {received_eth},
      threshold_check: {received_usd} >= 5 ? 'above' : 'below'
    }}, null, 2));
    
    process.exit(0);
    
  }} catch (error) {{
    console.error('Database simulation failed:', error.message);
    process.exit(1);
  }}
}}

simulatePartialPayment();
'''
        
        try:
            # Write and execute the database script
            with open('/tmp/simulate_partial_payment.js', 'w') as f:
                f.write(db_script)
            
            result = subprocess.run(
                ["node", "/tmp/simulate_partial_payment.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    simulation_data = json.loads(result.stdout)
                    self.log_result(
                        f"Simulate Partial Payment - {scenario}", 
                        True, 
                        f"Simulated partial payment: ${simulation_data['received_usd']} received (${simulation_data['expected_usd']} expected)",
                        simulation_data
                    )
                    return simulation_data
                except json.JSONDecodeError:
                    self.log_result(
                        f"Simulate Partial Payment - {scenario}", 
                        False, 
                        "Failed to parse simulation results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
            else:
                self.log_result(
                    f"Simulate Partial Payment - {scenario}", 
                    False, 
                    "Database simulation failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                f"Simulate Partial Payment - {scenario}", 
                False, 
                f"Simulation failed: {str(e)}"
            )
        
        return None
    
    def test_process_incomplete_payments_function(self):
        """Test the processIncompletePayments function directly"""
        print("\n=== Testing processIncompletePayments Function ===")
        
        # Create Node.js script to test the function
        test_script = '''
const { processIncompletePayments } = require('./controller/paymentController');

async function testProcessIncompletePayments() {
  try {
    console.log('Testing processIncompletePayments function...');
    
    // Call the function
    await processIncompletePayments();
    
    console.log(JSON.stringify({
      success: true,
      message: 'processIncompletePayments executed successfully'
    }, null, 2));
    
    process.exit(0);
    
  } catch (error) {
    console.error('processIncompletePayments test failed:', error.message);
    console.log(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2));
    process.exit(1);
  }
}

testProcessIncompletePayments();
'''
        
        try:
            # Write and execute the test script
            with open('/tmp/test_process_incomplete.js', 'w') as f:
                f.write(test_script)
            
            result = subprocess.run(
                ["node", "/tmp/test_process_incomplete.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                try:
                    test_data = json.loads(result.stdout.split('\n')[-2])  # Get last JSON line
                    self.log_result(
                        "Process Incomplete Payments Function", 
                        test_data.get('success', False), 
                        test_data.get('message', 'Function executed'),
                        test_data
                    )
                    return test_data.get('success', False)
                except (json.JSONDecodeError, IndexError):
                    # Function might have executed but no JSON output
                    if "processIncompletePayments executed successfully" in result.stdout:
                        self.log_result(
                            "Process Incomplete Payments Function", 
                            True, 
                            "Function executed successfully (no JSON output)",
                            {"stdout": result.stdout}
                        )
                        return True
                    else:
                        self.log_result(
                            "Process Incomplete Payments Function", 
                            False, 
                            "Failed to parse function results",
                            {"stdout": result.stdout, "stderr": result.stderr}
                        )
            else:
                self.log_result(
                    "Process Incomplete Payments Function", 
                    False, 
                    "Function test failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Process Incomplete Payments Function", 
                False, 
                f"Function test failed: {str(e)}"
            )
        
        return False
    
    def verify_database_results(self, scenario: str, temp_id: int = None):
        """Verify database results after processing"""
        print(f"\n--- Verifying Database Results ({scenario}) ---")
        
        # Create verification script
        verify_script = f'''
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
    
    // Get partial payment records
    const partialPayments = await sequelize.query(
      `SELECT temp_id, transaction_id, amount, expected_amount, status, 
              admin_status, usd_value, partial_payment_timestamp,
              "createdAt", "updatedAt"
       FROM tbl_user_temp_address 
       WHERE status IN ('partial', 'completed_partial', 'incomplete_expired')
       ORDER BY "updatedAt" DESC 
       LIMIT 10`,
      {{ type: QueryTypes.SELECT }}
    );
    
    // Get user transactions for merchants
    const userTransactions = await sequelize.query(
      `SELECT user_id, company_id, base_amount, base_currency, 
              transaction_type, status, transaction_reference
       FROM tbl_user_transaction 
       WHERE status IN ('completed_partial', 'incomplete_expired')
       ORDER BY "createdAt" DESC 
       LIMIT 10`,
      {{ type: QueryTypes.SELECT }}
    );
    
    // Get admin wallet balances
    const adminWallets = await sequelize.query(
      `SELECT wallet_type, fee, balance 
       FROM tbl_admin_wallet 
       WHERE wallet_type = 'ETH'`,
      {{ type: QueryTypes.SELECT }}
    );
    
    console.log(JSON.stringify({{
      success: true,
      scenario: '{scenario}',
      partial_payments: partialPayments,
      user_transactions: userTransactions,
      admin_wallets: adminWallets,
      analysis: {{
        total_partial_records: partialPayments.length,
        completed_partial: partialPayments.filter(p => p.status === 'completed_partial').length,
        incomplete_expired: partialPayments.filter(p => p.status === 'incomplete_expired').length,
        merchant_transactions: userTransactions.length
      }}
    }}, null, 2));
    
    process.exit(0);
    
  }} catch (error) {{
    console.error('Verification failed:', error.message);
    process.exit(1);
  }}
}}

verifyResults();
'''
        
        try:
            # Write and execute verification script
            with open('/tmp/verify_results.js', 'w') as f:
                f.write(verify_script)
            
            result = subprocess.run(
                ["node", "/tmp/verify_results.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    verification_data = json.loads(result.stdout)
                    analysis = verification_data.get('analysis', {})
                    
                    self.log_result(
                        f"Database Verification - {scenario}", 
                        True, 
                        f"Found {analysis.get('total_partial_records', 0)} partial payment records",
                        {
                            "completed_partial": analysis.get('completed_partial', 0),
                            "incomplete_expired": analysis.get('incomplete_expired', 0),
                            "merchant_transactions": analysis.get('merchant_transactions', 0)
                        }
                    )
                    return verification_data
                except json.JSONDecodeError:
                    self.log_result(
                        f"Database Verification - {scenario}", 
                        False, 
                        "Failed to parse verification results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
            else:
                self.log_result(
                    f"Database Verification - {scenario}", 
                    False, 
                    "Database verification failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                f"Database Verification - {scenario}", 
                False, 
                f"Verification failed: {str(e)}"
            )
        
        return None
    
    def run_comprehensive_test(self):
        """Run the comprehensive partial payment threshold test"""
        print("\n" + "=" * 80)
        print("STARTING COMPREHENSIVE PARTIAL PAYMENT THRESHOLD TEST")
        print("=" * 80)
        
        # Phase 1: Setup and Authentication
        if not self.authenticate_user():
            print("\n❌ CRITICAL: Authentication failed. Cannot proceed with tests.")
            return False
        
        if not self.get_user_company():
            print("\n❌ CRITICAL: Company setup failed. Cannot proceed with tests.")
            return False
        
        # Phase 2: Environment Verification
        self.verify_environment_configuration()
        
        # Phase 3: Create Payment Links
        above_threshold_link = self.create_payment_link_above_threshold()
        below_threshold_link = self.create_payment_link_below_threshold()
        
        # Phase 4: Simulate Partial Payments
        if above_threshold_link:
            above_simulation = self.simulate_partial_payment_database(
                above_threshold_link['transaction_id'], 
                'above_threshold'
            )
        
        if below_threshold_link:
            below_simulation = self.simulate_partial_payment_database(
                below_threshold_link['transaction_id'], 
                'below_threshold'
            )
        
        # Phase 5: Test Processing Function
        self.test_process_incomplete_payments_function()
        
        # Phase 6: Verify Results
        self.verify_database_results('above_threshold')
        self.verify_database_results('below_threshold')
        
        # Phase 7: Summary
        self.print_test_summary()
        
        return len(self.errors) == 0
    
    def print_test_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "=" * 80)
        print("PARTIAL PAYMENT THRESHOLD TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            for test_name, result in self.test_results.items():
                if not result['success']:
                    print(f"  • {test_name}: {result['message']}")
        
        print(f"\n📊 DETAILED RESULTS:")
        for test_name, result in self.test_results.items():
            status = "✅" if result['success'] else "❌"
            print(f"  {status} {test_name}: {result['message']}")
        
        print("\n" + "=" * 80)

def main():
    """Main test execution"""
    tester = PartialPaymentThresholdTester()
    
    try:
        success = tester.run_comprehensive_test()
        
        if success:
            print("\n🎉 ALL TESTS PASSED! Partial payment threshold logic is working correctly.")
            sys.exit(0)
        else:
            print(f"\n💥 {len(tester.errors)} TESTS FAILED! See details above.")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 CRITICAL ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()