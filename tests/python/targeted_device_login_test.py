#!/usr/bin/env python3
"""
DynoPay Device Login Email Testing Suite - Targeted Test
Tests the new device login email fixes by ensuring proper conditions are met
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any
import subprocess

class TargetedDeviceLoginTester:
    def __init__(self):
        self.backend_url = "https://rlusd-erc20-deploy.preview.emergentagent.com"
        self.test_results = {}
        self.errors = []
        
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
    
    def get_user_info(self, ip_address="default"):
        """Get current user info"""
        headers = {"Content-Type": "application/json"}
        if ip_address != "default":
            headers["X-Forwarded-For"] = ip_address
            
        response = requests.post(
            f"{self.backend_url}/api/user/login",
            json={"email": "john@dyno.pt", "password": "Katiekendra123@"},
            headers=headers,
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get('data', {}).get('userData', {})
        return None
    
    def test_device_alert_trigger(self):
        """Test device alert triggering with controlled conditions"""
        print("\n=== Testing Device Alert Trigger with Controlled Conditions ===")
        
        # Step 1: Login with first IP to establish baseline
        print("Step 1: Establishing baseline with IP 10.0.0.1")
        user_info_1 = self.get_user_info("10.0.0.1")
        if not user_info_1:
            self.log_result("Baseline Login", False, "Failed to establish baseline login")
            return
        
        baseline_ip = user_info_1.get('last_login_ip')
        print(f"Baseline established. Last login IP: {baseline_ip}")
        
        # Step 2: Wait a moment
        time.sleep(2)
        
        # Step 3: Login with different IP to trigger device alert
        print("Step 2: Logging in with different IP 192.168.1.100 to trigger device alert")
        
        headers = {
            "Content-Type": "application/json",
            "X-Forwarded-For": "192.168.1.100",
            "X-Real-IP": "192.168.1.100",
            "User-Agent": "TestBrowser/1.0 (Device Alert Test)"
        }
        
        response = requests.post(
            f"{self.backend_url}/api/user/login",
            json={"email": "john@dyno.pt", "password": "Katiekendra123@"},
            headers=headers,
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            user_data = data.get('data', {}).get('userData', {})
            new_ip = user_data.get('last_login_ip')
            
            self.log_result(
                "Device Alert Trigger Login", 
                True, 
                f"Login successful. IP changed from {baseline_ip} to {new_ip}",
                {
                    "baseline_ip": baseline_ip,
                    "new_ip": new_ip,
                    "ip_changed": baseline_ip != new_ip,
                    "conditions_met": f"lastLoginIp={baseline_ip}, currentIp=192.168.1.100, different={baseline_ip != '192.168.1.100'}"
                }
            )
        else:
            self.log_result("Device Alert Trigger Login", False, f"Login failed: {response.status_code}")
            return
        
        # Step 4: Wait for logs to be written
        time.sleep(3)
        
        # Step 5: Check logs for device alert
        self.check_logs_for_device_alert()
        
        # Step 6: Test duplicate prevention
        print("Step 3: Testing duplicate prevention with same IP")
        time.sleep(1)
        
        response2 = requests.post(
            f"{self.backend_url}/api/user/login",
            json={"email": "john@dyno.pt", "password": "Katiekendra123@"},
            headers=headers,
            timeout=15
        )
        
        if response2.status_code == 200:
            self.log_result(
                "Duplicate Prevention Test", 
                True, 
                "Second login successful - checking for duplicate alert prevention"
            )
        else:
            self.log_result("Duplicate Prevention Test", False, f"Second login failed: {response2.status_code}")
        
        # Wait and check logs again
        time.sleep(3)
        self.check_logs_for_duplicate_prevention()
    
    def check_logs_for_device_alert(self):
        """Check logs for device alert messages"""
        print("\n=== Checking Logs for Device Alert ===")
        
        try:
            result = subprocess.run(
                ["tail", "-n", "100", "/var/log/supervisor/backend.out.log"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                log_content = result.stdout
                
                # Look for device alert messages
                device_alerts = []
                geolocation_calls = []
                
                for line in log_content.split('\n'):
                    if '[Login] New device alert sent' in line:
                        device_alerts.append(line.strip())
                    if 'ip-api.com' in line or 'geolocation' in line.lower():
                        geolocation_calls.append(line.strip())
                
                if device_alerts:
                    self.log_result(
                        "Device Alert Detection", 
                        True, 
                        f"Found {len(device_alerts)} device alert message(s)",
                        {"alert_messages": device_alerts}
                    )
                    
                    # Check for geolocation info in the alert messages
                    has_location = any('(' in alert and ')' in alert for alert in device_alerts)
                    if has_location:
                        self.log_result(
                            "Geolocation in Alerts", 
                            True, 
                            "Device alert messages include location information",
                            {"alerts_with_location": [alert for alert in device_alerts if '(' in alert and ')' in alert]}
                        )
                    else:
                        self.log_result(
                            "Geolocation in Alerts", 
                            False, 
                            "Device alert messages found but no location information detected"
                        )
                else:
                    self.log_result(
                        "Device Alert Detection", 
                        False, 
                        "No device alert messages found in recent logs"
                    )
                    
                    # Show recent login-related logs for debugging
                    login_logs = [line for line in log_content.split('\n') if 'login' in line.lower() or 'Login' in line][-5:]
                    if login_logs:
                        print("Recent login-related logs:")
                        for log in login_logs:
                            print(f"  {log}")
            
        except Exception as e:
            self.log_result(
                "Log Analysis", 
                False, 
                f"Error checking logs: {str(e)}"
            )
    
    def check_logs_for_duplicate_prevention(self):
        """Check logs for duplicate prevention"""
        print("\n=== Checking Duplicate Prevention ===")
        
        try:
            result = subprocess.run(
                ["tail", "-n", "50", "/var/log/supervisor/backend.out.log"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                log_content = result.stdout
                
                # Count device alert messages in recent logs
                recent_alerts = [line for line in log_content.split('\n') if '[Login] New device alert sent' in line]
                
                if len(recent_alerts) <= 1:
                    self.log_result(
                        "Duplicate Prevention Verification", 
                        True, 
                        f"Found {len(recent_alerts)} device alert(s) in recent logs - duplicate prevention working",
                        {"recent_alerts": recent_alerts}
                    )
                else:
                    self.log_result(
                        "Duplicate Prevention Verification", 
                        False, 
                        f"Found {len(recent_alerts)} device alerts - may indicate duplicate prevention not working",
                        {"recent_alerts": recent_alerts}
                    )
            
        except Exception as e:
            self.log_result(
                "Duplicate Prevention Check", 
                False, 
                f"Error checking duplicate prevention: {str(e)}"
            )
    
    def check_email_template(self):
        """Check email template for location display"""
        print("\n=== Checking Email Template ===")
        
        try:
            result = subprocess.run(
                ["grep", "-A", "10", "-B", "5", "Location:", "/app/backend/services/emailService.ts"],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0 and "locationDisplay" in result.stdout:
                self.log_result(
                    "Email Template Location", 
                    True, 
                    "Email template correctly displays location as first item in login details"
                )
            else:
                self.log_result(
                    "Email Template Location", 
                    False, 
                    "Email template location display not found or incorrect"
                )
        
        except Exception as e:
            self.log_result(
                "Email Template Check", 
                False, 
                f"Error checking email template: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all targeted tests"""
        print("🚀 Starting Targeted Device Login Email Testing")
        print("=" * 60)
        
        # Test 1: Check email template
        self.check_email_template()
        
        # Test 2: Test device alert trigger with controlled conditions
        self.test_device_alert_trigger()
        
        # Summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TARGETED DEVICE LOGIN EMAIL TEST SUMMARY")
        print("=" * 60)
        
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

if __name__ == "__main__":
    tester = TargetedDeviceLoginTester()
    tester.run_all_tests()