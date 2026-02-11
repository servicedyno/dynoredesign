#!/usr/bin/env python3
"""
Backend Test Suite for Email Notification Fix - DynoPay Merchant Pool Payments
Tests the specific changes made to fix missing payment email notifications.
"""

import requests
import subprocess
import sys
import re
import os
from typing import Dict, Any, Optional

def run_test(test_name: str, test_func, expected_result: Any = None) -> Dict[str, Any]:
    """Run a single test and return results"""
    print(f"\n=== TEST {test_name} ===")
    try:
        result = test_func()
        if expected_result is not None:
            success = result == expected_result
        else:
            success = bool(result)
        
        print(f"✅ {test_name}: {'PASSED' if success else 'FAILED'}")
        return {
            "name": test_name,
            "success": success,
            "result": result,
            "error": None
        }
    except Exception as e:
        print(f"❌ {test_name}: FAILED - {str(e)}")
        return {
            "name": test_name,
            "success": False,
            "result": None,
            "error": str(e)
        }

def test_1_health_endpoint():
    """TEST 1: GET http://localhost:8001/health returns 200 with status 'healthy'"""
    response = requests.get("http://localhost:8001/health", timeout=10)
    data = response.json()
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {data}")
    
    if response.status_code == 200 and data.get("status") == "healthy":
        return True
    else:
        raise Exception(f"Expected 200 with status='healthy', got {response.status_code} with {data}")

def test_2_typescript_compiles():
    """TEST 2: TypeScript compiles clean - cd /app/backend && npx tsc --noEmit exits 0"""
    os.chdir("/app/backend")
    
    result = subprocess.run(
        ["npx", "tsc", "--noEmit"], 
        capture_output=True, 
        text=True,
        timeout=60
    )
    
    print(f"Exit code: {result.returncode}")
    if result.stdout:
        print(f"STDOUT: {result.stdout}")
    if result.stderr:
        print(f"STDERR: {result.stderr}")
    
    if result.returncode == 0:
        return True
    else:
        raise Exception(f"TypeScript compilation failed with exit code {result.returncode}\nSTDERR: {result.stderr}")

def test_3_sendpendingpaymentnotification_count():
    """TEST 3: grep -c 'sendPendingPaymentNotification' merchantPoolMonitoring.ts >= 3"""
    file_path = "/app/backend/services/merchantPool/merchantPoolMonitoring.ts"
    
    result = subprocess.run(
        ["grep", "-c", "sendPendingPaymentNotification", file_path],
        capture_output=True,
        text=True
    )
    
    count = int(result.stdout.strip()) if result.returncode == 0 else 0
    
    print(f"Count of 'sendPendingPaymentNotification' in {file_path}: {count}")
    
    if count >= 3:
        return True
    else:
        raise Exception(f"Expected >= 3 occurrences of 'sendPendingPaymentNotification', found {count}")

def test_4_sweep_recovery_count():
    """TEST 4: grep -c 'Sweep Recovery' merchantPoolSweep.ts >= 3"""
    file_path = "/app/backend/services/merchantPool/merchantPoolSweep.ts"
    
    result = subprocess.run(
        ["grep", "-c", "Sweep Recovery"], 
        capture_output=True,
        text=True,
        input=open(file_path).read()
    )
    
    count = int(result.stdout.strip()) if result.returncode == 0 else 0
    
    print(f"Count of 'Sweep Recovery' in {file_path}: {count}")
    
    if count >= 3:
        return True
    else:
        # Let's search for the actual recovery messages
        with open(file_path, 'r') as f:
            content = f.read()
        
        recovery_patterns = [
            "Sweep Recovery",
            "\[Sweep Recovery\]",
            "EMAIL RECOVERY",
            "recovery",  # case insensitive
        ]
        
        total_matches = 0
        for pattern in recovery_patterns:
            matches = len(re.findall(pattern, content, re.IGNORECASE))
            total_matches += matches
            print(f"Pattern '{pattern}': {matches} matches")
        
        print(f"Total recovery-related matches: {total_matches}")
        
        if total_matches >= 3:
            return True
        else:
            raise Exception(f"Expected >= 3 occurrences of 'Sweep Recovery' or similar, found {count} exact matches, {total_matches} total recovery matches")

def test_5_sendpaymentreceivedemail_usage():
    """TEST 5: grep 'sendPaymentReceivedEmail' merchantPoolSweep.ts - should find import AND usage"""
    file_path = "/app/backend/services/merchantPool/merchantPoolSweep.ts"
    
    result = subprocess.run(
        ["grep", "sendPaymentReceivedEmail", file_path],
        capture_output=True,
        text=True
    )
    
    matches = result.stdout.strip().split('\n') if result.stdout.strip() else []
    
    print(f"Matches for 'sendPaymentReceivedEmail':")
    for i, match in enumerate(matches):
        print(f"  {i+1}. {match.strip()}")
    
    has_import = any("import" in match for match in matches)
    has_usage = any("await sendPaymentReceivedEmail" in match or "sendPaymentReceivedEmail(" in match for match in matches)
    
    print(f"Has import: {has_import}")
    print(f"Has usage: {has_usage}")
    
    if has_import and has_usage:
        return True
    else:
        raise Exception(f"Expected both import and usage of 'sendPaymentReceivedEmail', found: import={has_import}, usage={has_usage}")

def test_6_redis_functions():
    """TEST 6: grep 'getRedisItem|setRedisItem' merchantPoolSweep.ts - should find imports"""
    file_path = "/app/backend/services/merchantPool/merchantPoolSweep.ts"
    
    result = subprocess.run(
        ["grep", "-E", "getRedisItem|setRedisItem", file_path],
        capture_output=True,
        text=True
    )
    
    matches = result.stdout.strip().split('\n') if result.stdout.strip() else []
    
    print(f"Matches for Redis functions:")
    for i, match in enumerate(matches):
        print(f"  {i+1}. {match.strip()}")
    
    has_get_redis = any("getRedisItem" in match for match in matches)
    has_set_redis = any("setRedisItem" in match for match in matches)
    
    print(f"Has getRedisItem: {has_get_redis}")
    print(f"Has setRedisItem: {has_set_redis}")
    
    if has_get_redis and has_set_redis:
        return True
    else:
        raise Exception(f"Expected both getRedisItem and setRedisItem, found: getRedisItem={has_get_redis}, setRedisItem={has_set_redis}")

def test_7_payment_received_email_dedup():
    """TEST 7: grep 'payment-received-email' merchantPoolSweep.ts - should find recovery dedup check"""
    file_path = "/app/backend/services/merchantPool/merchantPoolSweep.ts"
    
    result = subprocess.run(
        ["grep", "payment-received-email", file_path],
        capture_output=True,
        text=True
    )
    
    matches = result.stdout.strip().split('\n') if result.stdout.strip() else []
    
    print(f"Matches for 'payment-received-email':")
    for i, match in enumerate(matches):
        print(f"  {i+1}. {match.strip()}")
    
    has_dedup_check = len(matches) >= 1
    
    if has_dedup_check:
        return True
    else:
        raise Exception(f"Expected dedup key 'payment-received-email' for recovery check, found {len(matches)} matches")

def main():
    """Run all tests for email notification fix"""
    print("🧪 Email Notification Fix Testing - DynoPay Merchant Pool Payments")
    print("=" * 80)
    
    tests = [
        ("1", test_1_health_endpoint),
        ("2", test_2_typescript_compiles),
        ("3", test_3_sendpendingpaymentnotification_count),
        ("4", test_4_sweep_recovery_count),
        ("5", test_5_sendpaymentreceivedemail_usage),
        ("6", test_6_redis_functions),
        ("7", test_7_payment_received_email_dedup),
    ]
    
    results = []
    
    for test_id, test_func in tests:
        result = run_test(test_id, test_func)
        results.append(result)
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for r in results if r["success"])
    total = len(results)
    
    for result in results:
        status = "✅ PASS" if result["success"] else "❌ FAIL"
        error_info = f" - {result['error']}" if result["error"] else ""
        print(f"TEST {result['name']}: {status}{error_info}")
    
    print(f"\n🎯 OVERALL RESULT: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Email notification fix is working correctly!")
        return 0
    else:
        print("⚠️  SOME TESTS FAILED - Please review the failing tests above")
        return 1

if __name__ == "__main__":
    sys.exit(main())