#!/usr/bin/env python3
"""
DynoPay Backend API Test Suite
Tests specific fixes for the crypto payment processing platform
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

class DynoPayTester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.access_token: Optional[str] = None
        
    def test_backend_health(self) -> bool:
        """Test 1: Backend Health Check - GET /api/status"""
        print("🔍 Test 1: Backend Health Check")
        try:
            response = self.session.get(f"{self.base_url}/api/status")
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
                return False
                
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Check for overall_status in nested data structure
            overall_status = data.get('overall_status')
            if 'data' in data and isinstance(data['data'], dict):
                overall_status = data['data'].get('overall_status')
            
            if overall_status != 'operational':
                print(f"   ❌ FAIL: Expected overall_status='operational', got '{overall_status}'")
                return False
                
            print("   ✅ PASS: Health check successful")
            return True
            
        except Exception as e:
            print(f"   ❌ FAIL: Exception during health check: {str(e)}")
            return False
    
    def test_login(self) -> bool:
        """Test 2: User Login - POST /api/user/login"""
        print("\n🔍 Test 2: User Login")
        try:
            login_data = {
                "email": "nomadly@moxx.co",
                "password": "Katiekendra123@"
            }
            
            response = self.session.post(
                f"{self.base_url}/api/user/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
            data = response.json()
            print(f"   Response keys: {list(data.keys())}")
            
            # Check for accessToken in various possible locations
            access_token = None
            if 'accessToken' in data:
                access_token = data['accessToken']
            elif 'data' in data and isinstance(data['data'], dict) and 'accessToken' in data['data']:
                access_token = data['data']['accessToken']
            elif 'token' in data:
                access_token = data['token']
            
            if not access_token:
                print(f"   ❌ FAIL: No accessToken found in response")
                print(f"   Full response: {json.dumps(data, indent=2)}")
                return False
                
            self.access_token = access_token
            print(f"   ✅ PASS: Login successful, token acquired")
            return True
            
        except Exception as e:
            print(f"   ❌ FAIL: Exception during login: {str(e)}")
            return False
    
    def test_payment_link_920_status(self) -> bool:
        """Test 3: Payment Link #920 Status Check"""
        print("\n🔍 Test 3: Payment Link #920 Status (should be 'Completed')")
        
        if not self.access_token:
            print("   ❌ FAIL: No access token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = self.session.get(
                f"{self.base_url}/api/pay/getPaymentLinks?company_id=3",
                headers=headers
            )
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
            data = response.json()
            
            # Find payment link with link_id = 920
            payment_links = data.get('data', []) if 'data' in data else data
            if isinstance(payment_links, dict):
                payment_links = payment_links.get('paymentLinks', [])
                
            link_920 = None
            for link in payment_links:
                if str(link.get('link_id')) == '920' or link.get('id') == 920:
                    link_920 = link
                    break
                    
            if not link_920:
                print(f"   ❌ FAIL: Payment link #920 not found")
                print(f"   Available links: {[link.get('link_id', link.get('id')) for link in payment_links]}")
                return False
                
            status = link_920.get('status')
            print(f"   Link #920 Status: '{status}'")
            
            if status != 'Completed':
                print(f"   ❌ FAIL: Expected status='Completed', got '{status}'")
                return False
                
            print("   ✅ PASS: Payment link #920 has status 'Completed'")
            return True
            
        except Exception as e:
            print(f"   ❌ FAIL: Exception during payment link check: {str(e)}")
            return False
    
    def test_transaction_history(self) -> bool:
        """Test 4: Transaction History - Find $42 BTC transaction"""
        print("\n🔍 Test 4: Transaction History ($42 BTC transaction)")
        
        if not self.access_token:
            print("   ❌ FAIL: No access token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = self.session.get(
                f"{self.base_url}/api/company/getTransactions/3?page=1&limit=10",
                headers=headers
            )
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
            data = response.json()
            transactions = data.get('data', []) if 'data' in data else data
            if isinstance(transactions, dict):
                transactions = transactions.get('transactions', [])
                
            # Find transaction with base_amount=42, status="successful", crypto_currency="BTC"
            target_transaction = None
            for txn in transactions:
                base_amount = txn.get('base_amount') or txn.get('amount') or txn.get('base_value')
                status = txn.get('status')
                crypto_currency = txn.get('crypto_currency') or txn.get('currency')
                
                if (str(base_amount) == '42' and 
                    status == 'successful' and 
                    crypto_currency == 'BTC'):
                    target_transaction = txn
                    break
                    
            if not target_transaction:
                print(f"   ❌ FAIL: No transaction found with base_amount=42, status='successful', crypto_currency='BTC'")
                print(f"   Available transactions:")
                for i, txn in enumerate(transactions[:3]):  # Show first 3
                    amount = txn.get('base_amount') or txn.get('amount') or txn.get('base_value')
                    status = txn.get('status')
                    currency = txn.get('crypto_currency') or txn.get('currency')
                    print(f"     {i+1}. Amount: {amount}, Status: {status}, Currency: {currency}")
                return False
                
            print("   ✅ PASS: Found $42 BTC successful transaction")
            return True
            
        except Exception as e:
            print(f"   ❌ FAIL: Exception during transaction history check: {str(e)}")
            return False
    
    def test_checkout_page_completed_payment(self) -> bool:
        """Test 5: Checkout Page Status for Completed Payment"""
        print("\n🔍 Test 5: Checkout Page Status for Completed Payment")
        
        try:
            checkout_data = {
                "data": "11cf30c7f8fcc76dc274a3260727807e18ba2b4236cfc8da"
            }
            
            response = self.session.post(
                f"{self.base_url}/api/pay/getData",
                json=checkout_data,
                headers={"Content-Type": "application/json"}
            )
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
            data = response.json()
            print(f"   Response keys: {list(data.keys())}")
            
            # Check for required fields
            payment_completed = data.get('payment_completed')
            status = data.get('status') 
            paid_amount = data.get('paid_amount')
            
            # Check nested data structure if needed
            if 'data' in data and isinstance(data['data'], dict):
                nested_data = data['data']
                payment_completed = payment_completed or nested_data.get('payment_completed')
                status = status or nested_data.get('status')
                paid_amount = paid_amount or nested_data.get('paid_amount')
            
            print(f"   payment_completed: {payment_completed}")
            print(f"   status: {status}")
            print(f"   paid_amount: {paid_amount}")
            
            if payment_completed != True:
                print(f"   ❌ FAIL: Expected payment_completed=true, got {payment_completed}")
                return False
                
            if status != 'successful':
                print(f"   ❌ FAIL: Expected status='successful', got '{status}'")
                return False
                
            expected_paid_amount = 0.00060867
            if abs(float(paid_amount) - expected_paid_amount) > 0.00000001:
                print(f"   ❌ FAIL: Expected paid_amount={expected_paid_amount}, got {paid_amount}")
                return False
                
            print("   ✅ PASS: Checkout page shows completed payment with correct details")
            return True
            
        except Exception as e:
            print(f"   ❌ FAIL: Exception during checkout page check: {str(e)}")
            return False
    
    def test_transaction_auto_convert_display(self) -> bool:
        """Test 6: Transaction Status with Auto-Convert Display"""
        print("\n🔍 Test 6: Transaction Status with Auto-Convert Display")
        
        if not self.access_token:
            print("   ❌ FAIL: No access token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = self.session.get(
                f"{self.base_url}/api/company/getTransactions/3?page=1&limit=10",
                headers=headers
            )
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
            data = response.json()
            transactions = data.get('data', []) if 'data' in data else data
            if isinstance(transactions, dict):
                transactions = transactions.get('transactions', [])
            
            if not transactions:
                print("   ❌ FAIL: No transactions found in response")
                return False
                
            print(f"   Found {len(transactions)} transactions")
            
            # Check each transaction for required fields
            auto_converted_found = False
            status_issues = []
            auto_convert_issues = []
            
            for i, txn in enumerate(transactions):
                txn_id = txn.get('id') or txn.get('transaction_id') or f"Transaction {i+1}"
                
                # Check if status field is present
                if 'status' not in txn:
                    status_issues.append(f"Transaction {txn_id}: Missing 'status' field")
                
                # Check for auto_converted field
                auto_converted = txn.get('auto_converted')
                if auto_converted is True:
                    auto_converted_found = True
                    print(f"   Found auto-converted transaction: {txn_id}")
                    
                    # Check for auto_convert object with display_status
                    auto_convert_obj = txn.get('auto_convert')
                    if not auto_convert_obj:
                        auto_convert_issues.append(f"Transaction {txn_id}: Missing 'auto_convert' object")
                    elif not isinstance(auto_convert_obj, dict):
                        auto_convert_issues.append(f"Transaction {txn_id}: 'auto_convert' is not an object")
                    elif 'display_status' not in auto_convert_obj:
                        auto_convert_issues.append(f"Transaction {txn_id}: 'auto_convert' object missing 'display_status' field")
                    else:
                        print(f"   ✓ Transaction {txn_id}: auto_convert.display_status = '{auto_convert_obj['display_status']}'")
            
            # Report issues
            if status_issues:
                print("   ❌ Status field issues:")
                for issue in status_issues:
                    print(f"     - {issue}")
                return False
                
            if auto_convert_issues:
                print("   ❌ Auto-convert display issues:")
                for issue in auto_convert_issues:
                    print(f"     - {issue}")
                return False
            
            if auto_converted_found:
                print("   ✅ PASS: Auto-converted transactions have proper display_status fields")
            else:
                print("   ✅ PASS: All transactions have status field (no auto-converted transactions found)")
            
            return True
            
        except Exception as e:
            print(f"   ❌ FAIL: Exception during auto-convert display check: {str(e)}")
            return False
    
    def test_payment_link_status_normalization(self) -> bool:
        """Test 7: Payment Link Status Normalization (lowercase)"""
        print("\n🔍 Test 7: Payment Link Status Normalization (lowercase)")
        
        if not self.access_token:
            print("   ❌ FAIL: No access token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = self.session.get(
                f"{self.base_url}/api/pay/getPaymentLinks?company_id=3",
                headers=headers
            )
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
            data = response.json()
            payment_links = data.get('data', []) if 'data' in data else data
            if isinstance(payment_links, dict):
                payment_links = payment_links.get('paymentLinks', [])
            
            if not payment_links:
                print("   ❌ FAIL: No payment links found in response")
                return False
                
            print(f"   Found {len(payment_links)} payment links")
            
            # Check each payment link for status normalization
            status_issues = []
            link_920_found = False
            
            for link in payment_links:
                link_id = link.get('link_id') or link.get('id')
                status = link.get('status')
                
                if not status:
                    status_issues.append(f"Link {link_id}: Missing 'status' field")
                    continue
                
                # Check if status is lowercase
                if status != status.lower():
                    status_issues.append(f"Link {link_id}: Status '{status}' is not lowercase (should be '{status.lower()}')")
                
                # Special check for link_id=920
                if str(link_id) == '920':
                    link_920_found = True
                    print(f"   Found link_id=920 with status='{status}'")
                    if status != 'completed':
                        status_issues.append(f"Link 920: Status should be 'completed' (lowercase), got '{status}'")
                    else:
                        print("   ✓ Link 920 has correct lowercase status 'completed'")
            
            # Report issues
            if status_issues:
                print("   ❌ Status normalization issues:")
                for issue in status_issues:
                    print(f"     - {issue}")
                return False
            
            if not link_920_found:
                print("   ⚠️  Warning: link_id=920 not found in current results")
            
            print("   ✅ PASS: All payment link statuses are properly normalized to lowercase")
            return True
            
        except Exception as e:
            print(f"   ❌ FAIL: Exception during status normalization check: {str(e)}")
            return False

def main():
    # Use the backend URL from frontend/.env
    backend_url = "https://checkout-flow-demo-1.preview.emergentagent.com"
    
    print("=" * 60)
    print("DynoPay Backend API Test Suite")
    print("Testing specific fixes for crypto payment processing")
    print(f"Backend URL: {backend_url}")
    print("=" * 60)
    
    tester = DynoPayTester(backend_url)
    
    # Run all tests in sequence
    tests = [
        ("Backend Health Check", tester.test_backend_health),
        ("User Authentication", tester.test_login),
        ("Payment Link #920 Status", tester.test_payment_link_920_status),
        ("Transaction History", tester.test_transaction_history),
        ("Checkout Page Status", tester.test_checkout_page_completed_payment),
        ("Transaction Status with Auto-Convert Display", tester.test_transaction_auto_convert_display),
        ("Payment Link Status Normalization", tester.test_payment_link_status_normalization),
    ]
    
    results = []
    for test_name, test_func in tests:
        result = test_func()
        results.append((test_name, result))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! DynoPay backend fixes are working correctly.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. See details above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())