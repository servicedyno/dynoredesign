#!/usr/bin/env python3
"""
DynoPay Payment Threshold and Redis Flow Testing Suite
Tests the COMPLETE payment threshold and Redis flow using the new test endpoints
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any

class PaymentThresholdRedisTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        
        # Test credentials from review request
        self.test_email = "nomadly@moxx.co"
        self.test_password = "Katiekendra123@"
        
    def get_backend_url(self):
        """Get backend URL from frontend .env file"""
        # For testing, use the direct Node.js backend port
        return "http://localhost:3300"
        
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
    
    def authenticate_with_test_credentials(self):
        """Authenticate with provided test credentials"""
        print(f"\n=== Authenticating with {self.test_email} ===")
        
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
                    self.log_result(
                        "Authentication", 
                        True, 
                        f"Successfully authenticated with {self.test_email}",
                        {"email": self.test_email, "has_token": bool(self.jwt_token)}
                    )
                    return True
                else:
                    self.log_result(
                        "Authentication", 
                        False, 
                        "Login succeeded but no token received",
                        {"response": login_data}
                    )
            else:
                self.log_result(
                    "Authentication", 
                    False, 
                    f"Login failed with status {login_response.status_code}",
                    {"response": login_response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Authentication", 
                False, 
                f"Authentication failed: {str(e)}"
            )
        
        return False
    
    def test_phase_1_verify_thresholds(self):
        """TEST PHASE 1: Verify Thresholds - GET /api/test/thresholds"""
        print("\n=== TEST PHASE 1: Verify Thresholds ===")
        
        try:
            response = requests.get(
                f"{self.backend_url}/api/test/thresholds",
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Expected thresholds from review request
                expected_thresholds = {
                    "BTC": 7,
                    "ETH": 5,
                    "TRX": 5,
                    "USDT-TRC20": 10,
                    "LTC": 5,
                    "DOGE": 5
                }
                
                if 'data' in data:
                    thresholds = data['data']
                    
                    # Verify each expected threshold
                    all_correct = True
                    threshold_details = {}
                    
                    for blockchain, expected_value in expected_thresholds.items():
                        actual_value = thresholds.get(blockchain)
                        threshold_details[blockchain] = {
                            "expected": expected_value,
                            "actual": actual_value,
                            "correct": actual_value == expected_value
                        }
                        
                        if actual_value != expected_value:
                            all_correct = False
                    
                    if all_correct:
                        self.log_result(
                            "Phase 1 - Threshold Verification", 
                            True, 
                            "All blockchain thresholds are correct",
                            {"thresholds": threshold_details}
                        )
                    else:
                        incorrect_thresholds = [k for k, v in threshold_details.items() if not v['correct']]
                        self.log_result(
                            "Phase 1 - Threshold Verification", 
                            False, 
                            f"Incorrect thresholds for: {', '.join(incorrect_thresholds)}",
                            {"thresholds": threshold_details}
                        )
                else:
                    self.log_result(
                        "Phase 1 - Threshold Verification", 
                        False, 
                        "Invalid response format - missing thresholds data",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Phase 1 - Threshold Verification", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Phase 1 - Threshold Verification", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_phase_2_fee_calculation_below_threshold(self):
        """TEST PHASE 2: Test Fee Calculation BELOW threshold"""
        print("\n=== TEST PHASE 2: Fee Calculation & Distribution ===")
        print("--- Testing BELOW threshold ---")
        
        try:
            # Test BELOW threshold: BTC $5 (threshold is $7, minimum fee tier is $5)
            test_data = {
                "blockchain": "BTC",
                "amount": 5
            }
            
            response = requests.post(
                f"{self.backend_url}/api/test/calculate-fees",
                json=test_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    result = data['data']
                    admin_receives = result.get('admin_receives')
                    merchant_receives = result.get('merchant_receives')
                    
                    # Expected: admin_receives=5, merchant_receives=0
                    if admin_receives == 5 and merchant_receives == 0:
                        self.log_result(
                            "Phase 2 - Below Threshold Fee Calculation", 
                            True, 
                            "Correct fee distribution for below threshold payment",
                            {
                                "blockchain": "BTC",
                                "amount": 5,
                                "admin_receives": admin_receives,
                                "merchant_receives": merchant_receives,
                                "is_below_threshold": result.get('is_below_threshold', True)
                            }
                        )
                    else:
                        self.log_result(
                            "Phase 2 - Below Threshold Fee Calculation", 
                            False, 
                            f"Incorrect fee distribution - expected admin=5, merchant=0, got admin={admin_receives}, merchant={merchant_receives}",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "Phase 2 - Below Threshold Fee Calculation", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Phase 2 - Below Threshold Fee Calculation", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Phase 2 - Below Threshold Fee Calculation", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_phase_2_fee_calculation_above_threshold(self):
        """TEST PHASE 2: Test Fee Calculation ABOVE threshold"""
        print("--- Testing ABOVE threshold ---")
        
        try:
            # Test ABOVE threshold: BTC $20 (threshold is $7)
            test_data = {
                "blockchain": "BTC",
                "amount": 20
            }
            
            response = requests.post(
                f"{self.backend_url}/api/test/calculate-fees",
                json=test_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    result = data['data']
                    admin_receives = result.get('admin_receives')
                    merchant_receives = result.get('merchant_receives')
                    is_below_threshold = result.get('is_below_threshold')
                    
                    # Expected: admin receives fees only, merchant receives remainder
                    # Should be above threshold, so merchant should receive something
                    if is_below_threshold == False and merchant_receives > 0 and admin_receives > 0:
                        self.log_result(
                            "Phase 2 - Above Threshold Fee Calculation", 
                            True, 
                            "Correct fee distribution for above threshold payment",
                            {
                                "blockchain": "BTC",
                                "amount": 20,
                                "admin_receives": admin_receives,
                                "merchant_receives": merchant_receives,
                                "is_below_threshold": is_below_threshold
                            }
                        )
                    else:
                        self.log_result(
                            "Phase 2 - Above Threshold Fee Calculation", 
                            False, 
                            f"Incorrect fee distribution for above threshold - admin={admin_receives}, merchant={merchant_receives}, below_threshold={is_below_threshold}",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "Phase 2 - Above Threshold Fee Calculation", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Phase 2 - Above Threshold Fee Calculation", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Phase 2 - Above Threshold Fee Calculation", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_phase_2_threshold_test_below(self):
        """TEST PHASE 2: Test threshold logic BELOW threshold"""
        print("--- Testing threshold test endpoint BELOW ---")
        
        try:
            # Test ETH $2 (threshold is $5)
            test_data = {
                "blockchain": "ETH",
                "amount": 2
            }
            
            response = requests.post(
                f"{self.backend_url}/api/test/threshold-test",
                json=test_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    result = data['data']
                    is_below_threshold = result.get('is_below_threshold')
                    admin_gets_all = result.get('admin_gets_all')
                    
                    # Expected: is_below_threshold=true, admin gets all
                    if is_below_threshold == True and admin_gets_all == True:
                        self.log_result(
                            "Phase 2 - Threshold Test Below", 
                            True, 
                            "Correct threshold logic for below threshold amount",
                            {
                                "blockchain": "ETH",
                                "amount": 2,
                                "is_below_threshold": is_below_threshold,
                                "admin_gets_all": admin_gets_all
                            }
                        )
                    else:
                        self.log_result(
                            "Phase 2 - Threshold Test Below", 
                            False, 
                            f"Incorrect threshold logic - expected below=true, admin_all=true, got below={is_below_threshold}, admin_all={admin_gets_all}",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "Phase 2 - Threshold Test Below", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Phase 2 - Threshold Test Below", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Phase 2 - Threshold Test Below", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_phase_2_threshold_test_above(self):
        """TEST PHASE 2: Test threshold logic ABOVE threshold"""
        print("--- Testing threshold test endpoint ABOVE ---")
        
        try:
            # Test ETH $15 (threshold is $5)
            test_data = {
                "blockchain": "ETH",
                "amount": 15
            }
            
            response = requests.post(
                f"{self.backend_url}/api/test/threshold-test",
                json=test_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    result = data['data']
                    is_below_threshold = result.get('is_below_threshold')
                    split_distribution = result.get('split_distribution')
                    
                    # Expected: is_below_threshold=false, split distribution
                    if is_below_threshold == False and split_distribution == True:
                        self.log_result(
                            "Phase 2 - Threshold Test Above", 
                            True, 
                            "Correct threshold logic for above threshold amount",
                            {
                                "blockchain": "ETH",
                                "amount": 15,
                                "is_below_threshold": is_below_threshold,
                                "split_distribution": split_distribution
                            }
                        )
                    else:
                        self.log_result(
                            "Phase 2 - Threshold Test Above", 
                            False, 
                            f"Incorrect threshold logic - expected below=false, split=true, got below={is_below_threshold}, split={split_distribution}",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "Phase 2 - Threshold Test Above", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Phase 2 - Threshold Test Above", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Phase 2 - Threshold Test Above", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_phase_3_simulate_payment_redis(self):
        """TEST PHASE 3: Full Payment Flow with Redis - Setup Redis data"""
        print("\n=== TEST PHASE 3: Full Payment Flow with Redis ===")
        print("--- Setting up Redis data for below-threshold payment ---")
        
        if not self.jwt_token:
            self.log_result(
                "Phase 3 - Redis Setup", 
                False, 
                "No JWT token available for authentication"
            )
            return None
        
        try:
            # Setup Redis data for below-threshold payment
            test_data = {
                "address": "test-btc-001",
                "amount": 3,
                "currency": "BTC",
                "company_id": 1
            }
            
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/test/simulate-payment-redis",
                json=test_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    result = data['data']
                    redis_key = result.get('redis_key')
                    setup_success = result.get('setup_success')
                    
                    if setup_success and redis_key:
                        self.log_result(
                            "Phase 3 - Redis Setup", 
                            True, 
                            "Successfully set up Redis data for payment simulation",
                            {
                                "address": test_data["address"],
                                "amount": test_data["amount"],
                                "currency": test_data["currency"],
                                "redis_key": redis_key,
                                "setup_success": setup_success
                            }
                        )
                        return redis_key
                    else:
                        self.log_result(
                            "Phase 3 - Redis Setup", 
                            False, 
                            f"Redis setup failed - setup_success={setup_success}, redis_key={redis_key}",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "Phase 3 - Redis Setup", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Phase 3 - Redis Setup", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Phase 3 - Redis Setup", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return None
    
    def test_phase_3_verify_redis_data(self):
        """TEST PHASE 3: Verify Redis data was created correctly"""
        print("--- Verifying Redis data ---")
        
        try:
            response = requests.get(
                f"{self.backend_url}/api/test/redis/crypto-test-btc-001",
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    redis_data = data['data']
                    
                    # Verify expected fields in Redis data
                    expected_fields = ['address', 'amount', 'currency', 'company_id']
                    missing_fields = [field for field in expected_fields if field not in redis_data]
                    
                    if not missing_fields:
                        self.log_result(
                            "Phase 3 - Redis Data Verification", 
                            True, 
                            "Redis data created correctly with all expected fields",
                            {
                                "address": redis_data.get('address'),
                                "amount": redis_data.get('amount'),
                                "currency": redis_data.get('currency'),
                                "company_id": redis_data.get('company_id')
                            }
                        )
                    else:
                        self.log_result(
                            "Phase 3 - Redis Data Verification", 
                            False, 
                            f"Redis data missing fields: {', '.join(missing_fields)}",
                            {"redis_data": redis_data, "missing_fields": missing_fields}
                        )
                else:
                    self.log_result(
                        "Phase 3 - Redis Data Verification", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Phase 3 - Redis Data Verification", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Phase 3 - Redis Data Verification", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_phase_3_simulate_webhook(self):
        """TEST PHASE 3: Simulate incoming payment webhook"""
        print("--- Simulating incoming payment webhook ---")
        
        try:
            # Simulate webhook for the test payment
            webhook_data = {
                "address": "test-btc-001",
                "amount": "3",
                "asset": "BTC",
                "txId": "test-tx-btc-001"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/tatum-crypto-webhook",
                json=webhook_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if webhook was processed successfully
                if 'success' in data or 'message' in data:
                    self.log_result(
                        "Phase 3 - Webhook Simulation", 
                        True, 
                        "Webhook processed successfully",
                        {
                            "address": webhook_data["address"],
                            "amount": webhook_data["amount"],
                            "asset": webhook_data["asset"],
                            "txId": webhook_data["txId"],
                            "response": data
                        }
                    )
                else:
                    self.log_result(
                        "Phase 3 - Webhook Simulation", 
                        False, 
                        "Webhook response format unexpected",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Phase 3 - Webhook Simulation", 
                    False, 
                    f"Webhook call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Phase 3 - Webhook Simulation", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_phase_3_check_notifications(self):
        """TEST PHASE 3: Check for PAYMENT_PENDING notification"""
        print("--- Checking for payment notifications ---")
        
        if not self.jwt_token:
            self.log_result(
                "Phase 3 - Notification Check", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.get(
                f"{self.backend_url}/api/notifications",
                params={"limit": 5},
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    notifications = data['data'].get('notifications', [])
                    
                    # Look for PAYMENT_PENDING notification
                    payment_notifications = [
                        n for n in notifications 
                        if n.get('type') in ['payment_pending', 'payment_received', 'payment_partial']
                    ]
                    
                    if payment_notifications:
                        self.log_result(
                            "Phase 3 - Notification Check", 
                            True, 
                            f"Found {len(payment_notifications)} payment-related notifications",
                            {
                                "total_notifications": len(notifications),
                                "payment_notifications": len(payment_notifications),
                                "notification_types": [n.get('type') for n in payment_notifications]
                            }
                        )
                    else:
                        self.log_result(
                            "Phase 3 - Notification Check", 
                            False, 
                            "No payment-related notifications found",
                            {
                                "total_notifications": len(notifications),
                                "notification_types": [n.get('type') for n in notifications]
                            }
                        )
                else:
                    self.log_result(
                        "Phase 3 - Notification Check", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Phase 3 - Notification Check", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Phase 3 - Notification Check", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_phase_4_above_threshold_payment(self):
        """TEST PHASE 4: Above Threshold Payment Flow"""
        print("\n=== TEST PHASE 4: Above Threshold Payment ===")
        
        if not self.jwt_token:
            self.log_result(
                "Phase 4 - Above Threshold Setup", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        try:
            # Setup above threshold payment
            test_data = {
                "currency": "BTC",
                "company_id": 1,
                "simulate_below_threshold": False
            }
            
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/test/full-payment-flow",
                json=test_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    result = data['data']
                    next_step = result.get('next_step')
                    payment_setup = result.get('payment_setup')
                    
                    if next_step and payment_setup:
                        self.log_result(
                            "Phase 4 - Above Threshold Setup", 
                            True, 
                            "Above threshold payment flow prepared successfully",
                            {
                                "currency": test_data["currency"],
                                "company_id": test_data["company_id"],
                                "simulate_below_threshold": test_data["simulate_below_threshold"],
                                "next_step": next_step,
                                "payment_setup": payment_setup
                            }
                        )
                        
                        # Test the expected distribution
                        expected_distribution = result.get('expected_distribution', {})
                        merchant_receives = expected_distribution.get('merchant_receives', 0)
                        
                        if merchant_receives > 0:
                            self.log_result(
                                "Phase 4 - Distribution Verification", 
                                True, 
                                f"Correct distribution - merchant receives funds: {merchant_receives}",
                                {"expected_distribution": expected_distribution}
                            )
                        else:
                            self.log_result(
                                "Phase 4 - Distribution Verification", 
                                False, 
                                f"Incorrect distribution - merchant should receive funds but got: {merchant_receives}",
                                {"expected_distribution": expected_distribution}
                            )
                    else:
                        self.log_result(
                            "Phase 4 - Above Threshold Setup", 
                            False, 
                            f"Payment setup incomplete - next_step={next_step}, payment_setup={payment_setup}",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "Phase 4 - Above Threshold Setup", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Phase 4 - Above Threshold Setup", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Phase 4 - Above Threshold Setup", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def run_verification_checklist(self):
        """Run the verification checklist from the review request"""
        print("\n=== VERIFICATION CHECKLIST ===")
        
        checklist_items = [
            "Thresholds correctly loaded from env",
            "Below threshold → ALL to admin, ZERO to merchant", 
            "Above threshold → Fees to admin, remainder to merchant",
            "Redis data setup working",
            "Webhooks trigger notifications",
            "Payment flow works end-to-end"
        ]
        
        passed_items = []
        failed_items = []
        
        # Analyze test results to determine checklist status
        for test_name, result in self.test_results.items():
            if "Threshold Verification" in test_name and result['success']:
                passed_items.append("Thresholds correctly loaded from env")
            elif "Below Threshold" in test_name and result['success']:
                passed_items.append("Below threshold → ALL to admin, ZERO to merchant")
            elif "Above Threshold" in test_name and result['success']:
                passed_items.append("Above threshold → Fees to admin, remainder to merchant")
            elif "Redis" in test_name and result['success']:
                passed_items.append("Redis data setup working")
            elif "Webhook" in test_name and result['success']:
                passed_items.append("Webhooks trigger notifications")
            elif "Payment Flow" in test_name and result['success']:
                passed_items.append("Payment flow works end-to-end")
        
        # Remove duplicates
        passed_items = list(set(passed_items))
        failed_items = [item for item in checklist_items if item not in passed_items]
        
        print("\n--- CHECKLIST RESULTS ---")
        for item in checklist_items:
            status = "✅" if item in passed_items else "❌"
            print(f"{status} {item}")
        
        self.log_result(
            "Verification Checklist", 
            len(failed_items) == 0, 
            f"Checklist: {len(passed_items)}/{len(checklist_items)} items passed",
            {
                "passed_items": passed_items,
                "failed_items": failed_items,
                "total_items": len(checklist_items)
            }
        )
    
    def run_all_tests(self):
        """Run all payment threshold and Redis flow tests"""
        print("=" * 80)
        print("DYNOPAY PAYMENT THRESHOLD AND REDIS FLOW TESTING")
        print("=" * 80)
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Credentials: {self.test_email}")
        
        # Authenticate first
        if not self.authenticate_with_test_credentials():
            print("\n❌ CRITICAL: Authentication failed - cannot proceed with authenticated tests")
            return
        
        # Run all test phases
        self.test_phase_1_verify_thresholds()
        self.test_phase_2_fee_calculation_below_threshold()
        self.test_phase_2_fee_calculation_above_threshold()
        self.test_phase_2_threshold_test_below()
        self.test_phase_2_threshold_test_above()
        
        # Phase 3 - Redis flow
        redis_key = self.test_phase_3_simulate_payment_redis()
        if redis_key:
            self.test_phase_3_verify_redis_data()
            self.test_phase_3_simulate_webhook()
            time.sleep(2)  # Wait for webhook processing
            self.test_phase_3_check_notifications()
        
        # Phase 4 - Above threshold
        self.test_phase_4_above_threshold_payment()
        
        # Run verification checklist
        self.run_verification_checklist()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if self.errors:
            print(f"\n❌ FAILED TESTS ({len(self.errors)}):")
            for error in self.errors:
                print(f"  - {error}")
        else:
            print(f"\n✅ ALL TESTS PASSED!")
        
        print("=" * 80)

if __name__ == "__main__":
    tester = PaymentThresholdRedisTester()
    tester.run_all_tests()