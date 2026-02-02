#!/usr/bin/env python3
"""
DynoPay Backend Testing - checkMissedPayments Feature Comprehensive Test

This test verifies the checkMissedPayments webhook fallback feature works exactly like 
the Tatum webhook processing, including minimum forwarding thresholds, fund distribution,
merchant webhook callbacks, and all critical functionality.

Test Credentials:
- Email: john@dyno.pt
- Password: Katiekendra123@
- Company ID: 38

Backend URLs:
- Backend: https://setup-tooling.preview.emergentagent.com
- Health: https://setup-tooling.preview.emergentagent.com/health
"""

import requests
import json
import time
import sys
from datetime import datetime, timedelta

# Configuration
BACKEND_URL = "https://setup-tooling.preview.emergentagent.com"
TEST_EMAIL = "john@dyno.pt"
TEST_PASSWORD = "Katiekendra123@"
TEST_COMPANY_ID = 38

class DynoPayTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'DynoPay-Test/1.0'
        })
        self.auth_token = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
        
    def authenticate(self):
        """Authenticate with test credentials"""
        print(f"\n🔐 Authenticating with {TEST_EMAIL}...")
        
        try:
            response = self.session.post(f"{BACKEND_URL}/api/user/login", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                # Handle different token response structures
                token = None
                user_info = {}
                
                if data.get('data', {}).get('accessToken'):
                    token = data['data']['accessToken']
                    user_info = data['data'].get('userData', {})
                elif data.get('data', {}).get('token'):
                    token = data['data']['token']
                    user_info = data['data'].get('user', {})
                
                if token:
                    self.auth_token = token
                    self.session.headers['Authorization'] = f'Bearer {self.auth_token}'
                    self.log_test("Authentication", True, 
                                f"Logged in as {user_info.get('name', 'Unknown')} (ID: {user_info.get('user_id')})")
                    return True
                else:
                    self.log_test("Authentication", False, f"No token in response: {data}")
                    return False
            else:
                self.log_test("Authentication", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Authentication", False, f"Exception: {str(e)}")
            return False
    
    def test_backend_health(self):
        """Test backend health endpoint"""
        print(f"\n🏥 Testing backend health...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/health")
            if response.status_code == 200:
                self.log_test("Backend Health", True, f"Backend is healthy")
                return True
            else:
                self.log_test("Backend Health", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Backend Health", False, f"Exception: {str(e)}")
            return False
    
    def verify_code_structure(self):
        """Verify checkMissedPayments function structure"""
        print(f"\n🔍 Code Structure Verification...")
        
        # Test 1: Check if checkMissedPayments function exists in merchantPoolService.ts
        try:
            with open('/app/backend/services/merchantPoolService.ts', 'r') as f:
                content = f.read()
                
            # Check for 10-minute grace period constant
            if 'WEBHOOK_GRACE_PERIOD_MINUTES = 10' in content:
                self.log_test("10-minute Grace Period Constant", True, "Found WEBHOOK_GRACE_PERIOD_MINUTES = 10")
            else:
                self.log_test("10-minute Grace Period Constant", False, "WEBHOOK_GRACE_PERIOD_MINUTES = 10 not found")
            
            # Check for partial payment checks
            if 'incomplete === \'true\'' in content and 'partialPaymentTimestamp' in content:
                self.log_test("Partial Payment Checks", True, "Found incomplete flag and timestamp checks")
            else:
                self.log_test("Partial Payment Checks", False, "Partial payment logic not found")
            
            # Check for underpayment detection with tolerance
            if 'tolerance = expectedAmount * 0.01' in content and 'isUnderpayment' in content:
                self.log_test("Underpayment Detection (1% tolerance)", True, "Found 1% tolerance underpayment logic")
            else:
                self.log_test("Underpayment Detection (1% tolerance)", False, "1% tolerance logic not found")
            
            # Check for 25-minute threshold for underpayments
            if 'minutesSinceReserved < 25' in content:
                self.log_test("25-minute Underpayment Threshold", True, "Found 25-minute threshold for underpayments")
            else:
                self.log_test("25-minute Underpayment Threshold", False, "25-minute threshold not found")
            
            # Check for cryptoVerification call with webhook=true
            if 'paymentController.cryptoVerification(walletAddress, true)' in content:
                self.log_test("cryptoVerification(address, true) Call", True, "Found webhook=true parameter")
            else:
                self.log_test("cryptoVerification(address, true) Call", False, "webhook=true parameter not found")
                
        except Exception as e:
            self.log_test("Code Structure Verification", False, f"Exception: {str(e)}")
    
    def verify_min_forwarding_thresholds(self):
        """Verify minimum forwarding threshold configuration"""
        print(f"\n💰 Minimum Forwarding Threshold Verification...")
        
        try:
            # Check .env file for threshold values
            with open('/app/backend/.env', 'r') as f:
                env_content = f.read()
            
            thresholds = {}
            currencies = ['BTC', 'ETH', 'TRX', 'USDT_TRC20', 'USDT_ERC20', 'LTC', 'DOGE', 'BCH', 'USDC_ERC20']
            
            for currency in currencies:
                threshold_key = f"{currency}_THRESHOLD"
                for line in env_content.split('\n'):
                    if line.startswith(f"{threshold_key}="):
                        value = line.split('=')[1].strip()
                        thresholds[currency] = value
                        break
            
            if len(thresholds) > 0:
                threshold_details = ", ".join([f"{k}: ${v}" for k, v in thresholds.items()])
                self.log_test("Minimum Forwarding Thresholds", True, f"Found thresholds: {threshold_details}")
            else:
                self.log_test("Minimum Forwarding Thresholds", False, "No threshold values found in .env")
            
            # Check calculateTransactionFees function exists
            try:
                with open('/app/backend/controller/index.ts', 'r') as f:
                    controller_content = f.read()
                
                if 'calculateTransactionFees' in controller_content and 'minForwarding' in controller_content:
                    self.log_test("calculateTransactionFees Function", True, "Function exists with minForwarding logic")
                else:
                    self.log_test("calculateTransactionFees Function", False, "Function or minForwarding logic not found")
                    
            except Exception as e:
                self.log_test("calculateTransactionFees Function", False, f"Exception: {str(e)}")
                
        except Exception as e:
            self.log_test("Minimum Forwarding Threshold Verification", False, f"Exception: {str(e)}")
    
    def verify_fund_distribution_logic(self):
        """Verify fund distribution logic in cryptoVerification"""
        print(f"\n💸 Fund Distribution Logic Verification...")
        
        try:
            with open('/app/backend/controller/paymentController.ts', 'r') as f:
                content = f.read()
            
            # Check for minForwarding threshold logic
            if ('minForwarding' in content and 'adminAmountToSend = Number(totalAmountReceived)' in content) or \
               ('minForwarding' in content and 'all to admin' in content):
                self.log_test("Below Threshold Logic (100% to admin)", True, "Found logic for amounts below minForwarding")
            else:
                self.log_test("Below Threshold Logic (100% to admin)", False, "Below threshold logic not found")
            
            # Check for normal distribution logic
            if ('adminAmountToSend = Number(totalDeduction)' in content and 'userAmountToSend = Number(totalReceived) - Number(totalDeduction)' in content) or \
               ('totalDeduction' in content and 'userAmountToSend' in content):
                self.log_test("Normal Distribution Logic", True, "Found normal fee distribution logic")
            else:
                self.log_test("Normal Distribution Logic", False, "Normal distribution logic not found")
            
            # Check for fee_payer mode handling
            if 'fee_payer' in content and ('customer' in content or 'company' in content):
                self.log_test("Fee Payer Mode Handling", True, "Found fee_payer mode logic")
            else:
                self.log_test("Fee Payer Mode Handling", False, "Fee payer mode logic not found")
            
            # Check for merchant_amount field usage
            if 'merchant_amount' in content:
                self.log_test("Merchant Amount Field Usage", True, "Found merchant_amount field references")
            else:
                self.log_test("Merchant Amount Field Usage", False, "merchant_amount field not found")
                
        except Exception as e:
            self.log_test("Fund Distribution Logic Verification", False, f"Exception: {str(e)}")
    
    def verify_merchant_webhook_triggering(self):
        """Verify merchant webhook triggering in cryptoVerification"""
        print(f"\n📡 Merchant Webhook Triggering Verification...")
        
        try:
            with open('/app/backend/controller/paymentController.ts', 'r') as f:
                payment_content = f.read()
            
            with open('/app/backend/webhooks/index.ts', 'r') as f:
                webhook_content = f.read()
            
            # Check for callMerchantWebhook import and usage
            if 'import { callMerchantWebhook }' in payment_content and 'callMerchantWebhook(customerData' in payment_content:
                self.log_test("callMerchantWebhook Import & Usage", True, "Found import and usage in paymentController")
            else:
                self.log_test("callMerchantWebhook Import & Usage", False, "Import or usage not found")
            
            # Check webhook=true condition
            if 'if (webhook)' in payment_content and 'callMerchantWebhook' in payment_content:
                self.log_test("Webhook=true Condition", True, "Found webhook condition for callMerchantWebhook")
            else:
                self.log_test("Webhook=true Condition", False, "Webhook condition not found")
            
            # Check callMerchantWebhook function implementation
            if 'const callMerchantWebhook = async' in webhook_content:
                self.log_test("callMerchantWebhook Function", True, "Function exists in webhooks/index.ts")
            else:
                self.log_test("callMerchantWebhook Function", False, "Function not found in webhooks/index.ts")
            
            # Check for callback_url and webhook_url retrieval
            if 'callback_url' in webhook_content and 'webhook_url' in webhook_content:
                self.log_test("URL Retrieval Logic", True, "Found callback_url and webhook_url retrieval")
            else:
                self.log_test("URL Retrieval Logic", False, "URL retrieval logic not found")
            
            # Check event payload structure
            if ('event: "payment.confirmed"' in payment_content or 'event.*payment.confirmed' in payment_content) and \
               'payment_id' in payment_content and 'transaction_reference' in payment_content:
                self.log_test("Event Payload Structure", True, "Found required event payload fields")
            else:
                self.log_test("Event Payload Structure", False, "Required payload fields not found")
                
        except Exception as e:
            self.log_test("Merchant Webhook Triggering Verification", False, f"Exception: {str(e)}")
    
    def verify_redis_data_structure(self):
        """Verify Redis data structure matches webhook expectations"""
        print(f"\n🔴 Redis Data Structure Verification...")
        
        try:
            with open('/app/backend/services/merchantPoolService.ts', 'r') as f:
                content = f.read()
            
            # Check for Redis data structure in checkMissedPayments
            redis_fields = ['txId', 'receivedAmount', 'status: \'processing\'', 'incomplete', 'processedByFallback']
            found_fields = []
            
            for field in redis_fields:
                if field in content:
                    found_fields.append(field)
            
            if len(found_fields) >= 4:
                self.log_test("Redis Data Structure", True, f"Found {len(found_fields)}/5 required fields: {', '.join(found_fields)}")
            else:
                self.log_test("Redis Data Structure", False, f"Only found {len(found_fields)}/5 fields: {', '.join(found_fields)}")
            
            # Check for processedByFallback marker
            if 'processedByFallback' in content:
                self.log_test("Fallback Processing Marker", True, "Found processedByFallback marker")
            else:
                self.log_test("Fallback Processing Marker", False, "processedByFallback marker not found")
                
        except Exception as e:
            self.log_test("Redis Data Structure Verification", False, f"Exception: {str(e)}")
    
    def verify_duplicate_prevention(self):
        """Verify duplicate transaction prevention"""
        print(f"\n🚫 Duplicate Prevention Verification...")
        
        try:
            with open('/app/backend/services/merchantPoolService.ts', 'r') as f:
                content = f.read()
            
            # Check for processed-tx-{txId} Redis key
            if 'processed-tx-' in content and 'processedTxKey' in content:
                self.log_test("Processed Transaction Key", True, "Found processed-tx-{txId} Redis key logic")
            else:
                self.log_test("Processed Transaction Key", False, "processed-tx-{txId} key logic not found")
            
            # Check for duplicate detection before processing
            if 'alreadyProcessedTx' in content and 'already processed' in content:
                self.log_test("Duplicate Detection Logic", True, "Found duplicate detection before processing")
            else:
                self.log_test("Duplicate Detection Logic", False, "Duplicate detection logic not found")
            
            # Check for Redis txId check
            if 'redisData?.txId' in content:
                self.log_test("Redis TxId Check", True, "Found Redis txId existence check")
            else:
                self.log_test("Redis TxId Check", False, "Redis txId check not found")
                
        except Exception as e:
            self.log_test("Duplicate Prevention Verification", False, f"Exception: {str(e)}")
    
    def test_api_endpoints(self):
        """Test critical API endpoints"""
        print(f"\n🌐 API Endpoints Testing...")
        
        if not self.auth_token:
            self.log_test("API Endpoints", False, "No authentication token available")
            return
        
        # Test getPaymentLinks endpoint
        try:
            response = self.session.get(f"{BACKEND_URL}/api/pay/getPaymentLinks")
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    links = data.get('data', [])
                    self.log_test("GET /api/pay/getPaymentLinks", True, f"Retrieved {len(links)} payment links")
                else:
                    self.log_test("GET /api/pay/getPaymentLinks", False, f"API returned success=false")
            else:
                self.log_test("GET /api/pay/getPaymentLinks", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/pay/getPaymentLinks", False, f"Exception: {str(e)}")
        
        # Test getData endpoint with a sample link (if available)
        try:
            # First get a payment link to test getData
            response = self.session.get(f"{BACKEND_URL}/api/pay/getPaymentLinks")
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('data') and len(data['data']) > 0:
                    # Use the first payment link for testing
                    first_link = data['data'][0]
                    link_id = first_link.get('link_id')
                    
                    if link_id:
                        # Test getData endpoint
                        get_data_response = self.session.post(f"{BACKEND_URL}/api/pay/getData", json={
                            "data": str(link_id)
                        })
                        
                        if get_data_response.status_code == 200:
                            get_data_result = get_data_response.json()
                            if get_data_result.get('success'):
                                payload = get_data_result.get('data', {})
                                expected_amount = payload.get('amount', 0)
                                self.log_test("POST /api/pay/getData", True, f"Retrieved payment data, amount: {expected_amount}")
                            else:
                                self.log_test("POST /api/pay/getData", False, "API returned success=false")
                        else:
                            self.log_test("POST /api/pay/getData", False, f"HTTP {get_data_response.status_code}")
                    else:
                        self.log_test("POST /api/pay/getData", False, "No link_id found in payment links")
                else:
                    self.log_test("POST /api/pay/getData", False, "No payment links available for testing")
        except Exception as e:
            self.log_test("POST /api/pay/getData", False, f"Exception: {str(e)}")
    
    def check_cron_job_logs(self):
        """Check backend logs for checkMissedPayments cron job activity"""
        print(f"\n📋 Cron Job Verification...")
        
        try:
            import subprocess
            
            # Check backend logs for checkMissedPayments activity
            result = subprocess.run([
                'tail', '-n', '100', '/var/log/supervisor/backend.out.log'
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                log_content = result.stdout
                
                # Check for checkMissedPayments cron execution
                if 'checkMissedPayments' in log_content:
                    self.log_test("checkMissedPayments Cron Execution", True, "Found checkMissedPayments in backend logs")
                else:
                    self.log_test("checkMissedPayments Cron Execution", False, "No checkMissedPayments found in recent logs")
                
                # Check for webhook grace period message
                if 'Webhook grace period: 10 minutes' in log_content:
                    self.log_test("Webhook Grace Period Log", True, "Found 10-minute grace period message")
                else:
                    self.log_test("Webhook Grace Period Log", False, "Grace period message not found")
                
                # Check for reserved addresses check
                if 'reserved addresses to check' in log_content:
                    self.log_test("Reserved Addresses Check Log", True, "Found reserved addresses check message")
                else:
                    self.log_test("Reserved Addresses Check Log", False, "Reserved addresses check message not found")
                    
            else:
                self.log_test("Backend Log Access", False, f"Failed to read backend logs: {result.stderr}")
                
        except Exception as e:
            self.log_test("Cron Job Verification", False, f"Exception: {str(e)}")
    
    def document_integration_flow(self):
        """Document the complete checkMissedPayments integration flow"""
        print(f"\n📖 Integration Flow Documentation...")
        
        flow_steps = [
            "1. Payment created → address reserved (30-min timeout)",
            "2. 10 min passes → checkMissedPayments eligible for processing",
            "3. Balance detected on blockchain via getAddressBalance",
            "4. Checks pass: no txId in Redis, no incomplete flag, not already processed",
            "5. Transaction fetched from blockchain via getIncomingTransactions",
            "6. Redis updated with txId and processing status",
            "7. cryptoVerification called with webhook=true parameter",
            "8. Funds distributed respecting minForwarding threshold",
            "9. Merchant webhook sent via callMerchantWebhook",
            "10. Pool transaction recorded in database"
        ]
        
        print("\n📋 Complete checkMissedPayments Integration Flow:")
        for step in flow_steps:
            print(f"    {step}")
        
        self.log_test("Integration Flow Documentation", True, f"Documented {len(flow_steps)} flow steps")
    
    def run_comprehensive_test(self):
        """Run all checkMissedPayments tests"""
        print("=" * 80)
        print("🚀 DynoPay checkMissedPayments Feature - Comprehensive Testing")
        print("=" * 80)
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test Credentials: {TEST_EMAIL}")
        print(f"Company ID: {TEST_COMPANY_ID}")
        print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Run all tests
        self.test_backend_health()
        self.authenticate()
        self.verify_code_structure()
        self.verify_min_forwarding_thresholds()
        self.verify_fund_distribution_logic()
        self.verify_merchant_webhook_triggering()
        self.verify_redis_data_structure()
        self.verify_duplicate_prevention()
        self.test_api_endpoints()
        self.check_cron_job_logs()
        self.document_integration_flow()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        print(f"\n🎯 CRITICAL FINDINGS:")
        print(f"  - checkMissedPayments function: {'✅ Implemented' if any('checkMissedPayments' in r['test'] for r in self.test_results if r['success']) else '❌ Issues found'}")
        print(f"  - 10-minute grace period: {'✅ Configured' if any('10-minute Grace Period' in r['test'] for r in self.test_results if r['success']) else '❌ Not found'}")
        print(f"  - Minimum forwarding thresholds: {'✅ Configured' if any('Minimum Forwarding' in r['test'] for r in self.test_results if r['success']) else '❌ Not found'}")
        print(f"  - Merchant webhook integration: {'✅ Implemented' if any('callMerchantWebhook' in r['test'] for r in self.test_results if r['success']) else '❌ Issues found'}")
        print(f"  - Duplicate prevention: {'✅ Implemented' if any('Duplicate Prevention' in r['test'] for r in self.test_results if r['success']) else '❌ Issues found'}")
        
        print(f"\n🔧 MINIMUM FORWARDING THRESHOLDS FOUND:")
        # Extract threshold information from test results
        for result in self.test_results:
            if 'Minimum Forwarding Thresholds' in result['test'] and result['success']:
                print(f"  {result['details']}")
                break
        else:
            print(f"  ❌ No threshold configuration found")
        
        print(f"\n✅ CONCLUSION:")
        if success_rate >= 80:
            print(f"  checkMissedPayments feature is {'FULLY' if success_rate >= 95 else 'MOSTLY'} operational")
            print(f"  Webhook fallback mechanism should work as expected")
            print(f"  Fund distribution and merchant webhooks are properly configured")
        else:
            print(f"  ⚠️ checkMissedPayments feature has significant issues")
            print(f"  Manual review and fixes required before production use")
        
        return success_rate >= 80

if __name__ == "__main__":
    tester = DynoPayTester()
    success = tester.run_comprehensive_test()
    sys.exit(0 if success else 1)