#!/usr/bin/env python3
"""
DynoPay Pool Address Creation Analysis for john@dyno.pt
Comprehensive analysis to determine WHEN and HOW pool addresses were created.

This test analyzes:
1. Pool address creation timestamps
2. Merchant wallet (xpub) creation timestamps  
3. Regular wallet configuration timestamps
4. Transaction timeline correlation
5. Conclusion: Pre-created vs On-demand creation
"""

import os
import sys
import json
import subprocess
import time
import requests
from typing import Dict, List, Any
from datetime import datetime

class PoolAddressAnalyzer:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.analysis_data = {}
        
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
        
        # Credentials for john@dyno.pt (user_id: 28)
        credentials = {
            "email": "john@dyno.pt",
            "password": "Katiekendra123@"  # Correct password from existing tests
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json=credentials,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    self.jwt_token = data['data']['accessToken']
                    user_info = data['data'].get('user', {})
                    
                    self.log_result(
                        "Authentication", 
                        True, 
                        f"Successfully authenticated john@dyno.pt (user_id: {user_info.get('user_id')})",
                        {
                            "user_id": user_info.get('user_id'),
                            "name": user_info.get('name'),
                            "email": user_info.get('email')
                        }
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
    
    def run_database_query(self, query_name: str, sql_query: str):
        """Execute SQL query against the database"""
        print(f"\n--- Running {query_name} ---")
        
        # Create Node.js script to execute the query
        query_script = f'''
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

async function executeQuery() {{
  try {{
    await sequelize.authenticate();
    
    const results = await sequelize.query(`{sql_query}`, {{
      type: QueryTypes.SELECT
    }});
    
    console.log(JSON.stringify({{
      success: true,
      query_name: "{query_name}",
      row_count: results.length,
      data: results
    }}, null, 2));
    
    process.exit(0);
    
  }} catch (error) {{
    console.log(JSON.stringify({{
      success: false,
      query_name: "{query_name}",
      error: error.message
    }}, null, 2));
    process.exit(1);
  }}
}}

executeQuery();
'''
        
        try:
            # Write query script to temporary file
            script_path = f'/tmp/query_{query_name.lower().replace(" ", "_")}.js'
            with open(script_path, 'w') as f:
                f.write(query_script)
            
            # Run the query script
            result = subprocess.run(
                ["node", script_path],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    query_data = json.loads(result.stdout)
                    if query_data.get('success'):
                        self.analysis_data[query_name] = query_data['data']
                        self.log_result(
                            f"Database Query - {query_name}", 
                            True, 
                            f"Retrieved {query_data['row_count']} rows",
                            {"row_count": query_data['row_count']}
                        )
                        return query_data['data']
                    else:
                        self.log_result(
                            f"Database Query - {query_name}", 
                            False, 
                            f"Query failed: {query_data.get('error', 'Unknown error')}",
                            {"error": query_data.get('error')}
                        )
                        return None
                except json.JSONDecodeError:
                    self.log_result(
                        f"Database Query - {query_name}", 
                        False, 
                        "Failed to parse query results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
                    return None
            else:
                self.log_result(
                    f"Database Query - {query_name}", 
                    False, 
                    "Query script failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                return None
                
        except Exception as e:
            self.log_result(
                f"Database Query - {query_name}", 
                False, 
                f"Query execution failed: {str(e)}"
            )
            return None
    
    def analyze_pool_addresses(self):
        """Query 1: Check Pool Address Creation Timestamps"""
        sql_query = """
        SELECT 
          temp_address_id,
          owner_user_id,
          wallet_type,
          wallet_address,
          derivation_index,
          status,
          total_transactions,
          created_at,
          updated_at
        FROM tbl_merchant_temp_address 
        WHERE owner_user_id = 28
        ORDER BY created_at ASC
        """
        
        return self.run_database_query("Pool Address Creation", sql_query)
    
    def analyze_merchant_wallets(self):
        """Query 2: Check Merchant Wallet (xpub) Creation Timestamps"""
        sql_query = """
        SELECT 
          wallet_id,
          user_id,
          wallet_type,
          last_derivation_index,
          created_at,
          updated_at
        FROM tbl_merchant_wallet 
        WHERE user_id = 28
        ORDER BY created_at ASC
        """
        
        return self.run_database_query("Merchant Wallet Creation", sql_query)
    
    def analyze_user_wallets(self):
        """Query 3: Check User's Configured Wallets (Regular Wallet Table)"""
        sql_query = """
        SELECT 
          wallet_id,
          user_id,
          wallet_type,
          created_at
        FROM tbl_user_wallet
        WHERE user_id = 28
        ORDER BY created_at ASC
        """
        
        return self.run_database_query("User Wallet Configuration", sql_query)
    
    def analyze_pool_transactions(self):
        """Query 4: Check Pool Transaction History with Timestamps"""
        sql_query = """
        SELECT 
          pool_tx_id,
          temp_address_id,
          wallet_type,
          payment_amount,
          status,
          created_at
        FROM tbl_merchant_pool_transaction 
        WHERE owner_user_id = 28
        ORDER BY created_at ASC
        """
        
        return self.run_database_query("Pool Transaction History", sql_query)
    
    def analyze_timeline_correlation(self):
        """Analyze the timeline correlation between different creation events"""
        print("\n=== Timeline Correlation Analysis ===")
        
        pool_addresses = self.analysis_data.get("Pool Address Creation", [])
        merchant_wallets = self.analysis_data.get("Merchant Wallet Creation", [])
        user_wallets = self.analysis_data.get("User Wallet Configuration", [])
        pool_transactions = self.analysis_data.get("Pool Transaction History", [])
        
        if not pool_addresses:
            self.log_result(
                "Timeline Analysis", 
                False, 
                "No pool addresses found for user_id 28"
            )
            return
        
        # Parse timestamps and analyze patterns
        try:
            # Convert timestamps to datetime objects for analysis
            pool_times = []
            for addr in pool_addresses:
                if addr.get('created_at'):
                    pool_times.append({
                        'timestamp': datetime.fromisoformat(addr['created_at'].replace('Z', '+00:00')),
                        'wallet_type': addr.get('wallet_type'),
                        'address_id': addr.get('temp_address_id')
                    })
            
            merchant_wallet_times = []
            for wallet in merchant_wallets:
                if wallet.get('created_at'):
                    merchant_wallet_times.append({
                        'timestamp': datetime.fromisoformat(wallet['created_at'].replace('Z', '+00:00')),
                        'wallet_type': wallet.get('wallet_type'),
                        'wallet_id': wallet.get('wallet_id')
                    })
            
            transaction_times = []
            for tx in pool_transactions:
                if tx.get('created_at'):
                    transaction_times.append({
                        'timestamp': datetime.fromisoformat(tx['created_at'].replace('Z', '+00:00')),
                        'wallet_type': tx.get('wallet_type'),
                        'tx_id': tx.get('pool_tx_id')
                    })
            
            # Sort all events by timestamp
            pool_times.sort(key=lambda x: x['timestamp'])
            merchant_wallet_times.sort(key=lambda x: x['timestamp'])
            transaction_times.sort(key=lambda x: x['timestamp'])
            
            # Analyze creation patterns
            self.analyze_creation_patterns(pool_times, merchant_wallet_times, transaction_times)
            
        except Exception as e:
            self.log_result(
                "Timeline Analysis", 
                False, 
                f"Timeline analysis failed: {str(e)}"
            )
    
    def analyze_creation_patterns(self, pool_times, merchant_wallet_times, transaction_times):
        """Analyze creation patterns to determine pre-created vs on-demand"""
        print("\n--- Creation Pattern Analysis ---")
        
        if not pool_times:
            self.log_result(
                "Creation Pattern Analysis", 
                False, 
                "No pool address timestamps to analyze"
            )
            return
        
        # Check if pool addresses were created all at once (pre-initialized)
        first_pool_time = pool_times[0]['timestamp']
        last_pool_time = pool_times[-1]['timestamp']
        time_span = (last_pool_time - first_pool_time).total_seconds()
        
        # Group addresses by wallet type to see creation patterns
        wallet_type_groups = {}
        for addr in pool_times:
            wallet_type = addr['wallet_type']
            if wallet_type not in wallet_type_groups:
                wallet_type_groups[wallet_type] = []
            wallet_type_groups[wallet_type].append(addr['timestamp'])
        
        # Analyze if addresses were created in bulk or individually
        bulk_creation = time_span < 300  # Less than 5 minutes = bulk creation
        
        # Check correlation with merchant wallet creation
        merchant_wallet_correlation = False
        if merchant_wallet_times:
            first_merchant_time = merchant_wallet_times[0]['timestamp']
            time_diff_to_merchant = abs((first_pool_time - first_merchant_time).total_seconds())
            merchant_wallet_correlation = time_diff_to_merchant < 3600  # Within 1 hour
        
        # Check correlation with transactions
        transaction_correlation = False
        if transaction_times:
            first_tx_time = transaction_times[0]['timestamp']
            time_diff_to_tx = (first_tx_time - first_pool_time).total_seconds()
            transaction_correlation = time_diff_to_tx > 0  # Transactions came after addresses
        
        # Determine creation method
        if bulk_creation and merchant_wallet_correlation and transaction_correlation:
            creation_method = "PRE-INITIALIZED"
            conclusion = "Pool addresses were pre-created during wallet configuration (initializeMerchantPool)"
        elif not bulk_creation and len(wallet_type_groups) > 1:
            creation_method = "LAZY/ON-DEMAND"
            conclusion = "Pool addresses were created lazily when payment requests were made (reserveAddress)"
        else:
            creation_method = "MIXED/UNCLEAR"
            conclusion = "Creation pattern is unclear - may be a mix of pre-initialization and lazy creation"
        
        # Detailed timeline analysis
        timeline_details = {
            "total_pool_addresses": len(pool_times),
            "creation_time_span_seconds": time_span,
            "creation_time_span_minutes": round(time_span / 60, 2),
            "wallet_types": list(wallet_type_groups.keys()),
            "addresses_per_type": {wt: len(times) for wt, times in wallet_type_groups.items()},
            "first_address_created": first_pool_time.isoformat(),
            "last_address_created": last_pool_time.isoformat(),
            "merchant_wallets_count": len(merchant_wallet_times),
            "transactions_count": len(transaction_times),
            "bulk_creation": bulk_creation,
            "merchant_wallet_correlation": merchant_wallet_correlation,
            "transaction_correlation": transaction_correlation,
            "creation_method": creation_method
        }
        
        self.log_result(
            "Creation Pattern Analysis", 
            True, 
            f"CONCLUSION: {conclusion}",
            timeline_details
        )
        
        # Store conclusion for final report
        self.analysis_data["conclusion"] = {
            "method": creation_method,
            "explanation": conclusion,
            "evidence": timeline_details
        }
    
    def generate_detailed_timeline_report(self):
        """Generate a comprehensive timeline report"""
        print("\n=== DETAILED TIMELINE REPORT ===")
        
        pool_addresses = self.analysis_data.get("Pool Address Creation", [])
        merchant_wallets = self.analysis_data.get("Merchant Wallet Creation", [])
        user_wallets = self.analysis_data.get("User Wallet Configuration", [])
        pool_transactions = self.analysis_data.get("Pool Transaction History", [])
        conclusion = self.analysis_data.get("conclusion", {})
        
        # Create chronological timeline
        all_events = []
        
        # Add pool address events
        for addr in pool_addresses:
            all_events.append({
                'timestamp': addr.get('created_at'),
                'type': 'POOL_ADDRESS_CREATED',
                'details': f"Pool address for {addr.get('wallet_type')} (ID: {addr.get('temp_address_id')})"
            })
        
        # Add merchant wallet events
        for wallet in merchant_wallets:
            all_events.append({
                'timestamp': wallet.get('created_at'),
                'type': 'MERCHANT_WALLET_CREATED',
                'details': f"Merchant wallet for {wallet.get('wallet_type')} (ID: {wallet.get('wallet_id')})"
            })
        
        # Add user wallet events
        for wallet in user_wallets:
            all_events.append({
                'timestamp': wallet.get('created_at'),
                'type': 'USER_WALLET_CONFIGURED',
                'details': f"User wallet for {wallet.get('wallet_type')} (ID: {wallet.get('wallet_id')})"
            })
        
        # Add transaction events
        for tx in pool_transactions:
            all_events.append({
                'timestamp': tx.get('created_at'),
                'type': 'POOL_TRANSACTION',
                'details': f"Transaction for {tx.get('wallet_type')} - {tx.get('payment_amount')} ({tx.get('status')})"
            })
        
        # Sort by timestamp
        all_events.sort(key=lambda x: x['timestamp'] if x['timestamp'] else '1970-01-01')
        
        # Generate report
        report = {
            "user_analysis": "john@dyno.pt (user_id: 28)",
            "total_events": len(all_events),
            "chronological_timeline": all_events[:20],  # First 20 events
            "summary_counts": {
                "pool_addresses": len(pool_addresses),
                "merchant_wallets": len(merchant_wallets),
                "user_wallets": len(user_wallets),
                "pool_transactions": len(pool_transactions)
            },
            "conclusion": conclusion
        }
        
        self.log_result(
            "Detailed Timeline Report", 
            True, 
            f"Generated comprehensive timeline with {len(all_events)} events",
            report
        )
        
        return report
    
    def run_comprehensive_analysis(self):
        """Run the complete pool address creation analysis"""
        print("=" * 80)
        print("DYNOPAY POOL ADDRESS CREATION ANALYSIS FOR john@dyno.pt")
        print("Determining WHEN and HOW pool addresses were created")
        print("=" * 80)
        
        # Step 1: Authenticate
        if not self.authenticate_user():
            print("❌ CRITICAL: Authentication failed - cannot proceed with analysis")
            return False
        
        # Step 2: Run database queries
        print("\n🔍 EXECUTING DATABASE QUERIES...")
        self.analyze_pool_addresses()
        self.analyze_merchant_wallets()
        self.analyze_user_wallets()
        self.analyze_pool_transactions()
        
        # Step 3: Analyze timeline correlation
        print("\n📊 ANALYZING TIMELINE CORRELATION...")
        self.analyze_timeline_correlation()
        
        # Step 4: Generate detailed report
        print("\n📋 GENERATING DETAILED REPORT...")
        report = self.generate_detailed_timeline_report()
        
        # Step 5: Print final summary
        self.print_final_summary()
        
        return True
    
    def print_final_summary(self):
        """Print final analysis summary"""
        print("\n" + "=" * 80)
        print("FINAL ANALYSIS SUMMARY")
        print("=" * 80)
        
        conclusion = self.analysis_data.get("conclusion", {})
        
        if conclusion:
            print(f"🎯 CREATION METHOD: {conclusion.get('method', 'UNKNOWN')}")
            print(f"📝 EXPLANATION: {conclusion.get('explanation', 'No conclusion available')}")
            
            evidence = conclusion.get('evidence', {})
            if evidence:
                print(f"\n📈 KEY EVIDENCE:")
                print(f"   • Total Pool Addresses: {evidence.get('total_pool_addresses', 0)}")
                print(f"   • Creation Time Span: {evidence.get('creation_time_span_minutes', 0)} minutes")
                print(f"   • Wallet Types: {', '.join(evidence.get('wallet_types', []))}")
                print(f"   • Bulk Creation: {'Yes' if evidence.get('bulk_creation') else 'No'}")
                print(f"   • Merchant Wallet Correlation: {'Yes' if evidence.get('merchant_wallet_correlation') else 'No'}")
                print(f"   • Transaction Correlation: {'Yes' if evidence.get('transaction_correlation') else 'No'}")
        else:
            print("❌ No conclusion could be determined from the analysis")
        
        # Print test results summary
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        
        print(f"\n📊 TEST RESULTS: {passed_tests}/{total_tests} tests passed")
        
        if self.errors:
            print(f"\n❌ ERRORS ENCOUNTERED:")
            for error in self.errors:
                print(f"   • {error}")
        
        print("=" * 80)

def main():
    """Main execution function"""
    analyzer = PoolAddressAnalyzer()
    
    try:
        success = analyzer.run_comprehensive_analysis()
        
        if success:
            print("\n✅ Pool address creation analysis completed successfully!")
            sys.exit(0)
        else:
            print("\n❌ Pool address creation analysis failed!")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Analysis interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error during analysis: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()