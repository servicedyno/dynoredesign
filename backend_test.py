#!/usr/bin/env python3
"""
DynoPay Backend API Test Suite
Testing payment link status normalization fix
"""

import requests
import json
import sys
from typing import Dict, Any, List

# Test configuration
BASE_URL = "https://current-pod-config-1.preview.emergentagent.com/api"
TEST_CREDENTIALS = {
    "email": "nomadly@moxx.co",
    "password": "Katiekendra123@"
}
COMPANY_ID = 3
SPECIFIC_LINK_ID = 920

class DynoPayAPITest:
    def __init__(self):
        self.access_token = None
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })

    def authenticate(self) -> bool:
        """Authenticate and get access token"""
        print("🔐 Testing Authentication...")
        
        try:
            response = self.session.post(
                f"{BASE_URL}/user/login",
                json=TEST_CREDENTIALS,
                timeout=30
            )
            
            print(f"Status Code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"❌ Authentication failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
            data = response.json()
            
            if 'data' not in data or 'accessToken' not in data['data']:
                print(f"❌ No access token in response: {data}")
                return False
                
            self.access_token = data['data']['accessToken']
            self.session.headers.update({
                'Authorization': f'Bearer {self.access_token}'
            })
            
            print("✅ Authentication successful")
            return True
            
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return False

    def test_payment_links_status_normalization(self) -> Dict[str, Any]:
        """Test payment links endpoint for status normalization"""
        print(f"\n🔗 Testing Payment Links Status Normalization...")
        print(f"Endpoint: GET {BASE_URL}/pay/getPaymentLinks?company_id={COMPANY_ID}")
        
        try:
            response = self.session.get(
                f"{BASE_URL}/pay/getPaymentLinks?company_id={COMPANY_ID}",
                timeout=30
            )
            
            print(f"Status Code: {response.status_code}")
            
            if response.status_code != 200:
                return {
                    'success': False,
                    'error': f"HTTP {response.status_code}: {response.text}",
                    'endpoint': 'getPaymentLinks'
                }
            
            data = response.json()
            
            if 'data' not in data or not isinstance(data['data'], list):
                return {
                    'success': False,
                    'error': f"Invalid response structure: {data}",
                    'endpoint': 'getPaymentLinks'
                }
            
            payment_links = data['data']
            print(f"Found {len(payment_links)} payment links")
            
            # Check status normalization
            status_issues = []
            target_link_found = False
            target_link_status = None
            
            # Valid lowercase statuses
            valid_statuses = ['active', 'completed', 'expired', 'pending']
            
            for link in payment_links:
                link_id = link.get('link_id')
                status = link.get('status', '')
                
                # Check if this is our target link
                if link_id == SPECIFIC_LINK_ID:
                    target_link_found = True
                    target_link_status = status
                    print(f"🎯 Found target link_id={SPECIFIC_LINK_ID}, status='{status}'")
                
                # Check if status is lowercase
                if status and status != status.lower():
                    status_issues.append({
                        'link_id': link_id,
                        'status': status,
                        'expected': status.lower()
                    })
                
                # Check if status is valid
                if status and status.lower() not in valid_statuses:
                    status_issues.append({
                        'link_id': link_id,
                        'status': status,
                        'issue': 'invalid_status'
                    })
            
            # Analyze results
            result = {
                'success': len(status_issues) == 0,
                'endpoint': 'getPaymentLinks',
                'total_links': len(payment_links),
                'target_link_found': target_link_found,
                'target_link_status': target_link_status,
                'status_issues': status_issues
            }
            
            if target_link_found:
                if target_link_status == 'completed':
                    print(f"✅ Target link_id={SPECIFIC_LINK_ID} has correct lowercase status: '{target_link_status}'")
                else:
                    print(f"❌ Target link_id={SPECIFIC_LINK_ID} has incorrect status: '{target_link_status}' (expected: 'completed')")
            else:
                print(f"⚠️  Target link_id={SPECIFIC_LINK_ID} not found in results")
            
            if status_issues:
                print(f"❌ Found {len(status_issues)} status normalization issues:")
                for issue in status_issues[:5]:  # Show first 5 issues
                    if 'expected' in issue:
                        print(f"   - link_id={issue['link_id']}: '{issue['status']}' should be '{issue['expected']}'")
                    else:
                        print(f"   - link_id={issue['link_id']}: '{issue['status']}' is invalid")
                if len(status_issues) > 5:
                    print(f"   ... and {len(status_issues) - 5} more issues")
            else:
                print("✅ All payment link statuses are properly normalized (lowercase)")
            
            return result
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Exception: {e}",
                'endpoint': 'getPaymentLinks'
            }

    def test_single_payment_link(self) -> Dict[str, Any]:
        """Test single payment link endpoint for status normalization"""
        print(f"\n🔍 Testing Single Payment Link Status...")
        print(f"Endpoint: GET {BASE_URL}/pay/links/{SPECIFIC_LINK_ID}")
        
        try:
            response = self.session.get(
                f"{BASE_URL}/pay/links/{SPECIFIC_LINK_ID}",
                timeout=30
            )
            
            print(f"Status Code: {response.status_code}")
            
            if response.status_code != 200:
                return {
                    'success': False,
                    'error': f"HTTP {response.status_code}: {response.text}",
                    'endpoint': 'single_link'
                }
            
            data = response.json()
            
            if 'data' not in data:
                return {
                    'success': False,
                    'error': f"Invalid response structure: {data}",
                    'endpoint': 'single_link'
                }
            
            link_data = data['data']
            status = link_data.get('status', '')
            
            print(f"Link ID: {link_data.get('link_id')}")
            print(f"Status: '{status}'")
            
            # Check status normalization
            is_lowercase = status == status.lower()
            is_completed = status.lower() == 'completed'
            
            result = {
                'success': is_lowercase and is_completed,
                'endpoint': 'single_link',
                'link_id': link_data.get('link_id'),
                'status': status,
                'is_lowercase': is_lowercase,
                'is_completed': is_completed
            }
            
            if is_lowercase and is_completed:
                print(f"✅ Single link endpoint returns correct lowercase status: '{status}'")
            else:
                if not is_lowercase:
                    print(f"❌ Status is not lowercase: '{status}' (should be '{status.lower()}')")
                if not is_completed:
                    print(f"❌ Status is not 'completed': '{status}' (expected for link_id={SPECIFIC_LINK_ID})")
            
            return result
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Exception: {e}",
                'endpoint': 'single_link'
            }

    def run_all_tests(self) -> Dict[str, Any]:
        """Run all payment link status normalization tests"""
        print("=" * 60)
        print("🧪 DynoPay Payment Link Status Normalization Test Suite")
        print("=" * 60)
        
        # Authenticate first
        if not self.authenticate():
            return {
                'overall_success': False,
                'error': 'Authentication failed',
                'tests': {}
            }
        
        # Run tests
        test_results = {}
        
        # Test 1: Payment Links Status Normalization
        test_results['payment_links'] = self.test_payment_links_status_normalization()
        
        # Test 2: Single Payment Link Status
        test_results['single_link'] = self.test_single_payment_link()
        
        # Overall assessment
        overall_success = all(result.get('success', False) for result in test_results.values())
        
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        for test_name, result in test_results.items():
            status = "✅ PASS" if result.get('success') else "❌ FAIL"
            print(f"{test_name}: {status}")
            if not result.get('success') and 'error' in result:
                print(f"  Error: {result['error']}")
        
        print(f"\nOverall Status: {'✅ ALL TESTS PASSED' if overall_success else '❌ SOME TESTS FAILED'}")
        
        return {
            'overall_success': overall_success,
            'tests': test_results
        }

def main():
    """Main test execution"""
    tester = DynoPayAPITest()
    results = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if results['overall_success'] else 1)

if __name__ == "__main__":
    main()