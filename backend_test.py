#!/usr/bin/env python3
"""
DynoPay Backend Testing Suite
Tests Phase 1 Database Schema Updates, Phase 2 Tax API Integration, Phase 3 Dashboard APIs, and Phase 4 Notifications System
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
        self.jwt_token = None  # Store JWT token for authenticated requests
        
    def get_backend_url(self):
        """Get backend URL from frontend .env file"""
        try:
            with open('/app/frontend/.env', 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        external_url = line.split('=', 1)[1].strip()
                        print(f"Found external URL: {external_url}")
                        # Use localhost for testing since external URL may not be accessible
                        return "http://localhost:8001"
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
    
    def test_tax_api_endpoints(self):
        """Test Phase 2 Tax API endpoints"""
        print("\n=== Testing Phase 2 Tax API Endpoints ===")
        
        # Test countries as specified in review request
        test_countries = ["PT", "DE", "US", "GB", "FR"]
        
        # Test 1: GET /api/tax/rate/:countryCode (cache-first logic)
        for country in test_countries:
            self.test_tax_rate_endpoint(country)
        
        # Test 2: POST /api/tax/validate (Tax ID validation)
        self.test_tax_validation_endpoint()
        
        # Test 3: GET /api/tax/acronyms (all tax acronyms)
        self.test_tax_acronyms_endpoint()
        
        # Test 4: GET /api/tax/lookup (lookup by country name)
        self.test_tax_lookup_endpoint()
    
    def test_tax_rate_endpoint(self, country_code: str):
        """Test GET /api/tax/rate/:countryCode with cache verification"""
        print(f"\n--- Testing Tax Rate for {country_code} ---")
        
        try:
            # First call - should return cached: false
            response1 = requests.get(f"{self.backend_url}/api/tax/rate/{country_code}", timeout=15)
            
            if response1.status_code == 200:
                data1 = response1.json()
                
                # Verify response structure
                required_fields = ['country_code', 'country_name', 'tax_acronym', 'standard_rate']
                missing_fields = [field for field in required_fields if field not in data1.get('data', {})]
                
                if missing_fields:
                    self.log_result(
                        f"Tax Rate {country_code} - Structure", 
                        False, 
                        f"Missing required fields: {', '.join(missing_fields)}",
                        {"response": data1}
                    )
                else:
                    # Check if first call shows cached: false
                    cached_status = data1.get('data', {}).get('cached', None)
                    self.log_result(
                        f"Tax Rate {country_code} - First Call", 
                        True, 
                        f"Retrieved successfully, cached: {cached_status}",
                        {"country_code": data1.get('data', {}).get('country_code'),
                         "standard_rate": data1.get('data', {}).get('standard_rate'),
                         "cached": cached_status}
                    )
                
                # Second call - should return cached: true
                time.sleep(1)  # Brief pause
                response2 = requests.get(f"{self.backend_url}/api/tax/rate/{country_code}", timeout=15)
                
                if response2.status_code == 200:
                    data2 = response2.json()
                    cached_status2 = data2.get('data', {}).get('cached', None)
                    
                    if cached_status2 is True:
                        self.log_result(
                            f"Tax Rate {country_code} - Cache Test", 
                            True, 
                            f"Second call correctly returned cached: true",
                            {"cached": cached_status2}
                        )
                    else:
                        self.log_result(
                            f"Tax Rate {country_code} - Cache Test", 
                            False, 
                            f"Second call should return cached: true, got: {cached_status2}",
                            {"response": data2}
                        )
                else:
                    self.log_result(
                        f"Tax Rate {country_code} - Second Call", 
                        False, 
                        f"Second call failed with status {response2.status_code}",
                        {"response": response2.text}
                    )
            else:
                self.log_result(
                    f"Tax Rate {country_code}", 
                    False, 
                    f"API call failed with status {response1.status_code}",
                    {"response": response1.text}
                )
                
        except Exception as e:
            self.log_result(
                f"Tax Rate {country_code}", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_tax_validation_endpoint(self):
        """Test POST /api/tax/validate"""
        print("\n--- Testing Tax ID Validation ---")
        
        # Test with Portuguese VAT number as specified in review request
        test_data = {
            "tax_id": "PT518713130",
            "country_code": "PT"
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/tax/validate",
                json=test_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response contains expected fields
                response_data = data.get('data', {})
                expected_fields = ['tax_id', 'country_code', 'query_status']
                
                missing_fields = [field for field in expected_fields if field not in response_data]
                
                if missing_fields:
                    self.log_result(
                        "Tax ID Validation - Structure", 
                        False, 
                        f"Missing required fields: {', '.join(missing_fields)}",
                        {"response": data}
                    )
                else:
                    # Check if API handled rate limiting gracefully
                    query_status = response_data.get('query_status')
                    if query_status == "rate_limited":
                        self.log_result(
                            "Tax ID Validation", 
                            True, 
                            "API correctly handled rate limiting",
                            {"query_status": query_status, "tax_id": response_data.get('tax_id')}
                        )
                    else:
                        self.log_result(
                            "Tax ID Validation", 
                            True, 
                            f"Validation completed with status: {query_status}",
                            {"query_status": query_status, "valid": response_data.get('valid')}
                        )
            else:
                self.log_result(
                    "Tax ID Validation", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Tax ID Validation", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_tax_acronyms_endpoint(self):
        """Test GET /api/tax/acronyms"""
        print("\n--- Testing Tax Acronyms ---")
        
        try:
            response = requests.get(f"{self.backend_url}/api/tax/acronyms", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                response_data = data.get('data', {})
                
                # Check if response contains expected structure
                expected_fields = ['total_countries', 'acronyms', 'by_country', 'grouped']
                missing_fields = [field for field in expected_fields if field not in response_data]
                
                if missing_fields:
                    self.log_result(
                        "Tax Acronyms - Structure", 
                        False, 
                        f"Missing required fields: {', '.join(missing_fields)}",
                        {"response": data}
                    )
                else:
                    total_countries = response_data.get('total_countries', 0)
                    grouped_data = response_data.get('grouped', {})
                    
                    # Verify we have 102 countries as specified
                    if total_countries >= 100:  # Allow some flexibility
                        self.log_result(
                            "Tax Acronyms - Count", 
                            True, 
                            f"Retrieved {total_countries} countries (expected ~102)",
                            {"total_countries": total_countries}
                        )
                    else:
                        self.log_result(
                            "Tax Acronyms - Count", 
                            False, 
                            f"Expected ~102 countries, got {total_countries}",
                            {"total_countries": total_countries}
                        )
                    
                    # Verify grouped data structure
                    if 'european_union' in grouped_data and 'rest_of_world' in grouped_data:
                        eu_count = len(grouped_data['european_union'])
                        row_count = len(grouped_data['rest_of_world'])
                        
                        self.log_result(
                            "Tax Acronyms - Grouping", 
                            True, 
                            f"Data correctly grouped: EU ({eu_count}), Rest of World ({row_count})",
                            {"eu_countries": eu_count, "other_countries": row_count}
                        )
                    else:
                        self.log_result(
                            "Tax Acronyms - Grouping", 
                            False, 
                            "Missing grouped data structure",
                            {"grouped_keys": list(grouped_data.keys()) if grouped_data else []}
                        )
            else:
                self.log_result(
                    "Tax Acronyms", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Tax Acronyms", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_tax_lookup_endpoint(self):
        """Test GET /api/tax/lookup?country=Portugal"""
        print("\n--- Testing Tax Lookup by Country Name ---")
        
        test_countries = ["Portugal", "Germany", "United States"]
        
        for country_name in test_countries:
            try:
                response = requests.get(
                    f"{self.backend_url}/api/tax/lookup",
                    params={"country": country_name},
                    timeout=15
                )
                
                if response.status_code == 200:
                    data = response.json()
                    response_data = data.get('data', {})
                    
                    # Should resolve country name to code and return tax rate
                    if 'country_code' in response_data and 'standard_rate' in response_data:
                        self.log_result(
                            f"Tax Lookup - {country_name}", 
                            True, 
                            f"Successfully resolved to {response_data.get('country_code')} with rate {response_data.get('standard_rate')}%",
                            {"country_name": response_data.get('country_name'),
                             "country_code": response_data.get('country_code'),
                             "standard_rate": response_data.get('standard_rate')}
                        )
                    else:
                        self.log_result(
                            f"Tax Lookup - {country_name}", 
                            False, 
                            "Missing country_code or standard_rate in response",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        f"Tax Lookup - {country_name}", 
                        False, 
                        f"API call failed with status {response.status_code}",
                        {"response": response.text}
                    )
                    
            except Exception as e:
                self.log_result(
                    f"Tax Lookup - {country_name}", 
                    False, 
                    f"Request failed: {str(e)}"
                )
    
    def verify_tax_cache_database(self):
        """Verify tax rates are stored in tbl_tax_rate table"""
        print("\n--- Verifying Tax Cache Database ---")
        
        cache_test_script = '''
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

async function verifyCacheData() {
  try {
    await sequelize.authenticate();
    
    // Check if tbl_tax_rate has cached data
    const cachedRates = await sequelize.query(
      `SELECT country_code, country_name, tax_acronym, standard_rate, created_at 
       FROM tbl_tax_rate 
       ORDER BY created_at DESC 
       LIMIT 10`,
      { type: QueryTypes.SELECT }
    );
    
    console.log(JSON.stringify({
      table_exists: true,
      cached_entries: cachedRates.length,
      sample_data: cachedRates
    }, null, 2));
    
    process.exit(0);
    
  } catch (error) {
    console.error('Cache verification failed:', error.message);
    process.exit(1);
  }
}

verifyCacheData();
'''
        
        try:
            # Write cache verification script
            with open('/tmp/verify_cache.js', 'w') as f:
                f.write(cache_test_script)
            
            # Run the verification script
            result = subprocess.run(
                ["node", "/tmp/verify_cache.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    cache_data = json.loads(result.stdout)
                    cached_entries = cache_data.get('cached_entries', 0)
                    
                    if cached_entries > 0:
                        self.log_result(
                            "Tax Cache Database", 
                            True, 
                            f"Found {cached_entries} cached tax rates in database",
                            {"cached_entries": cached_entries, 
                             "sample_data": cache_data.get('sample_data', [])[:3]}  # Show first 3
                        )
                    else:
                        self.log_result(
                            "Tax Cache Database", 
                            False, 
                            "No cached tax rates found in database",
                            {"cached_entries": cached_entries}
                        )
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Tax Cache Database", 
                        False, 
                        "Failed to parse cache verification results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
            else:
                self.log_result(
                    "Tax Cache Database", 
                    False, 
                    "Cache verification script failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Tax Cache Database", 
                False, 
                f"Cache verification failed: {str(e)}"
            )
    
    def test_user_authentication(self):
        """Test user registration/login to get JWT token for dashboard APIs"""
        print("\n=== Testing User Authentication for Dashboard APIs ===")
        
        # Test data for authentication
        test_user = {
            "name": "Dashboard Test User",
            "email": "dashboard.test@dynopay.com",
            "password": "TestPassword123!"
        }
        
        try:
            # First try to login with existing user
            login_response = requests.post(
                f"{self.backend_url}/api/user/login",
                json={
                    "email": test_user["email"],
                    "password": test_user["password"]
                },
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if login_response.status_code == 200:
                login_data = login_response.json()
                if 'data' in login_data and 'accessToken' in login_data['data']:
                    self.jwt_token = login_data['data']['accessToken']
                    self.log_result(
                        "User Login", 
                        True, 
                        "Successfully logged in existing user",
                        {"email": test_user["email"], "has_token": bool(self.jwt_token)}
                    )
                    return True
            
            # If login fails, try to register new user
            register_response = requests.post(
                f"{self.backend_url}/api/user/registerUser",
                json=test_user,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if register_response.status_code == 200:
                register_data = register_response.json()
                if 'data' in register_data and 'accessToken' in register_data['data']:
                    self.jwt_token = register_data['data']['accessToken']
                    self.log_result(
                        "User Registration", 
                        True, 
                        "Successfully registered new user",
                        {"email": test_user["email"], "has_token": bool(self.jwt_token)}
                    )
                    return True
                else:
                    self.log_result(
                        "User Registration", 
                        False, 
                        "Registration succeeded but no token received",
                        {"response": register_data}
                    )
            else:
                self.log_result(
                    "User Registration", 
                    False, 
                    f"Registration failed with status {register_response.status_code}",
                    {"response": register_response.text}
                )
                
        except Exception as e:
            self.log_result(
                "User Authentication", 
                False, 
                f"Authentication failed: {str(e)}"
            )
        
        return False
    
    def test_dashboard_main_stats(self):
        """Test GET /api/dashboard - main dashboard statistics"""
        print("\n--- Testing Dashboard Main Statistics ---")
        
        if not self.jwt_token:
            self.log_result(
                "Dashboard Main Stats", 
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
                f"{self.backend_url}/api/dashboard",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    dashboard_data = data['data']
                    
                    # Check required fields
                    required_fields = [
                        'total_transactions', 'total_volume', 
                        'pending_transactions', 'active_wallets', 'fee_tier'
                    ]
                    
                    missing_fields = [field for field in required_fields if field not in dashboard_data]
                    
                    if missing_fields:
                        self.log_result(
                            "Dashboard Main Stats - Structure", 
                            False, 
                            f"Missing required fields: {', '.join(missing_fields)}",
                            {"response": data}
                        )
                    else:
                        # Verify nested structure
                        total_tx = dashboard_data.get('total_transactions', {})
                        total_vol = dashboard_data.get('total_volume', {})
                        fee_tier = dashboard_data.get('fee_tier', {})
                        
                        structure_valid = (
                            'count' in total_tx and 'change_percent' in total_tx and
                            'amount' in total_vol and 'currency' in total_vol and
                            'current_tier' in fee_tier
                        )
                        
                        if structure_valid:
                            self.log_result(
                                "Dashboard Main Stats", 
                                True, 
                                "Dashboard statistics retrieved successfully",
                                {
                                    "total_transactions": total_tx.get('count', 0),
                                    "total_volume": f"{total_vol.get('amount', 0)} {total_vol.get('currency', 'USD')}",
                                    "current_tier": fee_tier.get('current_tier', 'Unknown'),
                                    "active_wallets": dashboard_data.get('active_wallets', {}).get('count', 0)
                                }
                            )
                        else:
                            self.log_result(
                                "Dashboard Main Stats - Structure", 
                                False, 
                                "Response structure is incomplete",
                                {"dashboard_data": dashboard_data}
                            )
                else:
                    self.log_result(
                        "Dashboard Main Stats", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Dashboard Main Stats", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Dashboard Main Stats", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_dashboard_chart_data(self):
        """Test GET /api/dashboard/chart with different period values"""
        print("\n--- Testing Dashboard Chart Data ---")
        
        if not self.jwt_token:
            self.log_result(
                "Dashboard Chart Data", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        # Test different periods as specified in review request
        test_periods = ['7d', '30d', '90d', '1y']
        
        for period in test_periods:
            try:
                headers = {
                    "Authorization": f"Bearer {self.jwt_token}",
                    "Content-Type": "application/json"
                }
                
                response = requests.get(
                    f"{self.backend_url}/api/dashboard/chart",
                    params={"period": period},
                    headers=headers,
                    timeout=15
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if 'data' in data:
                        chart_data = data['data']
                        
                        # Check required fields
                        required_fields = [
                            'period', 'chart_data', 'currency_breakdown', 'status_breakdown'
                        ]
                        
                        missing_fields = [field for field in required_fields if field not in chart_data]
                        
                        if missing_fields:
                            self.log_result(
                                f"Dashboard Chart - {period} Structure", 
                                False, 
                                f"Missing required fields: {', '.join(missing_fields)}",
                                {"response": data}
                            )
                        else:
                            chart_entries = chart_data.get('chart_data', [])
                            currency_breakdown = chart_data.get('currency_breakdown', [])
                            status_breakdown = chart_data.get('status_breakdown', [])
                            
                            self.log_result(
                                f"Dashboard Chart - {period}", 
                                True, 
                                f"Chart data retrieved successfully for period {period}",
                                {
                                    "period": chart_data.get('period'),
                                    "chart_entries": len(chart_entries),
                                    "currencies": len(currency_breakdown),
                                    "statuses": len(status_breakdown),
                                    "group_by": chart_data.get('group_by')
                                }
                            )
                    else:
                        self.log_result(
                            f"Dashboard Chart - {period}", 
                            False, 
                            "Invalid response format",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        f"Dashboard Chart - {period}", 
                        False, 
                        f"API call failed with status {response.status_code}",
                        {"response": response.text}
                    )
                    
            except Exception as e:
                self.log_result(
                    f"Dashboard Chart - {period}", 
                    False, 
                    f"Request failed: {str(e)}"
                )
    
    def test_dashboard_fee_tiers(self):
        """Test GET /api/dashboard/fee-tiers"""
        print("\n--- Testing Dashboard Fee Tiers ---")
        
        if not self.jwt_token:
            self.log_result(
                "Dashboard Fee Tiers", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        # Expected fee tiers from review request
        expected_tiers = [
            {"name": "Starter", "min": 0, "max": 10000},
            {"name": "Standard", "min": 10000, "max": 50000},
            {"name": "Pro", "min": 50000, "max": 250000},
            {"name": "Business", "min": 250000, "max": 1000000},
            {"name": "Enterprise", "min": 1000000, "max": None}
        ]
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.get(
                f"{self.backend_url}/api/dashboard/fee-tiers",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data:
                    fee_data = data['data']
                    tiers = fee_data.get('tiers', [])
                    
                    if len(tiers) == 5:  # Should have 5 tiers
                        # Verify each tier structure
                        all_tiers_valid = True
                        tier_details = []
                        
                        for i, tier in enumerate(tiers):
                            expected = expected_tiers[i]
                            
                            if (tier.get('name') == expected['name'] and
                                tier.get('min_volume') == expected['min'] and
                                tier.get('max_volume') == expected['max']):
                                tier_details.append({
                                    "name": tier.get('name'),
                                    "min": tier.get('min_volume'),
                                    "max": tier.get('max_volume'),
                                    "description": tier.get('description', '')[:50] + '...' if tier.get('description') else ''
                                })
                            else:
                                all_tiers_valid = False
                                break
                        
                        if all_tiers_valid:
                            self.log_result(
                                "Dashboard Fee Tiers", 
                                True, 
                                "All fee tiers match expected structure",
                                {"tiers": tier_details}
                            )
                        else:
                            self.log_result(
                                "Dashboard Fee Tiers - Validation", 
                                False, 
                                f"Tier {i+1} ({tier.get('name')}) doesn't match expected values",
                                {"expected": expected, "actual": tier}
                            )
                    else:
                        self.log_result(
                            "Dashboard Fee Tiers - Count", 
                            False, 
                            f"Expected 5 tiers, got {len(tiers)}",
                            {"tiers_count": len(tiers)}
                        )
                else:
                    self.log_result(
                        "Dashboard Fee Tiers", 
                        False, 
                        "Invalid response format",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Dashboard Fee Tiers", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Dashboard Fee Tiers", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_dashboard_recent_transactions(self):
        """Test GET /api/dashboard/recent-transactions"""
        print("\n--- Testing Dashboard Recent Transactions ---")
        
        if not self.jwt_token:
            self.log_result(
                "Dashboard Recent Transactions", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        # Test with default limit and custom limit
        test_limits = [None, 5, 15]  # None = default (10), 5 = custom small, 15 = custom large
        
        for limit in test_limits:
            try:
                headers = {
                    "Authorization": f"Bearer {self.jwt_token}",
                    "Content-Type": "application/json"
                }
                
                params = {}
                if limit is not None:
                    params['limit'] = limit
                
                response = requests.get(
                    f"{self.backend_url}/api/dashboard/recent-transactions",
                    params=params,
                    headers=headers,
                    timeout=15
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if 'data' in data:
                        tx_data = data['data']
                        transactions = tx_data.get('transactions', [])
                        count = tx_data.get('count', 0)
                        
                        expected_limit = limit if limit is not None else 10
                        
                        # Verify transaction structure if any transactions exist
                        if transactions:
                            first_tx = transactions[0]
                            required_tx_fields = [
                                'transaction_id', 'base_amount', 'base_currency', 
                                'status', 'transaction_type'
                            ]
                            
                            missing_tx_fields = [field for field in required_tx_fields if field not in first_tx]
                            
                            if missing_tx_fields:
                                self.log_result(
                                    f"Recent Transactions - Limit {limit or 'default'} Structure", 
                                    False, 
                                    f"Transaction missing fields: {', '.join(missing_tx_fields)}",
                                    {"first_transaction": first_tx}
                                )
                            else:
                                self.log_result(
                                    f"Recent Transactions - Limit {limit or 'default'}", 
                                    True, 
                                    f"Retrieved {count} transactions (limit: {expected_limit})",
                                    {
                                        "count": count,
                                        "limit": expected_limit,
                                        "sample_tx": {
                                            "id": first_tx.get('transaction_id'),
                                            "amount": first_tx.get('base_amount'),
                                            "currency": first_tx.get('base_currency'),
                                            "status": first_tx.get('status')
                                        }
                                    }
                                )
                        else:
                            # No transactions is also valid (new user)
                            self.log_result(
                                f"Recent Transactions - Limit {limit or 'default'}", 
                                True, 
                                f"No transactions found (count: {count})",
                                {"count": count, "limit": expected_limit}
                            )
                    else:
                        self.log_result(
                            f"Recent Transactions - Limit {limit or 'default'}", 
                            False, 
                            "Invalid response format",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        f"Recent Transactions - Limit {limit or 'default'}", 
                        False, 
                        f"API call failed with status {response.status_code}",
                        {"response": response.text}
                    )
                    
            except Exception as e:
                self.log_result(
                    f"Recent Transactions - Limit {limit or 'default'}", 
                    False, 
                    f"Request failed: {str(e)}"
                )
    
    def test_dashboard_apis(self):
        """Test all Phase 3 Dashboard API endpoints"""
        print("\n=== Testing Phase 3 Dashboard APIs ===")
        
        # Step 1: Authenticate user to get JWT token
        if not self.test_user_authentication():
            print("\n❌ Authentication failed. Cannot test dashboard APIs.")
            return False
        
        # Step 2: Test all dashboard endpoints
        self.test_dashboard_main_stats()
        self.test_dashboard_chart_data()
        self.test_dashboard_fee_tiers()
        self.test_dashboard_recent_transactions()
        
        return True
    
    def test_notification_preferences(self):
        """Test notification preferences endpoints"""
        print("\n=== Testing Phase 4 Notification Preferences ===")
        
        if not self.jwt_token:
            self.log_result(
                "Notification Preferences", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        # Test 1: GET /api/notifications/preferences (should return defaults)
        try:
            response = requests.get(
                f"{self.backend_url}/api/notifications/preferences",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                prefs_data = data.get('data', {})
                
                # Check if defaults are returned
                expected_defaults = [
                    'transaction_updates', 'payment_received', 'weekly_summary',
                    'security_alerts', 'email_notifications', 'sms_notifications', 
                    'browser_notifications', 'is_default'
                ]
                
                missing_fields = [field for field in expected_defaults if field not in prefs_data]
                
                if missing_fields:
                    self.log_result(
                        "Get Preferences - Structure", 
                        False, 
                        f"Missing fields: {', '.join(missing_fields)}",
                        {"response": data}
                    )
                else:
                    is_default = prefs_data.get('is_default', False)
                    self.log_result(
                        "Get Preferences - Defaults", 
                        True, 
                        f"Retrieved preferences (is_default: {is_default})",
                        {
                            "transaction_updates": prefs_data.get('transaction_updates'),
                            "weekly_summary": prefs_data.get('weekly_summary'),
                            "email_notifications": prefs_data.get('email_notifications'),
                            "is_default": is_default
                        }
                    )
            else:
                self.log_result(
                    "Get Preferences", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Get Preferences", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test 2: PUT /api/notifications/preferences (update preferences)
        try:
            update_data = {
                "transaction_updates": True,
                "payment_received": False,
                "weekly_summary": True,
                "security_alerts": False,
                "email_notifications": True,
                "sms_notifications": False,
                "browser_notifications": False
            }
            
            response = requests.put(
                f"{self.backend_url}/api/notifications/preferences",
                json=update_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                updated_prefs = data.get('data', {})
                
                # Verify the update worked
                if (updated_prefs.get('transaction_updates') == True and
                    updated_prefs.get('payment_received') == False and
                    updated_prefs.get('weekly_summary') == True):
                    
                    self.log_result(
                        "Update Preferences", 
                        True, 
                        "Preferences updated successfully",
                        {
                            "transaction_updates": updated_prefs.get('transaction_updates'),
                            "payment_received": updated_prefs.get('payment_received'),
                            "weekly_summary": updated_prefs.get('weekly_summary')
                        }
                    )
                else:
                    self.log_result(
                        "Update Preferences - Validation", 
                        False, 
                        "Updated preferences don't match expected values",
                        {"updated_prefs": updated_prefs, "expected": update_data}
                    )
            else:
                self.log_result(
                    "Update Preferences", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Update Preferences", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test 3: GET /api/notifications/preferences (verify update persisted)
        try:
            response = requests.get(
                f"{self.backend_url}/api/notifications/preferences",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                prefs_data = data.get('data', {})
                
                # Should now show is_default: false since we updated
                is_default = prefs_data.get('is_default', True)
                if is_default == False:
                    self.log_result(
                        "Get Updated Preferences", 
                        True, 
                        "Updated preferences persisted correctly",
                        {"is_default": is_default}
                    )
                else:
                    self.log_result(
                        "Get Updated Preferences", 
                        False, 
                        "Preferences should show is_default: false after update",
                        {"is_default": is_default}
                    )
            else:
                self.log_result(
                    "Get Updated Preferences", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Get Updated Preferences", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_notification_types(self):
        """Test GET /api/notifications/types"""
        print("\n--- Testing Notification Types ---")
        
        if not self.jwt_token:
            self.log_result(
                "Notification Types", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        # Expected notification types from the controller
        expected_types = [
            "transaction_confirmed", "payment_received", "weekly_summary", 
            "security_alert", "kyc_required", "kyc_approved", "kyc_rejected",
            "wallet_verified", "wallet_added", "api_key_created", "company_created"
        ]
        
        try:
            response = requests.get(
                f"{self.backend_url}/api/notifications/types",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                types_data = data.get('data', {})
                types_list = types_data.get('types', [])
                
                if len(types_list) >= 10:  # Should have at least 10 types
                    # Check if expected types are present
                    returned_values = [t.get('value') for t in types_list]
                    missing_types = [t for t in expected_types if t not in returned_values]
                    
                    if not missing_types:
                        self.log_result(
                            "Notification Types", 
                            True, 
                            f"Retrieved {len(types_list)} notification types",
                            {"types_count": len(types_list), "sample_types": returned_values[:5]}
                        )
                    else:
                        self.log_result(
                            "Notification Types - Validation", 
                            False, 
                            f"Missing expected types: {', '.join(missing_types)}",
                            {"returned_types": returned_values, "missing": missing_types}
                        )
                else:
                    self.log_result(
                        "Notification Types - Count", 
                        False, 
                        f"Expected at least 10 types, got {len(types_list)}",
                        {"types_count": len(types_list)}
                    )
            else:
                self.log_result(
                    "Notification Types", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Notification Types", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_weekly_summary_trigger(self):
        """Test POST /api/notifications/trigger-weekly-summary"""
        print("\n--- Testing Weekly Summary Trigger ---")
        
        if not self.jwt_token:
            self.log_result(
                "Weekly Summary Trigger", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        try:
            # Trigger weekly summary for current user
            response = requests.post(
                f"{self.backend_url}/api/notifications/trigger-weekly-summary",
                json={},  # Empty body - will use authenticated user
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                results = data.get('data', {}).get('results', [])
                
                if isinstance(results, list):
                    self.log_result(
                        "Weekly Summary Trigger", 
                        True, 
                        f"Weekly summary triggered successfully for {len(results)} user(s)",
                        {"results_count": len(results)}
                    )
                    
                    # If we got results, check the structure
                    if results and len(results) > 0:
                        first_result = results[0]
                        if 'user_id' in first_result and 'summary' in first_result:
                            summary = first_result.get('summary', {})
                            self.log_result(
                                "Weekly Summary - Structure", 
                                True, 
                                "Weekly summary data structure is correct",
                                {
                                    "user_id": first_result.get('user_id'),
                                    "transaction_count": summary.get('transaction_count', 0),
                                    "total_volume": summary.get('total_volume', 0),
                                    "period_start": summary.get('period_start'),
                                    "period_end": summary.get('period_end')
                                }
                            )
                        else:
                            self.log_result(
                                "Weekly Summary - Structure", 
                                False, 
                                "Weekly summary result missing expected fields",
                                {"first_result": first_result}
                            )
                else:
                    self.log_result(
                        "Weekly Summary Trigger", 
                        False, 
                        "Invalid response format - results should be array",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Weekly Summary Trigger", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Weekly Summary Trigger", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_notification_list_and_operations(self):
        """Test notification list, unread count, mark as read, and delete operations"""
        print("\n--- Testing Notification List and Operations ---")
        
        if not self.jwt_token:
            self.log_result(
                "Notification Operations", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        notification_id = None
        
        # Test 1: GET /api/notifications (list notifications)
        try:
            response = requests.get(
                f"{self.backend_url}/api/notifications",
                params={"page": 1, "limit": 10},
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                notifications_data = data.get('data', {})
                notifications = notifications_data.get('notifications', [])
                pagination = notifications_data.get('pagination', {})
                
                # Check pagination structure
                required_pagination_fields = ['total', 'page', 'limit', 'total_pages']
                missing_pagination = [field for field in required_pagination_fields if field not in pagination]
                
                if missing_pagination:
                    self.log_result(
                        "Notification List - Pagination", 
                        False, 
                        f"Missing pagination fields: {', '.join(missing_pagination)}",
                        {"pagination": pagination}
                    )
                else:
                    self.log_result(
                        "Notification List", 
                        True, 
                        f"Retrieved {len(notifications)} notifications (total: {pagination.get('total', 0)})",
                        {
                            "notifications_count": len(notifications),
                            "total": pagination.get('total', 0),
                            "page": pagination.get('page', 1),
                            "limit": pagination.get('limit', 10)
                        }
                    )
                    
                    # Store first notification ID for later tests
                    if notifications and len(notifications) > 0:
                        notification_id = notifications[0].get('notification_id')
            else:
                self.log_result(
                    "Notification List", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Notification List", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test 2: GET /api/notifications/unread-count
        try:
            response = requests.get(
                f"{self.backend_url}/api/notifications/unread-count",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                unread_data = data.get('data', {})
                
                if 'unread_count' in unread_data:
                    unread_count = unread_data.get('unread_count', 0)
                    self.log_result(
                        "Unread Count", 
                        True, 
                        f"Retrieved unread count: {unread_count}",
                        {"unread_count": unread_count}
                    )
                else:
                    self.log_result(
                        "Unread Count - Structure", 
                        False, 
                        "Missing unread_count field in response",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Unread Count", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Unread Count", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test 3: PUT /api/notifications/:id/read (if we have a notification ID)
        if notification_id:
            try:
                response = requests.put(
                    f"{self.backend_url}/api/notifications/{notification_id}/read",
                    headers=headers,
                    timeout=15
                )
                
                if response.status_code == 200:
                    data = response.json()
                    read_data = data.get('data', {})
                    
                    # Convert both to string for comparison since API returns string
                    if (str(read_data.get('notification_id')) == str(notification_id) and 
                        read_data.get('is_read') == True):
                        self.log_result(
                            "Mark Single as Read", 
                            True, 
                            f"Notification {notification_id} marked as read",
                            {"notification_id": notification_id, "is_read": True}
                        )
                    else:
                        self.log_result(
                            "Mark Single as Read - Validation", 
                            False, 
                            "Response doesn't match expected format",
                            {"response": data, "expected_id": notification_id}
                        )
                else:
                    self.log_result(
                        "Mark Single as Read", 
                        False, 
                        f"API call failed with status {response.status_code}",
                        {"response": response.text}
                    )
                    
            except Exception as e:
                self.log_result(
                    "Mark Single as Read", 
                    False, 
                    f"Request failed: {str(e)}"
                )
        
        # Test 4: PUT /api/notifications/read-all
        try:
            response = requests.put(
                f"{self.backend_url}/api/notifications/read-all",
                json={},  # Empty body
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                read_all_data = data.get('data', {})
                
                if 'updated_count' in read_all_data:
                    updated_count = read_all_data.get('updated_count', 0)
                    self.log_result(
                        "Mark All as Read", 
                        True, 
                        f"Marked {updated_count} notifications as read",
                        {"updated_count": updated_count}
                    )
                else:
                    self.log_result(
                        "Mark All as Read - Structure", 
                        False, 
                        "Missing updated_count field in response",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Mark All as Read", 
                    False, 
                    f"API call failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Mark All as Read", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test 5: DELETE /api/notifications/:id (if we have a notification ID)
        if notification_id:
            try:
                response = requests.delete(
                    f"{self.backend_url}/api/notifications/{notification_id}",
                    headers=headers,
                    timeout=15
                )
                
                if response.status_code == 200:
                    data = response.json()
                    delete_data = data.get('data', {})
                    
                    # Convert both to string for comparison since API returns string
                    if (str(delete_data.get('notification_id')) == str(notification_id) and 
                        delete_data.get('deleted') == True):
                        self.log_result(
                            "Delete Notification", 
                            True, 
                            f"Notification {notification_id} deleted successfully",
                            {"notification_id": notification_id, "deleted": True}
                        )
                    else:
                        self.log_result(
                            "Delete Notification - Validation", 
                            False, 
                            "Response doesn't match expected format",
                            {"response": data, "expected_id": notification_id}
                        )
                else:
                    self.log_result(
                        "Delete Notification", 
                        False, 
                        f"API call failed with status {response.status_code}",
                        {"response": response.text}
                    )
                    
            except Exception as e:
                self.log_result(
                    "Delete Notification", 
                    False, 
                    f"Request failed: {str(e)}"
                )
    
    def test_notification_apis(self):
        """Test all Phase 4 Notification API endpoints"""
        print("\n=== Testing Phase 4 Notification APIs ===")
        
        # Step 1: Authenticate user to get JWT token (reuse from dashboard tests)
        if not self.jwt_token and not self.test_user_authentication():
            print("\n❌ Authentication failed. Cannot test notification APIs.")
            return False
        
        # Step 2: Test notification preferences
        self.test_notification_preferences()
        
        # Step 3: Test notification types
        self.test_notification_types()
        
        # Step 4: Test weekly summary trigger (creates notifications)
        self.test_weekly_summary_trigger()
        
        # Step 5: Test notification list and operations
        self.test_notification_list_and_operations()
        
        return True
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting DynoPay Backend Tests")
        print("=" * 60)
        print(f"Backend URL: {self.backend_url}")
        
        # Test 1: Backend connectivity
        if not self.test_database_connectivity():
            print("\n❌ Backend connectivity failed. Stopping tests.")
            return False
        
        # Test 2: Phase 4 Notification API endpoints (NEW - PRIORITY)
        self.test_notification_apis()
        
        # Test 3: Phase 3 Dashboard API endpoints (keeping existing tests)
        self.test_dashboard_apis()
        
        # Test 4: Phase 2 Tax API endpoints (keeping existing tests)
        self.test_tax_api_endpoints()
        
        # Test 5: Verify tax cache in database
        self.verify_tax_cache_database()
        
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
    tester = DynoPayBackendTester()
    
    try:
        success = tester.run_all_tests()
        overall_success = tester.print_summary()
        
        if overall_success:
            print("\n🎉 All backend tests passed!")
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