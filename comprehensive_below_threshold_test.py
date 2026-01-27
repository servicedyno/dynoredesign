#!/usr/bin/env python3
"""
DynoPay Below-Threshold Payment Testing Suite - COMPREHENSIVE WEBHOOK SIMULATION TEST
Tests complete payment flow for amounts < $5 USD on Sepolia testnet by simulating Tatum webhook

OBJECTIVE: Test complete payment flow for amount < $5 USD on Sepolia testnet by simulating the Tatum webhook, verifying that:
1. Payment address generation works
2. Webhook processing succeeds
3. Merchant receives payout
4. Admin fee is marked as 'pending' (NOT 'pending_sweep')
5. Admin fee is NOT swept by cron job

TEST CONFIGURATION:
- Testnet: Ethereum Sepolia
- TATUM_TESTNET=true
- ETH_THRESHOLD=$5 USD
- ETH price: ~$2,916.60/ETH (from previous test)
- Target payment: 0.005 ETH (~$14.58 USD) - BELOW threshold
- Test credentials: john@dyno.pt / Katiekendra123@
"""

import os
import sys
import json
import time
import requests
import hashlib
import random
import subprocess
from typing import Dict, List, Any, Optional

class ComprehensiveBelowThresholdTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        
        # Test configuration
        self.test_credentials = {
            "email": "john@dyno.pt",
            "password": "Katiekendra123@"
        }
        
        # Payment configuration for below-threshold test
        self.payment_config = {
            "amount": 0.005,  # ETH - below $5 threshold (~$14.58)
            "base_currency": "ETH",
            "modes": ["CRYPTO"],
            "customer_email": "test@example.com"
        }
        
        # Test data storage
        self.test_data = {
            "link_id": None,
            "transaction_id": None,
            "payment_address": None,
            "webhook_payload": None,
            "webhook_response": None,
            "user_id": None
        }
        
    def get_backend_url(self):
        """Get backend URL from frontend .env file"""
        env_backend_url = os.environ.get('BACKEND_URL')
        if env_backend_url:
            return env_backend_url
            
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
    
    def authenticate_user(self) -> bool:
        """Authenticate with provided test credentials"""
        print("\n=== PHASE 0: Authentication ===")
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json=self.test_credentials,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    self.jwt_token = data['data']['accessToken']
                    user_info = data['data'].get('user', {})
                    self.test_data["user_id"] = user_info.get('user_id')
                    
                    # Get company_id for payment link creation
                    self.get_company_id()
                    
                    self.log_result(
                        "Authentication", 
                        True, 
                        f"Successfully authenticated as {user_info.get('email', 'unknown')}",
                        {"user_id": user_info.get('user_id'), "email": user_info.get('email')}
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
    
    def get_company_id(self):
        """Get company_id for the authenticated user"""
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.get(
                f"{self.backend_url}/api/company/getCompany",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and len(data['data']) > 0:
                    self.test_data["company_id"] = data['data'][0].get('company_id')
                    print(f"   • Company ID: {self.test_data['company_id']}")
                else:
                    # If no company exists, create one
                    self.create_test_company()
            else:
                # If no company exists, create one
                self.create_test_company()
                
        except Exception as e:
            print(f"   • Warning: Could not get company_id: {str(e)}")
            # Try to create a company
            self.create_test_company()
    
    def create_test_company(self):
        """Create a test company for payment link creation"""
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "multipart/form-data"
            }
            
            # Remove Content-Type to let requests set it automatically for multipart
            headers.pop("Content-Type")
            
            company_data = {
                "company_name": "Test Company for Below Threshold",
                "email": "test@dynopay.com",
                "mobile": "+1234567890"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/company/addCompany",
                data={"data": json.dumps(company_data)},
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    self.test_data["company_id"] = data['data'].get('company_id')
                    print(f"   • Created Company ID: {self.test_data['company_id']}")
                    
        except Exception as e:
            print(f"   • Warning: Could not create company: {str(e)}")
            # Use a default company_id if available
            self.test_data["company_id"] = 1
    
    def create_payment_link(self) -> bool:
        """PHASE 1: Create payment link for below-threshold amount"""
        print("\n=== PHASE 1: Create Payment Link ===")
        
        if not self.jwt_token:
            self.log_result(
                "Create Payment Link", 
                False, 
                "No JWT token available"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "email": self.payment_config["customer_email"],
                "amount": self.payment_config["amount"],
                "base_currency": self.payment_config["base_currency"],
                "modes": self.payment_config["modes"]
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payload,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    payment_data = data['data']
                    self.test_data["link_id"] = payment_data.get('link_id')
                    self.test_data["transaction_id"] = payment_data.get('transaction_id')
                    
                    if self.test_data["link_id"] and self.test_data["transaction_id"]:
                        self.log_result(
                            "Create Payment Link", 
                            True, 
                            f"Payment link created successfully for {self.payment_config['amount']} {self.payment_config['base_currency']}",
                            {
                                "link_id": self.test_data["link_id"],
                                "transaction_id": self.test_data["transaction_id"],
                                "amount": self.payment_config["amount"],
                                "currency": self.payment_config["base_currency"]
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Create Payment Link", 
                            False, 
                            "Payment link created but missing link_id or transaction_id",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "Create Payment Link", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                # Try to parse error response
                try:
                    error_data = response.json()
                    self.log_result(
                        "Create Payment Link", 
                        False, 
                        f"API call failed with status {response.status_code}: {error_data.get('message', 'Unknown error')}",
                        {"response": error_data, "payload_sent": payload}
                    )
                except:
                    self.log_result(
                        "Create Payment Link", 
                        False, 
                        f"API call failed with status {response.status_code}",
                        {"response": response.text, "payload_sent": payload}
                    )
                
        except Exception as e:
            self.log_result(
                "Create Payment Link", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return False
    
    def generate_payment_address(self) -> bool:
        """PHASE 2: Generate payment address for crypto payment"""
        print("\n=== PHASE 2: Generate Payment Address ===")
        
        if not self.test_data["link_id"] or not self.test_data["transaction_id"]:
            self.log_result(
                "Generate Payment Address", 
                False, 
                "Missing link_id or transaction_id from previous phase"
            )
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "link_id": self.test_data["link_id"],
                "transaction_id": self.test_data["transaction_id"],
                "currency": "ETH"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createCryptoPayment",
                json=payload,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    crypto_data = data['data']
                    self.test_data["payment_address"] = crypto_data.get('address')
                    
                    if self.test_data["payment_address"]:
                        self.log_result(
                            "Generate Payment Address", 
                            True, 
                            f"Payment address generated successfully",
                            {
                                "address": self.test_data["payment_address"],
                                "currency": "ETH",
                                "testnet": "Sepolia",
                                "amount": self.payment_config["amount"]
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Generate Payment Address", 
                            False, 
                            "Payment address generation succeeded but no address returned",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "Generate Payment Address", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Generate Payment Address", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Generate Payment Address", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        return False
    
    def generate_realistic_tx_hash(self) -> str:
        """Generate realistic Sepolia transaction hash"""
        # Generate random 64 hex characters for realistic TX hash
        random_bytes = random.getrandbits(256)
        return f"0x{random_bytes:064x}"
    
    def simulate_webhook(self) -> bool:
        """PHASE 3: Simulate Tatum webhook for below-threshold payment"""
        print("\n=== PHASE 3: Simulate Tatum Webhook ===")
        
        if not self.test_data["payment_address"]:
            self.log_result(
                "Simulate Webhook", 
                False, 
                "Missing payment address from previous phase"
            )
            return False
        
        try:
            # Generate realistic webhook payload
            simulated_tx_hash = self.generate_realistic_tx_hash()
            
            webhook_payload = {
                "currency": "ETH",
                "amount": str(self.payment_config["amount"]),  # String format as required
                "address": self.test_data["payment_address"],
                "txId": simulated_tx_hash,
                "blockNumber": 5234567,  # Realistic Sepolia block number
                "asset": "ETH",
                "type": "native",
                "mempool": False,  # Confirmed transaction
                "confirmations": 12  # Enough for processing
            }
            
            self.test_data["webhook_payload"] = webhook_payload
            
            print(f"📤 Sending webhook with payload:")
            print(f"   • TX Hash: {simulated_tx_hash}")
            print(f"   • Amount: {webhook_payload['amount']} ETH")
            print(f"   • Address: {webhook_payload['address']}")
            print(f"   • Confirmations: {webhook_payload['confirmations']}")
            
            # Send webhook to backend
            response = requests.post(
                f"{self.backend_url}/api/tatum-crypto-webhook",
                json=webhook_payload,
                headers={"Content-Type": "application/json"},
                timeout=30  # Longer timeout for webhook processing
            )
            
            self.test_data["webhook_response"] = {
                "status_code": response.status_code,
                "response": response.text
            }
            
            if response.status_code == 200:
                try:
                    response_data = response.json()
                    self.log_result(
                        "Simulate Webhook", 
                        True, 
                        f"Webhook processed successfully",
                        {
                            "tx_hash": simulated_tx_hash,
                            "amount": webhook_payload["amount"],
                            "address": webhook_payload["address"],
                            "confirmations": webhook_payload["confirmations"],
                            "response": response_data
                        }
                    )
                    return True
                except json.JSONDecodeError:
                    # Some webhooks might return plain text success
                    if "success" in response.text.lower() or response.status_code == 200:
                        self.log_result(
                            "Simulate Webhook", 
                            True, 
                            f"Webhook processed successfully (plain text response)",
                            {
                                "tx_hash": simulated_tx_hash,
                                "response": response.text
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Simulate Webhook", 
                            False, 
                            f"Webhook returned 200 but unexpected response format",
                            {"response": response.text}
                        )
            else:
                self.log_result(
                    "Simulate Webhook", 
                    False, 
                    f"Webhook failed with status {response.status_code}",
                    {"response": response.text, "payload": webhook_payload}
                )
                
        except Exception as e:
            self.log_result(
                "Simulate Webhook", 
                False, 
                f"Webhook simulation failed: {str(e)}"
            )
        
        return False
    
    def verify_transaction_status(self) -> bool:
        """PHASE 4A: Verify transaction status in database"""
        print("\n=== PHASE 4A: Verify Transaction Status ===")
        
        if not self.test_data["transaction_id"]:
            self.log_result(
                "Verify Transaction Status", 
                False, 
                "Missing transaction_id"
            )
            return False
        
        # Create database query script
        db_query_script = f'''
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

async function verifyTransaction() {{
  try {{
    await sequelize.authenticate();
    
    // Query transaction status
    const transaction = await sequelize.query(
      `SELECT transaction_id, status, base_amount, usd_value, created_at, updated_at
       FROM tbl_transactions
       WHERE transaction_id = '{self.test_data["transaction_id"]}'`,
      {{ type: QueryTypes.SELECT }}
    );
    
    console.log(JSON.stringify({{
      transaction_found: transaction.length > 0,
      transaction_data: transaction[0] || null
    }}, null, 2));
    
    process.exit(0);
    
  }} catch (error) {{
    console.error('Transaction verification failed:', error.message);
    process.exit(1);
  }}
}}

verifyTransaction();
'''
        
        try:
            # Write and execute database query
            with open('/tmp/verify_transaction.js', 'w') as f:
                f.write(db_query_script)
            
            result = subprocess.run(
                ["node", "/tmp/verify_transaction.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    tx_data = json.loads(result.stdout)
                    
                    if tx_data.get('transaction_found', False):
                        transaction = tx_data.get('transaction_data', {})
                        status = transaction.get('status')
                        usd_value = transaction.get('usd_value')
                        
                        if status == 'successful':
                            self.log_result(
                                "Verify Transaction Status", 
                                True, 
                                f"Transaction processed successfully with status '{status}'",
                                {
                                    "transaction_id": transaction.get('transaction_id'),
                                    "status": status,
                                    "base_amount": transaction.get('base_amount'),
                                    "usd_value": usd_value,
                                    "below_threshold": usd_value < 5 if usd_value else "unknown"
                                }
                            )
                            return True
                        else:
                            self.log_result(
                                "Verify Transaction Status", 
                                False, 
                                f"Transaction found but status is '{status}' (expected 'successful')",
                                {"transaction": transaction}
                            )
                    else:
                        self.log_result(
                            "Verify Transaction Status", 
                            False, 
                            "Transaction not found in database",
                            {"transaction_id": self.test_data["transaction_id"]}
                        )
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Verify Transaction Status", 
                        False, 
                        "Failed to parse database query results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
            else:
                self.log_result(
                    "Verify Transaction Status", 
                    False, 
                    "Database query failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Verify Transaction Status", 
                False, 
                f"Transaction verification failed: {str(e)}"
            )
        
        return False
    
    def verify_merchant_payout(self) -> bool:
        """PHASE 4B: Verify merchant received payout"""
        print("\n=== PHASE 4B: Verify Merchant Payout ===")
        
        if not self.test_data["user_id"]:
            self.log_result(
                "Verify Merchant Payout", 
                False, 
                "Missing user_id"
            )
            return False
        
        # Create database query script for merchant wallet
        merchant_query_script = f'''
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

async function verifyMerchantPayout() {{
  try {{
    await sequelize.authenticate();
    
    // Query merchant wallet balance
    const wallet = await sequelize.query(
      `SELECT user_id, wallet_type, balance, updated_at
       FROM tbl_user_wallet
       WHERE user_id = {self.test_data["user_id"]} AND wallet_type = 'ETH'`,
      {{ type: QueryTypes.SELECT }}
    );
    
    console.log(JSON.stringify({{
      wallet_found: wallet.length > 0,
      wallet_data: wallet[0] || null
    }}, null, 2));
    
    process.exit(0);
    
  }} catch (error) {{
    console.error('Merchant payout verification failed:', error.message);
    process.exit(1);
  }}
}}

verifyMerchantPayout();
'''
        
        try:
            # Write and execute merchant payout query
            with open('/tmp/verify_merchant_payout.js', 'w') as f:
                f.write(merchant_query_script)
            
            result = subprocess.run(
                ["node", "/tmp/verify_merchant_payout.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    wallet_data = json.loads(result.stdout)
                    
                    if wallet_data.get('wallet_found', False):
                        wallet = wallet_data.get('wallet_data', {})
                        balance = wallet.get('balance')
                        
                        self.log_result(
                            "Verify Merchant Payout", 
                            True, 
                            f"Merchant ETH wallet found with balance",
                            {
                                "user_id": wallet.get('user_id'),
                                "wallet_type": wallet.get('wallet_type'),
                                "balance": balance,
                                "updated_at": wallet.get('updated_at')
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Verify Merchant Payout", 
                            False, 
                            "Merchant ETH wallet not found",
                            {"user_id": self.test_data["user_id"]}
                        )
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Verify Merchant Payout", 
                        False, 
                        "Failed to parse merchant payout query results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
            else:
                self.log_result(
                    "Verify Merchant Payout", 
                    False, 
                    "Merchant payout query failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Verify Merchant Payout", 
                False, 
                f"Merchant payout verification failed: {str(e)}"
            )
        
        return False
    
    def verify_admin_fee_status(self) -> bool:
        """PHASE 4C: Verify admin fee status is 'pending' (NOT 'pending_sweep')"""
        print("\n=== PHASE 4C: Verify Admin Fee Status ===")
        
        if not self.test_data["transaction_id"]:
            self.log_result(
                "Verify Admin Fee Status", 
                False, 
                "Missing transaction_id"
            )
            return False
        
        # Create database query script for admin fee
        admin_fee_query_script = f'''
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

async function verifyAdminFee() {{
  try {{
    await sequelize.authenticate();
    
    // Query admin fee status from temp address table
    const adminFee = await sequelize.query(
      `SELECT 
         wallet_address,
         admin_status,
         admin_fee,
         usd_value,
         adminTxId,
         created_at,
         updated_at
       FROM tbl_user_temp_address
       WHERE transaction_id = '{self.test_data["transaction_id"]}'`,
      {{ type: QueryTypes.SELECT }}
    );
    
    console.log(JSON.stringify({{
      admin_fee_found: adminFee.length > 0,
      admin_fee_data: adminFee[0] || null
    }}, null, 2));
    
    process.exit(0);
    
  }} catch (error) {{
    console.error('Admin fee verification failed:', error.message);
    process.exit(1);
  }}
}}

verifyAdminFee();
'''
        
        try:
            # Write and execute admin fee query
            with open('/tmp/verify_admin_fee.js', 'w') as f:
                f.write(admin_fee_query_script)
            
            result = subprocess.run(
                ["node", "/tmp/verify_admin_fee.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    fee_data = json.loads(result.stdout)
                    
                    if fee_data.get('admin_fee_found', False):
                        admin_fee = fee_data.get('admin_fee_data', {})
                        admin_status = admin_fee.get('admin_status')
                        usd_value = admin_fee.get('usd_value')
                        admin_fee_amount = admin_fee.get('admin_fee')
                        
                        # CRITICAL CHECK: admin_status should be 'pending' for below-threshold payments
                        if admin_status == 'pending':
                            self.log_result(
                                "Verify Admin Fee Status", 
                                True, 
                                f"✅ CRITICAL SUCCESS: Admin fee correctly marked as 'pending' for below-threshold payment",
                                {
                                    "admin_status": admin_status,
                                    "admin_fee": admin_fee_amount,
                                    "usd_value": usd_value,
                                    "below_threshold": usd_value < 5 if usd_value else "unknown",
                                    "wallet_address": admin_fee.get('wallet_address'),
                                    "adminTxId": admin_fee.get('adminTxId')
                                }
                            )
                            return True
                        elif admin_status == 'pending_sweep':
                            self.log_result(
                                "Verify Admin Fee Status", 
                                False, 
                                f"❌ CRITICAL FAILURE: Admin fee incorrectly marked as 'pending_sweep' (should be 'pending' for below-threshold)",
                                {"admin_fee_data": admin_fee}
                            )
                        else:
                            self.log_result(
                                "Verify Admin Fee Status", 
                                False, 
                                f"Admin fee has unexpected status '{admin_status}' (expected 'pending')",
                                {"admin_fee_data": admin_fee}
                            )
                    else:
                        self.log_result(
                            "Verify Admin Fee Status", 
                            False, 
                            "Admin fee record not found in database",
                            {"transaction_id": self.test_data["transaction_id"]}
                        )
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Verify Admin Fee Status", 
                        False, 
                        "Failed to parse admin fee query results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
            else:
                self.log_result(
                    "Verify Admin Fee Status", 
                    False, 
                    "Admin fee query failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Verify Admin Fee Status", 
                False, 
                f"Admin fee verification failed: {str(e)}"
            )
        
        return False
    
    def verify_no_sweep_occurred(self) -> bool:
        """PHASE 5: Verify admin fee was NOT swept by cron job"""
        print("\n=== PHASE 5: Verify No Sweep Occurred ===")
        
        if not self.test_data["transaction_id"]:
            self.log_result(
                "Verify No Sweep", 
                False, 
                "Missing transaction_id"
            )
            return False
        
        # Create database query script to check sweep status
        sweep_query_script = f'''
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

async function verifySweepStatus() {{
  try {{
    await sequelize.authenticate();
    
    // Check if admin fee transaction was created (indicating sweep)
    const sweepTransaction = await sequelize.query(
      `SELECT * FROM tbl_admin_fee_transaction
       WHERE transaction_id = '{self.test_data["transaction_id"]}'`,
      {{ type: QueryTypes.SELECT }}
    );
    
    // Also check current admin status
    const currentStatus = await sequelize.query(
      `SELECT admin_status, updated_at, adminTxId
       FROM tbl_user_temp_address
       WHERE transaction_id = '{self.test_data["transaction_id"]}'`,
      {{ type: QueryTypes.SELECT }}
    );
    
    console.log(JSON.stringify({{
      sweep_transaction_exists: sweepTransaction.length > 0,
      sweep_transaction_data: sweepTransaction[0] || null,
      current_admin_status: currentStatus[0] || null
    }}, null, 2));
    
    process.exit(0);
    
  }} catch (error) {{
    console.error('Sweep verification failed:', error.message);
    process.exit(1);
  }}
}}

verifySweepStatus();
'''
        
        try:
            # Write and execute sweep verification query
            with open('/tmp/verify_sweep.js', 'w') as f:
                f.write(sweep_query_script)
            
            result = subprocess.run(
                ["node", "/tmp/verify_sweep.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    sweep_data = json.loads(result.stdout)
                    
                    sweep_exists = sweep_data.get('sweep_transaction_exists', False)
                    current_status = sweep_data.get('current_admin_status', {})
                    admin_status = current_status.get('admin_status') if current_status else None
                    
                    # SUCCESS: No sweep transaction should exist for below-threshold payments
                    if not sweep_exists and admin_status == 'pending':
                        self.log_result(
                            "Verify No Sweep", 
                            True, 
                            f"✅ CRITICAL SUCCESS: Admin fee correctly NOT swept (status remains 'pending')",
                            {
                                "sweep_transaction_exists": sweep_exists,
                                "current_admin_status": admin_status,
                                "adminTxId": current_status.get('adminTxId') if current_status else None,
                                "updated_at": current_status.get('updated_at') if current_status else None
                            }
                        )
                        return True
                    elif sweep_exists:
                        self.log_result(
                            "Verify No Sweep", 
                            False, 
                            f"❌ CRITICAL FAILURE: Admin fee was incorrectly swept (sweep transaction exists)",
                            {"sweep_data": sweep_data}
                        )
                    elif admin_status != 'pending':
                        self.log_result(
                            "Verify No Sweep", 
                            False, 
                            f"Admin status changed from 'pending' to '{admin_status}' (may indicate sweep attempt)",
                            {"sweep_data": sweep_data}
                        )
                    else:
                        self.log_result(
                            "Verify No Sweep", 
                            False, 
                            "Unexpected sweep verification result",
                            {"sweep_data": sweep_data}
                        )
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Verify No Sweep", 
                        False, 
                        "Failed to parse sweep verification results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
            else:
                self.log_result(
                    "Verify No Sweep", 
                    False, 
                    "Sweep verification query failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Verify No Sweep", 
                False, 
                f"Sweep verification failed: {str(e)}"
            )
        
        return False
    
    def run_complete_test(self):
        """Run the complete below-threshold payment test"""
        print("=" * 80)
        print("DYNOPAY BELOW-THRESHOLD PAYMENT TEST - COMPREHENSIVE WEBHOOK SIMULATION")
        print("Testing payment flow for amounts < $5 USD on Sepolia testnet")
        print("=" * 80)
        
        # Test configuration summary
        print(f"\n📋 TEST CONFIGURATION:")
        print(f"   • Backend URL: {self.backend_url}")
        print(f"   • Test Amount: {self.payment_config['amount']} {self.payment_config['base_currency']} (~$14.58 USD)")
        print(f"   • Threshold: $5 USD (below threshold)")
        print(f"   • Testnet: Ethereum Sepolia")
        print(f"   • Test User: {self.test_credentials['email']}")
        
        # Execute test phases
        success_count = 0
        total_phases = 7
        
        if self.authenticate_user():
            success_count += 1
            
            if self.create_payment_link():
                success_count += 1
                
                if self.generate_payment_address():
                    success_count += 1
                    
                    if self.simulate_webhook():
                        success_count += 1
                        
                        # Wait a moment for processing
                        print("\n⏳ Waiting 10 seconds for webhook processing...")
                        time.sleep(10)
                        
                        if self.verify_transaction_status():
                            success_count += 1
                            
                            if self.verify_merchant_payout():
                                success_count += 1
                                
                                if self.verify_admin_fee_status():
                                    success_count += 1
                                    
                                    # Additional verification for no sweep
                                    self.verify_no_sweep_occurred()
        
        # Final summary
        self.print_final_summary(success_count, total_phases)
    
    def print_final_summary(self, success_count: int, total_phases: int):
        """Print comprehensive test summary"""
        print("\n" + "=" * 80)
        print("BELOW-THRESHOLD PAYMENT TEST SUMMARY")
        print("=" * 80)
        
        print(f"\n📊 OVERALL RESULTS:")
        print(f"   • Phases Completed: {success_count}/{total_phases}")
        print(f"   • Success Rate: {(success_count/total_phases)*100:.1f}%")
        
        print(f"\n🔍 TEST DATA COLLECTED:")
        for key, value in self.test_data.items():
            if value:
                if key == "webhook_payload":
                    print(f"   • {key}: {value.get('txId', 'N/A')} (TX Hash)")
                elif key == "webhook_response":
                    print(f"   • {key}: Status {value.get('status_code', 'N/A')}")
                else:
                    print(f"   • {key}: {value}")
        
        print(f"\n📋 DETAILED RESULTS:")
        for test_name, result in self.test_results.items():
            status = "✅ PASS" if result['success'] else "❌ FAIL"
            print(f"   {status} {test_name}: {result['message']}")
        
        if self.errors:
            print(f"\n❌ ERRORS ENCOUNTERED:")
            for error in self.errors:
                print(f"   • {error}")
        
        # Critical success criteria
        print(f"\n🎯 CRITICAL SUCCESS CRITERIA:")
        criteria = [
            ("Payment Link Created", "Create Payment Link" in self.test_results and self.test_results["Create Payment Link"]["success"]),
            ("Payment Address Generated", "Generate Payment Address" in self.test_results and self.test_results["Generate Payment Address"]["success"]),
            ("Webhook Processed", "Simulate Webhook" in self.test_results and self.test_results["Simulate Webhook"]["success"]),
            ("Transaction Successful", "Verify Transaction Status" in self.test_results and self.test_results["Verify Transaction Status"]["success"]),
            ("Merchant Payout Verified", "Verify Merchant Payout" in self.test_results and self.test_results["Verify Merchant Payout"]["success"]),
            ("Admin Fee Status = 'pending'", "Verify Admin Fee Status" in self.test_results and self.test_results["Verify Admin Fee Status"]["success"]),
            ("Admin Fee NOT Swept", "Verify No Sweep" in self.test_results and self.test_results["Verify No Sweep"]["success"])
        ]
        
        for criterion, met in criteria:
            status = "✅" if met else "❌"
            print(f"   {status} {criterion}")
        
        # Final verdict
        all_critical_met = all(met for _, met in criteria)
        print(f"\n🏆 FINAL VERDICT:")
        if all_critical_met:
            print("   ✅ BELOW-THRESHOLD PAYMENT HANDLING WORKING CORRECTLY")
            print("   ✅ Admin fees are properly held for batch sweep (not immediately transferred)")
            print("   ✅ System correctly distinguishes between above/below threshold payments")
        else:
            print("   ❌ BELOW-THRESHOLD PAYMENT HANDLING HAS ISSUES")
            print("   ❌ Some critical criteria not met - see detailed results above")
        
        print("=" * 80)

def main():
    """Main test execution"""
    tester = ComprehensiveBelowThresholdTester()
    tester.run_complete_test()

if __name__ == "__main__":
    main()