#!/usr/bin/env python3
"""
Database Wallet Company ID Check
Specific test to check company_id values in tbl_user_wallet for user_id 4
"""

import os
import sys
import json
import subprocess
import time
from typing import Dict, List, Any

class DatabaseWalletChecker:
    def __init__(self):
        self.test_results = {}
        self.errors = []
        
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
    
    def check_user_wallet_company_id_values(self):
        """Check company_id values in tbl_user_wallet for user_id 4"""
        print("\n=== Checking User Wallet Company ID Values ===")
        
        # Create Node.js script to run the SQL queries
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

async function checkWalletCompanyIds() {
  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully.");
    
    // Query 1: Check specific wallets for user_id 4
    const walletQuery = `
      SELECT wallet_id, user_id, company_id, wallet_type, 
             LEFT(wallet_address, 15) as address_sample,
             wallet_name
      FROM tbl_user_wallet
      WHERE user_id = 4 AND wallet_type IN ('USDT-TRC20', 'BTC', 'ETH')
      ORDER BY wallet_type
    `;
    
    const walletResults = await sequelize.query(walletQuery, { type: QueryTypes.SELECT });
    
    // Query 2: Check company_id distribution for user_id 4
    const companyDistQuery = `
      SELECT DISTINCT company_id, COUNT(*) as wallet_count
      FROM tbl_user_wallet  
      WHERE user_id = 4
      GROUP BY company_id
    `;
    
    const companyDistResults = await sequelize.query(companyDistQuery, { type: QueryTypes.SELECT });
    
    // Query 3: Check if user_id 4 exists at all
    const userExistsQuery = `
      SELECT COUNT(*) as total_wallets
      FROM tbl_user_wallet  
      WHERE user_id = 4
    `;
    
    const userExistsResults = await sequelize.query(userExistsQuery, { type: QueryTypes.SELECT });
    
    // Query 4: Get sample of all users to understand data structure
    const sampleUsersQuery = `
      SELECT DISTINCT user_id, COUNT(*) as wallet_count
      FROM tbl_user_wallet  
      GROUP BY user_id
      ORDER BY user_id
      LIMIT 10
    `;
    
    const sampleUsersResults = await sequelize.query(sampleUsersQuery, { type: QueryTypes.SELECT });
    
    // Query 5: Check company_id values across all users
    const allCompanyIdsQuery = `
      SELECT DISTINCT company_id, COUNT(*) as wallet_count
      FROM tbl_user_wallet  
      GROUP BY company_id
      ORDER BY company_id
    `;
    
    const allCompanyIdsResults = await sequelize.query(allCompanyIdsQuery, { type: QueryTypes.SELECT });
    
    const results = {
      user_4_wallets: walletResults,
      user_4_company_distribution: companyDistResults,
      user_4_total_wallets: userExistsResults[0]?.total_wallets || 0,
      sample_users: sampleUsersResults,
      all_company_ids: allCompanyIdsResults,
      queries_executed: {
        wallet_query: walletQuery,
        company_dist_query: companyDistQuery,
        user_exists_query: userExistsQuery,
        sample_users_query: sampleUsersQuery,
        all_company_ids_query: allCompanyIdsQuery
      }
    };
    
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
    
  } catch (error) {
    console.error('Database query failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

checkWalletCompanyIds();
'''
        
        try:
            # Write query script to temporary file
            with open('/tmp/check_wallet_company_ids.js', 'w') as f:
                f.write(query_script)
            
            # Run the query script
            result = subprocess.run(
                ["node", "/tmp/check_wallet_company_ids.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    query_results = json.loads(result.stdout)
                    self.analyze_wallet_company_id_results(query_results)
                    return True
                except json.JSONDecodeError:
                    self.log_result(
                        "Database Query - Parse Results", 
                        False, 
                        "Failed to parse query results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
                    return False
            else:
                self.log_result(
                    "Database Query - Execution", 
                    False, 
                    "Database query script failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Database Query - Setup", 
                False, 
                f"Query setup failed: {str(e)}"
            )
            return False
    
    def analyze_wallet_company_id_results(self, results: Dict):
        """Analyze the wallet company_id query results"""
        
        # Check if user_id 4 exists
        total_wallets = results.get('user_4_total_wallets', 0)
        
        if total_wallets == 0:
            self.log_result(
                "User ID 4 - Existence Check", 
                False, 
                "User ID 4 has no wallets in tbl_user_wallet table",
                {"total_wallets": total_wallets}
            )
            
            # Show sample users for context
            sample_users = results.get('sample_users', [])
            if sample_users:
                self.log_result(
                    "Sample Users - Available", 
                    True, 
                    f"Found {len(sample_users)} users with wallets",
                    {"sample_users": sample_users}
                )
            
            return
        
        # Analyze user_id 4 specific wallets
        user_4_wallets = results.get('user_4_wallets', [])
        
        if user_4_wallets:
            self.log_result(
                "User ID 4 - Specific Wallets Found", 
                True, 
                f"Found {len(user_4_wallets)} wallets for user_id 4 with specified types",
                {"wallet_count": len(user_4_wallets)}
            )
            
            # Analyze each wallet
            for i, wallet in enumerate(user_4_wallets):
                wallet_info = {
                    "wallet_id": wallet.get('wallet_id'),
                    "wallet_type": wallet.get('wallet_type'),
                    "company_id": wallet.get('company_id'),
                    "address_sample": wallet.get('address_sample'),
                    "wallet_name": wallet.get('wallet_name')
                }
                
                self.log_result(
                    f"User ID 4 - Wallet {i+1} ({wallet.get('wallet_type')})", 
                    True, 
                    f"Wallet details retrieved",
                    wallet_info
                )
        else:
            self.log_result(
                "User ID 4 - Specific Wallets", 
                False, 
                "No wallets found for user_id 4 with types USDT-TRC20, BTC, ETH",
                {"total_wallets": total_wallets}
            )
        
        # Analyze company_id distribution for user_id 4
        company_dist = results.get('user_4_company_distribution', [])
        
        if company_dist:
            self.log_result(
                "User ID 4 - Company ID Distribution", 
                True, 
                f"Found {len(company_dist)} distinct company_id values",
                {"distribution": company_dist}
            )
            
            # Check for NULL company_id values
            null_company_count = 0
            for dist in company_dist:
                if dist.get('company_id') is None:
                    null_company_count = dist.get('wallet_count', 0)
                    break
            
            if null_company_count > 0:
                self.log_result(
                    "User ID 4 - NULL Company IDs", 
                    True, 
                    f"Found {null_company_count} wallets with company_id = NULL",
                    {"null_company_wallets": null_company_count}
                )
        else:
            self.log_result(
                "User ID 4 - Company ID Distribution", 
                False, 
                "No company_id distribution data found",
                {}
            )
        
        # Show overall company_id distribution across all users
        all_company_ids = results.get('all_company_ids', [])
        
        if all_company_ids:
            self.log_result(
                "All Users - Company ID Distribution", 
                True, 
                f"Found {len(all_company_ids)} distinct company_id values across all users",
                {"all_company_distribution": all_company_ids}
            )
        
        # Summary analysis
        self.provide_validation_analysis(results)
    
    def provide_validation_analysis(self, results: Dict):
        """Provide analysis of why validation might be failing"""
        
        user_4_wallets = results.get('user_4_wallets', [])
        company_dist = results.get('user_4_company_distribution', [])
        
        # Check if Redis is expecting company_id=1 but wallets have different values
        company_id_1_wallets = 0
        null_company_id_wallets = 0
        other_company_id_wallets = 0
        
        for wallet in user_4_wallets:
            company_id = wallet.get('company_id')
            if company_id == 1:
                company_id_1_wallets += 1
            elif company_id is None:
                null_company_id_wallets += 1
            else:
                other_company_id_wallets += 1
        
        analysis_message = []
        
        if company_id_1_wallets == 0:
            analysis_message.append("❌ NO WALLETS with company_id=1 found for user_id 4")
        else:
            analysis_message.append(f"✅ {company_id_1_wallets} wallets with company_id=1 found")
        
        if null_company_id_wallets > 0:
            analysis_message.append(f"⚠️  {null_company_id_wallets} wallets with company_id=NULL found")
        
        if other_company_id_wallets > 0:
            analysis_message.append(f"ℹ️  {other_company_id_wallets} wallets with other company_id values found")
        
        validation_issue = "LIKELY CAUSE: " if company_id_1_wallets == 0 else "VALIDATION STATUS: "
        
        if company_id_1_wallets == 0 and null_company_id_wallets > 0:
            validation_issue += "Redis payload sets company_id=1 but user's wallets have company_id=NULL, causing validation mismatch"
        elif company_id_1_wallets == 0 and other_company_id_wallets > 0:
            validation_issue += "Redis payload sets company_id=1 but user's wallets have different company_id values"
        elif company_id_1_wallets > 0:
            validation_issue += "User has wallets with company_id=1, validation should pass"
        else:
            validation_issue += "User has no wallets, validation will fail"
        
        self.log_result(
            "Validation Analysis", 
            company_id_1_wallets > 0, 
            validation_issue,
            {
                "company_id_1_wallets": company_id_1_wallets,
                "null_company_id_wallets": null_company_id_wallets,
                "other_company_id_wallets": other_company_id_wallets,
                "analysis": analysis_message
            }
        )
    
    def run_all_checks(self):
        """Run all database checks"""
        print("🔍 DynoPay Database Wallet Company ID Checker")
        print("=" * 60)
        
        success = self.check_user_wallet_company_id_values()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        
        if self.errors:
            print(f"\n❌ ERRORS ({len(self.errors)}):")
            for error in self.errors:
                print(f"  - {error}")
        
        if failed_tests == 0:
            print("\n✅ All database checks completed successfully!")
        else:
            print(f"\n⚠️  {failed_tests} checks failed - see details above")
        
        return failed_tests == 0

if __name__ == "__main__":
    checker = DatabaseWalletChecker()
    success = checker.run_all_checks()
    sys.exit(0 if success else 1)