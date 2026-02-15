#!/usr/bin/env python3
"""
Backend test for BinanceWS logging improvements verification
Tests the switch from console.log to winston cronLogger in binanceWebSocketService.ts
"""

import requests
import subprocess
import re
import os

def test_backend_health():
    """TEST 1: Backend healthy"""
    try:
        response = requests.get("http://localhost:8001/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                return True, f"✅ Backend health check passed: {data.get('status')}"
        return False, f"❌ Health check failed: status={response.status_code}, data={response.text[:200]}"
    except Exception as e:
        return False, f"❌ Health check failed: {str(e)}"

def test_typescript_compilation():
    """TEST 2: TypeScript compiles clean"""
    try:
        result = subprocess.run(['npx', 'tsc', '--noEmit'], 
                              cwd='/app/backend', 
                              capture_output=True, 
                              text=True, 
                              timeout=60)
        if result.returncode == 0:
            return True, "✅ TypeScript compilation successful (no errors)"
        else:
            return False, f"❌ TypeScript compilation failed: {result.stderr[:500]}"
    except Exception as e:
        return False, f"❌ TypeScript compilation error: {str(e)}"

def test_no_console_logs():
    """TEST 3: No console.log remaining in binanceWebSocketService.ts"""
    try:
        result = subprocess.run(['grep', 'console.log\\|console.warn\\|console.error', 
                               '/app/backend/services/binanceWebSocketService.ts'],
                              capture_output=True, text=True)
        # grep returns exit code 1 when no matches found (which is what we want)
        if result.returncode == 1:
            return True, "✅ No console.log statements found in binanceWebSocketService.ts"
        else:
            return False, f"❌ Found console statements: {result.stdout}"
    except Exception as e:
        return False, f"❌ Error checking console statements: {str(e)}"

def test_cronlogger_import():
    """TEST 4: cronLogger imported"""
    try:
        result = subprocess.run(['grep', 'import.*cronLogger.*from.*loggers', 
                               '/app/backend/services/binanceWebSocketService.ts'],
                              capture_output=True, text=True)
        if result.returncode == 0 and 'cronLogger' in result.stdout:
            return True, f"✅ cronLogger import found: {result.stdout.strip()}"
        else:
            return False, "❌ cronLogger import not found"
    except Exception as e:
        return False, f"❌ Error checking cronLogger import: {str(e)}"

def test_logerror_usage():
    """TEST 5: logError used for errors"""
    try:
        result = subprocess.run(['grep', '-c', 'logError', 
                               '/app/backend/services/binanceWebSocketService.ts'],
                              capture_output=True, text=True)
        count = int(result.stdout.strip())
        if count >= 3:
            return True, f"✅ logError used {count} times (>= 3 required)"
        else:
            return False, f"❌ logError used only {count} times (< 3 required)"
    except Exception as e:
        return False, f"❌ Error checking logError usage: {str(e)}"

def test_logwarn_usage():
    """TEST 6: logWarn used for warnings"""
    try:
        result = subprocess.run(['grep', '-c', 'logWarn', 
                               '/app/backend/services/binanceWebSocketService.ts'],
                              capture_output=True, text=True)
        count = int(result.stdout.strip())
        if count >= 1:
            return True, f"✅ logWarn used {count} times (>= 1 required)"
        else:
            return False, f"❌ logWarn used only {count} times (< 1 required)"
    except Exception as e:
        return False, f"❌ Error checking logWarn usage: {str(e)}"

def test_winston_format_logs():
    """TEST 7: Log output uses winston format"""
    try:
        # Check for winston format with 'message:' wrapper and BinanceWS startup message
        result = subprocess.run(['tail', '-n', '300', '/var/log/supervisor/backend.out.log'],
                              capture_output=True, text=True)
        
        # Look for winston-formatted BinanceWS startup message
        log_content = result.stdout
        startup_pattern = r"message: '\[BinanceWS\] Starting"
        
        if re.search(startup_pattern, log_content):
            return True, "✅ Winston formatted BinanceWS startup message found in logs"
        else:
            # Also check for any winston-formatted BinanceWS messages
            winston_pattern = r"message: '\[BinanceWS\]"
            if re.search(winston_pattern, log_content):
                return True, "✅ Winston formatted BinanceWS messages found in logs (message: wrapper confirmed)"
            else:
                return False, "❌ Winston formatted BinanceWS messages not found in recent logs"
    except Exception as e:
        return False, f"❌ Error checking winston format logs: {str(e)}"

def run_all_tests():
    """Run all BinanceWS logging improvement tests"""
    print("🧪 BinanceWS Logging Improvement Testing Started")
    print("=" * 60)
    
    tests = [
        ("Backend Health Check", test_backend_health),
        ("TypeScript Compilation", test_typescript_compilation), 
        ("No Console.log Remaining", test_no_console_logs),
        ("cronLogger Import", test_cronlogger_import),
        ("logError Usage Count", test_logerror_usage),
        ("logWarn Usage Count", test_logwarn_usage),
        ("Winston Format Logs", test_winston_format_logs),
    ]
    
    results = []
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n🔍 Running: {test_name}")
        success, message = test_func()
        results.append((test_name, success, message))
        if success:
            passed += 1
        print(f"   {message}")
    
    print(f"\n{'=' * 60}")
    print(f"📊 BINANCEWS LOGGING IMPROVEMENT TEST RESULTS")
    print(f"{'=' * 60}")
    print(f"✅ Tests Passed: {passed}/{total}")
    print(f"❌ Tests Failed: {total - passed}/{total}")
    
    if passed == total:
        print(f"\n🎉 ALL TESTS PASSED! BinanceWS logging improvements are working correctly.")
        print(f"   - Console.log statements successfully replaced with winston cronLogger")
        print(f"   - Proper import and usage of logError and logWarn functions")
        print(f"   - Winston formatting with 'message:' wrapper confirmed in logs")
    else:
        print(f"\n❌ Some tests failed. Review the issues above.")
    
    return passed == total

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)