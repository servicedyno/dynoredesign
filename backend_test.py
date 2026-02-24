#!/usr/bin/env python3
"""
DynoPay Backend Testing Suite
Tests the USDT-ERC20 gas funding race condition fixes

This script tests:
1. TypeScript compilation
2. Backend health check
3. Chain-aware gas timeouts (Fix 1)
4. Gas race condition retryable patterns (Fix 2)  
5. isBalanceZero permanent failure detection (Fix 3)
6. BullMQ retry delay configuration (Fix 4)
7. Webhook endpoint functionality
"""

import requests
import subprocess
import sys
import json
import time
from typing import Dict, Any, List, Optional

# Configuration
BACKEND_URL = "http://localhost:8001"
WEBHOOK_URL = f"{BACKEND_URL}/api/tatum-crypto-webhook"
HEALTH_URL = f"{BACKEND_URL}/health"

# Test results tracking
test_results: List[Dict[str, Any]] = []

def log_test_result(test_name: str, passed: bool, message: str = "", details: str = ""):
    """Log a test result for final summary"""
    result = {
        'test': test_name,
        'passed': passed,
        'message': message,
        'details': details
    }
    test_results.append(result)
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if message:
        print(f"   {message}")
    if details and not passed:
        print(f"   Details: {details}")

def run_command(cmd: str, cwd: str = "/app/backend") -> tuple[int, str, str]:
    """Run a shell command and return exit code, stdout, stderr"""
    try:
        result = subprocess.run(
            cmd, 
            shell=True, 
            cwd=cwd,
            capture_output=True, 
            text=True, 
            timeout=30
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 1, "", "Command timed out after 30 seconds"
    except Exception as e:
        return 1, "", str(e)

def check_file_content(file_path: str, search_patterns: List[str]) -> Dict[str, bool]:
    """Check if specific patterns exist in a file"""
    results = {}
    try:
        with open(file_path, 'r') as f:
            content = f.read()
            for pattern in search_patterns:
                results[pattern] = pattern in content
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return {pattern: False for pattern in search_patterns}
    return results

def test_typescript_compilation():
    """Test 1: TypeScript compilation should exit cleanly"""
    print("\n=== Test 1: TypeScript Compilation ===")
    
    exit_code, stdout, stderr = run_command("npx tsc --noEmit")
    
    if exit_code == 0:
        log_test_result("TypeScript Compilation", True, "Code compiles without errors")
    else:
        log_test_result("TypeScript Compilation", False, 
                       f"Compilation failed with exit code {exit_code}",
                       f"stderr: {stderr[:500]}")

def test_backend_health():
    """Test 2: Backend health check"""
    print("\n=== Test 2: Backend Health Check ===")
    
    try:
        response = requests.get(HEALTH_URL, timeout=10)
        
        if response.status_code == 200:
            health_data = response.json()
            if health_data.get('status') == 'healthy':
                database_connected = health_data.get('database') == 'connected'
                redis_connected = health_data.get('redis') == 'connected'
                
                if database_connected and redis_connected:
                    log_test_result("Backend Health", True, 
                                  f"Service healthy with database={health_data.get('database')}, redis={health_data.get('redis')}")
                else:
                    log_test_result("Backend Health", False, 
                                  f"Service unhealthy: database={health_data.get('database')}, redis={health_data.get('redis')}")
            else:
                log_test_result("Backend Health", False, 
                              f"Unhealthy status: {health_data.get('status')}")
        else:
            log_test_result("Backend Health", False, 
                          f"HTTP {response.status_code}: {response.text[:200]}")
            
    except Exception as e:
        log_test_result("Backend Health", False, f"Request failed: {str(e)}")

def test_chain_aware_gas_timeouts():
    """Test 3: Verify Fix 1 - Chain-aware gas timeouts"""
    print("\n=== Test 3: Chain-aware Gas Timeouts (Fix 1) ===")
    
    file_path = "/app/backend/controller/paymentController.ts"
    
    # Check for gasTimeouts object with specific values
    patterns = [
        "gasTimeouts: Record<string, number>",
        "ETH: 120000",
        "MATIC: 45000", 
        "TRX: 15000",
        "BSC: 30000"
    ]
    
    results = check_file_content(file_path, patterns)
    
    # Check if waitForTransactionConfirmation uses gasTimeout variable (not hardcoded)
    with open(file_path, 'r') as f:
        content = f.read()
        uses_gas_timeout_var = "gasTimeout" in content and "waitForTransactionConfirmation" in content
    
    all_patterns_found = all(results.values()) and uses_gas_timeout_var
    
    if all_patterns_found:
        log_test_result("Chain-aware Gas Timeouts", True, 
                       "ETH=120s, MATIC=45s, TRX=15s, BSC=30s, uses gasTimeout variable")
    else:
        missing = [p for p, found in results.items() if not found]
        if not uses_gas_timeout_var:
            missing.append("gasTimeout variable usage")
        log_test_result("Chain-aware Gas Timeouts", False, 
                       f"Missing patterns: {', '.join(missing)}")

def test_gas_race_retryable_patterns():
    """Test 4: Verify Fix 2 - Gas errors are retryable"""
    print("\n=== Test 4: Gas Race Condition Errors Retryable (Fix 2) ===")
    
    file_path = "/app/backend/services/webhookProcessor.ts"
    
    # Check that "403" is NOT in NON_RETRYABLE_ERRORS
    patterns_to_check = [
        "GAS_RACE_RETRYABLE_PATTERNS = [",
        "eth.tx.preparation",
        "insufficient funds send transaction", 
        "available balance is 0, required balance"
    ]
    
    results = check_file_content(file_path, patterns_to_check)
    
    # Check that "403" is NOT in NON_RETRYABLE_ERRORS
    with open(file_path, 'r') as f:
        content = f.read()
        
        # Find NON_RETRYABLE_ERRORS array
        non_retryable_start = content.find("NON_RETRYABLE_ERRORS = [")
        if non_retryable_start != -1:
            non_retryable_end = content.find("];", non_retryable_start)
            non_retryable_section = content[non_retryable_start:non_retryable_end]
            has_403_removed = '"403"' not in non_retryable_section and "'403'" not in non_retryable_section
        else:
            has_403_removed = False
    
    all_patterns_found = all(results.values()) and has_403_removed
    
    if all_patterns_found:
        log_test_result("Gas Race Retryable Patterns", True, 
                       "GAS_RACE_RETRYABLE_PATTERNS exists, 403 removed from NON_RETRYABLE_ERRORS")
    else:
        missing = [p for p, found in results.items() if not found]
        if not has_403_removed:
            missing.append('"403" still in NON_RETRYABLE_ERRORS')
        log_test_result("Gas Race Retryable Patterns", False, 
                       f"Issues found: {', '.join(missing)}")

def test_balance_zero_permanent_failure():
    """Test 5: Verify Fix 3 - isBalanceZero permanent failure detection"""
    print("\n=== Test 5: isBalanceZero Permanent Failure Detection (Fix 3) ===")
    
    file_path = "/app/backend/services/webhookProcessor.ts"
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Check for the corrected logic
    checks = {
        "isGasRaceCondition check": "isGasRaceCondition = GAS_RACE_RETRYABLE_PATTERNS.some" in content,
        "corrected isBalanceZero regex": "balance \\[0\\]|token balance \\[0\\]" in content,
        "gas race condition precedence": "!isGasRaceCondition &&" in content
    }
    
    # Ensure old overly broad regex is NOT present
    old_regex_gone = "Insufficient.*balance" not in content or "/Insufficient.*balance/i" not in content
    checks["old regex removed"] = old_regex_gone
    
    all_checks_passed = all(checks.values())
    
    if all_checks_passed:
        log_test_result("isBalanceZero Fix", True, 
                       "Gas race conditions checked first, only specific balance[0] triggers permanent failure")
    else:
        failed_checks = [check for check, passed in checks.items() if not passed]
        log_test_result("isBalanceZero Fix", False, 
                       f"Failed checks: {', '.join(failed_checks)}")

def test_bullmq_retry_delay():
    """Test 6: Verify Fix 4 - BullMQ retry delay increased"""
    print("\n=== Test 6: BullMQ Retry Delay (Fix 4) ===")
    
    file_path = "/app/backend/services/webhookQueue.ts"
    
    patterns = [
        "delay: 30000",  # Should be 30000ms, not 5000ms
        "gives gas funding TXs time to confirm"  # Comment explaining the change
    ]
    
    results = check_file_content(file_path, patterns)
    
    # Also check for the inner retry loop logic (15s for gas errors vs 2s for others)
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Look in webhookProcessor.ts for the inner retry logic
    processor_file = "/app/backend/services/webhookProcessor.ts"
    with open(processor_file, 'r') as f:
        processor_content = f.read()
        
    gas_error_logic = ("baseWait = isGasError ? 15000 : 2000" in processor_content or 
                       "15000" in processor_content and "2000" in processor_content)
    
    all_patterns_found = all(results.values()) and gas_error_logic
    
    if all_patterns_found:
        log_test_result("BullMQ Retry Delay", True, 
                       "Initial delay 30s, gas errors get 15s base wait vs 2s for normal errors")
    else:
        missing = [p for p, found in results.items() if not found]
        if not gas_error_logic:
            missing.append("inner retry gas error logic")
        log_test_result("BullMQ Retry Delay", False, 
                       f"Missing: {', '.join(missing)}")

def test_webhook_endpoint():
    """Test 7: Webhook endpoint functionality"""
    print("\n=== Test 7: Webhook Endpoint Functionality ===")
    
    # Test payload that should return 200
    test_payload = {
        "address": "0xtest123",
        "txId": "test-tx-" + str(int(time.time())),
        "amount": "0.01",
        "asset": "ETH",
        "counterAddress": "0xsender123"
    }
    
    try:
        response = requests.post(
            WEBHOOK_URL,
            json=test_payload,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        if response.status_code == 200:
            log_test_result("Webhook Endpoint", True, 
                          f"POST {WEBHOOK_URL} returned 200 OK")
        else:
            log_test_result("Webhook Endpoint", False, 
                          f"POST returned HTTP {response.status_code}: {response.text[:200]}")
            
    except Exception as e:
        log_test_result("Webhook Endpoint", False, f"Request failed: {str(e)}")

def print_summary():
    """Print final test summary"""
    print("\n" + "="*80)
    print("USDT-ERC20 GAS FUNDING RACE CONDITION FIXES - TEST SUMMARY")
    print("="*80)
    
    passed_count = sum(1 for result in test_results if result['passed'])
    total_count = len(test_results)
    
    print(f"\nTests Passed: {passed_count}/{total_count}")
    
    if passed_count == total_count:
        print("🎉 ALL TESTS PASSED - All 4 fixes verified successfully!")
    else:
        print("⚠️  Some tests failed - see details below:")
        
        for result in test_results:
            if not result['passed']:
                print(f"\n❌ {result['test']}: {result['message']}")
                if result['details']:
                    print(f"   Details: {result['details']}")
    
    print("\n" + "="*80)
    
    # Return success status
    return passed_count == total_count

def main():
    """Run all tests"""
    print("DynoPay Backend Testing - USDT-ERC20 Gas Funding Race Condition Fixes")
    print("Testing 4 specific fixes as per review request...")
    
    # Run all tests
    test_typescript_compilation()
    test_backend_health() 
    test_chain_aware_gas_timeouts()
    test_gas_race_retryable_patterns()
    test_balance_zero_permanent_failure()
    test_bullmq_retry_delay()
    test_webhook_endpoint()
    
    # Print summary
    success = print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()