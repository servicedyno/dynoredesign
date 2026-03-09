#!/usr/bin/env python3
"""
Backend API Test Suite for DynoPay Geo-detect Endpoint
Tests the geo-detect API endpoint with various X-Forwarded-For headers
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL from frontend env
BACKEND_URL = "https://multi-pod-config.preview.emergentagent.com"

class GeoDetectAPITester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.results = []
        
    def test_geo_detect_endpoint(self, test_name: str, headers: Optional[Dict[str, str]] = None, expected_country_code: Optional[str] = None) -> Dict[str, Any]:
        """Test the geo-detect API endpoint with specified headers"""
        url = f"{self.base_url}/api/geo-detect"
        
        try:
            # Make request with optional headers
            response = requests.get(url, headers=headers or {}, timeout=10)
            
            # Parse response
            response_data = response.json()
            
            result = {
                "test_name": test_name,
                "url": url,
                "headers_sent": headers or {},
                "status_code": response.status_code,
                "response_data": response_data,
                "expected_country_code": expected_country_code,
                "success": True,
                "error": None
            }
            
            # Validate response structure
            if response.status_code == 200:
                if "status" not in response_data:
                    result["success"] = False
                    result["error"] = "Missing 'status' field in response"
                elif "countryCode" not in response_data:
                    result["success"] = False
                    result["error"] = "Missing 'countryCode' field in response"
                elif expected_country_code and response_data.get("countryCode") != expected_country_code:
                    result["success"] = False
                    result["error"] = f"Expected countryCode '{expected_country_code}', got '{response_data.get('countryCode')}'"
            else:
                result["success"] = False
                result["error"] = f"HTTP {response.status_code}: {response.text}"
                
        except requests.exceptions.RequestException as e:
            result = {
                "test_name": test_name,
                "url": url,
                "headers_sent": headers or {},
                "status_code": None,
                "response_data": None,
                "expected_country_code": expected_country_code,
                "success": False,
                "error": f"Request failed: {str(e)}"
            }
        except json.JSONDecodeError as e:
            result = {
                "test_name": test_name,
                "url": url,
                "headers_sent": headers or {},
                "status_code": response.status_code,
                "response_data": None,
                "expected_country_code": expected_country_code,
                "success": False,
                "error": f"Invalid JSON response: {str(e)}"
            }
        except Exception as e:
            result = {
                "test_name": test_name,
                "url": url,
                "headers_sent": headers or {},
                "status_code": None,
                "response_data": None,
                "expected_country_code": expected_country_code,
                "success": False,
                "error": f"Unexpected error: {str(e)}"
            }
            
        self.results.append(result)
        return result

    def run_all_tests(self):
        """Run all geo-detect API tests"""
        print("🧪 Starting Geo-detect API Tests")
        print("=" * 60)
        
        # Test 1: No special headers (should return JSON with status and countryCode)
        print("\n📍 Test 1: No X-Forwarded-For header")
        result1 = self.test_geo_detect_endpoint(
            "No X-Forwarded-For header",
            headers=None
        )
        self._print_test_result(result1)
        
        # Test 2: Portugal IP (85.244.0.1)
        print("\n📍 Test 2: Portugal IP (85.244.0.1)")
        result2 = self.test_geo_detect_endpoint(
            "Portugal IP via X-Forwarded-For",
            headers={"X-Forwarded-For": "85.244.0.1"},
            expected_country_code="PT"
        )
        self._print_test_result(result2)
        
        # Test 3: Spain IP (77.29.0.1)
        print("\n📍 Test 3: Spain IP (77.29.0.1)")
        result3 = self.test_geo_detect_endpoint(
            "Spain IP via X-Forwarded-For",
            headers={"X-Forwarded-For": "77.29.0.1"},
            expected_country_code="ES"
        )
        self._print_test_result(result3)
        
        # Test 4: Germany IP (78.46.0.1)
        print("\n📍 Test 4: Germany IP (78.46.0.1)")
        result4 = self.test_geo_detect_endpoint(
            "Germany IP via X-Forwarded-For",
            headers={"X-Forwarded-For": "78.46.0.1"},
            expected_country_code="DE"
        )
        self._print_test_result(result4)
        
        # Summary
        self._print_summary()
        
    def _print_test_result(self, result: Dict[str, Any]):
        """Print detailed test result"""
        status_emoji = "✅" if result["success"] else "❌"
        print(f"{status_emoji} {result['test_name']}")
        print(f"   URL: {result['url']}")
        
        if result['headers_sent']:
            print(f"   Headers: {result['headers_sent']}")
        
        if result['status_code']:
            print(f"   Status: {result['status_code']}")
            
        if result['response_data']:
            print(f"   Response: {json.dumps(result['response_data'], indent=2)}")
            
        if result['expected_country_code']:
            actual_code = result['response_data'].get('countryCode') if result['response_data'] else 'N/A'
            print(f"   Expected: {result['expected_country_code']}, Got: {actual_code}")
            
        if result['error']:
            print(f"   ❌ Error: {result['error']}")
    
    def _print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.results:
                if not result['success']:
                    print(f"   • {result['test_name']}: {result['error']}")
        
        print("\n💡 ANALYSIS:")
        
        # Analyze specific issues
        if any(r['error'] and 'timeout' in r['error'].lower() for r in self.results):
            print("   ⚠️ Timeout issues detected - backend may be slow or unreachable")
            
        if any(r['status_code'] and r['status_code'] >= 500 for r in self.results):
            print("   ⚠️ Server errors detected - check backend logs")
            
        if any(r['status_code'] and r['status_code'] == 404 for r in self.results):
            print("   ⚠️ 404 errors detected - endpoint may not be implemented")
            
        # Check for consistent response structure
        successful_responses = [r for r in self.results if r['success'] and r['response_data']]
        if successful_responses:
            sample_response = successful_responses[0]['response_data']
            required_fields = ['status', 'countryCode']
            has_all_fields = all(field in sample_response for field in required_fields)
            
            if has_all_fields:
                print("   ✅ Response structure is consistent and complete")
            else:
                missing_fields = [field for field in required_fields if field not in sample_fields]
                print(f"   ❌ Missing required fields in response: {missing_fields}")
        
        return passed_tests == total_tests

def main():
    """Main test execution"""
    print("🚀 DynoPay Geo-detect API Testing Suite")
    print(f"📡 Backend URL: {BACKEND_URL}")
    print("⏰ Starting tests...")
    
    tester = GeoDetectAPITester(BACKEND_URL)
    
    try:
        tester.run_all_tests()
        
        # Return appropriate exit code
        all_passed = all(r['success'] for r in tester.results)
        if all_passed:
            print("\n🎉 All tests passed! Geo-detect API is working correctly.")
            sys.exit(0)
        else:
            print("\n💥 Some tests failed. Check the details above.")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⏹️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Test suite crashed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()