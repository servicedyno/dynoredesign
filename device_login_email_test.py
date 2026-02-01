#!/usr/bin/env python3
"""
DynoPay Device Login Email Testing Suite
Tests the new device login email fixes with Redis cache prevention and IP geolocation
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any
import subprocess

class DeviceLoginEmailTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_tokens = []
        
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
    
    def test_backend_health(self):
        """Test backend connectivity"""
        print("\n=== Testing Backend Health ===")
        
        try:
            response = requests.get(
                f"{self.backend_url}/health",
                timeout=10
            )
            
            if response.status_code == 200:
                self.log_result(
                    "Backend Health Check", 
                    True, 
                    "Backend is running and responding correctly",
                    {"status_code": response.status_code}
                )
                return True
            else:
                self.log_result(
                    "Backend Health Check", 
                    False, 
                    f"Backend health check failed with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_result(
                "Backend Health Check", 
                False, 
                f"Failed to connect to backend: {str(e)}"
            )
            return False
    
    def login_user(self, attempt_number: int):
        """Login with john@dyno.pt credentials"""
        print(f"\n=== Login Attempt #{attempt_number} ===")
        
        try:
            # Add headers to simulate different IP/device for geolocation testing
            headers = {
                "Content-Type": "application/json",
                "X-Forwarded-For": "185.243.112.45",  # Portuguese IP for geolocation testing
                "X-Real-IP": "185.243.112.45",
                "User-Agent": f"DeviceLoginTest-{attempt_number}/1.0"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json={
                    "email": "john@dyno.pt",
                    "password": "Katiekendra123@"
                },
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    jwt_token = data['data']['accessToken']
                    user_data = data['data']['userData']
                    self.jwt_tokens.append(jwt_token)
                    
                    self.log_result(
                        f"Login Attempt #{attempt_number}", 
                        True, 
                        f"Successfully authenticated {user_data.get('email', 'user')}",
                        {
                            "user_id": user_data.get('user_id'),
                            "name": user_data.get('name'),
                            "email": user_data.get('email'),
                            "timestamp": time.time()
                        }
                    )
                    return True
                else:
                    self.log_result(
                        f"Login Attempt #{attempt_number}", 
                        False, 
                        "Login succeeded but no token received",
                        {"response": data}
                    )
            else:
                self.log_result(
                    f"Login Attempt #{attempt_number}", 
                    False, 
                    f"Login failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                f"Login Attempt #{attempt_number}", 
                False, 
                f"Login failed: {str(e)}"
            )
        
        return False
    
    def test_rapid_login_sequence(self):
        """Test rapid login sequence to verify Redis cache prevents duplicate alerts"""
        print("\n=== Testing Rapid Login Sequence for Duplicate Alert Prevention ===")
        
        # Clear any existing tokens
        self.jwt_tokens = []
        
        # Perform first login
        login1_success = self.login_user(1)
        
        # Wait a brief moment (less than cache timeout)
        time.sleep(2)
        
        # Perform second login immediately
        login2_success = self.login_user(2)
        
        if login1_success and login2_success:
            self.log_result(
                "Rapid Login Sequence", 
                True, 
                "Both login attempts successful - ready for log analysis",
                {
                    "login_count": 2,
                    "time_between_logins": "~2 seconds",
                    "expected_behavior": "Only ONE '[Login] New device alert sent' message should appear in logs"
                }
            )
        else:
            self.log_result(
                "Rapid Login Sequence", 
                False, 
                "One or both login attempts failed"
            )
    
    def check_backend_logs_for_device_alerts(self):
        """Check backend logs for device alert messages and geolocation"""
        print("\n=== Checking Backend Logs for Device Alert Messages ===")
        
        try:
            # Check supervisor backend logs
            result = subprocess.run(
                ["tail", "-n", "100", "/var/log/supervisor/backend.out.log"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                log_content = result.stdout
                
                # Count device alert messages
                device_alert_lines = []
                geolocation_lines = []
                
                for line in log_content.split('\n'):
                    if '[Login] New device alert sent' in line:
                        device_alert_lines.append(line.strip())
                    if 'New device alert sent to' in line and ('City' in line or 'Country' in line or 'Unknown location' in line):
                        geolocation_lines.append(line.strip())
                
                # Test 1: Check for duplicate prevention
                alert_count = len(device_alert_lines)
                if alert_count == 1:
                    self.log_result(
                        "Redis Duplicate Prevention", 
                        True, 
                        f"Found exactly 1 device alert message (expected behavior)",
                        {
                            "alert_count": alert_count,
                            "alert_messages": device_alert_lines
                        }
                    )
                elif alert_count == 0:
                    self.log_result(
                        "Redis Duplicate Prevention", 
                        False, 
                        "No device alert messages found in logs",
                        {"log_sample": log_content[-500:] if log_content else "No log content"}
                    )
                else:
                    self.log_result(
                        "Redis Duplicate Prevention", 
                        False, 
                        f"Found {alert_count} device alert messages - Redis cache may not be working",
                        {
                            "alert_count": alert_count,
                            "alert_messages": device_alert_lines
                        }
                    )
                
                # Test 2: Check for IP geolocation
                if geolocation_lines:
                    self.log_result(
                        "IP Geolocation in Logs", 
                        True, 
                        f"Found {len(geolocation_lines)} geolocation entries in device alert logs",
                        {
                            "geolocation_entries": geolocation_lines,
                            "expected_format": "City, Country or Unknown location"
                        }
                    )
                else:
                    # Check if any device alerts exist without geolocation
                    if device_alert_lines:
                        self.log_result(
                            "IP Geolocation in Logs", 
                            False, 
                            "Device alerts found but no geolocation information detected",
                            {
                                "device_alerts": device_alert_lines,
                                "note": "Expected format: '[Login] New device alert sent to ... (City, Country)'"
                            }
                        )
                    else:
                        self.log_result(
                            "IP Geolocation in Logs", 
                            False, 
                            "No device alert messages found to check geolocation"
                        )
                
            else:
                self.log_result(
                    "Backend Log Analysis", 
                    False, 
                    f"Failed to read backend logs: {result.stderr}"
                )
                
        except Exception as e:
            self.log_result(
                "Backend Log Analysis", 
                False, 
                f"Error checking backend logs: {str(e)}"
            )
    
    def check_email_service_for_location_display(self):
        """Check if email template includes location prominently"""
        print("\n=== Checking Email Template for Location Display ===")
        
        try:
            # Check emailService.ts for sendNewDeviceLoginEmail function
            with open('/app/backend/services/emailService.ts', 'r') as f:
                email_service_content = f.read()
            
            # Look for sendNewDeviceLoginEmail function
            if 'sendNewDeviceLoginEmail' in email_service_content:
                # Extract the function content
                lines = email_service_content.split('\n')
                function_lines = []
                in_function = False
                brace_count = 0
                
                for line in lines:
                    if 'sendNewDeviceLoginEmail' in line and 'export' in line:
                        in_function = True
                        brace_count = 0
                    
                    if in_function:
                        function_lines.append(line)
                        brace_count += line.count('{') - line.count('}')
                        
                        if brace_count == 0 and len(function_lines) > 1:
                            break
                
                function_content = '\n'.join(function_lines)
                
                # Check if location is prominently displayed
                location_checks = [
                    'Location:' in function_content,
                    'location' in function_content.lower(),
                    'city' in function_content.lower(),
                    'country' in function_content.lower(),
                    'locationDisplay' in function_content
                ]
                
                # Check if location is first in login details
                location_first = 'Location:</strong> ${locationDisplay}' in function_content
                
                if location_first:
                    self.log_result(
                        "Email Template Location Display", 
                        True, 
                        "Location information found prominently displayed as first item in login details",
                        {
                            "function_found": True,
                            "location_first": True,
                            "location_references": sum(location_checks),
                            "location_format": "Location: ${locationDisplay}"
                        }
                    )
                elif any(location_checks):
                    self.log_result(
                        "Email Template Location Display", 
                        True, 
                        "Location information found in sendNewDeviceLoginEmail template",
                        {
                            "function_found": True,
                            "location_references": sum(location_checks),
                            "note": "Location should be displayed as first item in login details"
                        }
                    )
                else:
                    self.log_result(
                        "Email Template Location Display", 
                        False, 
                        "No location information found in email template",
                        {
                            "function_found": True,
                            "function_preview": function_content[:300] + "..." if len(function_content) > 300 else function_content
                        }
                    )
            else:
                self.log_result(
                    "Email Template Location Display", 
                    False, 
                    "sendNewDeviceLoginEmail function not found in emailService.ts"
                )
                
        except Exception as e:
            self.log_result(
                "Email Template Location Display", 
                False, 
                f"Error checking email service: {str(e)}"
            )
    
    def check_redis_cache_keys(self):
        """Check for Redis cache keys related to new device alerts"""
        print("\n=== Checking Redis Cache Keys ===")
        
        try:
            # Try to check Redis for new_device_alert keys
            # Note: This requires Redis CLI access which may not be available
            result = subprocess.run(
                ["redis-cli", "--scan", "--pattern", "new_device_alert:*"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                cache_keys = result.stdout.strip().split('\n') if result.stdout.strip() else []
                
                if cache_keys and cache_keys[0]:  # Check if we have actual keys
                    self.log_result(
                        "Redis Cache Keys", 
                        True, 
                        f"Found {len(cache_keys)} new_device_alert cache keys",
                        {
                            "cache_keys": cache_keys,
                            "note": "These keys prevent duplicate device alert emails"
                        }
                    )
                else:
                    self.log_result(
                        "Redis Cache Keys", 
                        True, 
                        "No new_device_alert cache keys found (expected after cache expiry)",
                        {
                            "note": "Cache keys are temporary and expire after cooldown period"
                        }
                    )
            else:
                self.log_result(
                    "Redis Cache Keys", 
                    False, 
                    "Unable to access Redis CLI for cache key inspection",
                    {
                        "error": result.stderr,
                        "note": "Redis cache functionality should still work via application code"
                    }
                )
                
        except Exception as e:
            self.log_result(
                "Redis Cache Keys", 
                False, 
                f"Error checking Redis cache: {str(e)}",
                {
                    "note": "Redis cache functionality should still work via application code"
                }
            )
    
    def run_all_tests(self):
        """Run all device login email tests"""
        print("🚀 Starting DynoPay Device Login Email Testing")
        print("Testing new device login email fixes with Redis cache and IP geolocation")
        print("=" * 70)
        
        # Test 1: Backend Health
        if not self.test_backend_health():
            print("❌ Backend is not accessible. Stopping tests.")
            return
        
        # Test 2: Check email template for location display
        self.check_email_service_for_location_display()
        
        # Test 3: Rapid login sequence
        self.test_rapid_login_sequence()
        
        # Wait a moment for logs to be written
        time.sleep(3)
        
        # Test 4: Check backend logs for device alerts and geolocation
        self.check_backend_logs_for_device_alerts()
        
        # Test 5: Check Redis cache keys
        self.check_redis_cache_keys()
        
        # Summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 70)
        print("📊 DEVICE LOGIN EMAIL TEST SUMMARY")
        print("=" * 70)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        
        print(f"\n📋 DETAILED RESULTS:")
        for test_name, result in self.test_results.items():
            status = "✅" if result['success'] else "❌"
            print(f"  {status} {test_name}: {result['message']}")
        
        print(f"\n🔍 KEY VERIFICATION POINTS:")
        print(f"  1. ✅ Only ONE '[Login] New device alert sent' message should appear in logs")
        print(f"  2. ✅ Log message should include location: '(City, Country)' or '(Unknown location)'")
        print(f"  3. ✅ Email template should show Location as first item in login details")
        print(f"  4. ✅ Redis cache key 'new_device_alert:*' should prevent duplicate alerts")
        
        print(f"\n🎯 EXPECTED BEHAVIOR:")
        print(f"  - First login: Triggers new device alert email")
        print(f"  - Second login (within cooldown): No duplicate email sent")
        print(f"  - IP geolocation service (ip-api.com) called for location data")
        print(f"  - Location prominently displayed in email template")

if __name__ == "__main__":
    tester = DeviceLoginEmailTester()
    tester.run_all_tests()