#!/usr/bin/env python3
"""
Backend Testing for Binance Proxy Auto-detection and PostgreSQL Connection Stability Fixes
Tests the specific fixes mentioned in the review request.
"""

import requests
import subprocess
import sys
import os
import re

# Test configuration
BASE_URL = "http://localhost:8001"

def run_test(test_name, test_func):
    """Run a single test and return result"""
    try:
        print(f"TEST {test_name}: ", end="", flush=True)
        result = test_func()
        if result:
            print("✅ PASS")
            return True
        else:
            print("❌ FAIL")
            return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_1_backend_healthy():
    """TEST 1: Backend healthy - GET http://localhost:8001/health returns 200 with status 'healthy'"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data.get("status") == "healthy"
    except:
        return False
    return False

def test_2_typescript_compiles():
    """TEST 2: TypeScript compiles clean - cd /app/backend && npx tsc --noEmit — exit code 0"""
    try:
        result = subprocess.run(
            ["npx", "tsc", "--noEmit"],
            cwd="/app/backend",
            capture_output=True,
            text=True,
            timeout=30
        )
        return result.returncode == 0
    except:
        return False

def test_3_detect_binance_access_export():
    """TEST 3: detectBinanceAccess export exists - grep 'export const detectBinanceAccess' /app/backend/services/binanceService.ts"""
    try:
        with open("/app/backend/services/binanceService.ts", "r") as f:
            content = f.read()
        return "export const detectBinanceAccess" in content
    except:
        return False

def test_4_get_effective_proxy_agent_export():
    """TEST 4: getEffectiveProxyAgent export exists - grep 'export const getEffectiveProxyAgent' /app/backend/services/binanceService.ts"""
    try:
        with open("/app/backend/services/binanceService.ts", "r") as f:
            content = f.read()
        return "export const getEffectiveProxyAgent" in content
    except:
        return False

def test_5_websocket_uses_effective_proxy():
    """TEST 5: WebSocket uses getEffectiveProxyAgent (not old wsProxyAgent)"""
    try:
        with open("/app/backend/services/binanceWebSocketService.ts", "r") as f:
            content = f.read()
        
        # Should find getEffectiveProxyAgent occurrences
        has_effective_proxy = "getEffectiveProxyAgent" in content
        
        # Should NOT find old wsProxyAgent references
        has_old_proxy = "wsProxyAgent" in content
        
        return has_effective_proxy and not has_old_proxy
    except:
        return False

def test_6_server_calls_detect_binance():
    """TEST 6: server.ts calls detectBinanceAccess before startBinanceWebSocket"""
    try:
        with open("/app/backend/server.ts", "r") as f:
            content = f.read()
        
        # Should find detectBinanceAccess import and call
        has_import = "detectBinanceAccess" in content
        has_call = "detectBinanceAccess()" in content
        
        return has_import and has_call
    except:
        return False

def test_7_db_has_keep_alive():
    """TEST 7: dbInstance.ts has keepAlive for connection stability"""
    try:
        with open("/app/backend/utils/dbInstance.ts", "r") as f:
            content = f.read()
        return "keepAlive: true" in content
    except:
        return False

def test_8_db_has_retry_config():
    """TEST 8: dbInstance.ts has retry config"""
    try:
        with open("/app/backend/utils/dbInstance.ts", "r") as f:
            content = f.read()
        return "retry: retryConfig" in content
    except:
        return False

def test_9_cron_has_retry_logic():
    """TEST 9: Cron has retry logic for transient connection errors"""
    try:
        with open("/app/backend/server.ts", "r") as f:
            content = f.read()
        
        # Should find Connection terminated retry condition in releaseExpiredReservations cron
        return "Connection terminated" in content
    except:
        return False

def main():
    """Run all tests"""
    print("=== BINANCE PROXY AUTO-DETECTION & POSTGRESQL CONNECTION STABILITY TESTS ===")
    print(f"Base URL: {BASE_URL}")
    print()
    
    # Test definitions
    tests = [
        ("1", test_1_backend_healthy),
        ("2", test_2_typescript_compiles),
        ("3", test_3_detect_binance_access_export),
        ("4", test_4_get_effective_proxy_agent_export),
        ("5", test_5_websocket_uses_effective_proxy),
        ("6", test_6_server_calls_detect_binance),
        ("7", test_7_db_has_keep_alive),
        ("8", test_8_db_has_retry_config),
        ("9", test_9_cron_has_retry_logic),
    ]
    
    # Run tests
    passed = 0
    total = len(tests)
    
    for test_num, test_func in tests:
        if run_test(test_num, test_func):
            passed += 1
    
    print()
    print("=== RESULTS ===")
    print(f"Tests passed: {passed}/{total}")
    print(f"Success rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"❌ {total-passed} tests failed")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)