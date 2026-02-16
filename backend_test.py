#!/usr/bin/env python3

"""
DynoPay Backend Security, Real-time, Analytics, Admin, and DevOps Enhancement Testing
Testing Agent verification script for comprehensive backend testing.
"""

import requests
import json
import subprocess
import sys
import os
import time
from typing import Dict, Tuple, Any

class DynoPayBackendTester:
    def __init__(self):
        # Use the environment variable for the backend URL, fallback to localhost
        self.backend_url = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')
        if self.backend_url == "https://get-started-29.preview.emergentagent.com":
            # This is the external URL, we need the internal localhost for some tests
            self.internal_url = "http://localhost:8001"
        else:
            self.internal_url = self.backend_url
            
        print(f"🔧 Backend URL: {self.backend_url}")
        print(f"🔧 Internal URL: {self.internal_url}")
        
        self.session = requests.Session()
        self.results = {}
        self.failed_tests = []

    def test_1_health_endpoint(self) -> bool:
        """TEST 1: GET /health returns 200 with status "healthy" """
        print("\n✅ TEST 1: Backend Health Check")
        try:
            response = self.session.get(f"{self.internal_url}/health", timeout=30)
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Response: {json.dumps(data, indent=2)}")
                
                if data.get('status') == 'healthy':
                    print("   ✅ Health endpoint working correctly")
                    return True
                else:
                    print(f"   ❌ Status is not 'healthy': {data.get('status')}")
                    return False
            else:
                print(f"   ❌ Unexpected status code: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"   ❌ Health endpoint failed: {str(e)}")
            return False

    def test_2_csrf_token_endpoint(self) -> bool:
        """TEST 2: GET /api/csrf-token returns JSON with csrf_token field"""
        print("\n✅ TEST 2: CSRF Token Endpoint")
        try:
            response = self.session.get(f"{self.internal_url}/api/csrf-token", timeout=30)
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Response keys: {list(data.keys())}")
                
                if 'csrf_token' in data:
                    print(f"   ✅ CSRF token found: {data['csrf_token'][:20]}...")
                    return True
                else:
                    print(f"   ❌ csrf_token field not found in response")
                    return False
            else:
                print(f"   ❌ Unexpected status code: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"   ❌ CSRF token endpoint failed: {str(e)}")
            return False

    def test_3_events_stats_sse(self) -> bool:
        """TEST 3: GET /api/events/stats returns SSE stats with total_clients field"""
        print("\n✅ TEST 3: Events Stats SSE Endpoint")
        try:
            # For SSE endpoint, we expect text/plain or text/event-stream
            response = self.session.get(f"{self.internal_url}/api/events/stats", 
                                      timeout=10, 
                                      headers={'Accept': 'text/event-stream'})
            print(f"   Status Code: {response.status_code}")
            print(f"   Content-Type: {response.headers.get('content-type', 'N/A')}")
            
            if response.status_code == 200:
                content = response.text
                print(f"   Response preview: {content[:200]}...")
                
                if 'total_clients' in content:
                    print("   ✅ total_clients field found in SSE response")
                    return True
                else:
                    print("   ❌ total_clients field not found in SSE response")
                    return False
            else:
                print(f"   ❌ Unexpected status code: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"   ❌ Events stats SSE endpoint failed: {str(e)}")
            return False

    def test_4_admin_analytics_auth(self) -> bool:
        """TEST 4: GET /api/admin/analytics/revenue without auth returns 403"""
        print("\n✅ TEST 4: Admin Analytics Auth Protection")
        try:
            # Create new session without auth for this test
            unauth_session = requests.Session()
            response = unauth_session.get(f"{self.internal_url}/api/admin/analytics/revenue", timeout=30)
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 403:
                print("   ✅ Admin endpoint properly protected with 403 Forbidden")
                return True
            elif response.status_code == 401:
                print("   ✅ Admin endpoint properly protected with 401 Unauthorized")
                return True
            else:
                print(f"   ❌ Expected 403/401 but got: {response.status_code}")
                try:
                    print(f"   Response: {response.text}")
                except:
                    pass
                return False
                
        except Exception as e:
            print(f"   ❌ Admin analytics auth test failed: {str(e)}")
            return False

    def test_5_typescript_compilation(self) -> bool:
        """TEST 5: cd /app/backend && npx tsc --noEmit should compile cleanly (0 errors)"""
        print("\n✅ TEST 5: TypeScript Compilation Check")
        try:
            os.chdir('/app/backend')
            result = subprocess.run(['npx', 'tsc', '--noEmit'], 
                                 capture_output=True, text=True, timeout=120)
            
            print(f"   Exit Code: {result.returncode}")
            
            if result.returncode == 0:
                print("   ✅ TypeScript compilation successful (0 errors)")
                if result.stderr:
                    print(f"   Warnings: {result.stderr}")
                return True
            else:
                print(f"   ❌ TypeScript compilation failed")
                print(f"   STDOUT: {result.stdout}")
                print(f"   STDERR: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"   ❌ TypeScript compilation test failed: {str(e)}")
            return False

    def test_6_refresh_token_validation(self) -> bool:
        """TEST 6: POST /api/user/refresh-token with empty body returns 400"""
        print("\n✅ TEST 6: Refresh Token Validation")
        try:
            response = self.session.post(f"{self.internal_url}/api/user/refresh-token", 
                                       json={}, timeout=30)
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 400:
                print("   ✅ Refresh token endpoint properly validates empty body with 400")
                try:
                    data = response.json()
                    print(f"   Response: {data}")
                except:
                    print(f"   Response text: {response.text}")
                return True
            else:
                print(f"   ❌ Expected 400 but got: {response.status_code}")
                try:
                    print(f"   Response: {response.text}")
                except:
                    pass
                return False
                
        except Exception as e:
            print(f"   ❌ Refresh token validation test failed: {str(e)}")
            return False

    def test_7_2fa_status_auth(self) -> bool:
        """TEST 7: GET /api/user/2fa/status without auth returns 401/403"""
        print("\n✅ TEST 7: 2FA Status Auth Protection")
        try:
            # Create new session without auth for this test
            unauth_session = requests.Session()
            response = unauth_session.get(f"{self.internal_url}/api/user/2fa/status", timeout=30)
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code in [401, 403]:
                print(f"   ✅ 2FA status endpoint properly protected with {response.status_code}")
                return True
            else:
                print(f"   ❌ Expected 401/403 but got: {response.status_code}")
                try:
                    print(f"   Response: {response.text}")
                except:
                    pass
                return False
                
        except Exception as e:
            print(f"   ❌ 2FA status auth test failed: {str(e)}")
            return False

    def test_8_admin_users_ban_auth(self) -> bool:
        """TEST 8: PUT /api/admin/users/999/ban without auth returns 401/403"""
        print("\n✅ TEST 8: Admin User Ban Auth Protection")
        try:
            # Create new session without auth for this test
            unauth_session = requests.Session()
            response = unauth_session.put(f"{self.internal_url}/api/admin/users/999/ban", 
                                        json={}, timeout=30)
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code in [401, 403]:
                print(f"   ✅ Admin user ban endpoint properly protected with {response.status_code}")
                return True
            else:
                print(f"   ❌ Expected 401/403 but got: {response.status_code}")
                try:
                    print(f"   Response: {response.text}")
                except:
                    pass
                return False
                
        except Exception as e:
            print(f"   ❌ Admin user ban auth test failed: {str(e)}")
            return False

    def test_9_session_routes_exist(self) -> bool:
        """TEST 9: Verify session routes exist: grep for refresh-token, sessions, login-history, 2fa"""
        print("\n✅ TEST 9: Session Routes Verification")
        try:
            result = subprocess.run([
                'grep', '-E', 'refresh-token|sessions|login-history|2fa', 
                '/app/backend/routes/userRouter.ts'
            ], capture_output=True, text=True)
            
            lines = result.stdout.strip().split('\n') if result.stdout.strip() else []
            line_count = len([line for line in lines if line.strip()])
            
            print(f"   Found {line_count} matching lines:")
            for line in lines:
                if line.strip():
                    print(f"     {line.strip()}")
            
            if line_count >= 10:
                print(f"   ✅ Found {line_count} session route references (>= 10 required)")
                return True
            else:
                print(f"   ❌ Found only {line_count} session route references (< 10 required)")
                return False
                
        except Exception as e:
            print(f"   ❌ Session routes verification failed: {str(e)}")
            return False

    def test_10_slack_alert_integration(self) -> bool:
        """TEST 10: Verify Slack alert integration: grep for slackAlertService"""
        print("\n✅ TEST 10: Slack Alert Integration Verification")
        try:
            result = subprocess.run([
                'grep', 'slackAlertService', 
                '/app/backend/services/errorMonitoringService.ts'
            ], capture_output=True, text=True)
            
            lines = result.stdout.strip().split('\n') if result.stdout.strip() else []
            line_count = len([line for line in lines if line.strip()])
            
            print(f"   Found {line_count} slackAlertService references:")
            for line in lines:
                if line.strip():
                    print(f"     {line.strip()}")
            
            if line_count >= 1:
                print(f"   ✅ Found {line_count} slackAlertService references")
                return True
            else:
                print(f"   ❌ slackAlertService not found in errorMonitoringService.ts")
                return False
                
        except Exception as e:
            print(f"   ❌ Slack alert integration verification failed: {str(e)}")
            return False

    def run_all_tests(self) -> Dict[str, bool]:
        """Run all verification tests and return results"""
        print("🚀 Starting DynoPay Backend Security, Real-time, Analytics, Admin, and DevOps Enhancement Testing...")
        print("=" * 80)
        
        tests = [
            ("test_1_health_endpoint", self.test_1_health_endpoint),
            ("test_2_csrf_token_endpoint", self.test_2_csrf_token_endpoint), 
            ("test_3_events_stats_sse", self.test_3_events_stats_sse),
            ("test_4_admin_analytics_auth", self.test_4_admin_analytics_auth),
            ("test_5_typescript_compilation", self.test_5_typescript_compilation),
            ("test_6_refresh_token_validation", self.test_6_refresh_token_validation),
            ("test_7_2fa_status_auth", self.test_7_2fa_status_auth),
            ("test_8_admin_users_ban_auth", self.test_8_admin_users_ban_auth),
            ("test_9_session_routes_exist", self.test_9_session_routes_exist),
            ("test_10_slack_alert_integration", self.test_10_slack_alert_integration),
        ]
        
        results = {}
        for test_name, test_func in tests:
            try:
                results[test_name] = test_func()
                if not results[test_name]:
                    self.failed_tests.append(test_name)
            except Exception as e:
                print(f"❌ {test_name} failed with exception: {str(e)}")
                results[test_name] = False
                self.failed_tests.append(test_name)
        
        return results

    def print_summary(self, results: Dict[str, bool]):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        success_rate = (passed / total) * 100 if total > 0 else 0
        
        print(f"✅ Tests Passed: {passed}/{total} ({success_rate:.1f}%)")
        print(f"❌ Tests Failed: {total - passed}/{total}")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"  {i}. {test}")
        
        print("\n📋 DETAILED RESULTS:")
        for test_name, result in results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"  {test_name}: {status}")
        
        return success_rate

if __name__ == "__main__":
    tester = DynoPayBackendTester()
    results = tester.run_all_tests()
    success_rate = tester.print_summary(results)
    
    # Exit with appropriate code
    if success_rate == 100:
        print("\n🎉 ALL TESTS PASSED! Backend enhancements are working correctly.")
        sys.exit(0)
    else:
        print(f"\n⚠️  {len(tester.failed_tests)} tests failed. Please review and fix the issues.")
        sys.exit(1)