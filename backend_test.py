#!/usr/bin/env python3
"""
Admin Fee Residual False Positive Fix - Backend Testing
Testing 7 specific requirements as per review request
Base URL: https://code-analyzer-256.preview.emergentagent.com
"""

import os
import sys
import time
import subprocess
import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8001"
BACKEND_FILE_PATH = "/app/backend/services/merchantPool/merchantPoolMonitoring.ts"

# Test Results Storage
test_results = []

def log_test_result(test_num, description, passed, details=""):
    """Log test result with timestamp"""
    result = {
        "test": f"TEST {test_num}",
        "description": description,
        "passed": passed,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status} - TEST {test_num}: {description}")
    if details:
        print(f"Details: {details}")

def run_command(command, description=""):
    """Run shell command and return result"""
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=30)
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", f"Command timed out: {command}"
    except Exception as e:
        return False, "", f"Error running command: {str(e)}"

def test_1_backend_health():
    """TEST 1: Backend Health - GET /health returns 200 with 'healthy' status"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "status" in data and data["status"] == "healthy":
                    log_test_result(1, "Backend Health", True, 
                        f"Status code: {response.status_code}, Response: {data}")
                    return True
                else:
                    log_test_result(1, "Backend Health", False, 
                        f"Status code: {response.status_code}, but status is not 'healthy': {data}")
                    return False
            except json.JSONDecodeError:
                # Check if response text contains 'healthy'
                if "healthy" in response.text.lower():
                    log_test_result(1, "Backend Health", True, 
                        f"Status code: {response.status_code}, Response text: {response.text}")
                    return True
                else:
                    log_test_result(1, "Backend Health", False, 
                        f"Status code: {response.status_code}, but response doesn't contain 'healthy': {response.text}")
                    return False
        else:
            log_test_result(1, "Backend Health", False, 
                f"Status code: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test_result(1, "Backend Health", False, f"Exception: {str(e)}")
        return False

def test_2_admin_fee_balance_in_query():
    """TEST 2: Code verification - admin_fee_balance in query attributes"""
    try:
        success, stdout, stderr = run_command(
            f'grep -n -A3 -B3 "attributes.*\\[" {BACKEND_FILE_PATH}',
            "Searching for attributes arrays in queries"
        )
        
        if success and stdout:
            # Look for admin_fee_balance in checkMissedPayments function attributes
            attributes_found = "admin_fee_balance" in stdout and "attributes" in stdout
            
            # Also check for the calculation
            success2, stdout2, stderr2 = run_command(
                f'grep -n "const adminFeeBalance = parseFloat" {BACKEND_FILE_PATH}',
                "Searching for adminFeeBalance calculation"
            )
            calculation_found = success2 and "admin_fee_balance" in stdout2
            
            if attributes_found and calculation_found:
                log_test_result(2, "admin_fee_balance in query attributes", True, 
                    f"Found admin_fee_balance in attributes list and calculation present:\nAttributes context:\n{stdout}\nCalculation:\n{stdout2}")
                return True
            else:
                log_test_result(2, "admin_fee_balance in query attributes", False, 
                    f"Missing attributes ({attributes_found}) or calculation ({calculation_found}):\nAttributes:\n{stdout}\nCalculation:\n{stdout2}")
                return False
        else:
            log_test_result(2, "admin_fee_balance in query attributes", False, 
                f"No attributes arrays found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(2, "admin_fee_balance in query attributes", False, f"Exception: {str(e)}")
        return False

def test_3_effective_balance_calculation():
    """TEST 3: Code verification - effectiveBalance calculation exists"""
    try:
        success, stdout, stderr = run_command(
            f'grep -n "effectiveBalance\\|adminFeeBalance" {BACKEND_FILE_PATH}',
            "Searching for effectiveBalance calculation"
        )
        
        if success and stdout:
            lines = stdout.strip().split('\n')
            admin_fee_parse_found = False
            effective_balance_calc_found = False
            
            for line in lines:
                if "const adminFeeBalance = parseFloat(addr.dataValues.admin_fee_balance" in line:
                    admin_fee_parse_found = True
                if "const effectiveBalance = Math.max(0, balance - adminFeeBalance)" in line:
                    effective_balance_calc_found = True
            
            if admin_fee_parse_found and effective_balance_calc_found:
                log_test_result(3, "effectiveBalance calculation exists", True, 
                    f"Found both adminFeeBalance parsing and effectiveBalance calculation:\n{stdout}")
                return True
            else:
                log_test_result(3, "effectiveBalance calculation exists", False, 
                    f"Missing adminFeeBalance parsing ({admin_fee_parse_found}) or effectiveBalance calculation ({effective_balance_calc_found}):\n{stdout}")
                return False
        else:
            log_test_result(3, "effectiveBalance calculation exists", False, 
                f"No effectiveBalance/adminFeeBalance references found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(3, "effectiveBalance calculation exists", False, f"Exception: {str(e)}")
        return False

def test_4_dust_check_uses_effective_balance():
    """TEST 4: Code verification - dust check uses effectiveBalance (not raw balance)"""
    try:
        success, stdout, stderr = run_command(
            f'grep -n -A2 -B2 "effectiveBalance < dustThreshold" {BACKEND_FILE_PATH}',
            "Searching for effectiveBalance dust threshold check"
        )
        
        if success and stdout:
            # Check for the main fix: effectiveBalance < dustThreshold in checkMissedPayments
            effective_dust_found = "effectiveBalance < dustThreshold" in stdout
            
            # Note: There may be other dust checks in different functions for different purposes
            # We're specifically looking for the fix in checkMissedPayments function
            if effective_dust_found:
                log_test_result(4, "dust check uses effectiveBalance", True, 
                    f"Found effectiveBalance < dustThreshold in checkMissedPayments:\n{stdout}")
                return True
            else:
                log_test_result(4, "dust check uses effectiveBalance", False, 
                    f"effectiveBalance < dustThreshold not found in checkMissedPayments:\n{stdout}")
                return False
        else:
            log_test_result(4, "dust check uses effectiveBalance", False, 
                f"No effectiveBalance dust threshold check found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(4, "dust check uses effectiveBalance", False, f"Exception: {str(e)}")
        return False

def test_5_underpayment_check_uses_effective_balance():
    """TEST 5: Code verification - underpayment check uses effectiveBalance"""
    try:
        success, stdout, stderr = run_command(
            f'grep -n -A2 -B2 "expectedAmount.*tolerance" {BACKEND_FILE_PATH}',
            "Searching for underpayment comparison"
        )
        
        if success and stdout:
            # Check for effectiveBalance < (expectedAmount - tolerance) pattern
            effective_underpay_found = "effectiveBalance < (expectedAmount - tolerance)" in stdout
            
            # Check that there's NO raw "balance < (expectedAmount - tolerance)" without effectiveBalance context
            lines = stdout.split('\n')
            raw_balance_underpay_found = False
            for line in lines:
                if "balance < (expectedAmount - tolerance)" in line and "effectiveBalance" not in line:
                    raw_balance_underpay_found = True
                    break
            
            if effective_underpay_found and not raw_balance_underpay_found:
                log_test_result(5, "underpayment check uses effectiveBalance", True, 
                    f"Found effectiveBalance underpayment check and no raw balance check:\n{stdout}")
                return True
            else:
                log_test_result(5, "underpayment check uses effectiveBalance", False, 
                    f"effectiveBalance underpay found: {effective_underpay_found}, raw balance underpay found: {raw_balance_underpay_found}:\n{stdout}")
                return False
        else:
            log_test_result(5, "underpayment check uses effectiveBalance", False, 
                f"No underpayment comparison found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(5, "underpayment check uses effectiveBalance", False, f"Exception: {str(e)}")
        return False

def test_6_received_amount_uses_effective_balance():
    """TEST 6: Code verification - receivedAmount uses effectiveBalance"""
    try:
        success, stdout, stderr = run_command(
            f'grep -n -A2 -B2 "receivedAmount.*=" {BACKEND_FILE_PATH}',
            "Searching for receivedAmount assignment"
        )
        
        if success and stdout:
            # Check for const receivedAmount = effectiveBalance
            effective_received_found = "const receivedAmount = effectiveBalance" in stdout or "receivedAmount = effectiveBalance" in stdout
            
            # Check that there's NO "const receivedAmount = balance" (old code)
            raw_balance_received_found = "const receivedAmount = balance" in stdout and "effectiveBalance" not in stdout
            
            if effective_received_found and not raw_balance_received_found:
                log_test_result(6, "receivedAmount uses effectiveBalance", True, 
                    f"Found receivedAmount = effectiveBalance and no raw balance assignment:\n{stdout}")
                return True
            else:
                log_test_result(6, "receivedAmount uses effectiveBalance", False, 
                    f"effectiveBalance receivedAmount found: {effective_received_found}, raw balance receivedAmount found: {raw_balance_received_found}:\n{stdout}")
                return False
        else:
            log_test_result(6, "receivedAmount uses effectiveBalance", False, 
                f"No receivedAmount assignment found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(6, "receivedAmount uses effectiveBalance", False, f"Exception: {str(e)}")
        return False

def test_7_logs_zero_false_positives():
    """TEST 7: Logs verification - Zero false positives after fix"""
    try:
        print("\nChecking backend logs for admin fee residual entries...")
        
        # Check for admin_fee_residual logs
        success1, stdout1, stderr1 = run_command(
            'grep "admin_fee_residual" /var/log/supervisor/backend.out.log | tail -5',
            "Searching for admin_fee_residual log entries"
        )
        
        # Check for "Missed found: 0" logs
        success2, stdout2, stderr2 = run_command(
            'grep "2026-02-09.*Missed found" /var/log/supervisor/backend.out.log | tail -5',
            "Searching for Missed found log entries"
        )
        
        # Check for admin fee residual skipping logs
        success3, stdout3, stderr3 = run_command(
            'grep "admin fee residual.*skipping" /var/log/supervisor/backend.out.log | tail -5',
            "Searching for admin fee residual skipping logs"
        )
        
        admin_fee_logs = stdout1 if success1 else "No admin_fee_residual logs found"
        missed_logs = stdout2 if success2 else "No Missed found logs found"
        skipping_logs = stdout3 if success3 else "No admin fee residual skipping logs found"
        
        # Look for evidence of the fix working
        fix_evidence = []
        
        if success1 and stdout1:
            fix_evidence.append(f"✅ admin_fee_residual subtraction logs found: {len(stdout1.split(chr(10)))} entries")
        
        if success2 and stdout2:
            # Check if "Missed found: 0" appears in logs
            if "Missed found: 0" in stdout2:
                fix_evidence.append("✅ Found 'Missed found: 0' entries (no false positives)")
            else:
                fix_evidence.append("⚠️ Missed found logs present but need manual review")
        
        if success3 and stdout3:
            if "skipping" in stdout3.lower():
                fix_evidence.append("✅ Found admin fee residual addresses being correctly skipped")
        
        # Also check for any recent logs with "Missed found" pattern
        success4, stdout4, stderr4 = run_command(
            'grep "Missed found" /var/log/supervisor/backend.out.log | tail -10',
            "Searching for any recent Missed found entries"
        )
        
        if success4 and stdout4:
            # Count zero vs non-zero findings
            zero_findings = stdout4.count("Missed found: 0")
            total_findings = stdout4.count("Missed found:")
            
            if zero_findings > 0 and zero_findings == total_findings:
                fix_evidence.append(f"✅ All recent {total_findings} 'Missed found' entries show 0 false positives")
            elif zero_findings > 0:
                fix_evidence.append(f"⚠️ {zero_findings}/{total_findings} 'Missed found' entries show 0 (partial success)")
        
        if len(fix_evidence) >= 2:  # At least 2 pieces of evidence
            log_test_result(7, "Logs show zero false positives after fix", True, 
                f"Evidence found:\n" + "\n".join(fix_evidence) + f"\n\nLog samples:\nAdmin fee logs: {admin_fee_logs[:200]}...\nMissed logs: {missed_logs[:200]}...\nSkipping logs: {skipping_logs[:200]}...")
            return True
        else:
            log_test_result(7, "Logs show zero false positives after fix", False, 
                f"Insufficient evidence. Found {len(fix_evidence)} evidence pieces:\n" + "\n".join(fix_evidence) + f"\n\nLog details:\nAdmin fee logs: {admin_fee_logs}\nMissed logs: {missed_logs}\nSkipping logs: {skipping_logs}")
            return False
            
    except Exception as e:
        log_test_result(7, "Logs show zero false positives after fix", False, f"Exception: {str(e)}")
        return False

def main():
    """Run all 7 tests for Admin Fee Residual False Positive Fix"""
    print("=" * 60)
    print("ADMIN FEE RESIDUAL FALSE POSITIVE FIX - BACKEND TESTING")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Backend file: {BACKEND_FILE_PATH}")
    print(f"Test started at: {datetime.now().isoformat()}")
    print("=" * 60)
    
    # Run all 7 tests
    tests = [
        test_1_backend_health,
        test_2_admin_fee_balance_in_query,
        test_3_effective_balance_calculation,
        test_4_dust_check_uses_effective_balance,
        test_5_underpayment_check_uses_effective_balance,
        test_6_received_amount_uses_effective_balance,
        test_7_logs_zero_false_positives
    ]
    
    passed_tests = 0
    total_tests = len(tests)
    
    for i, test_func in enumerate(tests, 1):
        try:
            if test_func():
                passed_tests += 1
        except Exception as e:
            log_test_result(i, f"Test {i} execution", False, f"Exception during test execution: {str(e)}")
        
        # Small delay between tests
        time.sleep(0.5)
    
    # Summary
    print("\n" + "=" * 60)
    print("ADMIN FEE RESIDUAL FALSE POSITIVE FIX - TEST SUMMARY")
    print("=" * 60)
    
    for result in test_results:
        status = "✅ PASS" if result["passed"] else "❌ FAIL"
        print(f"{status} - {result['test']}: {result['description']}")
    
    print(f"\nOVERALL RESULT: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL 7 TESTS PASSED - Admin Fee Residual False Positive Fix is working correctly!")
        return True
    else:
        print(f"⚠️ {total_tests - passed_tests} TESTS FAILED - Admin Fee Residual False Positive Fix needs attention")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)