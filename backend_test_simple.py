#!/usr/bin/env python3
"""
DynoPay Backend Database Schema Testing - Simplified Version
Tests Phase 1 Database Schema Updates for PostgreSQL database
"""

import subprocess
import requests
import json

def test_backend_connectivity():
    """Test backend server connectivity"""
    try:
        response = requests.get("http://localhost:8001/", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print("✅ Backend Server: Connected successfully")
            print(f"   Response: {data}")
            return True
        else:
            print(f"❌ Backend Server: Status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend Server: Connection failed - {str(e)}")
        return False

def test_database_migration():
    """Test database migration"""
    try:
        result = subprocess.run(
            ["npx", "ts-node", "--transpile-only", "database/migrate.ts"],
            cwd="/app/backend",
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            print("✅ Database Migration: Completed successfully")
            return True
        else:
            print(f"❌ Database Migration: Failed with return code {result.returncode}")
            print(f"   Error: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Database Migration: Failed - {str(e)}")
        return False

def verify_database_schema():
    """Verify all database schema changes"""
    
    verification_script = '''
const { Sequelize, QueryTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.USER_NAME,
  process.env.PASSWORD,
  {
    host: process.env.HOST,
    port: Number(process.env.DB_PORT),
    dialect: 'postgres',
    logging: false
  }
);

async function verify() {
  try {
    await sequelize.authenticate();
    
    const results = {
      new_tables: {},
      modified_tables: {}
    };
    
    // Check new tables
    const newTables = ['tbl_tax_rate', 'tbl_invoice', 'tbl_notification', 'tbl_notification_preferences', 'tbl_kyc'];
    
    for (const tableName of newTables) {
      const columns = await sequelize.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${tableName}' ORDER BY ordinal_position`,
        { type: QueryTypes.SELECT }
      );
      
      results.new_tables[tableName] = {
        exists: columns.length > 0,
        column_count: columns.length,
        columns: columns.map(col => `${col.column_name} (${col.data_type})`)
      };
    }
    
    // Check modified tables for new columns
    const modifiedTables = {
      'tbl_company': ['address_line1', 'address_line2', 'city', 'state', 'country', 'zip_code', 'vat_number', 'vat_type', 'vat_verified'],
      'tbl_api': ['api_name'],
      'tbl_user_wallet': ['company_id', 'wallet_name'],
      'tbl_user_addresses': ['company_id', 'wallet_name']
    };
    
    for (const [tableName, expectedColumns] of Object.entries(modifiedTables)) {
      const columns = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}'`,
        { type: QueryTypes.SELECT }
      );
      
      const columnNames = columns.map(col => col.column_name);
      const missingColumns = expectedColumns.filter(col => !columnNames.includes(col));
      
      results.modified_tables[tableName] = {
        exists: columns.length > 0,
        expected_columns: expectedColumns,
        missing_columns: missingColumns,
        all_present: missingColumns.length === 0
      };
    }
    
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
    
  } catch (error) {
    console.error('Verification failed:', error.message);
    process.exit(1);
  }
}

verify();
'''
    
    try:
        # Write verification script
        with open('/tmp/verify_schema.js', 'w') as f:
            f.write(verification_script)
        
        # Run verification
        result = subprocess.run(
            ["node", "/tmp/verify_schema.js"],
            cwd="/app/backend",
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            try:
                data = json.loads(result.stdout)
                
                print("\n=== NEW TABLES VERIFICATION ===")
                all_new_tables_ok = True
                for table_name, info in data['new_tables'].items():
                    if info['exists']:
                        print(f"✅ {table_name}: {info['column_count']} columns")
                    else:
                        print(f"❌ {table_name}: NOT FOUND")
                        all_new_tables_ok = False
                
                print("\n=== MODIFIED TABLES VERIFICATION ===")
                all_modified_tables_ok = True
                for table_name, info in data['modified_tables'].items():
                    if info['exists'] and info['all_present']:
                        print(f"✅ {table_name}: All expected columns present")
                    elif info['exists']:
                        print(f"❌ {table_name}: Missing columns: {', '.join(info['missing_columns'])}")
                        all_modified_tables_ok = False
                    else:
                        print(f"❌ {table_name}: Table not found")
                        all_modified_tables_ok = False
                
                return all_new_tables_ok and all_modified_tables_ok
                
            except json.JSONDecodeError:
                print(f"❌ Schema Verification: Failed to parse results")
                print(f"   Output: {result.stdout}")
                return False
        else:
            print(f"❌ Schema Verification: Script failed")
            print(f"   Error: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Schema Verification: Failed - {str(e)}")
        return False

def main():
    """Main test execution"""
    print("🚀 DynoPay Database Schema Tests")
    print("=" * 50)
    
    tests_passed = 0
    total_tests = 3
    
    # Test 1: Backend connectivity
    if test_backend_connectivity():
        tests_passed += 1
    
    # Test 2: Database migration
    if test_database_migration():
        tests_passed += 1
    
    # Test 3: Schema verification
    if verify_database_schema():
        tests_passed += 1
    
    print("\n" + "=" * 50)
    print(f"📊 RESULTS: {tests_passed}/{total_tests} tests passed")
    
    if tests_passed == total_tests:
        print("🎉 All database schema tests PASSED!")
        return True
    else:
        print("⚠️  Some tests failed")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)