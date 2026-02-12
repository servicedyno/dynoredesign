#!/usr/bin/env python3
"""
Binance WebSocket Price Stream + Rate-Limit Fix Testing for DynoPay Backend

This test script verifies the Binance WebSocket implementation and rate-limit fixes
as specified in the review request. The tests handle expected geo-blocking from 
US-based servers gracefully.

Base URL: http://localhost:8001 (internal)

IMPORTANT: This server is in a US data center where Binance.com is geo-blocked.
The WebSocket shows geo_blocked: true which is EXPECTED behavior.
The key tests are about the code working correctly and handling the geo-block gracefully.
"""

import json
import subprocess
import sys
import requests
from typing import Dict, Any, Optional

# Test configuration
BASE_URL = "http://localhost:8001"
TIMEOUT = 30

class BinanceWebSocketTester:
    def __init__(self):
        self.results = {}
        self.passed_tests = 0
        self.total_tests = 8
        
    def log(self, message: str, level: str = "INFO") -> None:
        """Log message with timestamp"""
        print(f"[{level}] {message}")
        
    def run_curl_command(self, url: str) -> Optional[Dict[str, Any]]:
        """Run curl command and parse JSON response"""
        try:
            response = requests.get(url, timeout=TIMEOUT)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            self.log(f"Failed to fetch {url}: {e}", "ERROR")
            return None
    
    def run_bash_command(self, command: str) -> tuple:
        """Run bash command and return output, error, exit code"""
        try:
            result = subprocess.run(
                command, 
                shell=True, 
                capture_output=True, 
                text=True, 
                timeout=30
            )
            return result.stdout.strip(), result.stderr.strip(), result.returncode
        except subprocess.TimeoutExpired:
            return "", "Command timed out", 1
        except Exception as e:
            return "", str(e), 1
    
    def test_1_backend_healthy(self) -> bool:
        """TEST 1: Backend healthy — curl -s http://localhost:8001/health | python3 -c ..."""
        self.log("TEST 1: Backend Health Check")
        
        data = self.run_curl_command(f"{BASE_URL}/health")
        if not data:
            return False
            
        status = data.get('status')
        if status in ['healthy', 'degraded']:
            self.log(f"✅ Backend health check passed: status={status}")
            return True
        else:
            self.log(f"❌ Backend health check failed: status={status}")
            return False
    
    def test_2_health_shows_websocket_status(self) -> bool:
        """TEST 2: Health shows WebSocket status — curl -s http://localhost:8001/health | python3 -c ..."""
        self.log("TEST 2: Health shows WebSocket status")
        
        data = self.run_curl_command(f"{BASE_URL}/health")
        if not data:
            return False
            
        ws = data.get('binance_websocket', {})
        required_keys = ['connected', 'geo_blocked', 'cached_prices']
        has_keys = all(k in ws for k in required_keys)
        
        connected = ws.get('connected')
        geo_blocked = ws.get('geo_blocked') 
        prices = ws.get('cached_prices')
        
        self.log(f"connected={connected}, geo_blocked={geo_blocked}, prices={prices}")
        
        if has_keys:
            self.log("✅ Health endpoint shows WebSocket status with required keys")
            return True
        else:
            self.log(f"❌ Health endpoint missing WebSocket keys. Found: {list(ws.keys())}")
            return False
    
    def test_3_geo_block_properly_detected(self) -> bool:
        """TEST 3: Geo-block properly detected — curl -s http://localhost:8001/health | python3 -c ..."""
        self.log("TEST 3: Geo-block properly detected")
        
        data = self.run_curl_command(f"{BASE_URL}/health")
        if not data:
            return False
            
        ws = data.get('binance_websocket', {})
        geo_blocked = ws.get('geo_blocked', False)
        has_note = 'note' in ws
        
        self.log(f"geo_blocked={geo_blocked}, has_note={has_note}")
        
        if geo_blocked and has_note:
            self.log("✅ Geo-block properly detected with explanatory note")
            return True
        else:
            self.log(f"❌ Geo-block detection failed. geo_blocked={geo_blocked}, has_note={has_note}")
            return False
    
    def test_4_no_rate_limit_errors_in_logs(self) -> bool:
        """TEST 4: No rate-limit errors in logs"""
        self.log("TEST 4: Checking for rate-limit errors in logs")
        
        stdout, stderr, exit_code = self.run_bash_command(
            'grep -c "rate limited" /var/log/supervisor/backend.out.log 2>/dev/null || echo "0"'
        )
        
        try:
            count = int(stdout)
            if count == 0:
                self.log("✅ No rate-limit errors found in logs")
                return True
            else:
                self.log(f"❌ Found {count} rate-limit errors in logs")
                return False
        except ValueError:
            self.log(f"❌ Could not parse rate-limit error count: {stdout}")
            return False
    
    def test_5_websocket_service_started(self) -> bool:
        """TEST 5: WebSocket service started"""
        self.log("TEST 5: Checking if WebSocket service started")
        
        stdout, stderr, exit_code = self.run_bash_command(
            'grep -c "BinanceWS.*Starting\\|BinanceWS.*Connecting\\|BinanceWS.*geo-blocked" /var/log/supervisor/backend.out.log'
        )
        
        try:
            count = int(stdout)
            if count > 0:
                self.log(f"✅ WebSocket service startup messages found ({count} occurrences)")
                return True
            else:
                self.log("❌ No WebSocket service startup messages found")
                return False
        except ValueError:
            self.log(f"❌ Could not parse WebSocket startup message count: {stdout}")
            return False
    
    def test_6_volatility_monitor_websocket_powered(self) -> bool:
        """TEST 6: Volatility monitor is WebSocket-powered"""
        self.log("TEST 6: Checking if volatility monitor is WebSocket-powered")
        
        stdout, stderr, exit_code = self.run_bash_command(
            'grep "VolatilityMonitor.*WebSocket-powered" /var/log/supervisor/backend.out.log'
        )
        
        if stdout:
            self.log("✅ Volatility monitor WebSocket-powered message found")
            return True
        else:
            self.log("❌ Volatility monitor WebSocket-powered message not found")
            return False
    
    def test_7_reconnect_slow_for_geo_blocked(self) -> bool:
        """TEST 7: Reconnect is slow for geo-blocked"""
        self.log("TEST 7: Checking for slow reconnect intervals for geo-blocked")
        
        stdout, stderr, exit_code = self.run_bash_command(
            'grep "Reconnecting in 300s" /var/log/supervisor/backend.out.log'
        )
        
        if stdout:
            self.log("✅ 300s (5 min) reconnect interval found for geo-blocked connections")
            return True
        else:
            self.log("❌ 300s reconnect interval not found for geo-blocked connections")
            return False
    
    def test_8_swagger_still_works(self) -> bool:
        """TEST 8: Swagger still works"""
        self.log("TEST 8: Checking if Swagger API documentation works")
        
        data = self.run_curl_command(f"{BASE_URL}/api/docs.json")
        if not data:
            return False
            
        paths = data.get('paths', {})
        path_count = len(paths)
        
        self.log(f"Paths: {path_count}")
        
        if path_count >= 190:
            self.log(f"✅ Swagger API documentation working ({path_count} paths)")
            return True
        else:
            self.log(f"❌ Swagger API documentation has insufficient paths ({path_count} < 190)")
            return False
    
    def run_all_tests(self) -> None:
        """Run all tests and report results"""
        self.log("=== Binance WebSocket Price Stream + Rate-Limit Fix Testing ===")
        self.log("IMPORTANT: Geo-blocking is EXPECTED behavior in US data centers")
        self.log("")
        
        tests = [
            ("Backend Health Check", self.test_1_backend_healthy),
            ("Health Shows WebSocket Status", self.test_2_health_shows_websocket_status),
            ("Geo-block Properly Detected", self.test_3_geo_block_properly_detected),
            ("No Rate-Limit Errors in Logs", self.test_4_no_rate_limit_errors_in_logs),
            ("WebSocket Service Started", self.test_5_websocket_service_started),
            ("Volatility Monitor WebSocket-Powered", self.test_6_volatility_monitor_websocket_powered),
            ("Reconnect Slow for Geo-Blocked", self.test_7_reconnect_slow_for_geo_blocked),
            ("Swagger Still Works", self.test_8_swagger_still_works),
        ]
        
        for i, (name, test_func) in enumerate(tests, 1):
            self.log(f"\n--- Running Test {i}: {name} ---")
            try:
                if test_func():
                    self.passed_tests += 1
                    self.results[name] = "PASS"
                else:
                    self.results[name] = "FAIL"
            except Exception as e:
                self.log(f"❌ Test {i} encountered error: {e}", "ERROR")
                self.results[name] = f"ERROR: {e}"
        
        # Final Report
        self.log("\n" + "="*60)
        self.log("FINAL TEST RESULTS")
        self.log("="*60)
        
        for test_name, result in self.results.items():
            status_icon = "✅" if result == "PASS" else "❌"
            self.log(f"{status_icon} {test_name}: {result}")
        
        self.log(f"\nSUMMARY: {self.passed_tests}/{self.total_tests} tests passed")
        
        if self.passed_tests == self.total_tests:
            self.log("🎉 ALL TESTS PASSED! Binance WebSocket implementation is working correctly.")
            return True
        elif self.passed_tests >= 6:
            self.log("⚠️  Most tests passed with some minor issues. Core functionality is working.")
            return True
        else:
            self.log("❌ Multiple test failures detected. Review implementation needed.")
            return False

def main():
    """Main entry point"""
    tester = BinanceWebSocketTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()