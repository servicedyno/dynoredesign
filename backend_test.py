#!/usr/bin/env python3

"""
Backend Test Suite for XRP/RLUSD Redis Key Mismatch Fix
Testing Agent - Verifies 10 specific tests for the CRITICAL FIX
"""

import os
import subprocess
import requests
import sys
import time
from typing import Dict, Any, List, Tuple, Optional

# Configuration
BASE_URL = "http://localhost:8001"
TEST_RESULTS = []

def log_test_result(test_name: str, passed: bool, details: str = "", expected: str = "", actual: str = ""):
    """Log test result for summary reporting"""
    result = {
        "test": test_name,
        "passed": passed,
        "details": details,
        "expected": expected,
        "actual": actual
    }
    TEST_RESULTS.append(result)
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} - {test_name}")
    if not passed:
        print(f"    Expected: {expected}")
        print(f"    Actual: {actual}")
        print(f"    Details: {details}")
    print()

def run_grep_command(pattern: str, file_path: str, count_only: bool = False) -> Tuple[int, str, bool]:
    """Run grep command and return count, output, and success status"""
    try:
        if count_only:
            cmd = ["grep", "-c", pattern, file_path]
        else:
            cmd = ["grep", pattern, file_path]
        
        result = subprocess.run(cmd, capture_output=True, text=True, cwd="/app")
        
        if result.returncode == 0:
            output = result.stdout.strip()
            count = int(output) if count_only else len(output.split('\n')) if output else 0
            return count, output, True
        elif result.returncode == 1:
            # No matches found (normal for grep)
            return 0, "", True
        else:
            # Error occurred
            return 0, result.stderr, False
            
    except Exception as e:
        return 0, str(e), False

def test_backend_health():
    """TEST 1: Backend healthy - GET http://localhost:8001/health returns 200 with status "healthy" """
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        expected_status = 200
        expected_content = "healthy"
        
        if response.status_code == expected_status:
            response_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            status_field = response_data.get('status', '')
            
            if expected_content in status_field:
                log_test_result("TEST 1: Backend Health Check", True, 
                    f"Backend is healthy. Status: {response.status_code}, Response: {status_field}")
                return True
            else:
                log_test_result("TEST 1: Backend Health Check", False, 
                    f"Status field does not contain 'healthy'", expected_content, status_field)
                return False
        else:
            log_test_result("TEST 1: Backend Health Check", False, 
                f"Wrong status code", str(expected_status), str(response.status_code))
            return False
            
    except Exception as e:
        log_test_result("TEST 1: Backend Health Check", False, str(e))
        return False

def test_typescript_compilation():
    """TEST 2: TypeScript compiles clean - cd /app/backend && ./node_modules/.bin/tsc --noEmit should exit 0"""
    try:
        # Check if tsc exists
        tsc_path = "/app/backend/node_modules/.bin/tsc"
        if not os.path.exists(tsc_path):
            log_test_result("TEST 2: TypeScript Compilation", False, 
                f"TypeScript compiler not found at {tsc_path}")
            return False
        
        # Run tsc --noEmit
        result = subprocess.run([tsc_path, "--noEmit"], 
                               cwd="/app/backend", 
                               capture_output=True, 
                               text=True,
                               timeout=60)
        
        if result.returncode == 0:
            log_test_result("TEST 2: TypeScript Compilation", True, 
                "TypeScript compilation successful with no errors")
            return True
        else:
            log_test_result("TEST 2: TypeScript Compilation", False, 
                f"TypeScript compilation failed. Error: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        log_test_result("TEST 2: TypeScript Compilation", False, "TypeScript compilation timed out")
        return False
    except Exception as e:
        log_test_result("TEST 2: TypeScript Compilation", False, str(e))
        return False

def test_no_old_crypto_pattern_monitoring():
    """TEST 3: No old "crypto-" + walletAddress pattern in monitoring file"""
    file_path = "/app/backend/services/merchantPool/merchantPoolMonitoring.ts"
    pattern = '"crypto-" +'
    count, output, success = run_grep_command(pattern, file_path, count_only=True)
    
    if not success:
        log_test_result("TEST 3: No Old crypto- Pattern (Monitoring)", False, 
            f"Error running grep: {output}")
        return False
    
    expected_count = 0
    if count == expected_count:
        log_test_result("TEST 3: No Old crypto- Pattern (Monitoring)", True, 
            f"No old crypto- pattern found in monitoring file")
        return True
    else:
        log_test_result("TEST 3: No Old crypto- Pattern (Monitoring)", False, 
            f"Found old crypto- pattern occurrences", str(expected_count), str(count))
        return False

def test_no_old_crypto_pattern_reservation():
    """TEST 4: No old "crypto-" + pattern in reservation file"""
    file_path = "/app/backend/services/merchantPool/merchantPoolReservation.ts"
    pattern = '"crypto-" +'
    count, output, success = run_grep_command(pattern, file_path, count_only=True)
    
    if not success:
        log_test_result("TEST 4: No Old crypto- Pattern (Reservation)", False, 
            f"Error running grep: {output}")
        return False
    
    expected_count = 0
    if count == expected_count:
        log_test_result("TEST 4: No Old crypto- Pattern (Reservation)", True, 
            f"No old crypto- pattern found in reservation file")
        return True
    else:
        log_test_result("TEST 4: No Old crypto- Pattern (Reservation)", False, 
            f"Found old crypto- pattern occurrences", str(expected_count), str(count))
        return False

def test_getCryptoRedisKey_usage_monitoring():
    """TEST 5: getCryptoRedisKey used in monitoring (should find 10+ occurrences including variable names)"""
    file_path = "/app/backend/services/merchantPool/merchantPoolMonitoring.ts"
    pattern = 'getCryptoRedisKey\\|cryptoRedisKey\\|orphanCryptoKey'
    count, output, success = run_grep_command(pattern, file_path, count_only=True)
    
    if not success:
        log_test_result("TEST 5: getCryptoRedisKey Usage (Monitoring)", False, 
            f"Error running grep: {output}")
        return False
    
    expected_min = 10
    if count >= expected_min:
        log_test_result("TEST 5: getCryptoRedisKey Usage (Monitoring)", True, 
            f"Found {count} getCryptoRedisKey-related occurrences (>= {expected_min} required)")
        return True
    else:
        log_test_result("TEST 5: getCryptoRedisKey Usage (Monitoring)", False, 
            f"Insufficient getCryptoRedisKey usage", f">= {expected_min}", str(count))
        return False

def test_getCryptoRedisKey_usage_reservation():
    """TEST 6: getCryptoRedisKey used in reservation (should find 3+ occurrences)"""
    file_path = "/app/backend/services/merchantPool/merchantPoolReservation.ts"
    pattern = 'getCryptoRedisKey'
    count, output, success = run_grep_command(pattern, file_path, count_only=True)
    
    if not success:
        log_test_result("TEST 6: getCryptoRedisKey Usage (Reservation)", False, 
            f"Error running grep: {output}")
        return False
    
    expected_min = 3
    if count >= expected_min:
        log_test_result("TEST 6: getCryptoRedisKey Usage (Reservation)", True, 
            f"Found {count} getCryptoRedisKey occurrences (>= {expected_min} required)")
        return True
    else:
        log_test_result("TEST 6: getCryptoRedisKey Usage (Reservation)", False, 
            f"Insufficient getCryptoRedisKey usage", f">= {expected_min}", str(count))
        return False

def test_destination_tag_query_attributes():
    """TEST 7: destination_tag in query attributes (2 locations)"""
    file_path = "/app/backend/services/merchantPool/merchantPoolMonitoring.ts"
    pattern = "'destination_tag'"
    count, output, success = run_grep_command(pattern, file_path, count_only=True)
    
    if not success:
        log_test_result("TEST 7: destination_tag in Query Attributes", False, 
            f"Error running grep: {output}")
        return False
    
    expected_count = 2
    if count == expected_count:
        log_test_result("TEST 7: destination_tag in Query Attributes", True, 
            f"Found {count} destination_tag in query attributes (checkMissedPayments + detectOrphanPayments)")
        return True
    else:
        log_test_result("TEST 7: destination_tag in Query Attributes", False, 
            f"Wrong number of destination_tag attributes", str(expected_count), str(count))
        return False

def test_cryptoVerification_calls():
    """TEST 8: cryptoVerification calls pass overrideRedisKey (4 calls total)"""
    file_path = "/app/backend/services/merchantPool/merchantPoolMonitoring.ts"
    pattern = 'cryptoVerification(walletAddress, true,'
    count, output, success = run_grep_command(pattern, file_path, count_only=True)
    
    if not success:
        log_test_result("TEST 8: cryptoVerification Calls with overrideRedisKey", False, 
            f"Error running grep: {output}")
        return False
    
    expected_count = 4
    if count == expected_count:
        log_test_result("TEST 8: cryptoVerification Calls with overrideRedisKey", True, 
            f"Found {count} cryptoVerification calls with overrideRedisKey parameter")
        return True
    else:
        log_test_result("TEST 8: cryptoVerification Calls with overrideRedisKey", False, 
            f"Wrong number of cryptoVerification calls", str(expected_count), str(count))
        return False

def test_findOne_uses_temp_address_id():
    """TEST 9: findOne uses temp_address_id (not wallet_address)"""
    file_path = "/app/backend/services/merchantPool/merchantPoolMonitoring.ts"
    
    # Check for the fix: findOne uses temp_address_id
    pattern1 = 'findOne.*temp_address_id'
    count1, output1, success1 = run_grep_command(pattern1, file_path, count_only=True)
    
    # Check that old pattern is not used: findOne with wallet_address + walletAddress
    pattern2 = 'findOne.*wallet_address.*walletAddress'
    count2, output2, success2 = run_grep_command(pattern2, file_path, count_only=True)
    
    if not success1 or not success2:
        log_test_result("TEST 9: findOne uses temp_address_id", False, 
            f"Error running grep: {output1 if not success1 else output2}")
        return False
    
    if count1 > 0 and count2 == 0:
        log_test_result("TEST 9: findOne uses temp_address_id", True, 
            f"findOne correctly uses temp_address_id ({count1} occurrences), no old wallet_address pattern")
        return True
    else:
        log_test_result("TEST 9: findOne uses temp_address_id", False, 
            f"findOne pattern incorrect", "temp_address_id used, wallet_address not used", 
            f"temp_address_id: {count1}, wallet_address: {count2}")
        return False

def test_paymentController_getCryptoRedisKey():
    """TEST 10: paymentController.ts uses getCryptoRedisKey for all affected locations"""
    file_path = "/app/backend/controller/paymentController.ts"
    
    # Test 1: getCryptoRedisKey(existingAddress
    pattern1 = 'getCryptoRedisKey(existingAddress'
    count1, output1, success1 = run_grep_command(pattern1, file_path, count_only=True)
    
    # Test 2: activeCryptoKey variable (3+ occurrences)
    pattern2 = 'activeCryptoKey'
    count2, output2, success2 = run_grep_command(pattern2, file_path, count_only=True)
    
    # Test 3: getCryptoRedisKey(tempData
    pattern3 = 'getCryptoRedisKey(tempData'
    count3, output3, success3 = run_grep_command(pattern3, file_path, count_only=True)
    
    if not all([success1, success2, success3]):
        log_test_result("TEST 10: paymentController getCryptoRedisKey Usage", False, 
            f"Error running grep commands")
        return False
    
    # Expected counts
    expected_count1 = 1  # getCryptoRedisKey(existingAddress should find 1
    expected_min2 = 3    # activeCryptoKey should find 3+
    expected_count3 = 1  # getCryptoRedisKey(tempData should find 1
    
    success_conditions = [
        count1 == expected_count1,
        count2 >= expected_min2,
        count3 == expected_count3
    ]
    
    if all(success_conditions):
        log_test_result("TEST 10: paymentController getCryptoRedisKey Usage", True, 
            f"All patterns found: getCryptoRedisKey(existingAddress={count1}, activeCryptoKey={count2}, getCryptoRedisKey(tempData={count3}")
        return True
    else:
        details = f"Pattern results: getCryptoRedisKey(existingAddress={count1} (expected {expected_count1}), "
        details += f"activeCryptoKey={count2} (expected >={expected_min2}), "
        details += f"getCryptoRedisKey(tempData={count3} (expected {expected_count3})"
        log_test_result("TEST 10: paymentController getCryptoRedisKey Usage", False, 
            f"Some patterns not found", "All patterns to match expected counts", details)
        return False

def run_all_tests():
    """Run all 10 tests for XRP/RLUSD Redis Key Mismatch fix"""
    print("🔍 TESTING: XRP/RLUSD Redis Key Mismatch — Tag-Based Chain Gap Fix")
    print("=" * 80)
    
    tests = [
        test_backend_health,
        test_typescript_compilation,
        test_no_old_crypto_pattern_monitoring,
        test_no_old_crypto_pattern_reservation,
        test_getCryptoRedisKey_usage_monitoring,
        test_getCryptoRedisKey_usage_reservation,
        test_destination_tag_query_attributes,
        test_cryptoVerification_calls,
        test_findOne_uses_temp_address_id,
        test_paymentController_getCryptoRedisKey,
    ]
    
    passed_tests = 0
    total_tests = len(tests)
    
    for test_func in tests:
        try:
            if test_func():
                passed_tests += 1
        except Exception as e:
            print(f"❌ FAIL - {test_func.__name__}: Exception occurred: {e}")
    
    print("=" * 80)
    print(f"📊 SUMMARY: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED! XRP/RLUSD Redis Key Mismatch fix is working correctly.")
        return True
    else:
        print("⚠️  SOME TESTS FAILED! Review the failures above.")
        return False

def print_detailed_results():
    """Print detailed test results for reporting"""
    print("\n" + "=" * 80)
    print("DETAILED TEST RESULTS")
    print("=" * 80)
    
    for i, result in enumerate(TEST_RESULTS, 1):
        status = "PASS" if result["passed"] else "FAIL"
        print(f"{i:2d}. [{status}] {result['test']}")
        if result["details"]:
            print(f"    Details: {result['details']}")
        if not result["passed"] and result["expected"]:
            print(f"    Expected: {result['expected']}")
            print(f"    Actual: {result['actual']}")
        print()

if __name__ == "__main__":
    print("Backend Testing Agent - XRP/RLUSD Redis Key Mismatch Fix")
    print("Starting test suite...\n")
    
    success = run_all_tests()
    print_detailed_results()
    
    # Exit with proper code for CI/CD integration
    sys.exit(0 if success else 1)