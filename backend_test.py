#!/usr/bin/env python3

"""
DYNOPAY BACKEND TESTING SUITE - TATUM API BUG FIXES
Testing Agent for verifying two specific bug fixes in tatumApi.ts
Date: 2026-02-08
"""

import subprocess
import sys
import json
import requests

# Test configuration
BASE_URL = "https://init-install.preview.emergentagent.com"
CREDENTIALS = {
    "email": "richard@dyno.pt",
    "password": "Katiekendra123@"
}

def run_command(cmd, cwd=None):
    """Execute command and return result"""
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True, timeout=30)
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return False, "", "Command timeout"

def test_grep_patterns():
    """Test grep patterns for bug fixes in tatumApi.ts"""
    print("=== TESTING GREP PATTERNS FOR BUG FIXES ===")
    
    tests = []
    
    # Test 1: Verify "fast: 5" was removed (should return 0 matches)
    success, stdout, stderr = run_command('grep -n "fast: 5" /app/backend/apis/tatumApi.ts', cwd='/app/backend')
    if success:
        # If grep succeeds, it found matches - this is a failure
        tests.append({
            "name": "BUG 1: 'fast: 5' removal verification",
            "passed": False,
            "details": f"❌ FAILED: Found {len(stdout.splitlines())} matches for 'fast: 5' (should be 0)\n{stdout}"
        })
    else:
        # If grep fails (exit code 1), it found no matches - this is success
        tests.append({
            "name": "BUG 1: 'fast: 5' removal verification", 
            "passed": True,
            "details": "✅ PASSED: No 'fast: 5' found in tatumApi.ts (correctly removed)"
        })
    
    # Test 2: Verify "fast: 20" exists exactly twice
    success, stdout, stderr = run_command('grep -n "fast: 20" /app/backend/apis/tatumApi.ts', cwd='/app/backend')
    if success:
        matches = stdout.splitlines()
        if len(matches) == 2:
            tests.append({
                "name": "BUG 1: 'fast: 20' verification (2 matches expected)",
                "passed": True,
                "details": f"✅ PASSED: Found exactly 2 matches for 'fast: 20':\n{stdout}"
            })
        else:
            tests.append({
                "name": "BUG 1: 'fast: 20' verification (2 matches expected)",
                "passed": False,
                "details": f"❌ FAILED: Found {len(matches)} matches for 'fast: 20' (expected 2)\n{stdout}"
            })
    else:
        tests.append({
            "name": "BUG 1: 'fast: 20' verification (2 matches expected)",
            "passed": False,
            "details": f"❌ FAILED: No matches found for 'fast: 20'\n{stderr}"
        })
    
    # Test 3: Verify USDC-ERC20 in feeEstimation array
    success, stdout, stderr = run_command('grep -n "USDC-ERC20" /app/backend/apis/tatumApi.ts', cwd='/app/backend')
    if success:
        matches = stdout.splitlines()
        # Should find USDC-ERC20 in both feeEstimation and batchFeeEstimation arrays
        usdc_in_arrays = [line for line in matches if '"USDC-ERC20"' in line and 'indexOf' in line]
        if len(usdc_in_arrays) >= 2:
            tests.append({
                "name": "BUG 2: USDC-ERC20 array inclusion verification",
                "passed": True,
                "details": f"✅ PASSED: Found USDC-ERC20 in array checks:\n{chr(10).join(usdc_in_arrays)}"
            })
        else:
            tests.append({
                "name": "BUG 2: USDC-ERC20 array inclusion verification",
                "passed": False,
                "details": f"❌ FAILED: Expected USDC-ERC20 in at least 2 array checks, found {len(usdc_in_arrays)}\nAll matches:\n{stdout}"
            })
    else:
        tests.append({
            "name": "BUG 2: USDC-ERC20 array inclusion verification",
            "passed": False,
            "details": f"❌ FAILED: No USDC-ERC20 found in tatumApi.ts\n{stderr}"
        })
    
    # Test 4: Verify isERC20 logic includes both USDT-ERC20 and USDC-ERC20
    success, stdout, stderr = run_command('grep -n "isERC20.*USDT-ERC20.*USDC-ERC20" /app/backend/apis/tatumApi.ts', cwd='/app/backend')
    if success:
        matches = stdout.splitlines()
        if len(matches) >= 2:  # Should be in both feeEstimation and batchFeeEstimation
            tests.append({
                "name": "BUG 2: isERC20 logic verification",
                "passed": True,
                "details": f"✅ PASSED: Found isERC20 logic including both tokens:\n{stdout}"
            })
        else:
            tests.append({
                "name": "BUG 2: isERC20 logic verification",
                "passed": False,
                "details": f"❌ FAILED: Expected isERC20 logic in 2 locations, found {len(matches)}\n{stdout}"
            })
    else:
        tests.append({
            "name": "BUG 2: isERC20 logic verification",
            "passed": False,
            "details": f"❌ FAILED: isERC20 logic not found\n{stderr}"
        })
    
    return tests

def test_typescript_compilation():
    """Test TypeScript compilation"""
    print("=== TESTING TYPESCRIPT COMPILATION ===")
    
    success, stdout, stderr = run_command('npx tsc --noEmit', cwd='/app/backend')
    
    if success and not stderr:
        return {
            "name": "TypeScript compilation",
            "passed": True,
            "details": "✅ PASSED: No TypeScript compilation errors"
        }
    else:
        return {
            "name": "TypeScript compilation",
            "passed": False,
            "details": f"❌ FAILED: TypeScript compilation errors:\nSTDOUT: {stdout}\nSTDERR: {stderr}"
        }

def test_backend_health():
    """Test backend health endpoint"""
    print("=== TESTING BACKEND HEALTH ===")
    
    try:
        response = requests.get(f"{BASE_URL}/api/status/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                return {
                    "name": "Backend health check",
                    "passed": True,
                    "details": f"✅ PASSED: Backend healthy - {data}"
                }
            else:
                return {
                    "name": "Backend health check",
                    "passed": False,
                    "details": f"❌ FAILED: Backend unhealthy - {data}"
                }
        else:
            return {
                "name": "Backend health check",
                "passed": False,
                "details": f"❌ FAILED: HTTP {response.status_code} - {response.text}"
            }
    except Exception as e:
        return {
            "name": "Backend health check",
            "passed": False,
            "details": f"❌ FAILED: Exception - {str(e)}"
        }

def run_all_tests():
    """Run all tests and generate report"""
    print("🧪 DYNOPAY TATUM API BUG FIXES TESTING")
    print("=" * 60)
    
    all_tests = []
    
    # Run grep pattern tests
    all_tests.extend(test_grep_patterns())
    
    # Run TypeScript compilation test
    all_tests.append(test_typescript_compilation())
    
    # Run backend health test
    all_tests.append(test_backend_health())
    
    # Generate summary
    passed_count = sum(1 for test in all_tests if test["passed"])
    total_count = len(all_tests)
    
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    for test in all_tests:
        status = "✅ PASS" if test["passed"] else "❌ FAIL"
        print(f"{status} - {test['name']}")
        if not test["passed"]:
            print(f"    {test['details']}")
        print()
    
    print("-" * 60)
    print(f"🎯 OVERALL RESULT: {passed_count}/{total_count} tests passed")
    
    if passed_count == total_count:
        print("✅ ALL TESTS PASSED - BUG FIXES VERIFIED SUCCESSFULLY")
        return True
    else:
        print("❌ SOME TESTS FAILED - REVIEW REQUIRED")
        
        print("\n📝 DETAILED FAILURE ANALYSIS:")
        for test in all_tests:
            if not test["passed"]:
                print(f"\n{test['name']}:")
                print(f"  {test['details']}")
        
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)