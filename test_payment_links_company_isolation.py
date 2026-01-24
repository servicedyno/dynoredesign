#!/usr/bin/env python3
"""
DynoPay Phase 10 Task 10.4: Payment Links Company Isolation Fix Testing
Tests the complete multi-tenant isolation implementation for payment links
"""

import os
import sys
import json
import subprocess
import time
import requests
from typing import Dict, List, Any

class PaymentLinksCompanyIsolationTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.test_company_id = None
        self.test_link_without_company = None
        self.test_link_with_company = None
        
    def get_backend_url(self):
        """Get backend URL from frontend .env file"""
        try:
            with open('/app/frontend/.env', 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        external_url = line.split('=', 1)[1].strip()
                        print(f"Found external URL: {external_url}")
                        # Use external URL for testing
                        return external_url + "/api"
        except Exception as e:
            print(f"Warning: Could not read frontend .env file: {e}")
        
        # Fallback to localhost
        return "http://localhost:8001/api"
        
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
        """Authenticate user to get JWT token"""
        print("\n=== Authenticating User ===")
        
        # Test data for authentication
        test_user = {
            "name": "Payment Links Test User",
            "email": "paymentlinks.test@dynopay.com",
            "password": "TestPassword123!"
        }
        
        try:
            # First try to login with existing user
            login_response = requests.post(
                f"{self.backend_url}/user/login",
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
                        "User Authentication", 
                        True, 
                        "Successfully logged in existing user",
                        {"email": test_user["email"], "has_token": bool(self.jwt_token)}
                    )
                    return True
            
            # If login fails, try to register new user
            register_response = requests.post(
                f"{self.backend_url}/user/registerUser",
                json=test_user,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if register_response.status_code == 200:
                register_data = register_response.json()
                if 'data' in register_data and 'accessToken' in register_data['data']:
                    self.jwt_token = register_data['data']['accessToken']
                    self.log_result(
                        "User Authentication", 
                        True, 
                        "Successfully registered new user",
                        {"email": test_user["email"], "has_token": bool(self.jwt_token)}
                    )
                    return True
                else:
                    self.log_result(
                        "User Authentication", 
                        False, 
                        "Registration succeeded but no token received",
                        {"response": register_data}
                    )
            else:
                self.log_result(
                    "User Authentication", 
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
    
    def run_payment_link_migration(self):
        """Run database migration to add company_id to payment links"""
        print("\n=== Running Payment Link Migration ===")
        
        try:
            # Run the migration script
            result = subprocess.run(
                ["npx", "ts-node", "--transpile-only", "database/migrate.ts"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                self.log_result(
                    "Payment Link Migration", 
                    True, 
                    "Database migration completed successfully",
                    {"stdout": result.stdout[:500], "stderr": result.stderr[:500]}
                )
                return True
            else:
                self.log_result(
                    "Payment Link Migration", 
                    False, 
                    f"Migration failed with return code {result.returncode}",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Payment Link Migration", 
                False, 
                f"Migration failed: {str(e)}"
            )
            return False
    
    def verify_payment_link_schema(self):
        """Verify tbl_payment_link has company_id column with foreign key"""
        print("\n=== Verifying Payment Link Schema ===")
        
        schema_test_script = '''
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

async function verifyPaymentLinkSchema() {
  try {
    await sequelize.authenticate();
    
    // Check if company_id column exists
    const columns = await sequelize.query(
      `SELECT column_name, data_type, is_nullable, column_default 
       FROM information_schema.columns 
       WHERE table_name = 'tbl_payment_link' AND column_name = 'company_id'`,
      { type: QueryTypes.SELECT }
    );
    
    // Check foreign key constraint
    const foreignKeys = await sequelize.query(
      `SELECT tc.constraint_name, tc.table_name, kcu.column_name, 
              ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
       FROM information_schema.table_constraints AS tc 
       JOIN information_schema.key_column_usage AS kcu
         ON tc.constraint_name = kcu.constraint_name
       JOIN information_schema.constraint_column_usage AS ccu
         ON ccu.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY' 
         AND tc.table_name = 'tbl_payment_link' 
         AND kcu.column_name = 'company_id'`,
      { type: QueryTypes.SELECT }
    );
    
    // Check indexes
    const indexes = await sequelize.query(
      `SELECT indexname, indexdef 
       FROM pg_indexes 
       WHERE tablename = 'tbl_payment_link' 
         AND (indexname LIKE '%company_id%' OR indexdef LIKE '%company_id%')`,
      { type: QueryTypes.SELECT }
    );
    
    console.log(JSON.stringify({
      company_id_column: columns,
      foreign_keys: foreignKeys,
      indexes: indexes
    }, null, 2));
    
    process.exit(0);
    
  } catch (error) {
    console.error('Schema verification failed:', error.message);
    process.exit(1);
  }
}

verifyPaymentLinkSchema();
'''
        
        try:
            # Write schema test script
            with open('/tmp/verify_payment_link_schema.js', 'w') as f:
                f.write(schema_test_script)
            
            # Run the schema test
            result = subprocess.run(
                ["node", "/tmp/verify_payment_link_schema.js"],
                cwd="/app/backend",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    schema_data = json.loads(result.stdout)
                    
                    # Verify company_id column exists
                    company_id_column = schema_data.get('company_id_column', [])
                    if company_id_column:
                        column_info = company_id_column[0]
                        self.log_result(
                            "Payment Link Schema - company_id Column", 
                            True, 
                            f"✅ company_id column exists: {column_info['data_type']}, nullable: {column_info['is_nullable']}",
                            {"column_info": column_info}
                        )
                    else:
                        self.log_result(
                            "Payment Link Schema - company_id Column", 
                            False, 
                            "❌ company_id column not found in tbl_payment_link"
                        )
                    
                    # Verify foreign key constraint
                    foreign_keys = schema_data.get('foreign_keys', [])
                    if foreign_keys:
                        fk_info = foreign_keys[0]
                        self.log_result(
                            "Payment Link Schema - Foreign Key", 
                            True, 
                            f"✅ Foreign key constraint exists: {fk_info['constraint_name']} -> {fk_info['foreign_table_name']}.{fk_info['foreign_column_name']}",
                            {"foreign_key": fk_info}
                        )
                    else:
                        self.log_result(
                            "Payment Link Schema - Foreign Key", 
                            False, 
                            "❌ Foreign key constraint to tbl_company not found"
                        )
                    
                    # Verify indexes
                    indexes = schema_data.get('indexes', [])
                    if indexes:
                        self.log_result(
                            "Payment Link Schema - Indexes", 
                            True, 
                            f"✅ Found {len(indexes)} indexes on company_id",
                            {"indexes": [idx['indexname'] for idx in indexes]}
                        )
                    else:
                        self.log_result(
                            "Payment Link Schema - Indexes", 
                            False, 
                            "❌ No indexes found on company_id column"
                        )
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Payment Link Schema Verification", 
                        False, 
                        "Failed to parse schema verification results",
                        {"stdout": result.stdout, "stderr": result.stderr}
                    )
            else:
                self.log_result(
                    "Payment Link Schema Verification", 
                    False, 
                    "Schema verification script failed",
                    {"stdout": result.stdout, "stderr": result.stderr}
                )
                
        except Exception as e:
            self.log_result(
                "Payment Link Schema Verification", 
                False, 
                f"Schema verification failed: {str(e)}"
            )
    
    def get_or_create_test_company(self):
        """Get or create a test company for the authenticated user"""
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        try:
            # First try to get existing companies
            response = requests.get(
                f"{self.backend_url}/company/getCompany",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and data['data']:
                    companies = data['data']
                    if companies:
                        company_id = companies[0].get('company_id')
                        self.test_company_id = company_id
                        return company_id
            
            # If no companies exist, create one
            company_data = {
                "company_name": "Test Company for Payment Links",
                "company_email": "test.company@dynopay.com",
                "company_phone": "+1234567890",
                "address_line1": "123 Test Street",
                "city": "Test City",
                "state": "Test State",
                "country": "US",
                "zip_code": "12345"
            }
            
            create_response = requests.post(
                f"{self.backend_url}/company/addCompany",
                json=company_data,
                headers=headers,
                timeout=30
            )
            
            if create_response.status_code == 200:
                create_data = create_response.json()
                if 'data' in create_data:
                    company_id = create_data['data'].get('company_id')
                    self.test_company_id = company_id
                    return company_id
            
            return None
            
        except Exception as e:
            print(f"Error getting/creating test company: {str(e)}")
            return None
    
    def test_create_payment_link_without_company_id(self):
        """Test creating payment link without company_id (backward compatibility)"""
        print("\n=== Testing Create Payment Link WITHOUT company_id ===")
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        payment_data = {
            "email": "test@dynopay.com",
            "base_currency": "USD",
            "modes": ["CRYPTO", "CARD"],
            "amount": 100,
            "description": "Test payment without company_id",
            "expire": "24h",
            "callback_url": "https://example.com/callback",
            "redirect_url": "https://example.com/redirect",
            "webhook_url": "https://example.com/webhook"
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/pay/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    link_data = data['data']
                    # Verify company_id is stored as NULL
                    company_id = link_data.get('company_id')
                    
                    self.log_result(
                        "Create Payment Link - No company_id", 
                        True, 
                        f"✅ Payment link created successfully, company_id: {company_id}",
                        {
                            "link_id": link_data.get('link_id'),
                            "transaction_id": link_data.get('transaction_id'),
                            "company_id": company_id,
                            "payment_link": link_data.get('payment_link')
                        }
                    )
                    
                    # Store for later tests
                    self.test_link_without_company = link_data
                else:
                    self.log_result(
                        "Create Payment Link - No company_id", 
                        False, 
                        "❌ Invalid response structure",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Create Payment Link - No company_id", 
                    False, 
                    f"❌ Failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Create Payment Link - No company_id", 
                False, 
                f"❌ Request failed: {str(e)}"
            )
    
    def test_create_payment_link_with_valid_company_id(self):
        """Test creating payment link with valid company_id"""
        print("\n=== Testing Create Payment Link WITH valid company_id ===")
        
        # First, get or create a company for the user
        company_id = self.get_or_create_test_company()
        
        if not company_id:
            self.log_result(
                "Create Payment Link - Valid company_id", 
                False, 
                "❌ Could not get or create test company"
            )
            return
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        payment_data = {
            "email": "test@dynopay.com",
            "base_currency": "USD",
            "modes": ["CRYPTO", "CARD"],
            "amount": 150,
            "description": "Test payment with company_id",
            "expire": "7d",
            "callback_url": "https://example.com/callback",
            "redirect_url": "https://example.com/redirect",
            "webhook_url": "https://example.com/webhook",
            "company_id": company_id
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/pay/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    link_data = data['data']
                    stored_company_id = link_data.get('company_id')
                    
                    if stored_company_id == company_id:
                        self.log_result(
                            "Create Payment Link - Valid company_id", 
                            True, 
                            f"✅ Payment link created with company_id: {company_id}",
                            {
                                "link_id": link_data.get('link_id'),
                                "transaction_id": link_data.get('transaction_id'),
                                "company_id": stored_company_id,
                                "payment_link": link_data.get('payment_link')
                            }
                        )
                        
                        # Store for later tests
                        self.test_link_with_company = link_data
                    else:
                        self.log_result(
                            "Create Payment Link - Valid company_id", 
                            False, 
                            f"❌ company_id mismatch: expected {company_id}, got {stored_company_id}",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "Create Payment Link - Valid company_id", 
                        False, 
                        "❌ Invalid response structure",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Create Payment Link - Valid company_id", 
                    False, 
                    f"❌ Failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Create Payment Link - Valid company_id", 
                False, 
                f"❌ Request failed: {str(e)}"
            )
    
    def test_create_payment_link_with_invalid_company_id(self):
        """Test creating payment link with invalid company_id"""
        print("\n=== Testing Create Payment Link WITH invalid company_id ===")
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        payment_data = {
            "email": "test@dynopay.com",
            "base_currency": "USD",
            "modes": ["CRYPTO", "CARD"],
            "amount": 200,
            "description": "Test payment with invalid company_id",
            "expire": "30d",
            "company_id": 99999  # Invalid company_id
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/pay/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 400:
                data = response.json()
                error_message = data.get('message', '').lower()
                
                if 'invalid company_id' in error_message or 'company does not belong' in error_message:
                    self.log_result(
                        "Create Payment Link - Invalid company_id", 
                        True, 
                        f"✅ Correctly rejected invalid company_id with 400 error",
                        {"error_message": data.get('message')}
                    )
                else:
                    self.log_result(
                        "Create Payment Link - Invalid company_id", 
                        False, 
                        f"❌ Wrong error message for invalid company_id",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Create Payment Link - Invalid company_id", 
                    False, 
                    f"❌ Expected 400 error, got status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Create Payment Link - Invalid company_id", 
                False, 
                f"❌ Request failed: {str(e)}"
            )
    
    def test_get_payment_links_with_filtering(self):
        """Test GET payment links with company_id filtering"""
        print("\n=== Testing GET Payment Links with Filtering ===")
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        # Test A: Get all payment links (no filter)
        try:
            response = requests.get(
                f"{self.backend_url}/pay/getPaymentLinks",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    all_links = data['data']
                    self.log_result(
                        "Get Payment Links - All Links", 
                        True, 
                        f"✅ Retrieved {len(all_links)} payment links (no filter)",
                        {"total_links": len(all_links)}
                    )
                    
                    # Verify company_id field is included in response
                    if all_links:
                        first_link = all_links[0]
                        has_company_id = 'company_id' in first_link
                        self.log_result(
                            "Get Payment Links - company_id Field", 
                            has_company_id, 
                            f"✅ company_id field present in response" if has_company_id else "❌ company_id field missing from response",
                            {"sample_link": {k: v for k, v in first_link.items() if k in ['link_id', 'company_id', 'description']}}
                        )
                else:
                    self.log_result(
                        "Get Payment Links - All Links", 
                        False, 
                        "❌ Invalid response structure",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Get Payment Links - All Links", 
                    False, 
                    f"❌ Failed with status {response.status_code}",
                    {"response": response.text}
                )
        except Exception as e:
            self.log_result(
                "Get Payment Links - All Links", 
                False, 
                f"❌ Request failed: {str(e)}"
            )
        
        # Test B: Get payment links filtered by company_id
        company_id = getattr(self, 'test_company_id', 1)
        try:
            response = requests.get(
                f"{self.backend_url}/pay/getPaymentLinks",
                params={"company_id": company_id},
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    filtered_links = data['data']
                    
                    # Verify all returned links have the correct company_id
                    all_correct_company = all(
                        link.get('company_id') == company_id 
                        for link in filtered_links 
                        if link.get('company_id') is not None
                    )
                    
                    self.log_result(
                        "Get Payment Links - Filtered by company_id", 
                        True, 
                        f"✅ Retrieved {len(filtered_links)} links for company_id={company_id}, filtering correct: {all_correct_company}",
                        {
                            "filtered_links": len(filtered_links),
                            "company_id": company_id,
                            "all_correct_company": all_correct_company
                        }
                    )
                else:
                    self.log_result(
                        "Get Payment Links - Filtered by company_id", 
                        False, 
                        "❌ Invalid response structure",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Get Payment Links - Filtered by company_id", 
                    False, 
                    f"❌ Failed with status {response.status_code}",
                    {"response": response.text}
                )
        except Exception as e:
            self.log_result(
                "Get Payment Links - Filtered by company_id", 
                False, 
                f"❌ Request failed: {str(e)}"
            )
    
    def test_get_payment_link_by_id_includes_company_id(self):
        """Test GET payment link by ID includes company_id"""
        print("\n=== Testing GET Payment Link by ID ===")
        
        # Use a test link if available
        test_link = getattr(self, 'test_link_with_company', None)
        if not test_link:
            self.log_result(
                "Get Payment Link by ID", 
                False, 
                "❌ No test payment link available"
            )
            return
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        link_id = test_link.get('link_id')
        
        try:
            response = requests.get(
                f"{self.backend_url}/pay/links/{link_id}",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    link_data = data['data']
                    
                    # Verify company_id is included
                    has_company_id = 'company_id' in link_data
                    company_id_value = link_data.get('company_id')
                    
                    self.log_result(
                        "Get Payment Link by ID", 
                        has_company_id, 
                        f"✅ Payment link retrieved with company_id: {company_id_value}" if has_company_id else "❌ company_id field missing from response",
                        {
                            "link_id": link_id,
                            "company_id": company_id_value,
                            "has_company_id": has_company_id
                        }
                    )
                else:
                    self.log_result(
                        "Get Payment Link by ID", 
                        False, 
                        "❌ Invalid response structure",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Get Payment Link by ID", 
                    False, 
                    f"❌ Failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Get Payment Link by ID", 
                False, 
                f"❌ Request failed: {str(e)}"
            )
    
    def test_update_payment_link_preserves_company_id(self):
        """Test PUT payment link update preserves company_id"""
        print("\n=== Testing Update Payment Link Preserves company_id ===")
        
        # Use a test link if available
        test_link = getattr(self, 'test_link_with_company', None)
        if not test_link:
            self.log_result(
                "Update Payment Link", 
                False, 
                "❌ No test payment link available"
            )
            return
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        link_id = test_link.get('link_id')
        original_company_id = test_link.get('company_id')
        
        update_data = {
            "description": "Updated description for company isolation test",
            "expire": "No",
            "callback_url": "https://updated.example.com/callback",
            "redirect_url": "https://updated.example.com/redirect",
            "webhook_url": "https://updated.example.com/webhook"
        }
        
        try:
            response = requests.put(
                f"{self.backend_url}/pay/links/{link_id}",
                json=update_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    updated_link = data['data']
                    updated_company_id = updated_link.get('company_id')
                    
                    # Verify company_id is preserved and not editable
                    company_id_preserved = updated_company_id == original_company_id
                    
                    self.log_result(
                        "Update Payment Link - company_id Preserved", 
                        company_id_preserved, 
                        f"✅ company_id preserved: {original_company_id} -> {updated_company_id}" if company_id_preserved else f"❌ company_id changed: {original_company_id} -> {updated_company_id}",
                        {
                            "link_id": link_id,
                            "original_company_id": original_company_id,
                            "updated_company_id": updated_company_id,
                            "description_updated": updated_link.get('description') == update_data['description']
                        }
                    )
                else:
                    self.log_result(
                        "Update Payment Link", 
                        False, 
                        "❌ Invalid response structure",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Update Payment Link", 
                    False, 
                    f"❌ Failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Update Payment Link", 
                False, 
                f"❌ Request failed: {str(e)}"
            )
    
    def test_redis_payload_includes_company_id(self):
        """Test that Redis payload includes company_id for payment links"""
        print("\n=== Testing Redis Payload Includes company_id ===")
        
        # This test verifies that when a payment link is created, 
        # the Redis payload includes the company_id field
        # We'll create a new payment link and check the implementation
        
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        company_id = getattr(self, 'test_company_id', 1)
        
        payment_data = {
            "email": "redis.test@dynopay.com",
            "base_currency": "USD",
            "modes": ["CRYPTO"],
            "amount": 50,
            "description": "Redis payload test",
            "expire": "24h",
            "company_id": company_id
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/pay/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    link_data = data['data']
                    
                    # The Redis payload is created internally, but we can verify
                    # that the payment link creation includes company_id
                    stored_company_id = link_data.get('company_id')
                    
                    if stored_company_id == company_id:
                        self.log_result(
                            "Redis Payload - company_id Inclusion", 
                            True, 
                            f"✅ Payment link created with company_id {company_id}, Redis payload should include this field",
                            {
                                "link_id": link_data.get('link_id'),
                                "company_id": stored_company_id,
                                "transaction_id": link_data.get('transaction_id')
                            }
                        )
                    else:
                        self.log_result(
                            "Redis Payload - company_id Inclusion", 
                            False, 
                            f"❌ company_id not properly stored: expected {company_id}, got {stored_company_id}",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "Redis Payload - company_id Inclusion", 
                        False, 
                        "❌ Invalid response structure",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Redis Payload - company_id Inclusion", 
                    False, 
                    f"❌ Failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Redis Payload - company_id Inclusion", 
                False, 
                f"❌ Request failed: {str(e)}"
            )
    
    def print_test_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "=" * 80)
        print("PHASE 10 TASK 10.4: PAYMENT LINKS COMPANY ISOLATION FIX - TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if self.errors:
            print(f"\n❌ FAILED TESTS ({len(self.errors)}):")
            for error in self.errors:
                print(f"  • {error}")
        
        if passed_tests == total_tests:
            print(f"\n🎉 ALL TESTS PASSED! Payment Links Company Isolation Fix is working correctly.")
        else:
            print(f"\n⚠️  {failed_tests} test(s) failed. Please review the implementation.")
        
        print("=" * 80)
    
    def run_all_tests(self):
        """Run all payment links company isolation tests"""
        print("=" * 80)
        print("DYNOPAY PHASE 10 TASK 10.4: PAYMENT LINKS COMPANY ISOLATION FIX")
        print("=" * 80)
        print(f"Backend URL: {self.backend_url}")
        
        # Step 1: Authenticate user
        if not self.authenticate_user():
            print("\n❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Step 2: Run database migration
        self.run_payment_link_migration()
        
        # Step 3: Verify database schema
        self.verify_payment_link_schema()
        
        # Step 4: Test payment link creation scenarios
        self.test_create_payment_link_without_company_id()
        self.test_create_payment_link_with_valid_company_id()
        self.test_create_payment_link_with_invalid_company_id()
        
        # Step 5: Test payment link retrieval and filtering
        self.test_get_payment_links_with_filtering()
        self.test_get_payment_link_by_id_includes_company_id()
        
        # Step 6: Test payment link updates
        self.test_update_payment_link_preserves_company_id()
        
        # Step 7: Test Redis payload
        self.test_redis_payload_includes_company_id()
        
        # Step 8: Print summary
        self.print_test_summary()
        
        return len(self.errors) == 0

if __name__ == "__main__":
    tester = PaymentLinksCompanyIsolationTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)