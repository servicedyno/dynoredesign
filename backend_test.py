#!/usr/bin/env python3
"""
DynoPay Backend Testing Suite
Tests Phase 1 Database Schema Updates and Phase 2 Tax API Integration
"""

import os
import sys
import json
import subprocess
import time
import requests
from typing import Dict, List, Any

class DynoPayBackendTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        
    def get_backend_url(self):
        """Get backend URL from frontend .env file"""
        try:
            with open('/app/frontend/.env', 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        return line.split('=', 1)[1].strip()
        except Exception as e:
            print(f"Warning: Could not read frontend .env file: {e}")
        
        # Fallback to localhost
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
    
    def test_database_connectivity(self):
        """Test PostgreSQL database connectivity"""
        print("\n=== Testing Database Connectivity ===")
        
        try:
            # Test backend server is running
            response = requests.get(f"{self.backend_url}/", timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "Backend Server Connection", 
                    True, 
                    f"Server responding with status {response.status_code}",
                    {"response_data": data}
                )
            else:
                self.log_result(
                    "Backend Server Connection", 
                    False, 
                    f"Server returned status {response.status_code}"
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Backend Server Connection", 
                False, 
                f"Failed to connect to backend: {str(e)}"
            )
            return False
            
        return True
    
    def run_database_migration(self):
        """Run the database migration to sync all models"""
        print("\n=== Running Database Migration ===")
        
        try:
            # Change to backend directory and run migration
            result = subprocess.run(
                ["npx", "ts-node", "--transpile-only", "database/migrate.ts"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                self.log_result(
                    "Database Migration", 
                    True, 
                    "Migration completed successfully",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                return True
            else:
                self.log_result(
                    "Database Migration", 
                    False, 
                    f"Migration failed with return code {result.returncode}",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                return False
                
        except subprocess.TimeoutExpired:
            self.log_result(
                "Database Migration", 
                False, 
                "Migration timed out after 60 seconds"
            )
            return False
        except Exception as e:
            self.log_result(
                "Database Migration", 
                False, 
                f"Migration failed: {str(e)}"
            )
            return False
    
    def verify_database_tables(self):
        """Verify that all required tables exist with correct columns"""
        print("\n=== Verifying Database Tables ===")
        
        # Test database connection using Node.js script
        test_script = '''
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

async function verifyTables() {
  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully.");
    
    // Check for new tables
    const newTables = [
      'tbl_tax_rate',
      'tbl_invoice', 
      'tbl_notification',
      'tbl_notification_preferences',
      'tbl_kyc'
    ];
    
    const results = {};
    
    for (const table of newTables) {
      try {
        const columns = await sequelize.query(
          `SELECT column_name, data_type, is_nullable, column_default 
           FROM information_schema.columns 
           WHERE table_name = '${table}' 
           ORDER BY ordinal_position`,
          { type: QueryTypes.SELECT }
        );
        
        results[table] = {
          exists: columns.length > 0,
          columns: columns
        };
      } catch (error) {
        results[table] = {
          exists: false,
          error: error.message
        };
      }
    }
    
    // Check modified tables for new columns
    const modifiedTables = {
      'tbl_company': ['address_line1', 'address_line2', 'city', 'state', 'country', 'zip_code', 'vat_number', 'vat_type', 'vat_verified'],
      'tbl_api': ['api_name'],
      'tbl_user_wallet': ['company_id', 'wallet_name'],
      'tbl_user_addresses': ['company_id', 'wallet_name']
    };
    
    for (const [table, expectedColumns] of Object.entries(modifiedTables)) {
      try {
        const columns = await sequelize.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`,
          { type: QueryTypes.SELECT }
        );
        
        const columnNames = columns.map(col => col.column_name);
        const missingColumns = expectedColumns.filter(col => !columnNames.includes(col));
        
        results[table] = {
          exists: columns.length > 0,
          expected_columns: expectedColumns,
          missing_columns: missingColumns,
          all_columns: columnNames
        };
      } catch (error) {
        results[table] = {
          exists: false,
          error: error.message
        };
      }
    }
    
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
    
  } catch (error) {
    console.error('Database verification failed:', error.message);
    process.exit(1);
  }
}

verifyTables();
'''
        
        try:
            # Write test script to temporary file
            with open('/tmp/verify_tables.js', 'w') as f:
                f.write(test_script)
            
            # Run the verification script
            result = subprocess.run(
                ["node", "/tmp/verify_tables.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    table_data = json.loads(result.stdout)
                    self.analyze_table_verification_results(table_data)
                    return True
                except json.JSONDecodeError:
                    self.log_result(
                        "Table Verification", 
                        False, 
                        "Failed to parse verification results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
                    return False
            else:
                self.log_result(
                    "Table Verification", 
                    False, 
                    "Table verification script failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Table Verification", 
                False, 
                f"Table verification failed: {str(e)}"
            )
            return False
    
    def analyze_table_verification_results(self, table_data: Dict):
        """Analyze the table verification results"""
        
        # Check new tables
        new_tables = ['tbl_tax_rate', 'tbl_invoice', 'tbl_notification', 'tbl_notification_preferences', 'tbl_kyc']
        
        for table in new_tables:
            if table in table_data:
                if table_data[table].get('exists', False):
                    columns = table_data[table].get('columns', [])
                    self.log_result(
                        f"New Table: {table}", 
                        True, 
                        f"Table exists with {len(columns)} columns",
                        {"columns": [col['column_name'] for col in columns]}
                    )
                else:
                    error = table_data[table].get('error', 'Unknown error')
                    self.log_result(
                        f"New Table: {table}", 
                        False, 
                        f"Table does not exist: {error}"
                    )
            else:
                self.log_result(
                    f"New Table: {table}", 
                    False, 
                    "Table not found in verification results"
                )
        
        # Check modified tables
        modified_tables = {
            'tbl_company': ['address_line1', 'address_line2', 'city', 'state', 'country', 'zip_code', 'vat_number', 'vat_type', 'vat_verified'],
            'tbl_api': ['api_name'],
            'tbl_user_wallet': ['company_id', 'wallet_name'],
            'tbl_user_addresses': ['company_id', 'wallet_name']
        }
        
        for table, expected_columns in modified_tables.items():
            if table in table_data:
                if table_data[table].get('exists', False):
                    missing_columns = table_data[table].get('missing_columns', [])
                    if not missing_columns:
                        self.log_result(
                            f"Modified Table: {table}", 
                            True, 
                            f"All expected columns present: {', '.join(expected_columns)}"
                        )
                    else:
                        self.log_result(
                            f"Modified Table: {table}", 
                            False, 
                            f"Missing columns: {', '.join(missing_columns)}",
                            {"expected": expected_columns, "missing": missing_columns}
                        )
                else:
                    error = table_data[table].get('error', 'Unknown error')
                    self.log_result(
                        f"Modified Table: {table}", 
                        False, 
                        f"Table does not exist: {error}"
                    )
            else:
                self.log_result(
                    f"Modified Table: {table}", 
                    False, 
                    "Table not found in verification results"
                )
    
    def test_specific_table_schemas(self):
        """Test specific table schemas match expected structure"""
        print("\n=== Testing Specific Table Schemas ===")
        
        expected_schemas = {
            'tbl_tax_rate': {
                'required_columns': ['tax_id', 'country_code', 'country_name', 'tax_acronym', 'standard_rate', 'reduced_rates'],
                'primary_key': 'tax_id'
            },
            'tbl_invoice': {
                'required_columns': ['invoice_id', 'invoice_number', 'transaction_id', 'company_id', 'provider_name', 'customer_name', 'vat_rate', 'total_usd'],
                'primary_key': 'invoice_id'
            },
            'tbl_notification': {
                'required_columns': ['notification_id', 'user_id', 'company_id', 'type', 'title', 'message', 'is_read'],
                'primary_key': 'notification_id'
            },
            'tbl_notification_preferences': {
                'required_columns': ['preference_id', 'user_id', 'company_id', 'transaction_updates', 'payment_received', 'email_notifications'],
                'primary_key': 'preference_id'
            },
            'tbl_kyc': {
                'required_columns': ['kyc_id', 'user_id', 'company_id', 'status', 'documents', 'volume_threshold'],
                'primary_key': 'kyc_id'
            }
        }
        
        schema_test_script = f'''
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

async function testSchemas() {{
  try {{
    await sequelize.authenticate();
    
    const schemas = {json.dumps(expected_schemas)};
    const results = {{}};
    
    for (const [tableName, schema] of Object.entries(schemas)) {{
      try {{
        const columns = await sequelize.query(
          `SELECT column_name, data_type, is_nullable, column_default, 
                  CASE WHEN column_name IN (
                    SELECT column_name FROM information_schema.key_column_usage 
                    WHERE table_name = '${{tableName}}' AND constraint_name LIKE '%_pkey'
                  ) THEN true ELSE false END as is_primary_key
           FROM information_schema.columns 
           WHERE table_name = '${{tableName}}'
           ORDER BY ordinal_position`,
          {{ type: QueryTypes.SELECT }}
        );
        
        const columnNames = columns.map(col => col.column_name);
        const missingColumns = schema.required_columns.filter(col => !columnNames.includes(col));
        const primaryKeyColumn = columns.find(col => col.is_primary_key);
        
        results[tableName] = {{
          exists: columns.length > 0,
          columns: columns,
          missing_columns: missingColumns,
          primary_key_correct: primaryKeyColumn ? primaryKeyColumn.column_name === schema.primary_key : false
        }};
      }} catch (error) {{
        results[tableName] = {{
          exists: false,
          error: error.message
        }};
      }}
    }}
    
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
    
  }} catch (error) {{
    console.error('Schema test failed:', error.message);
    process.exit(1);
  }}
}}

testSchemas();
'''
        
        try:
            # Write schema test script
            with open('/tmp/test_schemas.js', 'w') as f:
                f.write(schema_test_script)
            
            # Run the schema test
            result = subprocess.run(
                ["node", "/tmp/test_schemas.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    schema_data = json.loads(result.stdout)
                    self.analyze_schema_results(schema_data, expected_schemas)
                    return True
                except json.JSONDecodeError:
                    self.log_result(
                        "Schema Validation", 
                        False, 
                        "Failed to parse schema test results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
                    return False
            else:
                self.log_result(
                    "Schema Validation", 
                    False, 
                    "Schema test script failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Schema Validation", 
                False, 
                f"Schema validation failed: {str(e)}"
            )
            return False
    
    def analyze_schema_results(self, schema_data: Dict, expected_schemas: Dict):
        """Analyze schema validation results"""
        
        for table_name, expected in expected_schemas.items():
            if table_name in schema_data:
                table_result = schema_data[table_name]
                
                if table_result.get('exists', False):
                    missing_columns = table_result.get('missing_columns', [])
                    primary_key_correct = table_result.get('primary_key_correct', False)
                    
                    if not missing_columns and primary_key_correct:
                        self.log_result(
                            f"Schema: {table_name}", 
                            True, 
                            f"Schema validation passed - all required columns and primary key correct"
                        )
                    else:
                        issues = []
                        if missing_columns:
                            issues.append(f"Missing columns: {', '.join(missing_columns)}")
                        if not primary_key_correct:
                            issues.append(f"Primary key incorrect (expected: {expected['primary_key']})")
                        
                        self.log_result(
                            f"Schema: {table_name}", 
                            False, 
                            f"Schema validation failed - {'; '.join(issues)}"
                        )
                else:
                    error = table_result.get('error', 'Unknown error')
                    self.log_result(
                        f"Schema: {table_name}", 
                        False, 
                        f"Table does not exist: {error}"
                    )
            else:
                self.log_result(
                    f"Schema: {table_name}", 
                    False, 
                    "Table not found in schema validation results"
                )
    
    def run_all_tests(self):
        """Run all database tests"""
        print("🚀 Starting DynoPay Database Schema Tests")
        print("=" * 60)
        
        # Test 1: Database connectivity
        if not self.test_database_connectivity():
            print("\n❌ Database connectivity failed. Stopping tests.")
            return False
        
        # Test 2: Run migration
        if not self.run_database_migration():
            print("\n❌ Database migration failed. Continuing with verification...")
        
        # Test 3: Verify tables exist
        if not self.verify_database_tables():
            print("\n❌ Table verification failed.")
        
        # Test 4: Test specific schemas
        if not self.test_specific_table_schemas():
            print("\n❌ Schema validation failed.")
        
        return True
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        
        if failed_tests > 0:
            print(f"\n🔍 FAILED TESTS:")
            for error in self.errors:
                print(f"  • {error}")
        
        print(f"\n🎯 Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        return failed_tests == 0

def main():
    """Main test execution"""
    tester = DynoPayDatabaseTester()
    
    try:
        success = tester.run_all_tests()
        overall_success = tester.print_summary()
        
        if overall_success:
            print("\n🎉 All database schema tests passed!")
            sys.exit(0)
        else:
            print("\n⚠️  Some tests failed. Check the summary above.")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n⏹️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()