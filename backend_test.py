#!/usr/bin/env python3
"""
Email Bug Fixes Testing Script
Tests the 6 verification requirements for email bug fixes in DynoPay backend
"""

import requests
import subprocess
import sys
import re

def test_backend_health():
    """Test 1: GET http://localhost:8001/health — returns 200 with status "healthy" """
    try:
        response = requests.get('http://localhost:8001/health', timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                print("✅ TEST 1 PASSED: Backend health check returns 200 with status 'healthy'")
                return True
            else:
                print(f"❌ TEST 1 FAILED: Backend health status is '{data.get('status')}', expected 'healthy'")
                return False
        else:
            print(f"❌ TEST 1 FAILED: Backend health returns status code {response.status_code}, expected 200")
            return False
    except Exception as e:
        print(f"❌ TEST 1 FAILED: Backend health check error: {e}")
        return False

def test_typescript_compilation():
    """Test 2: TypeScript compilation: cd /app/backend && npx tsc --noEmit — exits 0"""
    try:
        result = subprocess.run(['npx', 'tsc', '--noEmit'], 
                              cwd='/app/backend', 
                              capture_output=True, 
                              text=True,
                              timeout=60)
        if result.returncode == 0:
            print("✅ TEST 2 PASSED: TypeScript compilation exits with code 0")
            return True
        else:
            print(f"❌ TEST 2 FAILED: TypeScript compilation exits with code {result.returncode}")
            print(f"Stderr: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ TEST 2 FAILED: TypeScript compilation error: {e}")
        return False

def test_format_email_error_exists():
    """Test 3: formatEmailError function exists: grep -c 'formatEmailError' should find >= 16 occurrences"""
    try:
        result = subprocess.run(['grep', '-c', 'formatEmailError', '/app/backend/helper/sendEmail.ts'], 
                              capture_output=True, 
                              text=True)
        if result.returncode == 0:
            count = int(result.stdout.strip())
            if count >= 16:
                print(f"✅ TEST 3 PASSED: formatEmailError found {count} times (>= 16 required)")
                return True
            else:
                print(f"❌ TEST 3 FAILED: formatEmailError found {count} times (< 16 required)")
                return False
        else:
            print(f"❌ TEST 3 FAILED: grep command failed with return code {result.returncode}")
            return False
    except Exception as e:
        print(f"❌ TEST 3 FAILED: formatEmailError search error: {e}")
        return False

def test_no_raw_error_dumps():
    """Test 4: No raw error dumps left: grep -c 'console.log.*", e)' should return 0"""
    try:
        result = subprocess.run(['grep', '-c', 'console.log.*", e)', '/app/backend/helper/sendEmail.ts'], 
                              capture_output=True, 
                              text=True)
        # When grep finds 0 matches, it returns exit code 1
        if result.returncode == 1 and result.stdout.strip() == '':
            print("✅ TEST 4 PASSED: No raw error dumps found (0 occurrences of old pattern)")
            return True
        elif result.returncode == 0:
            count = int(result.stdout.strip())
            print(f"❌ TEST 4 FAILED: Found {count} raw error dumps (should be 0)")
            return False
        else:
            print(f"❌ TEST 4 FAILED: grep command failed with unexpected return code {result.returncode}")
            return False
    except Exception as e:
        print(f"❌ TEST 4 FAILED: Raw error dump search error: {e}")
        return False

def test_unsubscribe_uses_server_url():
    """Test 5: Unsubscribe URL uses SERVER_URL: grep 'SERVER_URL' should find the backendUrl variable"""
    try:
        result = subprocess.run(['grep', 'SERVER_URL', '/app/backend/helper/sendEmail.ts'], 
                              capture_output=True, 
                              text=True)
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            # Look for the backendUrl assignment that uses SERVER_URL
            for line in lines:
                if 'backendUrl' in line and 'SERVER_URL' in line:
                    print("✅ TEST 5 PASSED: Unsubscribe URL uses SERVER_URL (found backendUrl variable)")
                    return True
            print("❌ TEST 5 FAILED: SERVER_URL found but not in backendUrl context")
            print(f"Found: {lines}")
            return False
        else:
            print("❌ TEST 5 FAILED: SERVER_URL not found in sendEmail.ts")
            return False
    except Exception as e:
        print(f"❌ TEST 5 FAILED: SERVER_URL search error: {e}")
        return False

def test_error_formatter_extracts_response():
    """Test 6: Error formatter extracts response status/data"""
    try:
        result = subprocess.run(['grep', 'response.*status\\|response.*data', '/app/backend/helper/sendEmail.ts'], 
                              capture_output=True, 
                              text=True)
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            has_status = any('status' in line for line in lines)
            has_data = any('data' in line for line in lines)
            if has_status and has_data:
                print("✅ TEST 6 PASSED: Error formatter extracts both response status and data")
                return True
            else:
                print(f"❌ TEST 6 FAILED: Missing status ({has_status}) or data ({has_data}) extraction")
                return False
        else:
            print("❌ TEST 6 FAILED: No response status/data extraction found")
            return False
    except Exception as e:
        print(f"❌ TEST 6 FAILED: Response extraction search error: {e}")
        return False

def main():
    """Run all email bug fix tests"""
    print("=== EMAIL BUG FIXES TESTING ===")
    print("Testing 6 verification requirements for email bug fixes in DynoPay backend")
    print()
    
    tests = [
        ("Backend Health Check", test_backend_health),
        ("TypeScript Compilation", test_typescript_compilation), 
        ("formatEmailError Function Exists", test_format_email_error_exists),
        ("No Raw Error Dumps", test_no_raw_error_dumps),
        ("Unsubscribe Uses SERVER_URL", test_unsubscribe_uses_server_url),
        ("Error Formatter Extracts Response", test_error_formatter_extracts_response)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"Running: {test_name}")
        try:
            if test_func():
                passed += 1
            else:
                pass  # Error already printed by test function
        except Exception as e:
            print(f"❌ {test_name} FAILED: Unexpected error: {e}")
        print()
    
    print("=== SUMMARY ===")
    print(f"Tests passed: {passed}/{total} ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED: Email bug fixes are working correctly!")
        return True
    else:
        print("⚠️  SOME TESTS FAILED: Email bug fixes need attention")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)