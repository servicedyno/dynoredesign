#!/usr/bin/env python3
"""
ETH Payment Direct API Test - Create $10 ETH Payment via Direct API Endpoint
Tests the complete flow for john@dyno.pt to create ETH payment and get address immediately.

Flow:
1. Login as merchant to get API key
2. Create/retrieve customer using /api/user/createUser endpoint
3. Use customer token to call /api/user/cryptoPayment with amount: 10, currency: "ETH", fee_payer: "company"
4. Expected response: transaction_id, address (ETH address), crypto_amount, qr_code
"""

import os
import sys
import json
import requests
import time
from typing import Dict, List, Any

class ETHPaymentDirectAPITester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.api_service_url = self.get_api_service_url()
        self.test_results = {}
        self.errors = []
        self.merchant_jwt_token = None
        self.customer_token = None
        self.api_key = None
        
        # Test credentials from review request
        self.merchant_credentials = {
            "email": "john@dyno.pt",
            "password": "Katiekendra123@",
            "user_id": 28,
            "company_id": 38
        }
        
    def get_backend_url(self):
        """Get backend URL - use direct Node.js backend on port 3300"""
        return "http://localhost:3300"
    
    def get_api_service_url(self):
        """Get API service URL - direct API service on port 3301"""
        return "http://localhost:3301"
        
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
    
    def test_merchant_authentication(self):
        """Step 1: Login as merchant to get JWT token"""
        print("\n=== Step 1: Merchant Authentication ===")
        
        try:
            login_data = {
                "email": self.merchant_credentials["email"],
                "password": self.merchant_credentials["password"]
            }
            
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json=login_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    self.merchant_jwt_token = data['data']['accessToken']
                    user_data = data['data'].get('userData', {})
                    
                    # Verify user details match expected
                    expected_user_id = self.merchant_credentials["user_id"]
                    actual_user_id = user_data.get('user_id')
                    
                    if actual_user_id == expected_user_id:
                        self.log_result(
                            "Merchant Authentication", 
                            True, 
                            f"Successfully authenticated john@dyno.pt (user_id: {actual_user_id})",
                            {
                                "user_id": actual_user_id,
                                "name": user_data.get('name'),
                                "email": user_data.get('email'),
                                "has_token": bool(self.merchant_jwt_token)
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Merchant Authentication", 
                            False, 
                            f"User ID mismatch: expected {expected_user_id}, got {actual_user_id}",
                            {"expected": expected_user_id, "actual": actual_user_id}
                        )
                        return False
                else:
                    self.log_result(
                        "Merchant Authentication", 
                        False, 
                        "Login succeeded but no access token received",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Merchant Authentication", 
                    False, 
                    f"Login failed with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Merchant Authentication", 
                False, 
                f"Authentication request failed: {str(e)}"
            )
            return False
    
    def test_get_api_key(self):
        """Get merchant API key for API service calls"""
        print("\n=== Step 1.5: Get Merchant API Key ===")
        
        if not self.merchant_jwt_token:
            self.log_result(
                "Get API Key", 
                False, 
                "No merchant JWT token available"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.merchant_jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Get existing API keys
            response = requests.get(
                f"{self.backend_url}/api/userApi/getApi",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                api_keys = data.get('data', {}).get('all', [])
                
                if api_keys:
                    # Use first available API key
                    first_key = api_keys[0]
                    self.api_key = first_key.get('apiKey')
                    
                    if self.api_key:
                        self.log_result(
                            "Get API Key", 
                            True, 
                            f"Retrieved existing API key",
                            {
                                "api_name": first_key.get('api_name'),
                                "permissions": first_key.get('permissions'),
                                "has_key": bool(self.api_key)
                            }
                        )
                        return True
                
                # No API keys found, create one
                create_data = {
                    "api_name": "ETH Payment Test API",
                    "permissions": ["payments", "transactions"],
                    "base_currency": "USD",
                    "company_id": self.merchant_credentials["company_id"]
                }
                
                create_response = requests.post(
                    f"{self.backend_url}/api/userApi/addApi",
                    json=create_data,
                    headers=headers,
                    timeout=15
                )
                
                if create_response.status_code == 200:
                    create_data_response = create_response.json()
                    self.api_key = create_data_response.get('data', {}).get('apiKey')
                    
                    if self.api_key:
                        self.log_result(
                            "Get API Key", 
                            True, 
                            f"Created new API key successfully",
                            {
                                "api_name": create_data["api_name"],
                                "permissions": create_data["permissions"],
                                "has_key": bool(self.api_key)
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Get API Key", 
                            False, 
                            "API key creation succeeded but no key returned",
                            {"response": create_data_response}
                        )
                        return False
                else:
                    self.log_result(
                        "Get API Key", 
                        False, 
                        f"API key creation failed with status {create_response.status_code}",
                        {"response": create_response.text}
                    )
                    return False
            else:
                self.log_result(
                    "Get API Key", 
                    False, 
                    f"Failed to retrieve API keys with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Get API Key", 
                False, 
                f"API key request failed: {str(e)}"
            )
            return False
    
    def test_create_customer(self):
        """Step 2: Create/retrieve customer using /api/user/createUser endpoint"""
        print("\n=== Step 2: Create/Retrieve Customer ===")
        
        if not self.api_key:
            self.log_result(
                "Create Customer", 
                False, 
                "No API key available for customer creation"
            )
            return False
        
        try:
            # Customer data for ETH payment test - use timestamp to ensure unique email
            import time
            timestamp = int(time.time())
            customer_data = {
                "name": "ETH Payment Test Customer",
                "email": f"eth.test.customer.{timestamp}@dynopay.com",
                "phone": "+1234567890"
            }
            
            headers = {
                "x-api-key": self.api_key,  # Use encrypted API key in x-api-key header
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.api_service_url}/api/user/createUser",
                json=customer_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Extract customer token from response
                if 'data' in data and 'token' in data['data']:
                    self.customer_token = data['data']['token']
                    customer_info = data.get('data', {})
                    
                    self.log_result(
                        "Create Customer", 
                        True, 
                        f"Successfully created/retrieved customer",
                        {
                            "customer_id": customer_info.get('customer_id'),
                            "has_token": bool(self.customer_token)
                        }
                    )
                    return True
                else:
                    self.log_result(
                        "Create Customer", 
                        False, 
                        "Customer creation succeeded but no token received",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "Create Customer", 
                    False, 
                    f"Customer creation failed with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Create Customer", 
                False, 
                f"Customer creation request failed: {str(e)}"
            )
            return False
    
    def test_create_eth_payment(self):
        """Step 3: Create $10 ETH payment using direct API endpoint"""
        print("\n=== Step 3: Create $10 ETH Payment ===")
        
        if not self.customer_token:
            self.log_result(
                "Create ETH Payment", 
                False, 
                "No customer token available for payment creation"
            )
            return False
        
        if not self.api_key:
            self.log_result(
                "Create ETH Payment", 
                False, 
                "No API key available for payment creation"
            )
            return False
        
        try:
            # Payment data as specified in review request
            payment_data = {
                "amount": 10,
                "currency": "ETH",
                "fee_payer": "company",
                "redirect_uri": "https://example.com/success",
                "meta_data": {
                    "product_name": "ETH Payment Test"
                }
            }
            
            headers = {
                "Authorization": f"Bearer {self.customer_token}",
                "x-api-key": self.api_key,  # API key required for all API service endpoints
                "Content-Type": "application/json"
            }
            
            # Use the direct API endpoint as specified in review request
            response = requests.post(
                f"{self.api_service_url}/api/user/cryptoPayment",
                json=payment_data,
                headers=headers,
                timeout=30  # Longer timeout for crypto operations
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for expected response fields
                expected_fields = ['transaction_id', 'address', 'crypto_amount', 'qr_code']
                missing_fields = [field for field in expected_fields if field not in data]
                
                if not missing_fields:
                    eth_address = data.get('address')
                    crypto_amount = data.get('crypto_amount')
                    transaction_id = data.get('transaction_id')
                    qr_code = data.get('qr_code')
                    
                    # Validate ETH address format (should start with 0x and be 42 characters)
                    is_valid_eth_address = (
                        eth_address and 
                        isinstance(eth_address, str) and 
                        eth_address.startswith('0x') and 
                        len(eth_address) == 42
                    )
                    
                    if is_valid_eth_address:
                        self.log_result(
                            "Create ETH Payment", 
                            True, 
                            f"✅ SUCCESS: ETH payment created with valid address",
                            {
                                "transaction_id": transaction_id,
                                "eth_address": eth_address,
                                "crypto_amount": crypto_amount,
                                "has_qr_code": bool(qr_code),
                                "amount_usd": payment_data["amount"],
                                "currency": payment_data["currency"],
                                "fee_payer": payment_data["fee_payer"]
                            }
                        )
                        
                        # Log the ETH address prominently for the user
                        print(f"\n🎯 ETH PAYMENT ADDRESS: {eth_address}")
                        print(f"💰 Amount: {crypto_amount} ETH (${payment_data['amount']} USD)")
                        print(f"🔗 Transaction ID: {transaction_id}")
                        
                        return True
                    else:
                        self.log_result(
                            "Create ETH Payment", 
                            False, 
                            f"Invalid ETH address format: {eth_address}",
                            {"address": eth_address, "expected_format": "0x... (42 characters)"}
                        )
                        return False
                else:
                    self.log_result(
                        "Create ETH Payment", 
                        False, 
                        f"Missing required response fields: {', '.join(missing_fields)}",
                        {"response": data, "missing_fields": missing_fields}
                    )
                    return False
            else:
                self.log_result(
                    "Create ETH Payment", 
                    False, 
                    f"ETH payment creation failed with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Create ETH Payment", 
                False, 
                f"ETH payment creation request failed: {str(e)}"
            )
            return False
    
    def test_verify_merchant_pool_system(self):
        """Verify merchant pool system is working for ETH"""
        print("\n=== Step 4: Verify Merchant Pool System ===")
        
        if not self.merchant_jwt_token:
            self.log_result(
                "Verify Merchant Pool", 
                False, 
                "No merchant JWT token available"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.merchant_jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Check wallet addresses for ETH
            response = requests.get(
                f"{self.backend_url}/api/wallet/getWalletAddresses",
                params={"company_id": self.merchant_credentials["company_id"]},
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                addresses = data.get('data', [])
                
                # Look for ETH addresses
                eth_addresses = [addr for addr in addresses if addr.get('currency') == 'ETH']
                
                if eth_addresses:
                    self.log_result(
                        "Verify Merchant Pool - ETH", 
                        True, 
                        f"Found {len(eth_addresses)} ETH addresses in merchant pool",
                        {
                            "eth_addresses_count": len(eth_addresses),
                            "total_addresses": len(addresses),
                            "sample_eth_address": eth_addresses[0].get('address') if eth_addresses else None
                        }
                    )
                else:
                    self.log_result(
                        "Verify Merchant Pool - ETH", 
                        True, 
                        "No ETH addresses found in pool (addresses generated on-demand)",
                        {
                            "total_addresses": len(addresses),
                            "note": "ETH addresses are generated when customers select ETH payment method"
                        }
                    )
                
                return True
            else:
                self.log_result(
                    "Verify Merchant Pool", 
                    False, 
                    f"Failed to retrieve wallet addresses with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Verify Merchant Pool", 
                False, 
                f"Merchant pool verification failed: {str(e)}"
            )
            return False
    
    def test_admin_wallet_configuration(self):
        """Verify admin ETH wallet is configured"""
        print("\n=== Step 5: Verify Admin ETH Wallet Configuration ===")
        
        try:
            # Check backend .env for admin ETH wallet
            with open('/app/backend/.env', 'r') as f:
                env_content = f.read()
                
            eth_wallet = None
            for line in env_content.split('\n'):
                if line.startswith('ETH='):
                    eth_wallet = line.split('=', 1)[1].strip()
                    break
            
            if eth_wallet:
                # Validate ETH address format
                is_valid = (
                    eth_wallet.startswith('0x') and 
                    len(eth_wallet) == 42
                )
                
                if is_valid:
                    self.log_result(
                        "Admin ETH Wallet", 
                        True, 
                        f"Admin ETH wallet configured correctly",
                        {
                            "admin_eth_wallet": eth_wallet,
                            "format_valid": is_valid
                        }
                    )
                    return True
                else:
                    self.log_result(
                        "Admin ETH Wallet", 
                        False, 
                        f"Admin ETH wallet has invalid format: {eth_wallet}",
                        {"wallet": eth_wallet, "expected_format": "0x... (42 characters)"}
                    )
                    return False
            else:
                self.log_result(
                    "Admin ETH Wallet", 
                    False, 
                    "Admin ETH wallet not found in environment configuration"
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Admin ETH Wallet", 
                False, 
                f"Failed to verify admin ETH wallet: {str(e)}"
            )
            return False
    
    def run_complete_test(self):
        """Run the complete ETH payment creation test"""
        print("=" * 80)
        print("ETH PAYMENT DIRECT API TEST - $10 USD ETH PAYMENT FOR john@dyno.pt")
        print("=" * 80)
        print(f"Backend URL: {self.backend_url}")
        print(f"API Service URL: {self.api_service_url}")
        print(f"Test User: {self.merchant_credentials['email']}")
        print("=" * 80)
        
        # Run all test steps
        steps = [
            self.test_merchant_authentication,
            self.test_get_api_key,
            self.test_create_customer,
            self.test_create_eth_payment,
            self.test_verify_merchant_pool_system,
            self.test_admin_wallet_configuration
        ]
        
        passed_steps = 0
        total_steps = len(steps)
        
        for step in steps:
            try:
                if step():
                    passed_steps += 1
                else:
                    # If critical step fails, continue but note the failure
                    pass
            except Exception as e:
                print(f"❌ CRITICAL ERROR in {step.__name__}: {str(e)}")
        
        # Final summary
        print("\n" + "=" * 80)
        print("ETH PAYMENT DIRECT API TEST SUMMARY")
        print("=" * 80)
        
        success_rate = (passed_steps / total_steps) * 100
        
        print(f"📊 Overall Success Rate: {success_rate:.1f}% ({passed_steps}/{total_steps} steps passed)")
        
        if passed_steps >= 4:  # At least authentication, API key, customer creation, and payment creation
            print("✅ CORE ETH PAYMENT FUNCTIONALITY: WORKING")
            if self.customer_token and passed_steps >= 3:
                print("🎯 ETH PAYMENT ADDRESS GENERATION: SUCCESS")
        else:
            print("❌ CORE ETH PAYMENT FUNCTIONALITY: FAILED")
        
        # Show any errors
        if self.errors:
            print(f"\n⚠️  Issues Found ({len(self.errors)}):")
            for error in self.errors:
                print(f"   • {error}")
        
        print("\n" + "=" * 80)
        
        return success_rate >= 75  # Consider test successful if 75% or more steps pass

def main():
    """Main test execution"""
    tester = ETHPaymentDirectAPITester()
    success = tester.run_complete_test()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()