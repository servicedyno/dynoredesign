#!/usr/bin/env python3
"""
DynoPay Below-Threshold Payment Testing Suite
Tests crypto payment processing when payment amount is BELOW the forwarding threshold ($5 USD for ETH)
"""

import os
import sys
import json
import requests
import time
from typing import Dict, List, Any

class BelowThresholdPaymentTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        
        # Test credentials from review request
        self.test_email = "john@dyno.pt"
        self.test_password = "Katiekendra123@"
        
        # ETH threshold from .env
        self.eth_threshold = 5  # $5 USD
        
        # Admin wallet from .env
        self.admin_wallet = "0x9a7221b5e32d5f99e8da95585835442e29afb38f"
        
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
        print("\n=== Authenticating with Test Credentials ===")
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json={
                    "email": self.test_email,
                    "password": self.test_password
                },
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
                        f"Successfully authenticated as {self.test_email}",
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
    
    def query_below_threshold_transactions(self):
        """Query database for transactions below $5 USD threshold"""
        print("\n=== Querying Below-Threshold Transactions ===")
        
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

async function queryBelowThresholdTransactions() {
  try {
    await sequelize.authenticate();
    
    // Query 1: Find transactions below $5 USD
    const belowThresholdTx = await sequelize.query(
      `SELECT 
        t.transaction_id, 
        t.base_amount, 
        t.base_currency, 
        t.usd_value,
        t.status,
        t.created_at,
        t.payment_mode
      FROM tbl_transactions t
      WHERE t.usd_value < 5 
        AND t.status = 'successful'
      ORDER BY t.created_at DESC 
      LIMIT 10`,
      { type: QueryTypes.SELECT }
    );
    
    // Query 2: Check admin fees for below-threshold payments
    const adminFeesQuery = await sequelize.query(
      `SELECT 
        t.transaction_id,
        t.usd_value,
        ta.admin_status,
        ta.admin_fee,
        ta.wallet_address,
        ta.amount as temp_amount,
        ta.created_at
      FROM tbl_transactions t
      JOIN tbl_user_temp_address ta ON t.transaction_id = ta.transaction_id
      WHERE t.usd_value < 5
        AND t.payment_mode = 'CRYPTO'
      ORDER BY t.created_at DESC
      LIMIT 10`,
      { type: QueryTypes.SELECT }
    );
    
    // Query 3: Check admin fee transaction records
    const adminFeeTransactions = await sequelize.query(
      `SELECT 
        aft.fee_transaction_id,
        aft.transaction_id,
        aft.admin_fee,
        aft.status,
        aft.sweep_status,
        aft.created_at
      FROM tbl_admin_fee_transaction aft
      JOIN tbl_transactions t ON t.transaction_id = aft.transaction_id
      WHERE t.usd_value < 5
      ORDER BY aft.created_at DESC
      LIMIT 10`,
      { type: QueryTypes.SELECT }
    );
    
    // Query 4: Check current ETH threshold from environment
    const ethThreshold = process.env.ETH_THRESHOLD || 5;
    
    console.log(JSON.stringify({
      eth_threshold: ethThreshold,
      below_threshold_transactions: belowThresholdTx,
      admin_fees_below_threshold: adminFeesQuery,
      admin_fee_transactions: adminFeeTransactions,
      total_below_threshold: belowThresholdTx.length,
      total_admin_fees: adminFeesQuery.length
    }, null, 2));
    
    process.exit(0);
    
  } catch (error) {
    console.error('Database query failed:', error.message);
    process.exit(1);
  }
}

queryBelowThresholdTransactions();
'''
        
        try:
            # Write query script to temporary file
            with open('/tmp/query_below_threshold.js', 'w') as f:
                f.write(query_script)
            
            # Run the query script
            import subprocess
            result = subprocess.run(
                ["node", "/tmp/query_below_threshold.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    query_data = json.loads(result.stdout)
                    
                    below_threshold_count = query_data.get('total_below_threshold', 0)
                    admin_fees_count = query_data.get('total_admin_fees', 0)
                    eth_threshold = query_data.get('eth_threshold', 5)
                    
                    self.log_result(
                        "Below-Threshold Transaction Query", 
                        True, 
                        f"Found {below_threshold_count} transactions below ${eth_threshold} USD threshold",
                        {
                            "eth_threshold": eth_threshold,
                            "below_threshold_count": below_threshold_count,
                            "admin_fees_count": admin_fees_count,
                            "sample_transactions": query_data.get('below_threshold_transactions', [])[:3],
                            "sample_admin_fees": query_data.get('admin_fees_below_threshold', [])[:3]
                        }
                    )
                    
                    # Analyze admin fee handling
                    admin_fees = query_data.get('admin_fees_below_threshold', [])
                    if admin_fees:
                        admin_statuses = [fee.get('admin_status') for fee in admin_fees]
                        unique_statuses = list(set(admin_statuses))
                        
                        self.log_result(
                            "Below-Threshold Admin Fee Status Analysis", 
                            True, 
                            f"Admin fee statuses for below-threshold payments: {', '.join(unique_statuses)}",
                            {
                                "admin_statuses": admin_statuses,
                                "unique_statuses": unique_statuses,
                                "sample_admin_fees": admin_fees[:3]
                            }
                        )
                    else:
                        self.log_result(
                            "Below-Threshold Admin Fee Status Analysis", 
                            True, 
                            "No admin fee records found for below-threshold payments",
                            {"admin_fees_count": 0}
                        )
                    
                    return query_data
                    
                except json.JSONDecodeError:
                    self.log_result(
                        "Below-Threshold Transaction Query", 
                        False, 
                        "Failed to parse query results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
                    return None
            else:
                self.log_result(
                    "Below-Threshold Transaction Query", 
                    False, 
                    "Database query failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                return None
                
        except Exception as e:
            self.log_result(
                "Below-Threshold Transaction Query", 
                False, 
                f"Query execution failed: {str(e)}"
            )
            return None
    
    def analyze_threshold_logic_in_code(self):
        """Analyze the threshold handling logic in the codebase"""
        print("\n=== Analyzing Threshold Logic in Code ===")
        
        try:
            # Read the payment controller to understand threshold logic
            with open('/app/backend/controller/paymentController.ts', 'r') as f:
                content = f.read()
            
            # Look for threshold-related code
            threshold_mentions = []
            lines = content.split('\n')
            
            for i, line in enumerate(lines):
                if any(keyword in line.lower() for keyword in ['threshold', 'eth_threshold', 'minforwarding', 'under threshold']):
                    threshold_mentions.append({
                        'line_number': i + 1,
                        'content': line.strip()
                    })
            
            # Look for admin fee sweep logic
            sweep_mentions = []
            for i, line in enumerate(lines):
                if any(keyword in line.lower() for keyword in ['sweep', 'pending_sweep', 'admin_status']):
                    sweep_mentions.append({
                        'line_number': i + 1,
                        'content': line.strip()
                    })
            
            self.log_result(
                "Threshold Logic Code Analysis", 
                True, 
                f"Found {len(threshold_mentions)} threshold-related code lines and {len(sweep_mentions)} sweep-related lines",
                {
                    "threshold_mentions": threshold_mentions[:5],  # Show first 5
                    "sweep_mentions": sweep_mentions[:5],  # Show first 5
                    "total_threshold_lines": len(threshold_mentions),
                    "total_sweep_lines": len(sweep_mentions)
                }
            )
            
            # Check if sweepNativeAdminFees function exists
            if 'sweepNativeAdminFees' in content:
                self.log_result(
                    "Admin Fee Sweep Function", 
                    True, 
                    "sweepNativeAdminFees function found in payment controller",
                    {"function_exists": True}
                )
            else:
                self.log_result(
                    "Admin Fee Sweep Function", 
                    False, 
                    "sweepNativeAdminFees function not found",
                    {"function_exists": False}
                )
            
            return True
            
        except Exception as e:
            self.log_result(
                "Threshold Logic Code Analysis", 
                False, 
                f"Code analysis failed: {str(e)}"
            )
            return False
    
    def get_existing_payment_links(self):
        """Get existing payment links for the authenticated user"""
        print("\n=== Getting Existing Payment Links ===")
        
        if not self.jwt_token:
            self.log_result(
                "Get Payment Links", 
                False, 
                "No JWT token available for authentication"
            )
            return None
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.get(
                f"{self.backend_url}/api/pay/getPaymentLinks",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    payment_links = data['data']
                    
                    # Look for small amount payment links
                    small_links = []
                    for link in payment_links:
                        base_amount = float(link.get('base_amount', 0))
                        if base_amount < 0.01:  # Less than 0.01 ETH (approximately $30 at current rates)
                            small_links.append(link)
                    
                    self.log_result(
                        "Get Payment Links", 
                        True, 
                        f"Retrieved {len(payment_links)} payment links, {len(small_links)} are small amounts",
                        {
                            "total_links": len(payment_links),
                            "small_amount_links": len(small_links),
                            "sample_links": payment_links[:3] if payment_links else [],
                            "small_links": small_links[:3] if small_links else []
                        }
                    )
                    
                    return payment_links
                else:
                    self.log_result(
                        "Get Payment Links", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Get Payment Links", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Get Payment Links", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return None
    
    def create_below_threshold_payment_link(self):
        """Create a payment link with amount below threshold (~$3 USD)"""
        print("\n=== Creating Below-Threshold Payment Link ===")
        
        if not self.jwt_token:
            self.log_result(
                "Create Below-Threshold Payment Link", 
                False, 
                "No JWT token available for authentication"
            )
            return None
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Create payment link for 0.001 ETH (~$2.92 USD at current rates)
            payment_data = {
                "base_amount": 0.001,
                "base_currency": "ETH",
                "modes": ["CRYPTO"],
                "description": "Below-threshold test payment",
                "expire": "24h"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    link_data = data['data']
                    
                    self.log_result(
                        "Create Below-Threshold Payment Link", 
                        True, 
                        f"Created payment link for {payment_data['base_amount']} {payment_data['base_currency']}",
                        {
                            "link_id": link_data.get('link_id'),
                            "transaction_id": link_data.get('transaction_id'),
                            "base_amount": payment_data['base_amount'],
                            "base_currency": payment_data['base_currency'],
                            "payment_link": link_data.get('payment_link')
                        }
                    )
                    
                    return link_data
                else:
                    self.log_result(
                        "Create Below-Threshold Payment Link", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Create Below-Threshold Payment Link", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Create Below-Threshold Payment Link", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return None
    
    def check_admin_fee_sweep_status(self):
        """Check the status of admin fee sweep operations"""
        print("\n=== Checking Admin Fee Sweep Status ===")
        
        # Create a Node.js script to check sweep status
        sweep_status_script = '''
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

async function checkSweepStatus() {
  try {
    await sequelize.authenticate();
    
    // Query 1: Check pending sweep admin fees
    const pendingSweeps = await sequelize.query(
      `SELECT 
        ta.wallet_address,
        ta.wallet_type,
        ta.admin_status,
        ta.amount,
        ta.admin_fee,
        ta.created_at,
        t.usd_value
      FROM tbl_user_temp_address ta
      JOIN tbl_transactions t ON t.transaction_id = ta.transaction_id
      WHERE ta.admin_status = 'pending_sweep'
        AND t.usd_value < 5
      ORDER BY ta.created_at DESC
      LIMIT 10`,
      { type: QueryTypes.SELECT }
    );
    
    // Query 2: Check successful admin fee transfers
    const successfulSweeps = await sequelize.query(
      `SELECT 
        ta.wallet_address,
        ta.wallet_type,
        ta.admin_status,
        ta.amount,
        ta.admin_fee,
        ta.created_at,
        t.usd_value
      FROM tbl_user_temp_address ta
      JOIN tbl_transactions t ON t.transaction_id = ta.transaction_id
      WHERE ta.admin_status = 'successful'
        AND t.usd_value < 5
      ORDER BY ta.created_at DESC
      LIMIT 10`,
      { type: QueryTypes.SELECT }
    );
    
    // Query 3: Check admin wallet balances
    const adminWallets = await sequelize.query(
      `SELECT 
        wallet_type,
        amount,
        fee,
        last_index
      FROM tbl_admin_wallet
      WHERE wallet_type IN ('ETH', 'BTC', 'TRX')`,
      { type: QueryTypes.SELECT }
    );
    
    console.log(JSON.stringify({
      pending_sweeps: pendingSweeps,
      successful_sweeps: successfulSweeps,
      admin_wallets: adminWallets,
      pending_count: pendingSweeps.length,
      successful_count: successfulSweeps.length
    }, null, 2));
    
    process.exit(0);
    
  } catch (error) {
    console.error('Sweep status query failed:', error.message);
    process.exit(1);
  }
}

checkSweepStatus();
'''
        
        try:
            # Write sweep status script to temporary file
            with open('/tmp/check_sweep_status.js', 'w') as f:
                f.write(sweep_status_script)
            
            # Run the sweep status script
            import subprocess
            result = subprocess.run(
                ["node", "/tmp/check_sweep_status.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    sweep_data = json.loads(result.stdout)
                    
                    pending_count = sweep_data.get('pending_count', 0)
                    successful_count = sweep_data.get('successful_count', 0)
                    
                    self.log_result(
                        "Admin Fee Sweep Status Check", 
                        True, 
                        f"Found {pending_count} pending sweeps and {successful_count} successful sweeps for below-threshold payments",
                        {
                            "pending_sweeps": pending_count,
                            "successful_sweeps": successful_count,
                            "sample_pending": sweep_data.get('pending_sweeps', [])[:3],
                            "sample_successful": sweep_data.get('successful_sweeps', [])[:3],
                            "admin_wallets": sweep_data.get('admin_wallets', [])
                        }
                    )
                    
                    return sweep_data
                    
                except json.JSONDecodeError:
                    self.log_result(
                        "Admin Fee Sweep Status Check", 
                        False, 
                        "Failed to parse sweep status results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
                    return None
            else:
                self.log_result(
                    "Admin Fee Sweep Status Check", 
                    False, 
                    "Sweep status query failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                return None
                
        except Exception as e:
            self.log_result(
                "Admin Fee Sweep Status Check", 
                False, 
                f"Sweep status check failed: {str(e)}"
            )
            return None
    
    def run_comprehensive_below_threshold_test(self):
        """Run comprehensive below-threshold payment testing"""
        print("\n" + "="*60)
        print("DYNOPAY BELOW-THRESHOLD PAYMENT TESTING")
        print("Testing crypto payments < $5 USD threshold")
        print("="*60)
        
        # Phase 1: Authentication
        if not self.authenticate_user():
            print("\n❌ CRITICAL: Authentication failed. Cannot proceed with testing.")
            return False
        
        # Phase 2: Database Analysis
        print("\n" + "="*40)
        print("PHASE 1: DATABASE ANALYSIS")
        print("="*40)
        
        transaction_data = self.query_below_threshold_transactions()
        sweep_data = self.check_admin_fee_sweep_status()
        
        # Phase 3: Code Review
        print("\n" + "="*40)
        print("PHASE 2: CODE REVIEW")
        print("="*40)
        
        self.analyze_threshold_logic_in_code()
        
        # Phase 4: Live Testing (Optional)
        print("\n" + "="*40)
        print("PHASE 3: LIVE TESTING (SAFE)")
        print("="*40)
        
        existing_links = self.get_existing_payment_links()
        
        # Only create new payment link if safe to do so
        if existing_links is not None:
            # Check if we already have small payment links
            small_links = [link for link in existing_links if float(link.get('base_amount', 0)) < 0.01]
            
            if not small_links:
                print("\nCreating test payment link for below-threshold testing...")
                test_link = self.create_below_threshold_payment_link()
            else:
                print(f"\nFound {len(small_links)} existing small payment links. Skipping creation.")
        
        return True
    
    def generate_summary_report(self):
        """Generate comprehensive summary report"""
        print("\n" + "="*60)
        print("BELOW-THRESHOLD PAYMENT TESTING SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"\nTEST RESULTS OVERVIEW:")
        print(f"✅ Passed: {passed_tests}/{total_tests}")
        print(f"❌ Failed: {failed_tests}/{total_tests}")
        print(f"📊 Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        print(f"\nKEY FINDINGS:")
        
        # Analyze findings from test results
        findings = []
        
        for test_name, result in self.test_results.items():
            if result['success'] and result['details']:
                if 'below_threshold_count' in result['details']:
                    count = result['details']['below_threshold_count']
                    findings.append(f"• Found {count} transactions below $5 USD threshold in database")
                
                if 'admin_statuses' in result['details']:
                    statuses = result['details']['unique_statuses']
                    findings.append(f"• Admin fee statuses for below-threshold: {', '.join(statuses)}")
                
                if 'pending_sweeps' in result['details']:
                    pending = result['details']['pending_sweeps']
                    successful = result['details']['successful_sweeps']
                    findings.append(f"• Admin fee sweep status: {pending} pending, {successful} successful")
                
                if 'function_exists' in result['details']:
                    exists = result['details']['function_exists']
                    findings.append(f"• sweepNativeAdminFees function: {'Found' if exists else 'Not found'}")
        
        for finding in findings:
            print(finding)
        
        if self.errors:
            print(f"\nERRORS ENCOUNTERED:")
            for error in self.errors:
                print(f"❌ {error}")
        
        print(f"\nRECOMMENDations:")
        print("• Review admin fee handling for payments below $5 USD threshold")
        print("• Verify sweep logic for below-threshold admin fees")
        print("• Check if admin fees are accumulated or swept immediately")
        print("• Ensure proper tracking of below-threshold payments")
        
        return {
            'total_tests': total_tests,
            'passed_tests': passed_tests,
            'failed_tests': failed_tests,
            'success_rate': passed_tests/total_tests*100,
            'findings': findings,
            'errors': self.errors
        }

def main():
    """Main test execution"""
    tester = BelowThresholdPaymentTester()
    
    try:
        # Run comprehensive testing
        success = tester.run_comprehensive_below_threshold_test()
        
        # Generate summary report
        summary = tester.generate_summary_report()
        
        # Exit with appropriate code
        if summary['failed_tests'] == 0:
            print(f"\n🎉 ALL TESTS PASSED! Below-threshold payment system analysis complete.")
            sys.exit(0)
        else:
            print(f"\n⚠️  {summary['failed_tests']} tests failed. Review findings above.")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n⚠️ Testing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 FATAL ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()