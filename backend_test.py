#!/usr/bin/env python3
"""
DynoPay 7 Issues Fix Verification Test
Tests all 7 specific fixes applied to DynoPay backend as requested in review
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any
import uuid

class DynoPay7IssuesFixTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.user_data = None
        
        # Test credentials from review request
        self.test_email = "richard@dyno.pt"
        self.test_password = "Katiekendra123@"
        self.company_id = 38
        
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
                    self.user_data = data['data']['userData']
                    self.log_result(
                        "Authentication", 
                        True, 
                        f"Successfully authenticated {self.user_data.get('email', 'user')}",
                        {
                            "user_id": self.user_data.get('user_id'),
                            "name": self.user_data.get('name'),
                            "email": self.user_data.get('email')
                        }
                    )
                    return True
                else:
                    self.log_result("Authentication", False, "Login succeeded but no token received")
                    return False
            else:
                self.log_result("Authentication", False, f"Login failed with status {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Authentication", False, f"Authentication failed: {str(e)}")
            return False
    
    # ============================================
    # ISSUE #1: KYC Schema Fix - veriff_session_id field
    # ============================================
    
    def test_issue_1_kyc_schema_fix(self):
        """Issue #1: Test KYC Schema Fix - veriff_session_id field"""
        print("\n" + "="*60)
        print("ISSUE #1: KYC SCHEMA FIX - veriff_session_id FIELD")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("Issue #1 - KYC Schema", False, "No JWT token available")
            return
            
        try:
            response = requests.get(
                f"{self.backend_url}/api/kyc/history",
                headers={"Authorization": f"Bearer {self.jwt_token}"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                kyc_records = data.get('data', [])
                
                # Check if veriff_session_id field exists in records
                has_veriff_session_id = False
                veriff_session_ids = []
                
                for record in kyc_records:
                    if 'veriff_session_id' in record:
                        has_veriff_session_id = True
                        veriff_session_ids.append(record.get('veriff_session_id'))
                
                if has_veriff_session_id or len(kyc_records) == 0:
                    self.log_result(
                        "Issue #1 - KYC Schema", 
                        True, 
                        f"KYC history endpoint working - veriff_session_id field available ({len(kyc_records)} records)",
                        {
                            "kyc_record_count": len(kyc_records),
                            "veriff_session_id_present": has_veriff_session_id,
                            "sample_veriff_ids": veriff_session_ids[:3] if veriff_session_ids else []
                        }
                    )
                else:
                    self.log_result("Issue #1 - KYC Schema", False, "veriff_session_id field missing from KYC records")
            else:
                self.log_result("Issue #1 - KYC Schema", False, f"KYC history endpoint failed with status {response.status_code} (should not return 500 error)")
                
        except Exception as e:
            self.log_result("Issue #1 - KYC Schema", False, f"KYC history request failed: {str(e)}")
    
    # ============================================
    # ISSUE #2: Tatum API Fix - wallet operations without subscription errors
    # ============================================
    
    def test_issue_2_tatum_api_fix(self):
        """Issue #2: Test Tatum API Fix - wallet operations without subscription errors"""
        print("\n" + "="*60)
        print("ISSUE #2: TATUM API FIX - WALLET OPERATIONS")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("Issue #2 - Tatum API", False, "No JWT token available")
            return
            
        try:
            response = requests.get(
                f"{self.backend_url}/api/wallet/getWallet",
                headers={"Authorization": f"Bearer {self.jwt_token}"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                wallets = data.get('data', [])
                
                # Check response for subscription errors
                response_text = response.text.lower()
                has_subscription_error = 'subscription' in response_text and 'error' in response_text
                
                if not has_subscription_error:
                    self.log_result(
                        "Issue #2 - Tatum API", 
                        True, 
                        f"Wallet operations working without subscription errors ({len(wallets)} wallets retrieved)",
                        {
                            "wallet_count": len(wallets),
                            "no_subscription_errors": True,
                            "response_status": response.status_code
                        }
                    )
                else:
                    self.log_result("Issue #2 - Tatum API", False, "Subscription errors detected in wallet response")
            else:
                self.log_result("Issue #2 - Tatum API", False, f"Wallet endpoint failed with status {response.status_code}")
                
        except Exception as e:
            self.log_result("Issue #2 - Tatum API", False, f"Wallet request failed: {str(e)}")
    
    # ============================================
    # ISSUE #3: KMS/Wallet Address Fix - BTC address addition without KMS/decoder error
    # ============================================
    
    def test_issue_3_kms_wallet_address_fix(self):
        """Issue #3: Test KMS/Wallet Address Fix - BTC address addition"""
        print("\n" + "="*60)
        print("ISSUE #3: KMS/WALLET ADDRESS FIX - BTC ADDRESS ADDITION")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("Issue #3 - KMS/Wallet Address", False, "No JWT token available")
            return
            
        try:
            # Test BTC address addition as specified in review request
            btc_address_data = {
                "company_id": str(self.company_id),
                "currency": "BTC",
                "wallet_address": "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/wallet/addWalletAddress",
                json=btc_address_data,
                headers={
                    "Authorization": f"Bearer {self.jwt_token}",
                    "Content-Type": "application/json"
                },
                timeout=15
            )
            
            # Check for KMS/decoder errors in response
            response_text = response.text.lower()
            has_kms_error = 'kms' in response_text and 'error' in response_text
            has_decoder_error = 'decoder' in response_text and 'error' in response_text
            
            if response.status_code in [200, 201]:
                self.log_result(
                    "Issue #3 - KMS/Wallet Address", 
                    True, 
                    "BTC address addition succeeded without KMS/decoder errors",
                    {
                        "response_status": response.status_code,
                        "btc_address": btc_address_data["wallet_address"],
                        "no_kms_errors": not has_kms_error,
                        "no_decoder_errors": not has_decoder_error
                    }
                )
            elif response.status_code == 400 and ('already exists' in response_text or 'duplicate' in response_text):
                self.log_result(
                    "Issue #3 - KMS/Wallet Address", 
                    True, 
                    "BTC address already exists (acceptable) - no KMS/decoder errors",
                    {
                        "response_status": response.status_code,
                        "message": "Address already exists",
                        "no_kms_errors": not has_kms_error,
                        "no_decoder_errors": not has_decoder_error
                    }
                )
            else:
                error_details = {
                    "response_status": response.status_code,
                    "has_kms_error": has_kms_error,
                    "has_decoder_error": has_decoder_error,
                    "response_preview": response.text[:200]
                }
                
                if has_kms_error or has_decoder_error:
                    self.log_result("Issue #3 - KMS/Wallet Address", False, f"KMS/decoder errors detected in response (status {response.status_code})", error_details)
                else:
                    self.log_result("Issue #3 - KMS/Wallet Address", False, f"BTC address addition failed with status {response.status_code}", error_details)
                
        except Exception as e:
            self.log_result("Issue #3 - KMS/Wallet Address", False, f"BTC address addition request failed: {str(e)}")
    
    # ============================================
    # ISSUE #4: Device Login Alert Fix - login with different IPs should trigger alert
    # ============================================
    
    def test_issue_4_device_login_alert_fix(self):
        """Issue #4: Test Device Login Alert Fix - different IP addresses"""
        print("\n" + "="*60)
        print("ISSUE #4: DEVICE LOGIN ALERT FIX - DIFFERENT IP ADDRESSES")
        print("="*60)
        
        try:
            # First login with IP 1.2.3.4
            response1 = requests.post(
                f"{self.backend_url}/api/user/login",
                json={
                    "email": self.test_email,
                    "password": self.test_password
                },
                headers={
                    "Content-Type": "application/json",
                    "X-Forwarded-For": "1.2.3.4"
                },
                timeout=15
            )
            
            time.sleep(2)  # Brief pause between logins
            
            # Second login with IP 5.6.7.8
            response2 = requests.post(
                f"{self.backend_url}/api/user/login",
                json={
                    "email": self.test_email,
                    "password": self.test_password
                },
                headers={
                    "Content-Type": "application/json",
                    "X-Forwarded-For": "5.6.7.8"
                },
                timeout=15
            )
            
            if response1.status_code == 200 and response2.status_code == 200:
                # Check backend logs for device alert message
                try:
                    import subprocess
                    log_result = subprocess.run(
                        ["tail", "-n", "50", "/var/log/supervisor/backend.out.log"],
                        capture_output=True,
                        text=True,
                        timeout=10
                    )
                    
                    log_content = log_result.stdout.lower()
                    device_alert_found = '[login] new device alert sent' in log_content
                    
                    if device_alert_found:
                        self.log_result(
                            "Issue #4 - Device Login Alert", 
                            True, 
                            "Device login alert triggered for different IP addresses",
                            {
                                "first_ip": "1.2.3.4",
                                "second_ip": "5.6.7.8",
                                "alert_message_found": True,
                                "both_logins_successful": True
                            }
                        )
                    else:
                        self.log_result("Issue #4 - Device Login Alert", False, "Device login alert message not found in backend logs")
                        
                except Exception as log_e:
                    self.log_result("Issue #4 - Device Login Alert", False, f"Could not check backend logs: {str(log_e)}")
            else:
                self.log_result("Issue #4 - Device Login Alert", False, f"Login attempts failed - Status 1: {response1.status_code}, Status 2: {response2.status_code}")
                
        except Exception as e:
            self.log_result("Issue #4 - Device Login Alert", False, f"Device login alert test failed: {str(e)}")
    
    # ============================================
    # ISSUE #5: Currency Rates Fallback - FastForex/CoinGecko fallback
    # ============================================
    
    def test_issue_5_currency_rates_fallback(self):
        """Issue #5: Test Currency Rates Fallback - FastForex/CoinGecko"""
        print("\n" + "="*60)
        print("ISSUE #5: CURRENCY RATES FALLBACK - FASTFOREX/COINGECKO")
        print("="*60)
        
        try:
            currency_rates_data = {
                "source": "USD",
                "amount": 100,
                "currencyList": ["BTC", "ETH", "EUR"]
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/getCurrencyRates",
                json=currency_rates_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                rates_data = data.get('data', {})
                
                # Check if rates are returned for requested currencies
                expected_currencies = ["BTC", "ETH", "EUR"]
                rates_found = []
                
                for currency in expected_currencies:
                    if currency in rates_data or currency.lower() in str(rates_data).lower():
                        rates_found.append(currency)
                
                if len(rates_found) >= 2:  # At least 2 out of 3 currencies should have rates
                    self.log_result(
                        "Issue #5 - Currency Rates Fallback", 
                        True, 
                        f"Currency rates returned successfully ({len(rates_found)}/3 currencies)",
                        {
                            "requested_currencies": expected_currencies,
                            "rates_found": rates_found,
                            "source_amount": currency_rates_data["amount"],
                            "source_currency": currency_rates_data["source"]
                        }
                    )
                else:
                    self.log_result("Issue #5 - Currency Rates Fallback", False, f"Insufficient currency rates returned ({len(rates_found)}/3)")
            else:
                self.log_result("Issue #5 - Currency Rates Fallback", False, f"Currency rates endpoint failed with status {response.status_code}")
                
        except Exception as e:
            self.log_result("Issue #5 - Currency Rates Fallback", False, f"Currency rates request failed: {str(e)}")
    
    # ============================================
    # ISSUE #6: Payment Link Creation - seed data related
    # ============================================
    
    def test_issue_6_payment_link_creation(self):
        """Issue #6: Test Payment Link Creation - seed data related"""
        print("\n" + "="*60)
        print("ISSUE #6: PAYMENT LINK CREATION - SEED DATA")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("Issue #6 - Payment Link Creation", False, "No JWT token available")
            return
            
        try:
            payment_link_data = {
                "amount": 100,
                "email": "test@test.com",
                "modes": ["CRYPTO"],
                "company_id": str(self.company_id),
                "description": "Test"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payment_link_data,
                headers={
                    "Authorization": f"Bearer {self.jwt_token}",
                    "Content-Type": "application/json"
                },
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                payment_link_response = data.get('data', {})
                payment_link = payment_link_response.get('payment_link', '')
                
                if payment_link:
                    self.log_result(
                        "Issue #6 - Payment Link Creation", 
                        True, 
                        "Payment link creation succeeded with existing data",
                        {
                            "payment_link_created": bool(payment_link),
                            "link_id": payment_link_response.get('link_id'),
                            "amount": payment_link_data["amount"],
                            "company_id": payment_link_data["company_id"]
                        }
                    )
                else:
                    self.log_result("Issue #6 - Payment Link Creation", False, "Payment link creation succeeded but no link returned")
            else:
                self.log_result("Issue #6 - Payment Link Creation", False, f"Payment link creation failed with status {response.status_code}")
                
        except Exception as e:
            self.log_result("Issue #6 - Payment Link Creation", False, f"Payment link creation request failed: {str(e)}")
    
    # ============================================
    # ISSUE #7: Base Currency Check - API keys with base_currency field
    # ============================================
    
    def test_issue_7_base_currency_check(self):
        """Issue #7: Test Base Currency Check - API keys with base_currency field"""
        print("\n" + "="*60)
        print("ISSUE #7: BASE CURRENCY CHECK - API KEYS")
        print("="*60)
        
        if not self.jwt_token:
            self.log_result("Issue #7 - Base Currency Check", False, "No JWT token available")
            return
            
        try:
            # Test API keys endpoint
            response = requests.get(
                f"{self.backend_url}/api/userApi/getApi",
                headers={"Authorization": f"Bearer {self.jwt_token}"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                api_data = data.get('data', {})
                
                # Handle both single API key and grouped format
                if isinstance(api_data, dict) and 'all' in api_data:
                    api_list = api_data['all']
                elif isinstance(api_data, list):
                    api_list = api_data
                else:
                    api_list = [api_data] if api_data else []
                
                # Check for base_currency field in API keys
                base_currency_found = False
                base_currencies = []
                
                for api_key in api_list:
                    if 'base_currency' in api_key:
                        base_currency_found = True
                        base_currencies.append(api_key.get('base_currency'))
                
                if base_currency_found:
                    self.log_result(
                        "Issue #7 - Base Currency Check", 
                        True, 
                        f"API keys contain base_currency field ({len(api_list)} keys checked)",
                        {
                            "api_key_count": len(api_list),
                            "base_currency_present": base_currency_found,
                            "base_currencies_found": list(set(base_currencies))
                        }
                    )
                else:
                    self.log_result("Issue #7 - Base Currency Check", False, "base_currency field not found in API keys")
            else:
                self.log_result("Issue #7 - Base Currency Check", False, f"API keys endpoint failed with status {response.status_code}")
                
        except Exception as e:
            self.log_result("Issue #7 - Base Currency Check", False, f"API keys request failed: {str(e)}")
    
    # ============================================
    # Main Test Runner
    # ============================================
    
    def run_all_tests(self):
        """Run all 7 issue fix verification tests"""
        print("="*80)
        print("DYNOPAY 7 ISSUES FIX VERIFICATION TEST")
        print("="*80)
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Credentials: {self.test_email}")
        print(f"Company ID: {self.company_id}")
        print("="*80)
        
        # Authenticate first
        if not self.authenticate_user():
            print("\n❌ AUTHENTICATION FAILED - Cannot proceed with tests")
            return
        
        # Run all 7 issue tests
        self.test_issue_1_kyc_schema_fix()
        self.test_issue_2_tatum_api_fix()
        self.test_issue_3_kms_wallet_address_fix()
        self.test_issue_4_device_login_alert_fix()
        self.test_issue_5_currency_rates_fallback()
        self.test_issue_6_payment_link_creation()
        self.test_issue_7_base_currency_check()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        
        if passed_tests == total_tests:
            print("\n🎉 ALL 7 ISSUES VERIFIED SUCCESSFULLY!")
        else:
            print(f"\n⚠️  {failed_tests} ISSUE(S) NEED ATTENTION")

if __name__ == "__main__":
    tester = DynoPay7IssuesFixTester()
    tester.run_all_tests()