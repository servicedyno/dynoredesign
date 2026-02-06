#!/usr/bin/env python3
"""
DynoPay Dashboard Currency Display Fix Testing
Tests that dashboard shows amounts in the company's preferred currency as requested in review
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any
import uuid

class DynoPayDashboardCurrencyTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.user_data = None
        
        # Test credentials from review request
        self.test_email = "richard@dyno.pt"
        self.test_password = "Katiekendra123@"
        self.expected_company_id = 38
        
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
        """Authenticate with provided credentials"""
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json={
                    "email": self.test_email,
                    "password": self.test_password
                },
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    self.jwt_token = data['data']['accessToken']
                    self.user_data = data['data']['userData']
                    self.log_result(
                        "Authentication", 
                        True, 
                        f"Successfully authenticated {self.user_data.get('email', 'user')}",
                        {
                            "user_id": self.user_data.get('user_id'),
                            "name": self.user_data.get('name'),
                            "email": self.user_data.get('email')
                        }
                    )
                    return True
                else:
                    self.log_result("Authentication", False, "Login succeeded but no token received")
                    return False
            else:
                self.log_result("Authentication", False, f"Login failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Authentication", False, f"Authentication failed: {str(e)}")
            return False
    
    def get_company_info(self):
        """Get company information to verify company_id"""
        try:
            response = requests.get(
                f"{self.backend_url}/api/company/getCompany",
                headers={"Authorization": f"Bearer {self.jwt_token}"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                companies = data.get('data', [])
                
                # Find company with expected ID
                target_company = None
                for company in companies:
                    if company.get('company_id') == self.expected_company_id:
                        target_company = company
                        break
                
                if target_company:
                    self.log_result(
                        "Company Info", 
                        True, 
                        f"Found company {target_company.get('company_name', 'Unknown')} with ID {self.expected_company_id}",
                        {
                            "company_id": target_company.get('company_id'),
                            "company_name": target_company.get('company_name'),
                            "total_companies": len(companies)
                        }
                    )
                    return target_company
                else:
                    self.log_result(
                        "Company Info", 
                        False, 
                        f"Company ID {self.expected_company_id} not found. Available companies: {[c.get('company_id') for c in companies]}"
                    )
                    return None
            else:
                self.log_result("Company Info", False, f"Failed to get companies: status {response.status_code}")
                return None
                
        except Exception as e:
            self.log_result("Company Info", False, f"Company info request failed: {str(e)}")
            return None
    
    def get_api_key_currency(self):
        """Get API keys and check their base_currency"""
        try:
            response = requests.get(
                f"{self.backend_url}/api/userApi/getApi",
                headers={"Authorization": f"Bearer {self.jwt_token}"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                api_data = data.get('data', {})
                
                # Handle both single API key and grouped format
                if isinstance(api_data, dict) and 'all' in api_data:
                    api_list = api_data['all']
                elif isinstance(api_data, list):
                    api_list = api_data
                else:
                    api_list = [api_data] if api_data else []
                
                # Find API keys for the target company
                company_api_keys = []
                for api_key in api_list:
                    if api_key.get('company_id') == self.expected_company_id:
                        company_api_keys.append(api_key)
                
                if company_api_keys:
                    # Get the most recent active API key
                    active_keys = [k for k in company_api_keys if k.get('status') == 'active']
                    if active_keys:
                        # Sort by creation date (most recent first)
                        active_keys.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
                        primary_key = active_keys[0]
                        
                        base_currency = primary_key.get('base_currency', 'USD')
                        self.log_result(
                            "API Key Currency", 
                            True, 
                            f"Company {self.expected_company_id} has API key with base_currency: {base_currency}",
                            {
                                "api_id": primary_key.get('api_id'),
                                "api_name": primary_key.get('api_name'),
                                "base_currency": base_currency,
                                "status": primary_key.get('status'),
                                "environment": primary_key.get('environment'),
                                "total_company_keys": len(company_api_keys),
                                "active_keys": len(active_keys)
                            }
                        )
                        return base_currency
                    else:
                        self.log_result(
                            "API Key Currency", 
                            False, 
                            f"No active API keys found for company {self.expected_company_id}. Total keys: {len(company_api_keys)}"
                        )
                        return None
                else:
                    self.log_result(
                        "API Key Currency", 
                        False, 
                        f"No API keys found for company {self.expected_company_id}. Total API keys: {len(api_list)}"
                    )
                    return None
            else:
                self.log_result("API Key Currency", False, f"Failed to get API keys: status {response.status_code}")
                return None
                
        except Exception as e:
            self.log_result("API Key Currency", False, f"API key request failed: {str(e)}")
            return None
    
    def test_dashboard_with_company_filter(self, expected_currency):
        """Test dashboard with company_id filter - should show company's preferred currency"""
        try:
            response = requests.get(
                f"{self.backend_url}/api/dashboard",
                params={"company_id": self.expected_company_id},
                headers={"Authorization": f"Bearer {self.jwt_token}"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                dashboard_data = data.get('data', {})
                total_volume = dashboard_data.get('total_volume', {})
                currency = total_volume.get('currency', 'USD')
                amount = total_volume.get('amount', 0)
                
                if currency == expected_currency:
                    self.log_result(
                        "Dashboard With Company Filter", 
                        True, 
                        f"Dashboard correctly shows currency as {currency} (expected: {expected_currency})",
                        {
                            "company_id": self.expected_company_id,
                            "currency": currency,
                            "expected_currency": expected_currency,
                            "total_amount": amount,
                            "current_month": total_volume.get('current_month', 0),
                            "total_transactions": dashboard_data.get('total_transactions', {}).get('count', 0)
                        }
                    )
                    return True
                else:
                    self.log_result(
                        "Dashboard With Company Filter", 
                        False, 
                        f"Dashboard shows currency as {currency}, expected {expected_currency}",
                        {
                            "company_id": self.expected_company_id,
                            "actual_currency": currency,
                            "expected_currency": expected_currency,
                            "total_volume_data": total_volume
                        }
                    )
                    return False
            else:
                self.log_result(
                    "Dashboard With Company Filter", 
                    False, 
                    f"Dashboard request failed: status {response.status_code}: {response.text[:200]}"
                )
                return False
                
        except Exception as e:
            self.log_result("Dashboard With Company Filter", False, f"Dashboard request failed: {str(e)}")
            return False
    
    def test_dashboard_without_company_filter(self):
        """Test dashboard without company_id filter - should show USD as default"""
        try:
            response = requests.get(
                f"{self.backend_url}/api/dashboard",
                headers={"Authorization": f"Bearer {self.jwt_token}"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                dashboard_data = data.get('data', {})
                total_volume = dashboard_data.get('total_volume', {})
                currency = total_volume.get('currency', 'USD')
                amount = total_volume.get('amount', 0)
                
                if currency == 'USD':
                    self.log_result(
                        "Dashboard Without Company Filter", 
                        True, 
                        f"Dashboard correctly shows default currency as USD",
                        {
                            "currency": currency,
                            "total_amount": amount,
                            "current_month": total_volume.get('current_month', 0),
                            "total_transactions": dashboard_data.get('total_transactions', {}).get('count', 0)
                        }
                    )
                    return True
                else:
                    self.log_result(
                        "Dashboard Without Company Filter", 
                        False, 
                        f"Dashboard shows currency as {currency}, expected USD for default",
                        {
                            "actual_currency": currency,
                            "expected_currency": "USD",
                            "total_volume_data": total_volume
                        }
                    )
                    return False
            else:
                self.log_result(
                    "Dashboard Without Company Filter", 
                    False, 
                    f"Dashboard request failed: status {response.status_code}: {response.text[:200]}"
                )
                return False
                
        except Exception as e:
            self.log_result("Dashboard Without Company Filter", False, f"Dashboard request failed: {str(e)}")
            return False
    
    def test_currency_conversion_logic(self, expected_currency):
        """Test that amounts are properly converted when currency is not USD"""
        if expected_currency == 'USD':
            self.log_result(
                "Currency Conversion Logic", 
                True, 
                "Currency is USD, no conversion needed",
                {"currency": expected_currency}
            )
            return True
            
        try:
            # Get dashboard data with company filter
            response = requests.get(
                f"{self.backend_url}/api/dashboard",
                params={"company_id": self.expected_company_id},
                headers={"Authorization": f"Bearer {self.jwt_token}"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                dashboard_data = data.get('data', {})
                total_volume = dashboard_data.get('total_volume', {})
                
                # Get dashboard data without company filter (USD)
                usd_response = requests.get(
                    f"{self.backend_url}/api/dashboard",
                    headers={"Authorization": f"Bearer {self.jwt_token}"},
                    timeout=15
                )
                
                if usd_response.status_code == 200:
                    usd_data = usd_response.json()
                    usd_dashboard_data = usd_data.get('data', {})
                    usd_total_volume = usd_dashboard_data.get('total_volume', {})
                    
                    company_amount = total_volume.get('amount', 0)
                    usd_amount = usd_total_volume.get('amount', 0)
                    company_currency = total_volume.get('currency', 'USD')
                    
                    # If amounts are different, conversion likely occurred
                    if company_amount != usd_amount and company_currency != 'USD':
                        self.log_result(
                            "Currency Conversion Logic", 
                            True, 
                            f"Currency conversion detected: {usd_amount} USD vs {company_amount} {company_currency}",
                            {
                                "usd_amount": usd_amount,
                                "converted_amount": company_amount,
                                "converted_currency": company_currency,
                                "conversion_ratio": round(company_amount / usd_amount, 4) if usd_amount > 0 else 0
                            }
                        )
                        return True
                    elif company_amount == usd_amount and company_currency != 'USD':
                        self.log_result(
                            "Currency Conversion Logic", 
                            False, 
                            f"No conversion detected: amounts are identical ({company_amount}) but currencies differ (USD vs {company_currency})",
                            {
                                "usd_amount": usd_amount,
                                "company_amount": company_amount,
                                "company_currency": company_currency
                            }
                        )
                        return False
                    else:
                        self.log_result(
                            "Currency Conversion Logic", 
                            True, 
                            f"Amounts match as expected for same currency or zero amounts",
                            {
                                "amount": company_amount,
                                "currency": company_currency
                            }
                        )
                        return True
                else:
                    self.log_result("Currency Conversion Logic", False, f"Failed to get USD dashboard: status {usd_response.status_code}")
                    return False
            else:
                self.log_result("Currency Conversion Logic", False, f"Failed to get company dashboard: status {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Currency Conversion Logic", False, f"Currency conversion test failed: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all dashboard currency display tests"""
        print("="*80)
        print("DYNOPAY DASHBOARD CURRENCY DISPLAY FIX TESTING")
        print("="*80)
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Credentials: {self.test_email}")
        print(f"Expected Company ID: {self.expected_company_id}")
        print("="*80)
        
        # Step 1: Authenticate
        if not self.authenticate_user():
            print("\n❌ AUTHENTICATION FAILED - Cannot proceed with tests")
            return
        
        # Step 2: Get company info
        company_info = self.get_company_info()
        if not company_info:
            print("\n❌ COMPANY INFO FAILED - Cannot proceed with tests")
            return
        
        # Step 3: Get API key currency
        api_key_currency = self.get_api_key_currency()
        if not api_key_currency:
            print("\n❌ API KEY CURRENCY FAILED - Cannot proceed with tests")
            return
        
        # Step 4: Test dashboard with company filter
        self.test_dashboard_with_company_filter(api_key_currency)
        
        # Step 5: Test dashboard without company filter
        self.test_dashboard_without_company_filter()
        
        # Step 6: Test currency conversion logic
        self.test_currency_conversion_logic(api_key_currency)
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        
        if passed_tests == total_tests:
            print("\n🎉 ALL DASHBOARD CURRENCY DISPLAY TESTS PASSED!")
            print("✅ Dashboard shows amounts in company's preferred currency when company_id is provided")
            print("✅ Dashboard shows USD as default when no company_id is provided")
            print("✅ Currency conversion logic is working correctly")
        else:
            print(f"\n⚠️  {failed_tests} TEST(S) NEED ATTENTION")
            
        # Show key findings
        print("\n" + "="*80)
        print("KEY FINDINGS")
        print("="*80)
        
        for test_name, result in self.test_results.items():
            if result['success']:
                details = result.get('details', {})
                if test_name == "API Key Currency":
                    currency = details.get('base_currency', 'Unknown')
                    print(f"✅ Company API Key Base Currency: {currency}")
                elif test_name == "Dashboard With Company Filter":
                    currency = details.get('currency', 'Unknown')
                    amount = details.get('total_amount', 0)
                    print(f"✅ Dashboard with Company Filter: {amount} {currency}")
                elif test_name == "Dashboard Without Company Filter":
                    currency = details.get('currency', 'Unknown')
                    amount = details.get('total_amount', 0)
                    print(f"✅ Dashboard without Company Filter: {amount} {currency}")

if __name__ == "__main__":
    tester = DynoPayDashboardCurrencyTester()
    tester.run_all_tests()