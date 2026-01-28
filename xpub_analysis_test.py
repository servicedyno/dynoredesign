#!/usr/bin/env python3
"""
XPUB ANALYSIS FOR john@dyno.pt
Comprehensive analysis of merchant xpub wallet creation status as requested in review.

This test analyzes:
1. User verification (john@dyno.pt)
2. Merchant wallet (xpub) analysis in tbl_merchant_wallet
3. Pool address analysis in tbl_merchant_temp_address
4. Transaction and sweep history
5. Overall initialization status and recommendations
"""

import os
import sys
import json
import subprocess
import time
import requests
from typing import Dict, List, Any, Optional

class XPubAnalysisTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.user_data = None
        self.analysis_results = {
            'user_info': {},
            'merchant_wallets': [],
            'pool_addresses': [],
            'transaction_count': 0,
            'sweep_count': 0,
            'initialization_status': 'unknown'
        }
        
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
        """Authenticate with john@dyno.pt credentials"""
        print("\n=== Authenticating with john@dyno.pt ===")
        
        # Test credentials from review request
        test_credentials = {
            "email": "john@dyno.pt",
            "password": "Katiekendra123@"  # Correct password from merchant pool test
        }
        
        try:
            # Try to login
            login_response = requests.post(
                f"{self.backend_url}/api/user/login",
                json=test_credentials,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if login_response.status_code == 200:
                login_data = login_response.json()
                if 'data' in login_data and 'accessToken' in login_data['data']:
                    self.jwt_token = login_data['data']['accessToken']
                    self.user_data = login_data['data']
                    
                    self.log_result(
                        "User Authentication", 
                        True, 
                        f"Successfully authenticated john@dyno.pt",
                        {
                            "user_id": self.user_data.get('user_id'),
                            "email": self.user_data.get('email'),
                            "name": f"{self.user_data.get('first_name', '')} {self.user_data.get('last_name', '')}".strip()
                        }
                    )
                    
                    # Store user info for analysis
                    self.analysis_results['user_info'] = {
                        'user_id': self.user_data.get('user_id'),
                        'email': self.user_data.get('email'),
                        'first_name': self.user_data.get('first_name'),
                        'last_name': self.user_data.get('last_name')
                    }
                    
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
    
    def analyze_user_verification(self):
        """Step 1: Find user john@dyno.pt in tbl_user"""
        print("\n=== Step 1: User Verification ===")
        
        user_query_script = '''
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

async function findUser() {
  try {
    await sequelize.authenticate();
    
    // Find user john@dyno.pt
    const user = await sequelize.query(
      `SELECT user_id, email, first_name, last_name, created_at, updated_at
       FROM tbl_user 
       WHERE email = 'john@dyno.pt'`,
      { type: QueryTypes.SELECT }
    );
    
    console.log(JSON.stringify({
      found: user.length > 0,
      user_data: user[0] || null,
      total_users_with_john: user.length
    }, null, 2));
    
    process.exit(0);
    
  } catch (error) {
    console.error('User query failed:', error.message);
    process.exit(1);
  }
}

findUser();
'''
        
        try:
            # Write and run user query script
            with open('/tmp/user_query.js', 'w') as f:
                f.write(user_query_script)
            
            result = subprocess.run(
                ["node", "/tmp/user_query.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    user_data = json.loads(result.stdout)
                    
                    if user_data.get('found', False):
                        user_info = user_data.get('user_data', {})
                        self.analysis_results['user_info'] = user_info
                        
                        self.log_result(
                            "User Verification", 
                            True, 
                            f"Found user john@dyno.pt with user_id: {user_info.get('user_id')}",
                            {
                                "user_id": user_info.get('user_id'),
                                "email": user_info.get('email'),
                                "first_name": user_info.get('first_name'),
                                "last_name": user_info.get('last_name'),
                                "created_at": user_info.get('created_at')
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "User Verification", 
                            False, 
                            "User john@dyno.pt not found in database",
                            {"query_result": user_data}
                        )
                        return False
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "User Verification", 
                        False, 
                        "Failed to parse user query results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
                    return False
            else:
                self.log_result(
                    "User Verification", 
                    False, 
                    "User query script failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "User Verification", 
                False, 
                f"User verification failed: {str(e)}"
            )
            return False
    
    def analyze_merchant_wallets(self):
        """Step 2: Merchant Wallet (XPUB) Analysis"""
        print("\n=== Step 2: Merchant Wallet (XPUB) Analysis ===")
        
        if not self.analysis_results['user_info'].get('user_id'):
            self.log_result(
                "Merchant Wallet Analysis", 
                False, 
                "No user_id available for wallet analysis"
            )
            return False
        
        user_id = self.analysis_results['user_info']['user_id']
        
        wallet_query_script = f'''
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

async function analyzeMerchantWallets() {{
  try {{
    await sequelize.authenticate();
    
    // Query merchant wallets for user
    const wallets = await sequelize.query(
      `SELECT 
        wallet_id,
        wallet_type,
        xpub,
        last_derivation_index,
        created_at,
        updated_at
       FROM tbl_merchant_wallet 
       WHERE user_id = {user_id}
       ORDER BY wallet_type`,
      {{ type: QueryTypes.SELECT }}
    );
    
    // Process wallets to show xpub preview (first 60 chars)
    const processedWallets = wallets.map(wallet => ({{
      ...wallet,
      xpub_preview: wallet.xpub ? wallet.xpub.substring(0, 60) + '...' : null,
      xpub_length: wallet.xpub ? wallet.xpub.length : 0
    }}));
    
    console.log(JSON.stringify({{
      total_wallets: wallets.length,
      wallets: processedWallets,
      wallet_types: wallets.map(w => w.wallet_type)
    }}, null, 2));
    
    process.exit(0);
    
  }} catch (error) {{
    console.error('Merchant wallet query failed:', error.message);
    process.exit(1);
  }}
}}

analyzeMerchantWallets();
'''
        
        try:
            # Write and run wallet query script
            with open('/tmp/wallet_query.js', 'w') as f:
                f.write(wallet_query_script)
            
            result = subprocess.run(
                ["node", "/tmp/wallet_query.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    wallet_data = json.loads(result.stdout)
                    
                    total_wallets = wallet_data.get('total_wallets', 0)
                    wallets = wallet_data.get('wallets', [])
                    wallet_types = wallet_data.get('wallet_types', [])
                    
                    self.analysis_results['merchant_wallets'] = wallets
                    
                    if total_wallets > 0:
                        # Expected wallet types for base chains
                        expected_types = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH']
                        found_types = set(wallet_types)
                        missing_types = set(expected_types) - found_types
                        
                        self.log_result(
                            "Merchant Wallet Analysis", 
                            True, 
                            f"Found {total_wallets} merchant wallets for user {user_id}",
                            {
                                "total_wallets": total_wallets,
                                "wallet_types": wallet_types,
                                "missing_base_chains": list(missing_types) if missing_types else None,
                                "sample_wallet": wallets[0] if wallets else None
                            }
                        )
                        
                        # Log details for each wallet
                        for wallet in wallets:
                            self.log_result(
                                f"Wallet {wallet['wallet_type']}", 
                                True, 
                                f"XPUB length: {wallet['xpub_length']}, Last derivation: {wallet['last_derivation_index']}",
                                {
                                    "wallet_id": wallet['wallet_id'],
                                    "wallet_type": wallet['wallet_type'],
                                    "xpub_preview": wallet['xpub_preview'],
                                    "last_derivation_index": wallet['last_derivation_index'],
                                    "created_at": wallet['created_at']
                                }
                            )
                        
                        return True
                    else:
                        self.log_result(
                            "Merchant Wallet Analysis", 
                            True, 
                            f"No merchant wallets found for user {user_id} - Lazy initialization NOT triggered",
                            {"total_wallets": 0, "user_id": user_id}
                        )
                        return True
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Merchant Wallet Analysis", 
                        False, 
                        "Failed to parse wallet query results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
                    return False
            else:
                self.log_result(
                    "Merchant Wallet Analysis", 
                    False, 
                    "Wallet query script failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Merchant Wallet Analysis", 
                False, 
                f"Merchant wallet analysis failed: {str(e)}"
            )
            return False
    
    def analyze_pool_addresses(self):
        """Step 3: Pool Address Analysis"""
        print("\n=== Step 3: Pool Address Analysis ===")
        
        if not self.analysis_results['user_info'].get('user_id'):
            self.log_result(
                "Pool Address Analysis", 
                False, 
                "No user_id available for pool address analysis"
            )
            return False
        
        user_id = self.analysis_results['user_info']['user_id']
        
        pool_query_script = f'''
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

async function analyzePoolAddresses() {{
  try {{
    await sequelize.authenticate();
    
    // Query pool addresses for user
    const addresses = await sequelize.query(
      `SELECT 
        temp_address_id,
        wallet_type,
        wallet_address,
        derivation_index,
        status,
        admin_fee_balance,
        gas_balance,
        total_transactions,
        created_at
       FROM tbl_merchant_temp_address 
       WHERE owner_user_id = {user_id}
       ORDER BY wallet_type, derivation_index`,
      {{ type: QueryTypes.SELECT }}
    );
    
    // Group addresses by wallet type
    const groupedAddresses = {{}};
    addresses.forEach(addr => {{
      if (!groupedAddresses[addr.wallet_type]) {{
        groupedAddresses[addr.wallet_type] = [];
      }}
      groupedAddresses[addr.wallet_type].push(addr);
    }});
    
    // Count by status
    const statusCounts = {{}};
    addresses.forEach(addr => {{
      statusCounts[addr.status] = (statusCounts[addr.status] || 0) + 1;
    }});
    
    console.log(JSON.stringify({{
      total_addresses: addresses.length,
      addresses_by_type: Object.keys(groupedAddresses).map(type => ({{
        wallet_type: type,
        count: groupedAddresses[type].length,
        addresses: groupedAddresses[type]
      }})),
      status_distribution: statusCounts,
      sample_addresses: addresses.slice(0, 5)  // First 5 addresses
    }}, null, 2));
    
    process.exit(0);
    
  }} catch (error) {{
    console.error('Pool address query failed:', error.message);
    process.exit(1);
  }}
}}

analyzePoolAddresses();
'''
        
        try:
            # Write and run pool address query script
            with open('/tmp/pool_query.js', 'w') as f:
                f.write(pool_query_script)
            
            result = subprocess.run(
                ["node", "/tmp/pool_query.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    pool_data = json.loads(result.stdout)
                    
                    total_addresses = pool_data.get('total_addresses', 0)
                    addresses_by_type = pool_data.get('addresses_by_type', [])
                    status_distribution = pool_data.get('status_distribution', {})
                    
                    self.analysis_results['pool_addresses'] = pool_data
                    
                    if total_addresses > 0:
                        self.log_result(
                            "Pool Address Analysis", 
                            True, 
                            f"Found {total_addresses} pool addresses across {len(addresses_by_type)} wallet types",
                            {
                                "total_addresses": total_addresses,
                                "wallet_types": [addr_type['wallet_type'] for addr_type in addresses_by_type],
                                "status_distribution": status_distribution
                            }
                        )
                        
                        # Log details for each wallet type
                        for addr_type in addresses_by_type:
                            wallet_type = addr_type['wallet_type']
                            count = addr_type['count']
                            
                            self.log_result(
                                f"Pool Addresses - {wallet_type}", 
                                True, 
                                f"{count} addresses found",
                                {
                                    "wallet_type": wallet_type,
                                    "address_count": count,
                                    "sample_address": addr_type['addresses'][0]['wallet_address'] if addr_type['addresses'] else None,
                                    "derivation_indices": [addr['derivation_index'] for addr in addr_type['addresses'][:3]]
                                }
                            )
                        
                        return True
                    else:
                        self.log_result(
                            "Pool Address Analysis", 
                            True, 
                            f"No pool addresses found for user {user_id}",
                            {"total_addresses": 0, "user_id": user_id}
                        )
                        return True
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Pool Address Analysis", 
                        False, 
                        "Failed to parse pool address query results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
                    return False
            else:
                self.log_result(
                    "Pool Address Analysis", 
                    False, 
                    "Pool address query script failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Pool Address Analysis", 
                False, 
                f"Pool address analysis failed: {str(e)}"
            )
            return False
    
    def analyze_transaction_history(self):
        """Step 4: Transaction History Analysis"""
        print("\n=== Step 4: Transaction History Analysis ===")
        
        if not self.analysis_results['user_info'].get('user_id'):
            self.log_result(
                "Transaction History Analysis", 
                False, 
                "No user_id available for transaction analysis"
            )
            return False
        
        user_id = self.analysis_results['user_info']['user_id']
        
        transaction_query_script = f'''
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

async function analyzeTransactionHistory() {{
  try {{
    await sequelize.authenticate();
    
    // Query transaction count
    const transactionCount = await sequelize.query(
      `SELECT COUNT(*) as transaction_count
       FROM tbl_merchant_pool_transaction 
       WHERE owner_user_id = {user_id}`,
      {{ type: QueryTypes.SELECT }}
    );
    
    // Query sweep count
    const sweepCount = await sequelize.query(
      `SELECT COUNT(*) as sweep_count
       FROM tbl_merchant_pool_sweep 
       WHERE owner_user_id = {user_id}`,
      {{ type: QueryTypes.SELECT }}
    );
    
    // Get recent transactions if any
    const recentTransactions = await sequelize.query(
      `SELECT transaction_id, wallet_type, amount_usd, status, created_at
       FROM tbl_merchant_pool_transaction 
       WHERE owner_user_id = {user_id}
       ORDER BY created_at DESC
       LIMIT 5`,
      {{ type: QueryTypes.SELECT }}
    );
    
    // Get recent sweeps if any
    const recentSweeps = await sequelize.query(
      `SELECT sweep_id, wallet_type, total_amount_usd, status, created_at
       FROM tbl_merchant_pool_sweep 
       WHERE owner_user_id = {user_id}
       ORDER BY created_at DESC
       LIMIT 3`,
      {{ type: QueryTypes.SELECT }}
    );
    
    console.log(JSON.stringify({{
      transaction_count: transactionCount[0]?.transaction_count || 0,
      sweep_count: sweepCount[0]?.sweep_count || 0,
      recent_transactions: recentTransactions,
      recent_sweeps: recentSweeps
    }}, null, 2));
    
    process.exit(0);
    
  }} catch (error) {{
    console.error('Transaction history query failed:', error.message);
    process.exit(1);
  }}
}}

analyzeTransactionHistory();
'''
        
        try:
            # Write and run transaction history query script
            with open('/tmp/transaction_query.js', 'w') as f:
                f.write(transaction_query_script)
            
            result = subprocess.run(
                ["node", "/tmp/transaction_query.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    transaction_data = json.loads(result.stdout)
                    
                    transaction_count = transaction_data.get('transaction_count', 0)
                    sweep_count = transaction_data.get('sweep_count', 0)
                    recent_transactions = transaction_data.get('recent_transactions', [])
                    recent_sweeps = transaction_data.get('recent_sweeps', [])
                    
                    self.analysis_results['transaction_count'] = transaction_count
                    self.analysis_results['sweep_count'] = sweep_count
                    
                    self.log_result(
                        "Transaction History", 
                        True, 
                        f"Found {transaction_count} transactions and {sweep_count} sweeps",
                        {
                            "transaction_count": transaction_count,
                            "sweep_count": sweep_count,
                            "has_recent_activity": len(recent_transactions) > 0 or len(recent_sweeps) > 0
                        }
                    )
                    
                    if recent_transactions:
                        self.log_result(
                            "Recent Transactions", 
                            True, 
                            f"Found {len(recent_transactions)} recent transactions",
                            {"recent_transactions": recent_transactions}
                        )
                    
                    if recent_sweeps:
                        self.log_result(
                            "Recent Sweeps", 
                            True, 
                            f"Found {len(recent_sweeps)} recent sweeps",
                            {"recent_sweeps": recent_sweeps}
                        )
                    
                    return True
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Transaction History Analysis", 
                        False, 
                        "Failed to parse transaction history query results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
                    return False
            else:
                self.log_result(
                    "Transaction History Analysis", 
                    False, 
                    "Transaction history query script failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Transaction History Analysis", 
                False, 
                f"Transaction history analysis failed: {str(e)}"
            )
            return False
    
    def determine_initialization_status(self):
        """Step 5: Determine Overall Initialization Status"""
        print("\n=== Step 5: Overall Initialization Status ===")
        
        merchant_wallets = self.analysis_results.get('merchant_wallets', [])
        pool_addresses = self.analysis_results.get('pool_addresses', {}).get('total_addresses', 0)
        transaction_count = self.analysis_results.get('transaction_count', 0)
        
        if len(merchant_wallets) == 0 and pool_addresses == 0:
            self.analysis_results['initialization_status'] = 'not_initialized'
            status_message = "Lazy initialization NOT triggered - No xpub wallets or pool addresses created"
            recommendation = "Wallets are created on-demand when first crypto payment is requested. To trigger initialization, create a payment link with CRYPTO mode."
        elif len(merchant_wallets) > 0 and pool_addresses >= 2:
            self.analysis_results['initialization_status'] = 'fully_initialized'
            status_message = f"Fully initialized - {len(merchant_wallets)} xpub wallets with {pool_addresses} pool addresses"
            recommendation = "System is properly initialized and ready for crypto payments. Pool health is good."
        elif len(merchant_wallets) > 0 and pool_addresses < 2:
            self.analysis_results['initialization_status'] = 'partially_initialized'
            status_message = f"Partially initialized - {len(merchant_wallets)} xpub wallets but only {pool_addresses} pool addresses (expected ≥2 per chain)"
            recommendation = "Pool addresses may need replenishment. Check pool management system."
        else:
            self.analysis_results['initialization_status'] = 'inconsistent'
            status_message = f"Inconsistent state - {pool_addresses} pool addresses but {len(merchant_wallets)} xpub wallets"
            recommendation = "Data inconsistency detected. Review merchant pool system configuration."
        
        self.log_result(
            "Initialization Status", 
            True, 
            status_message,
            {
                "status": self.analysis_results['initialization_status'],
                "merchant_wallets": len(merchant_wallets),
                "pool_addresses": pool_addresses,
                "transaction_count": transaction_count,
                "recommendation": recommendation
            }
        )
        
        return True
    
    def generate_comprehensive_report(self):
        """Generate the final comprehensive report"""
        print("\n" + "="*80)
        print("XPUB ANALYSIS REPORT FOR john@dyno.pt")
        print("="*80)
        
        # 1. User Information
        user_info = self.analysis_results.get('user_info', {})
        print(f"\n1. USER INFORMATION")
        print(f"   - User ID: {user_info.get('user_id', 'Not found')}")
        print(f"   - Email: {user_info.get('email', 'Not found')}")
        print(f"   - Name: {user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip() or 'Not available')
        
        # 2. Merchant Wallet Status
        merchant_wallets = self.analysis_results.get('merchant_wallets', [])
        print(f"\n2. MERCHANT WALLET STATUS")
        print(f"   - Total wallets created: {len(merchant_wallets)}")
        
        if merchant_wallets:
            print(f"   - Wallet types: {', '.join([w['wallet_type'] for w in merchant_wallets])}")
            for wallet in merchant_wallets:
                print(f"     * {wallet['wallet_type']}: XPUB length {wallet['xpub_length']}, derivation index {wallet['last_derivation_index']}")
        else:
            print(f"   - No merchant wallets found")
        
        # 3. Pool Address Status
        pool_data = self.analysis_results.get('pool_addresses', {})
        total_addresses = pool_data.get('total_addresses', 0)
        addresses_by_type = pool_data.get('addresses_by_type', [])
        status_distribution = pool_data.get('status_distribution', {})
        
        print(f"\n3. POOL ADDRESS STATUS")
        print(f"   - Total addresses: {total_addresses}")
        
        if addresses_by_type:
            print(f"   - Breakdown by wallet type:")
            for addr_type in addresses_by_type:
                print(f"     * {addr_type['wallet_type']}: {addr_type['count']} addresses")
            
            if status_distribution:
                print(f"   - Status distribution:")
                for status, count in status_distribution.items():
                    print(f"     * {status}: {count} addresses")
        else:
            print(f"   - No pool addresses found")
        
        # 4. Activity Summary
        transaction_count = self.analysis_results.get('transaction_count', 0)
        sweep_count = self.analysis_results.get('sweep_count', 0)
        
        print(f"\n4. ACTIVITY SUMMARY")
        print(f"   - Total transactions: {transaction_count}")
        print(f"   - Total sweeps: {sweep_count}")
        print(f"   - Overall status: {self.analysis_results.get('initialization_status', 'unknown')}")
        
        # 5. Recommendation
        print(f"\n5. RECOMMENDATION")
        status = self.analysis_results.get('initialization_status', 'unknown')
        
        if status == 'not_initialized':
            print(f"   - Status: Lazy initialization NOT triggered")
            print(f"   - Action: Create a payment link with CRYPTO mode to trigger wallet creation")
            print(f"   - Expected result: System will create xpub wallets and initial pool addresses")
        elif status == 'fully_initialized':
            print(f"   - Status: System is fully initialized and operational")
            print(f"   - Pool health: Good ({total_addresses} addresses available)")
            print(f"   - Action: No action required - system ready for production use")
        elif status == 'partially_initialized':
            print(f"   - Status: Wallets created but pool may need attention")
            print(f"   - Action: Check pool management system for address replenishment")
            print(f"   - Expected: Each chain should have ≥2 pool addresses")
        else:
            print(f"   - Status: Inconsistent state detected")
            print(f"   - Action: Review merchant pool system configuration")
            print(f"   - Investigation: Check for data integrity issues")
        
        print(f"\n" + "="*80)
        print("END OF XPUB ANALYSIS REPORT")
        print("="*80)
    
    def run_complete_analysis(self):
        """Run the complete XPUB analysis"""
        print("🔍 Starting XPUB Analysis for john@dyno.pt")
        print("="*60)
        
        # Step 1: User Verification
        if not self.analyze_user_verification():
            print("❌ Cannot proceed without user verification")
            return False
        
        # Step 2: Merchant Wallet Analysis
        self.analyze_merchant_wallets()
        
        # Step 3: Pool Address Analysis
        self.analyze_pool_addresses()
        
        # Step 4: Transaction History
        self.analyze_transaction_history()
        
        # Step 5: Determine Status
        self.determine_initialization_status()
        
        # Generate comprehensive report
        self.generate_comprehensive_report()
        
        # Summary
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        
        print(f"\n📊 ANALYSIS SUMMARY")
        print(f"   - Tests completed: {total_tests}")
        print(f"   - Tests passed: {passed_tests}")
        print(f"   - Success rate: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "N/A")
        
        if self.errors:
            print(f"\n❌ ERRORS ENCOUNTERED:")
            for error in self.errors:
                print(f"   - {error}")
        
        return passed_tests == total_tests

def main():
    """Main execution function"""
    tester = XPubAnalysisTester()
    
    try:
        success = tester.run_complete_analysis()
        
        if success:
            print(f"\n✅ XPUB Analysis completed successfully!")
            sys.exit(0)
        else:
            print(f"\n❌ XPUB Analysis completed with errors")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print(f"\n⚠️  Analysis interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Analysis failed with exception: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()