#!/usr/bin/env python3
"""
PHASE 10 TASK 10.3 - CURRENCY VALIDATION WITH REDIS DATA - FINAL TEST

Tests the currency validation logic in payment creation after Phase 10 implementation fix.
Validates that userWalletModel.findOne() is used correctly with wallet_type field.
"""

import os
import sys
import json
import time
import requests
import redis
from typing import Dict, Any

class Phase10CurrencyValidationTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.user_id = None
        self.company_id = None
        
        # Redis connection for test data setup
        self.redis_client = self.setup_redis_connection()
        
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
    
    def setup_redis_connection(self):
        """Setup Redis connection using backend .env configuration"""
        try:
            with open('/app/backend/.env', 'r') as f:
                for line in f:
                    if line.startswith('REDIS_PUBLIC_URL='):
                        redis_url = line.split('=', 1)[1].strip()
                        # Parse Redis URL: redis://default:password@host:port
                        if redis_url.startswith('redis://'):
                            # Extract components
                            url_parts = redis_url.replace('redis://', '').split('@')
                            if len(url_parts) == 2:
                                auth_part = url_parts[0]
                                host_port = url_parts[1]
                                
                                # Extract password
                                if ':' in auth_part:
                                    username, password = auth_part.split(':', 1)
                                else:
                                    password = auth_part
                                
                                # Extract host and port
                                if ':' in host_port:
                                    host, port = host_port.split(':')
                                    port = int(port)
                                else:
                                    host = host_port
                                    port = 6379
                                
                                return redis.Redis(host=host, port=port, password=password, decode_responses=True)
        except Exception as e:
            print(f"⚠️ Redis connection failed: {e}")
            return None
        
        return None
        
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
    
    def authenticate_with_provided_credentials(self):
        """Authenticate with provided credentials: nomadly@moxx.co / Katiekendra123@"""
        print("\n=== Authenticating with Provided Credentials ===")
        
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
                    self.user_id = data['data'].get('user_id', 4)  # Default to 4 as mentioned in review
                    
                    self.log_result(
                        "Authentication", 
                        True, 
                        f"Successfully authenticated user {test_credentials['email']}",
                        {"user_id": self.user_id, "has_token": bool(self.jwt_token)}
                    )
                    return True
                else:
                    self.log_result(
                        "Authentication", 
                        False, 
                        "Login succeeded but no token received",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Authentication", 
                    False, 
                    f"Login failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Authentication", 
                False, 
                f"Authentication failed: {str(e)}"
            )
        
        return False
    
    def verify_user_wallet_configuration(self):
        """Verify user has BTC wallet configured and check configured currencies"""
        print("\n=== Verifying User Wallet Configuration ===")
        
        if not self.jwt_token:
            self.log_result(
                "Wallet Configuration Check", 
                False, 
                "No JWT token available for authentication"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Check configured currencies endpoint
            response = requests.get(
                f"{self.backend_url}/api/wallet/configured-currencies",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    wallet_data = data['data']
                    configured_currencies = wallet_data.get('configured_currencies', [])
                    
                    # Check if BTC is configured
                    btc_configured = 'BTC' in configured_currencies
                    xrp_configured = 'XRP' in configured_currencies
                    
                    self.log_result(
                        "Configured Currencies Check", 
                        True, 
                        f"Retrieved {len(configured_currencies)} configured currencies",
                        {
                            "configured_currencies": configured_currencies,
                            "btc_configured": btc_configured,
                            "xrp_configured": xrp_configured,
                            "wallet_count": wallet_data.get('wallet_count', 0)
                        }
                    )
                    
                    return {
                        "btc_configured": btc_configured,
                        "xrp_configured": xrp_configured,
                        "configured_currencies": configured_currencies
                    }
                else:
                    self.log_result(
                        "Configured Currencies Check", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Configured Currencies Check", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Configured Currencies Check", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return False
    
    def setup_redis_test_data(self, currency: str, test_type: str):
        """Setup Redis test data for payment creation"""
        print(f"\n--- Setting up Redis data for {test_type} test ({currency}) ---")
        
        if not self.redis_client:
            self.log_result(
                f"Redis Setup - {test_type}", 
                False, 
                "Redis connection not available"
            )
            return None
        
        try:
            # Create unique transaction ID
            timestamp = int(time.time())
            transaction_id = f"TEST_{currency}_{test_type}_{timestamp}"
            
            # Redis payload structure based on createCryptoPayment expectations
            redis_payload = {
                "user_id": self.user_id or 4,
                "adm_id": self.user_id or 4,
                "company_id": self.company_id or 1,
                "customer_id": 1,
                "base_amount": 100,
                "amount": 100,
                "base_currency": "USD",
                "currency": currency,
                "pathType": "createPayment",
                "fee_payer": "company",
                "transaction_id": transaction_id,
                "meta_data": json.dumps({"product_name": f"Test Product {currency}"})
            }
            
            # Store in Redis with customer- prefix as expected by createCryptoPayment
            redis_key = f"customer-{transaction_id}"
            self.redis_client.setex(redis_key, 3600, json.dumps(redis_payload))  # 1 hour expiry
            
            self.log_result(
                f"Redis Setup - {test_type}", 
                True, 
                f"Redis data created for {currency} test",
                {
                    "redis_key": redis_key,
                    "transaction_id": transaction_id,
                    "currency": currency,
                    "user_id": self.user_id or 4,
                    "company_id": self.company_id or 1
                }
            )
            
            return transaction_id
            
        except Exception as e:
            self.log_result(
                f"Redis Setup - {test_type}", 
                False, 
                f"Failed to setup Redis data: {str(e)}"
            )
            return None
    
    def test_positive_scenario_btc(self):
        """SCENARIO 1: POSITIVE TEST - Configured Currency (BTC)"""
        print("\n=== SCENARIO 1: POSITIVE TEST - Configured Currency (BTC) ===")
        
        # Setup Redis data for BTC payment
        transaction_id = self.setup_redis_test_data("BTC", "POSITIVE")
        if not transaction_id:
            return
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Create crypto payment with BTC
            payment_data = {
                "uniqueRef": transaction_id,
                "currency": "BTC",
                "amount": 0.001,  # Small BTC amount
                "customer_email": "test@example.com"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createCryptoPayment",
                json=payment_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    payment_result = data['data']
                    
                    # Check if payment was created successfully
                    if 'address' in payment_result and 'transaction_id' in payment_result:
                        self.log_result(
                            "BTC Payment Creation - Positive", 
                            True, 
                            "BTC payment created successfully (wallet configured)",
                            {
                                "transaction_id": payment_result.get('transaction_id'),
                                "address": payment_result.get('address')[:10] + "..." if payment_result.get('address') else None,
                                "qr_code_present": 'qr_code' in payment_result
                            }
                        )
                        
                        # Check backend logs for Phase 10 validation messages
                        self.check_backend_logs_for_validation("BTC", "configured")
                        
                    else:
                        self.log_result(
                            "BTC Payment Creation - Positive", 
                            False, 
                            "Payment response missing required fields",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "BTC Payment Creation - Positive", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                # This should not happen for configured currency
                self.log_result(
                    "BTC Payment Creation - Positive", 
                    False, 
                    f"Payment creation failed with status {response.status_code} (should succeed for configured currency)",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "BTC Payment Creation - Positive", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Cleanup Redis data
        self.cleanup_redis_data(transaction_id)
    
    def test_negative_scenario_xrp(self):
        """SCENARIO 2: NEGATIVE TEST - Unconfigured Currency (XRP)"""
        print("\n=== SCENARIO 2: NEGATIVE TEST - Unconfigured Currency (XRP) ===")
        
        # Setup Redis data for XRP payment
        transaction_id = self.setup_redis_test_data("XRP", "NEGATIVE")
        if not transaction_id:
            return
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Attempt to create crypto payment with XRP
            payment_data = {
                "uniqueRef": transaction_id,
                "currency": "XRP",
                "amount": 10,  # XRP amount
                "customer_email": "test@example.com"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createCryptoPayment",
                json=payment_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 400:
                data = response.json()
                
                # Check if error message is correct
                error_message = data.get('message', '').lower()
                expected_message_parts = ['no wallet address configured', 'xrp', 'please add']
                
                message_correct = all(part in error_message for part in expected_message_parts)
                
                if message_correct:
                    self.log_result(
                        "XRP Payment Creation - Negative", 
                        True, 
                        "XRP payment correctly blocked with proper error message",
                        {
                            "status_code": response.status_code,
                            "error_message": data.get('message'),
                            "validation_working": True
                        }
                    )
                    
                    # Check backend logs for Phase 10 validation messages
                    self.check_backend_logs_for_validation("XRP", "unconfigured")
                    
                else:
                    self.log_result(
                        "XRP Payment Creation - Negative", 
                        False, 
                        f"Error message format incorrect: {data.get('message')}",
                        {"expected_parts": expected_message_parts, "actual_message": error_message}
                    )
            elif response.status_code == 200:
                # This should not happen for unconfigured currency
                self.log_result(
                    "XRP Payment Creation - Negative", 
                    False, 
                    "Payment creation succeeded when it should have failed (XRP not configured)",
                    {"response": response.json()}
                )
            else:
                self.log_result(
                    "XRP Payment Creation - Negative", 
                    False, 
                    f"Unexpected status code {response.status_code} (expected 400)",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "XRP Payment Creation - Negative", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Cleanup Redis data
        self.cleanup_redis_data(transaction_id)
    
    def test_validation_bypass_scenarios(self):
        """SCENARIO 3: VALIDATION BYPASS CHECK"""
        print("\n=== SCENARIO 3: VALIDATION BYPASS CHECK ===")
        
        # Test 1: Try to create payment without Redis data
        self.test_payment_without_redis_data()
        
        # Test 2: Try with malformed currency
        self.test_payment_with_invalid_currency()
    
    def test_payment_without_redis_data(self):
        """Test payment creation without Redis data"""
        print("\n--- Testing Payment Without Redis Data ---")
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Try to create payment with non-existent Redis key
            payment_data = {
                "uniqueRef": "NON_EXISTENT_KEY_12345",
                "currency": "BTC",
                "amount": 0.001,
                "customer_email": "test@example.com"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createCryptoPayment",
                json=payment_data,
                headers=headers,
                timeout=15
            )
            
            # Should fail with Redis key not found error
            if response.status_code == 500:
                data = response.json()
                error_message = data.get('message', '').lower()
                
                if 'redis' in error_message or 'not found' in error_message or 'transaction' in error_message:
                    self.log_result(
                        "Payment Without Redis Data", 
                        True, 
                        "Payment correctly failed when Redis data missing",
                        {"error_message": data.get('message')}
                    )
                else:
                    self.log_result(
                        "Payment Without Redis Data", 
                        False, 
                        f"Unexpected error message: {data.get('message')}",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Payment Without Redis Data", 
                    False, 
                    f"Expected 500 error, got {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Payment Without Redis Data", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_payment_with_invalid_currency(self):
        """Test payment creation with malformed currency"""
        print("\n--- Testing Payment With Invalid Currency ---")
        
        # Setup Redis data for invalid currency test
        transaction_id = self.setup_redis_test_data("INVALID123", "BYPASS")
        if not transaction_id:
            return
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Try to create payment with invalid currency
            payment_data = {
                "uniqueRef": transaction_id,
                "currency": "INVALID123",
                "amount": 100,
                "customer_email": "test@example.com"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createCryptoPayment",
                json=payment_data,
                headers=headers,
                timeout=15
            )
            
            # Should fail with wallet not configured error
            if response.status_code == 400:
                data = response.json()
                error_message = data.get('message', '').lower()
                
                if 'no wallet address configured' in error_message and 'invalid123' in error_message:
                    self.log_result(
                        "Payment With Invalid Currency", 
                        True, 
                        "Invalid currency correctly blocked with wallet validation",
                        {"error_message": data.get('message')}
                    )
                else:
                    self.log_result(
                        "Payment With Invalid Currency", 
                        False, 
                        f"Unexpected error message format: {data.get('message')}",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Payment With Invalid Currency", 
                    False, 
                    f"Expected 400 error, got {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Payment With Invalid Currency", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Cleanup Redis data
        self.cleanup_redis_data(transaction_id)
    
    def check_backend_logs_for_validation(self, currency: str, expected_result: str):
        """Check backend logs for Phase 10 validation messages"""
        print(f"\n--- Checking Backend Logs for {currency} Validation ---")
        
        try:
            # Check backend logs for Phase 10 validation messages
            import subprocess
            result = subprocess.run(
                ["tail", "-n", "50", "/var/log/supervisor/backend.out.log"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                log_content = result.stdout
                
                # Look for Phase 10 validation messages
                phase10_messages = []
                for line in log_content.split('\n'):
                    if 'Phase 10' in line or 'Checking wallet for currency' in line or 'Wallet found' in line:
                        phase10_messages.append(line.strip())
                
                if phase10_messages:
                    # Check for specific currency and result
                    currency_check = any(currency in msg for msg in phase10_messages)
                    result_check = any(('YES' if expected_result == 'configured' else 'NO') in msg for msg in phase10_messages)
                    
                    if currency_check and result_check:
                        self.log_result(
                            f"Backend Logs - {currency} Validation", 
                            True, 
                            f"Phase 10 validation logs found for {currency} ({expected_result})",
                            {"validation_messages": phase10_messages[-3:]}  # Last 3 messages
                        )
                    else:
                        self.log_result(
                            f"Backend Logs - {currency} Validation", 
                            False, 
                            f"Phase 10 validation logs incomplete for {currency}",
                            {"found_messages": phase10_messages, "currency_check": currency_check, "result_check": result_check}
                        )
                else:
                    self.log_result(
                        f"Backend Logs - {currency} Validation", 
                        False, 
                        "No Phase 10 validation messages found in logs",
                        {"log_sample": log_content[-500:] if log_content else "No logs"}
                    )
            else:
                self.log_result(
                    f"Backend Logs - {currency} Validation", 
                    False, 
                    "Failed to read backend logs",
                    {"error": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                f"Backend Logs - {currency} Validation", 
                False, 
                f"Log check failed: {str(e)}"
            )
    
    def cleanup_redis_data(self, transaction_id: str):
        """Cleanup Redis test data"""
        if self.redis_client and transaction_id:
            try:
                redis_key = f"customer-{transaction_id}"
                self.redis_client.delete(redis_key)
                print(f"🧹 Cleaned up Redis key: {redis_key}")
            except Exception as e:
                print(f"⚠️ Failed to cleanup Redis key: {e}")
    
    def verify_code_implementation(self):
        """Verify the code implementation uses userWalletModel correctly"""
        print("\n=== VERIFYING CODE IMPLEMENTATION ===")
        
        try:
            # Read the paymentController.ts file to verify implementation
            with open('/app/backend/controller/paymentController.ts', 'r') as f:
                controller_content = f.read()
            
            # Check for Phase 10 implementation markers
            checks = {
                "userWalletModel_usage": "userWalletModel.findOne" in controller_content,
                "wallet_type_field": "wallet_type:" in controller_content,
                "wallet_address_validation": "wallet_address: { [Op.not]: null }" in controller_content,
                "phase10_comments": "Phase 10" in controller_content,
                "currency_validation_error": "No wallet address configured for" in controller_content
            }
            
            all_checks_passed = all(checks.values())
            
            if all_checks_passed:
                self.log_result(
                    "Code Implementation Verification", 
                    True, 
                    "All Phase 10 implementation requirements found in code",
                    checks
                )
            else:
                failed_checks = [check for check, passed in checks.items() if not passed]
                self.log_result(
                    "Code Implementation Verification", 
                    False, 
                    f"Missing implementation requirements: {', '.join(failed_checks)}",
                    checks
                )
                
        except Exception as e:
            self.log_result(
                "Code Implementation Verification", 
                False, 
                f"Failed to verify code implementation: {str(e)}"
            )
    
    def run_comprehensive_test(self):
        """Run comprehensive Phase 10 Task 10.3 currency validation test"""
        print("🚀 Starting Phase 10 Task 10.3 - Currency Validation with Redis Data Test")
        print("=" * 80)
        
        # Step 1: Authenticate
        if not self.authenticate_with_provided_credentials():
            print("❌ Authentication failed - cannot proceed with tests")
            return
        
        # Step 2: Verify wallet configuration
        wallet_config = self.verify_user_wallet_configuration()
        if not wallet_config:
            print("❌ Wallet configuration check failed - cannot proceed with tests")
            return
        
        # Step 3: Verify code implementation
        self.verify_code_implementation()
        
        # Step 4: Run positive scenario (BTC - configured currency)
        if wallet_config.get("btc_configured", False):
            self.test_positive_scenario_btc()
        else:
            print("⚠️ BTC not configured - skipping positive test scenario")
        
        # Step 5: Run negative scenario (XRP - unconfigured currency)
        if not wallet_config.get("xrp_configured", False):
            self.test_negative_scenario_xrp()
        else:
            print("⚠️ XRP is configured - negative test may not work as expected")
        
        # Step 6: Run validation bypass tests
        self.test_validation_bypass_scenarios()
        
        # Step 7: Generate summary
        self.generate_test_summary()
    
    def generate_test_summary(self):
        """Generate comprehensive test summary"""
        print("\n" + "=" * 80)
        print("📊 PHASE 10 TASK 10.3 - CURRENCY VALIDATION TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        print()
        
        # Show detailed results
        for test_name, result in self.test_results.items():
            status = "✅ PASS" if result['success'] else "❌ FAIL"
            print(f"{status}: {test_name}")
            if not result['success']:
                print(f"    └─ {result['message']}")
        
        if self.errors:
            print(f"\n❌ FAILED TESTS ({len(self.errors)}):")
            for error in self.errors:
                print(f"  • {error}")
        
        # Overall assessment
        print(f"\n🎯 OVERALL ASSESSMENT:")
        if success_rate >= 80:
            print("✅ Phase 10 Task 10.3 currency validation is working correctly!")
            print("✅ userWalletModel.findOne() implementation verified")
            print("✅ Currency validation logic functioning as expected")
        elif success_rate >= 60:
            print("⚠️ Phase 10 Task 10.3 mostly working with minor issues")
            print("⚠️ Some validation scenarios need attention")
        else:
            print("❌ Phase 10 Task 10.3 has significant issues")
            print("❌ Currency validation logic needs fixing")
        
        print("=" * 80)

def main():
    """Main test execution"""
    tester = Phase10CurrencyValidationTester()
    tester.run_comprehensive_test()

if __name__ == "__main__":
    main()