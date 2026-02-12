#!/usr/bin/env python3
"""
DynoPay Backend Security Audit Testing Suite
Tests 14 OWASP compliance fixes including bcrypt, XSS sanitization, 
global error handling, graceful shutdown, and more.
"""

import requests
import subprocess
import os
import sys
from typing import Dict, Any, Tuple

# Use the correct backend URL from environment
BASE_URL = "http://localhost:8001"

def log_test(test_name: str, passed: bool, details: str = ""):
    """Log test results with emoji indicators"""
    icon = "✅" if passed else "❌"
    print(f"{icon} TEST {test_name}: {'PASS' if passed else 'FAIL'}")
    if details:
        print(f"   {details}")
    return passed

def run_command(cmd: str, cwd: str = None) -> Tuple[int, str, str]:
    """Run shell command and return exit code, stdout, stderr"""
    try:
        result = subprocess.run(
            cmd, shell=True, cwd=cwd, 
            capture_output=True, text=True, timeout=30
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 1, "", "Command timed out"
    except Exception as e:
        return 1, "", str(e)

def test_health_endpoint() -> bool:
    """TEST 1: GET /health returns 200 with status "healthy" """
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                return log_test("1", True, f"Health check passed: {data.get('service', 'N/A')}")
            else:
                return log_test("1", False, f"Status not healthy: {data}")
        else:
            return log_test("1", False, f"HTTP {response.status_code}: {response.text}")
    except Exception as e:
        return log_test("1", False, f"Request failed: {str(e)}")

def test_diagnostics_protected() -> bool:
    """TEST 2: GET /diagnostics/fee-optimization returns 403 (no auth, diagnostics now protected)"""
    try:
        response = requests.get(f"{BASE_URL}/diagnostics/fee-optimization", timeout=10)
        if response.status_code == 403:
            return log_test("2", True, "Diagnostics endpoint properly protected (returns 403 without auth)")
        else:
            return log_test("2", False, f"Expected 403, got {response.status_code}")
    except Exception as e:
        return log_test("2", False, f"Request failed: {str(e)}")

def test_correlation_id_header() -> bool:
    """TEST 3: POST /api/v1/user/login should have X-Request-ID header (correlation ID)"""
    try:
        # Make POST request to login endpoint (it will return error but should have X-Request-ID header)
        response = requests.post(f"{BASE_URL}/api/v1/user/login", json={}, timeout=10)
        
        # Check if X-Request-ID header is present
        request_id = response.headers.get('X-Request-ID')
        if request_id:
            return log_test("3", True, f"X-Request-ID header found: {request_id[:8]}...")
        else:
            return log_test("3", False, f"X-Request-ID header not found in response headers: {list(response.headers.keys())}")
    except Exception as e:
        return log_test("3", False, f"Request failed: {str(e)}")

def test_csp_header() -> bool:
    """TEST 4: GET /health should have content-security-policy header (CSP directives, not 'false')"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        
        # Check for CSP header
        csp_header = response.headers.get('content-security-policy') or response.headers.get('Content-Security-Policy')
        if csp_header and csp_header.lower() != 'false':
            return log_test("4", True, f"CSP header found with directives: {csp_header[:50]}...")
        else:
            return log_test("4", False, f"CSP header not found or set to 'false'. Headers: {list(response.headers.keys())}")
    except Exception as e:
        return log_test("4", False, f"Request failed: {str(e)}")

def test_bcrypt_import_usage() -> bool:
    """TEST 5: grep 'bcrypt' passwordHelper.ts - should find bcrypt import and usage"""
    exit_code, stdout, stderr = run_command("grep 'bcrypt' /app/backend/helper/passwordHelper.ts")
    if exit_code == 0 and stdout:
        # Count occurrences - should have import, hashSync, compareSync
        lines = stdout.strip().split('\n')
        if len(lines) >= 2:  # At least import + usage
            return log_test("5", True, f"bcrypt found {len(lines)} times: import and usage detected")
        else:
            return log_test("5", False, f"bcrypt found only {len(lines)} time(s), expected at least 2")
    else:
        return log_test("5", False, "bcrypt not found in passwordHelper.ts")

def test_password_functions_usage() -> bool:
    """TEST 6: grep 'hashPassword|verifyPassword' userController.ts - should find at least 8 occurrences"""
    exit_code, stdout, stderr = run_command("grep -E 'hashPassword|verifyPassword' /app/backend/controller/userController.ts")
    if exit_code == 0 and stdout:
        lines = stdout.strip().split('\n')
        occurrences = len(lines)
        if occurrences >= 8:
            return log_test("6", True, f"Password functions found {occurrences} times (≥8 required)")
        else:
            return log_test("6", False, f"Password functions found {occurrences} times, expected ≥8")
    else:
        return log_test("6", False, "hashPassword/verifyPassword not found in userController.ts")

def test_sanitize_middleware() -> bool:
    """TEST 7: grep 'sanitizeInputMiddleware' server.ts - should find middleware import and usage"""
    exit_code, stdout, stderr = run_command("grep 'sanitizeInputMiddleware' /app/backend/server.ts")
    if exit_code == 0 and stdout:
        lines = stdout.strip().split('\n')
        if len(lines) >= 2:  # Import + usage
            return log_test("7", True, f"sanitizeInputMiddleware found {len(lines)} times: import and usage")
        else:
            return log_test("7", False, f"sanitizeInputMiddleware found {len(lines)} time(s), expected at least 2")
    else:
        return log_test("7", False, "sanitizeInputMiddleware not found in server.ts")

def test_request_logger_middleware() -> bool:
    """TEST 8: grep 'requestLoggerMiddleware' server.ts - should find middleware import and usage"""
    exit_code, stdout, stderr = run_command("grep 'requestLoggerMiddleware' /app/backend/server.ts")
    if exit_code == 0 and stdout:
        lines = stdout.strip().split('\n')
        if len(lines) >= 2:  # Import + usage
            return log_test("8", True, f"requestLoggerMiddleware found {len(lines)} times: import and usage")
        else:
            return log_test("8", False, f"requestLoggerMiddleware found {len(lines)} time(s), expected at least 2")
    else:
        return log_test("8", False, "requestLoggerMiddleware not found in server.ts")

def test_trust_proxy() -> bool:
    """TEST 9: grep 'trust proxy' server.ts - should find app.set('trust proxy', 1)"""
    exit_code, stdout, stderr = run_command("grep 'trust proxy' /app/backend/server.ts")
    if exit_code == 0 and stdout and "trust proxy" in stdout:
        return log_test("9", True, f"Trust proxy configuration found: {stdout.strip()}")
    else:
        return log_test("9", False, "Trust proxy configuration not found in server.ts")

def test_db_pool_config() -> bool:
    """TEST 10: grep 'pool' dbInstance.ts - should find pool configuration with max, min, idle"""
    exit_code, stdout, stderr = run_command("grep -A3 -B1 'poolConfig' /app/backend/utils/dbInstance.ts")
    if exit_code == 0 and stdout:
        # Check for pool configuration keywords in the poolConfig object
        pool_content = stdout.lower()
        if 'max:' in pool_content and 'min:' in pool_content and 'idle:' in pool_content:
            return log_test("10", True, f"DB pool configuration found with max, min, idle parameters")
        else:
            return log_test("10", False, f"Pool config found but missing required parameters. Found: {stdout[:100]}...")
    else:
        return log_test("10", False, "DB pool configuration not found in dbInstance.ts")

def test_graceful_shutdown() -> bool:
    """TEST 11: grep 'gracefulShutdown|SIGTERM|SIGINT' server.ts - should find signal handlers"""
    exit_code, stdout, stderr = run_command("grep -E 'gracefulShutdown|SIGTERM|SIGINT' /app/backend/server.ts")
    if exit_code == 0 and stdout:
        lines = stdout.strip().split('\n')
        # Should find gracefulShutdown function + SIGTERM + SIGINT handlers
        if len(lines) >= 3:
            return log_test("11", True, f"Graceful shutdown handlers found: {len(lines)} patterns")
        else:
            return log_test("11", False, f"Partial graceful shutdown found: {len(lines)} patterns, expected ≥3")
    else:
        return log_test("11", False, "Graceful shutdown handlers not found in server.ts")

def test_token_expires_headers_removed() -> bool:
    """TEST 12: grep 'X-Token-Expires' authMiddleware.ts - should return EMPTY (headers removed)"""
    exit_code, stdout, stderr = run_command("grep 'X-Token-Expires' /app/backend/middleware/authMiddleware.ts")
    if exit_code != 0 or not stdout.strip():
        return log_test("12", True, "X-Token-Expires headers successfully removed (no matches found)")
    else:
        return log_test("12", False, f"X-Token-Expires headers still present: {stdout.strip()}")

def test_webhook_endpoint_removed() -> bool:
    """TEST 13: grep 'test-webhook' routes/index.ts - should return EMPTY (endpoint removed)"""
    exit_code, stdout, stderr = run_command("grep 'test-webhook' /app/backend/routes/index.ts")
    if exit_code != 0 or not stdout.strip():
        return log_test("13", True, "test-webhook endpoint successfully removed (no matches found)")
    else:
        return log_test("13", False, f"test-webhook endpoint still present: {stdout.strip()}")

def test_password_strength_rules() -> bool:
    """TEST 14: grep password strength rules in userMiddleware.ts - should find min(8), lowercase, uppercase, digit"""
    exit_code, stdout, stderr = run_command("grep -E 'min\\(8\\)|pattern.*lowercase|pattern.*uppercase|pattern.*digit' /app/backend/middleware/userMiddleware.ts")
    if exit_code == 0 and stdout:
        lines = stdout.strip().split('\n')
        # Should find multiple password validation rules
        if len(lines) >= 2:
            return log_test("14", True, f"Password strength rules found: {len(lines)} validation patterns")
        else:
            return log_test("14", False, f"Limited password rules found: {len(lines)} pattern(s), expected multiple")
    else:
        return log_test("14", False, "Password strength validation rules not found in userMiddleware.ts")

def main():
    """Run all security audit tests and provide summary"""
    print("🔒 DYNOPAY SECURITY AUDIT VERIFICATION TESTING")
    print("=" * 65)
    print(f"Base URL: {BASE_URL}")
    print()
    
    tests = [
        test_health_endpoint,                    # TEST 1
        test_diagnostics_protected,              # TEST 2  
        test_correlation_id_header,              # TEST 3
        test_csp_header,                         # TEST 4
        test_bcrypt_import_usage,                # TEST 5
        test_password_functions_usage,           # TEST 6
        test_sanitize_middleware,                # TEST 7
        test_request_logger_middleware,          # TEST 8
        test_trust_proxy,                        # TEST 9
        test_db_pool_config,                     # TEST 10
        test_graceful_shutdown,                  # TEST 11
        test_token_expires_headers_removed,      # TEST 12
        test_webhook_endpoint_removed,           # TEST 13
        test_password_strength_rules,            # TEST 14
    ]
    
    results = []
    for i, test in enumerate(tests, 1):
        try:
            results.append(test())
        except Exception as e:
            print(f"❌ TEST {i} ERROR: {e}")
            results.append(False)
    
    print("\n" + "=" * 65)
    passed = sum(results)
    total = len(results)
    success_rate = (passed / total) * 100
    
    print(f"📊 SECURITY AUDIT RESULTS: {passed}/{total} tests passed ({success_rate:.1f}%)")
    
    if passed == total:
        print("🎉 ALL SECURITY AUDIT TESTS PASSED - OWASP compliance verified!")
    else:
        print(f"⚠️  {total - passed} tests failed - see details above")
        print("🔧 Failed tests indicate incomplete security implementations")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)