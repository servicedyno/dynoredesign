#!/usr/bin/env python3
"""
DynoPay Backend API Test Suite
Tests the dashboard API with focus on today_summary data
"""

import requests
import json
import os
from typing import Dict, Any, Optional

class DynoPayAPITester:
    def __init__(self):
        # Read the backend URL from frontend env file
        self.backend_url = self._get_backend_url()
        self.session = requests.Session()
        self.access_token: Optional[str] = None
        self.test_results = {
            'login': False,
            'dashboard': False,
            'today_summary_structure': False,
            'today_summary_data': False,
            'existing_dashboard_fields': False
        }
        
    def _get_backend_url(self) -> str:
        """Read backend URL from frontend .env file"""
        env_path = '/app/frontend/.env'
        try:
            with open(env_path, 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        backend_url = line.split('=', 1)[1].strip()
                        print(f"✓ Using backend URL from frontend/.env: {backend_url}")
                        return backend_url
        except Exception as e:
            print(f"⚠ Could not read from {env_path}: {e}")
        
        # Fallback to localhost as per review request
        fallback_url = "http://localhost:8001"
        print(f"✓ Using fallback backend URL: {fallback_url}")
        return fallback_url
    
    def test_login(self, email: str = "nomadly@moxx.co", password: str = "Katiekendra123@") -> bool:
        """Test user login and get access token"""
        print(f"\n🔐 Testing login with {email}...")
        
        login_url = f"{self.backend_url}/api/user/login"
        login_data = {
            "email": email,
            "password": password
        }
        
        try:
            response = self.session.post(login_url, json=login_data, timeout=30)
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    self.access_token = data['data']['accessToken']
                    self.session.headers.update({
                        'Authorization': f"Bearer {self.access_token}"
                    })
                    print(f"   ✓ Login successful, got access token")
                    self.test_results['login'] = True
                    return True
                else:
                    print(f"   ❌ No access token in response: {data}")
                    return False
            else:
                print(f"   ❌ Login failed: {response.text}")
                return False
                
        except Exception as e:
            print(f"   ❌ Login request failed: {e}")
            return False
    
    def test_dashboard_api(self) -> bool:
        """Test dashboard API and verify today_summary data"""
        if not self.access_token:
            print("❌ Cannot test dashboard - no access token")
            return False
            
        print(f"\n📊 Testing dashboard API...")
        
        dashboard_url = f"{self.backend_url}/api/dashboard"
        
        try:
            response = self.session.get(dashboard_url, timeout=30)
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"   ❌ Dashboard API failed: {response.text}")
                return False
            
            data = response.json()
            print(f"   ✓ Dashboard API responded successfully")
            
            # Check if response has expected structure
            if 'data' not in data:
                print(f"   ❌ No 'data' field in response")
                return False
                
            dashboard_data = data['data']
            self.test_results['dashboard'] = True
            
            # Test today_summary structure
            return self._test_today_summary(dashboard_data) and self._test_existing_fields(dashboard_data)
            
        except Exception as e:
            print(f"   ❌ Dashboard request failed: {e}")
            return False
    
    def _test_today_summary(self, dashboard_data: Dict[str, Any]) -> bool:
        """Test today_summary object structure and data"""
        print(f"\n📈 Testing today_summary structure...")
        
        if 'today_summary' not in dashboard_data:
            print(f"   ❌ No 'today_summary' field in dashboard data")
            return False
            
        today_summary = dashboard_data['today_summary']
        print(f"   ✓ today_summary field found")
        
        # Required fields for today_summary
        required_fields = {
            'volume_today': (int, float),
            'volume_today_formatted': str,
            'volume_yesterday': (int, float),
            'volume_yesterday_formatted': str,
            'volume_change_percent': (int, float),
            'transactions_today': int,
            'transactions_yesterday': int,
            'transactions_change_percent': (int, float),
            'pending_count': int,
            'currency': str
        }
        
        missing_fields = []
        invalid_types = []
        
        for field, expected_type in required_fields.items():
            if field not in today_summary:
                missing_fields.append(field)
            else:
                value = today_summary[field]
                if isinstance(expected_type, tuple):
                    # Multiple valid types
                    if not any(isinstance(value, t) for t in expected_type):
                        invalid_types.append(f"{field}: {type(value).__name__} (expected {' or '.join(t.__name__ for t in expected_type)})")
                else:
                    # Single type
                    if not isinstance(value, expected_type):
                        invalid_types.append(f"{field}: {type(value).__name__} (expected {expected_type.__name__})")
        
        if missing_fields:
            print(f"   ❌ Missing required fields: {missing_fields}")
            return False
            
        if invalid_types:
            print(f"   ❌ Invalid field types: {invalid_types}")
            return False
            
        self.test_results['today_summary_structure'] = True
        print(f"   ✓ All required fields present with correct types")
        
        # Test data values
        print(f"\n📊 Testing today_summary data values...")
        
        print(f"   Volume Today: {today_summary['volume_today']} ({today_summary['volume_today_formatted']})")
        print(f"   Volume Yesterday: {today_summary['volume_yesterday']} ({today_summary['volume_yesterday_formatted']})")
        print(f"   Volume Change: {today_summary['volume_change_percent']}%")
        print(f"   Transactions Today: {today_summary['transactions_today']}")
        print(f"   Transactions Yesterday: {today_summary['transactions_yesterday']}")
        print(f"   Transactions Change: {today_summary['transactions_change_percent']}%")
        print(f"   Pending Count: {today_summary['pending_count']}")
        print(f"   Currency: {today_summary['currency']}")
        
        # Basic data validation
        errors = []
        
        # Volume values should be non-negative
        if today_summary['volume_today'] < 0:
            errors.append("volume_today cannot be negative")
        if today_summary['volume_yesterday'] < 0:
            errors.append("volume_yesterday cannot be negative")
            
        # Transaction counts should be non-negative integers
        if today_summary['transactions_today'] < 0:
            errors.append("transactions_today cannot be negative")
        if today_summary['transactions_yesterday'] < 0:
            errors.append("transactions_yesterday cannot be negative")
        if today_summary['pending_count'] < 0:
            errors.append("pending_count cannot be negative")
            
        # Currency should not be empty
        if not today_summary['currency'].strip():
            errors.append("currency cannot be empty")
            
        # Formatted values should not be empty
        if not today_summary['volume_today_formatted'].strip():
            errors.append("volume_today_formatted cannot be empty")
        if not today_summary['volume_yesterday_formatted'].strip():
            errors.append("volume_yesterday_formatted cannot be empty")
        
        if errors:
            print(f"   ❌ Data validation errors: {errors}")
            return False
            
        self.test_results['today_summary_data'] = True
        print(f"   ✓ today_summary data validation passed")
        return True
    
    def _test_existing_fields(self, dashboard_data: Dict[str, Any]) -> bool:
        """Test that existing dashboard fields still work"""
        print(f"\n🔍 Testing existing dashboard fields...")
        
        # Expected existing fields based on controller code
        expected_fields = {
            'total_transactions': dict,
            'total_volume': dict,
            'pending_transactions': dict,
            'active_wallets': dict,
            'fee_tier': dict
        }
        
        missing_fields = []
        invalid_types = []
        
        for field, expected_type in expected_fields.items():
            if field not in dashboard_data:
                missing_fields.append(field)
            else:
                if not isinstance(dashboard_data[field], expected_type):
                    invalid_types.append(f"{field}: {type(dashboard_data[field]).__name__} (expected {expected_type.__name__})")
        
        if missing_fields:
            print(f"   ❌ Missing existing fields: {missing_fields}")
            return False
            
        if invalid_types:
            print(f"   ❌ Invalid field types in existing fields: {invalid_types}")
            return False
            
        # Test specific structure of key existing fields
        total_transactions = dashboard_data.get('total_transactions', {})
        total_volume = dashboard_data.get('total_volume', {})
        active_wallets = dashboard_data.get('active_wallets', {})
        
        print(f"   Total Transactions Count: {total_transactions.get('count', 'N/A')}")
        print(f"   Total Volume Amount: {total_volume.get('amount', 'N/A')} {total_volume.get('currency', '')}")
        print(f"   Active Wallets Count: {active_wallets.get('count', 'N/A')}")
        
        self.test_results['existing_dashboard_fields'] = True
        print(f"   ✓ Existing dashboard fields validation passed")
        return True
    
    def run_all_tests(self) -> Dict[str, bool]:
        """Run all tests and return results"""
        print("🚀 Starting DynoPay Backend API Tests")
        print(f"Backend URL: {self.backend_url}")
        
        # Test 1: Login
        if not self.test_login():
            print("❌ Login test failed - cannot proceed with other tests")
            return self.test_results
            
        # Test 2: Dashboard API
        self.test_dashboard_api()
        
        return self.test_results
    
    def print_summary(self):
        """Print test summary"""
        print(f"\n" + "="*60)
        print("📋 TEST SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result)
        
        for test_name, result in self.test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} {test_name.replace('_', ' ').title()}")
        
        print(f"\n🎯 Overall: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 All tests passed! Dashboard today_summary API is working correctly.")
        else:
            failed_tests = [name for name, result in self.test_results.items() if not result]
            print(f"⚠️  Failed tests: {', '.join(failed_tests)}")


def main():
    """Main test execution"""
    tester = DynoPayAPITester()
    
    try:
        results = tester.run_all_tests()
        tester.print_summary()
        
        # Return appropriate exit code
        if all(results.values()):
            exit(0)  # All tests passed
        else:
            exit(1)  # Some tests failed
            
    except KeyboardInterrupt:
        print("\n🛑 Tests interrupted by user")
        exit(130)
    except Exception as e:
        print(f"\n💥 Unexpected error during testing: {e}")
        exit(1)


if __name__ == "__main__":
    main()