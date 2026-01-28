#!/usr/bin/env python3
"""
ETH Payment Creation Test for john@dyno.pt
Creates a $10 USD ETH payment and retrieves the merchant pool address for real-time testing.

Test Requirements:
1. Authenticate as john@dyno.pt (password: Katiekendra123@)
2. Create a $10 USD ETH payment 
3. Get the merchant pool address generated
4. Document the complete payment address
5. Show current merchant pool status for ETH

Expected Output:
- Payment ID
- ETH payment address (for sending real ETH)
- Expected ETH amount
- Merchant wallet address
- Admin wallet address
"""

import os
import sys
import json
import requests
import time
from typing import Dict, List, Any

class ETHPaymentCreationTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.user_data = None
        self.payment_data = None
        
        # Test credentials from review request
        self.test_credentials = {
            "email": "john@dyno.pt",
            "password": "Katiekendra123@",
            "user_id": 28,
            "company_id": 38
        }
        
    def get_backend_url(self):
        """Get backend URL - use localhost for internal testing"""
        # For internal testing, always use localhost
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
        print("\n=== Step 1: User Authentication ===")
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json={
                    "email": self.test_credentials["email"],
                    "password": self.test_credentials["password"]
                },
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    self.jwt_token = data['data']['accessToken']
                    
                    # Extract user data from the response
                    user_data = data['data'].get('userData', {})
                    self.user_data = user_data
                    
                    # Verify user details match expected
                    user_id = user_data.get('user_id')
                    
                    if user_id == self.test_credentials["user_id"]:
                        self.log_result(
                            "User Authentication", 
                            True, 
                            f"Successfully authenticated as {self.test_credentials['email']}",
                            {
                                "user_id": user_id,
                                "name": user_data.get('name'),
                                "username": user_data.get('username'),
                                "email": user_data.get('email'),
                                "status": user_data.get('status')
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "User Authentication - Verification", 
                            False, 
                            f"User ID mismatch: expected {self.test_credentials['user_id']}, got {user_id}",
                            {"expected_user_id": self.test_credentials["user_id"], "actual_user_id": user_id, "user_data": user_data}
                        )
                        return False
                else:
                    self.log_result(
                        "User Authentication", 
                        False, 
                        "Login succeeded but no token received",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "User Authentication", 
                    False, 
                    f"Login failed with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "User Authentication", 
                False, 
                f"Authentication failed: {str(e)}"
            )
            return False
    
    def create_payment_link(self):
        """Create a $10 USD payment link"""
        print("\n=== Step 2: Create Payment Link ===")
        
        if not self.jwt_token:
            self.log_result(
                "Payment Link Creation", 
                False, 
                "No JWT token available for authentication"
            )
            return False
        
        # Payment data for $10 USD
        payment_request = {
            "amount": 10.00,
            "currency": "USD",
            "description": "Test ETH Payment - $10 USD",
            "email": "test.customer@example.com",
            "modes": ["CRYPTO"],
            "company_id": self.test_credentials["company_id"]
        }
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payment_request,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    self.payment_data = data['data']
                    
                    self.log_result(
                        "Payment Link Creation", 
                        True, 
                        f"Payment link created successfully for ${payment_request['amount']} USD",
                        {
                            "payment_id": self.payment_data.get('payment_id'),
                            "amount": self.payment_data.get('amount'),
                            "currency": self.payment_data.get('currency'),
                            "status": self.payment_data.get('status'),
                            "payment_url": self.payment_data.get('payment_url')
                        }
                    )
                    return True
                else:
                    self.log_result(
                        "Payment Link Creation", 
                        False, 
                        "Payment link created but no data received",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Payment Link Creation", 
                    False, 
                    f"Payment link creation failed with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Payment Link Creation", 
                False, 
                f"Payment link creation failed: {str(e)}"
            )
            return False
    
    def create_crypto_payment(self):
        """Create crypto payment for ETH and get the payment address"""
        print("\n=== Step 3: Create ETH Crypto Payment ===")
        
        if not self.payment_data or not self.payment_data.get('payment_id'):
            self.log_result(
                "ETH Crypto Payment Creation", 
                False, 
                "No payment ID available from previous step"
            )
            return False
        
        # Request ETH crypto payment
        crypto_request = {
            "payment_id": self.payment_data['payment_id'],
            "crypto_currency": "ETH"
        }
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/payment/createCryptoPayment",
                json=crypto_request,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    crypto_data = data['data']
                    
                    # Extract key information
                    eth_address = crypto_data.get('crypto_address')
                    expected_amount = crypto_data.get('crypto_amount')
                    payment_id = crypto_data.get('payment_id')
                    
                    if eth_address and expected_amount:
                        self.log_result(
                            "ETH Crypto Payment Creation", 
                            True, 
                            f"ETH payment address generated successfully",
                            {
                                "payment_id": payment_id,
                                "eth_address": eth_address,
                                "expected_eth_amount": expected_amount,
                                "usd_amount": crypto_data.get('usd_amount'),
                                "exchange_rate": crypto_data.get('exchange_rate'),
                                "expires_at": crypto_data.get('expires_at')
                            }
                        )
                        
                        # Store crypto data for final summary
                        self.payment_data.update(crypto_data)
                        return True
                    else:
                        self.log_result(
                            "ETH Crypto Payment Creation", 
                            False, 
                            "ETH address or amount missing from response",
                            {"crypto_data": crypto_data}
                        )
                        return False
                else:
                    self.log_result(
                        "ETH Crypto Payment Creation", 
                        False, 
                        "Crypto payment created but no data received",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "ETH Crypto Payment Creation", 
                    False, 
                    f"Crypto payment creation failed with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "ETH Crypto Payment Creation", 
                False, 
                f"Crypto payment creation failed: {str(e)}"
            )
            return False
    
    def get_merchant_pool_status(self):
        """Get current merchant pool status for ETH"""
        print("\n=== Step 4: Get Merchant Pool Status ===")
        
        if not self.jwt_token:
            self.log_result(
                "Merchant Pool Status", 
                False, 
                "No JWT token available for authentication"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Get merchant pool status
            response = requests.get(
                f"{self.backend_url}/api/merchant-pool/status",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    pool_data = data['data']
                    
                    # Look for ETH pool information
                    eth_pool = None
                    for pool in pool_data.get('pools', []):
                        if pool.get('currency') == 'ETH':
                            eth_pool = pool
                            break
                    
                    if eth_pool:
                        self.log_result(
                            "Merchant Pool Status - ETH", 
                            True, 
                            f"ETH merchant pool found with {eth_pool.get('available_addresses', 0)} available addresses",
                            {
                                "currency": eth_pool.get('currency'),
                                "available_addresses": eth_pool.get('available_addresses'),
                                "reserved_addresses": eth_pool.get('reserved_addresses'),
                                "total_addresses": eth_pool.get('total_addresses'),
                                "admin_wallet": eth_pool.get('admin_wallet'),
                                "sweep_threshold": eth_pool.get('sweep_threshold')
                            }
                        )
                        return eth_pool
                    else:
                        self.log_result(
                            "Merchant Pool Status - ETH", 
                            False, 
                            "ETH pool not found in merchant pool status",
                            {"available_pools": [p.get('currency') for p in pool_data.get('pools', [])]}
                        )
                        return None
                else:
                    self.log_result(
                        "Merchant Pool Status", 
                        False, 
                        "Pool status retrieved but no data received",
                        {"response": data}
                    )
                    return None
            else:
                self.log_result(
                    "Merchant Pool Status", 
                    False, 
                    f"Pool status request failed with status {response.status_code}",
                    {"response": response.text}
                )
                return None
                
        except Exception as e:
            self.log_result(
                "Merchant Pool Status", 
                False, 
                f"Pool status request failed: {str(e)}"
            )
            return None
    
    def get_admin_wallet_info(self):
        """Get admin wallet information from environment"""
        print("\n=== Step 5: Get Admin Wallet Information ===")
        
        try:
            # Read admin wallet from backend .env
            admin_eth_wallet = None
            with open('/app/backend/.env', 'r') as f:
                for line in f:
                    if line.startswith('ETH='):
                        admin_eth_wallet = line.split('=', 1)[1].strip()
                        break
            
            if admin_eth_wallet:
                self.log_result(
                    "Admin Wallet Information", 
                    True, 
                    f"Admin ETH wallet address retrieved",
                    {"admin_eth_wallet": admin_eth_wallet}
                )
                return admin_eth_wallet
            else:
                self.log_result(
                    "Admin Wallet Information", 
                    False, 
                    "Admin ETH wallet address not found in environment"
                )
                return None
                
        except Exception as e:
            self.log_result(
                "Admin Wallet Information", 
                False, 
                f"Failed to read admin wallet: {str(e)}"
            )
            return None
    
    def generate_final_summary(self, eth_pool_info, admin_wallet):
        """Generate final summary with all required information"""
        print("\n" + "="*80)
        print("🎯 ETH PAYMENT CREATION - FINAL SUMMARY")
        print("="*80)
        
        if not self.payment_data:
            print("❌ FAILED: No payment data available")
            return
        
        # Payment Information
        print(f"\n📋 PAYMENT DETAILS:")
        print(f"   Payment ID: {self.payment_data.get('payment_id', 'N/A')}")
        print(f"   USD Amount: ${self.payment_data.get('usd_amount', self.payment_data.get('amount', 'N/A'))}")
        print(f"   Status: {self.payment_data.get('status', 'N/A')}")
        
        # ETH Payment Address (CRITICAL FOR TESTING)
        eth_address = self.payment_data.get('crypto_address')
        expected_eth = self.payment_data.get('crypto_amount')
        
        print(f"\n🔗 ETH PAYMENT ADDRESS (FOR REAL TESTING):")
        if eth_address:
            print(f"   Address: {eth_address}")
            print(f"   Expected ETH Amount: {expected_eth} ETH")
            print(f"   Exchange Rate: {self.payment_data.get('exchange_rate', 'N/A')} USD/ETH")
            print(f"   Expires At: {self.payment_data.get('expires_at', 'N/A')}")
        else:
            print("   ❌ ETH address not generated")
        
        # Merchant Pool Information
        print(f"\n🏦 MERCHANT POOL STATUS:")
        if eth_pool_info:
            print(f"   Available Addresses: {eth_pool_info.get('available_addresses', 'N/A')}")
            print(f"   Reserved Addresses: {eth_pool_info.get('reserved_addresses', 'N/A')}")
            print(f"   Total Pool Size: {eth_pool_info.get('total_addresses', 'N/A')}")
            print(f"   Sweep Threshold: ${eth_pool_info.get('sweep_threshold', 'N/A')} USD")
        else:
            print("   ❌ Pool information not available")
        
        # Admin Wallet
        print(f"\n👑 ADMIN WALLET:")
        if admin_wallet:
            print(f"   Admin ETH Address: {admin_wallet}")
        else:
            print("   ❌ Admin wallet not available")
        
        # Testing Instructions
        print(f"\n🧪 TESTING INSTRUCTIONS:")
        if eth_address and expected_eth:
            print(f"   1. Send exactly {expected_eth} ETH to: {eth_address}")
            print(f"   2. Payment will be processed automatically")
            print(f"   3. Funds will be distributed according to threshold rules")
            print(f"   4. Monitor payment status via API or dashboard")
        else:
            print("   ❌ Cannot provide testing instructions - ETH address not generated")
        
        # Success Summary
        successful_steps = sum(1 for result in self.test_results.values() if result['success'])
        total_steps = len(self.test_results)
        
        print(f"\n📊 TEST RESULTS SUMMARY:")
        print(f"   Successful Steps: {successful_steps}/{total_steps}")
        print(f"   Success Rate: {(successful_steps/total_steps)*100:.1f}%")
        
        if successful_steps == total_steps:
            print(f"   ✅ ALL TESTS PASSED - ETH payment ready for real testing")
        else:
            print(f"   ⚠️  SOME TESTS FAILED - Check errors above")
            print(f"   Failed Tests: {len(self.errors)}")
            for error in self.errors:
                print(f"      - {error}")
        
        print("="*80)
    
    def run_complete_test(self):
        """Run the complete ETH payment creation test"""
        print("🚀 Starting ETH Payment Creation Test for john@dyno.pt")
        print(f"Backend URL: {self.backend_url}")
        print(f"Target: Create $10 USD ETH payment and get merchant pool address")
        
        # Step 1: Authenticate
        if not self.authenticate_user():
            print("❌ Authentication failed - cannot proceed")
            return False
        
        # Step 2: Create payment link
        if not self.create_payment_link():
            print("❌ Payment link creation failed - cannot proceed")
            return False
        
        # Step 3: Create ETH crypto payment
        if not self.create_crypto_payment():
            print("❌ ETH crypto payment creation failed - cannot proceed")
            return False
        
        # Step 4: Get merchant pool status
        eth_pool_info = self.get_merchant_pool_status()
        
        # Step 5: Get admin wallet info
        admin_wallet = self.get_admin_wallet_info()
        
        # Generate final summary
        self.generate_final_summary(eth_pool_info, admin_wallet)
        
        # Return success if all critical steps passed
        critical_steps = ["User Authentication", "Payment Link Creation", "ETH Crypto Payment Creation"]
        critical_success = all(
            self.test_results.get(step, {}).get('success', False) 
            for step in critical_steps
        )
        
        return critical_success

def main():
    """Main function to run the ETH payment creation test"""
    tester = ETHPaymentCreationTester()
    
    try:
        success = tester.run_complete_test()
        
        if success:
            print("\n🎉 ETH Payment Creation Test COMPLETED SUCCESSFULLY")
            print("✅ Payment address is ready for real ETH testing")
            sys.exit(0)
        else:
            print("\n💥 ETH Payment Creation Test FAILED")
            print("❌ Check the errors above and retry")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()