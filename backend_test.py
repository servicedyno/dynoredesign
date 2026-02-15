#!/usr/bin/env python3
"""
DynoPay Backend Testing Suite - Payment Status Normalization
Tests for additive payment_status field implementation across all merchant-facing endpoints.
"""

import subprocess
import sys
import os
import requests
import re
import json
from pathlib import Path

def run_command(cmd, description="", cwd=None, capture_output=True):
    """Run a shell command and return the result"""
    print(f"\n📋 {description}")
    print(f"💻 Running: {cmd}")
    
    if isinstance(cmd, str):
        # For shell commands that need shell parsing
        result = subprocess.run(cmd, shell=True, capture_output=capture_output, text=True, cwd=cwd)
    else:
        # For command arrays
        result = subprocess.run(cmd, capture_output=capture_output, text=True, cwd=cwd)
    
    if result.returncode == 0:
        print("✅ SUCCESS")
        if result.stdout and capture_output:
            print(f"📄 Output:\n{result.stdout}")
        return True, result.stdout
    else:
        print(f"❌ FAILED (exit code: {result.returncode})")
        if result.stderr and capture_output:
            print(f"🚨 Error:\n{result.stderr}")
        if result.stdout and capture_output:
            print(f"📄 Output:\n{result.stdout}")
        return False, result.stderr

def test_backend_health():
    """TEST 1: Backend healthy"""
    try:
        response = requests.get("http://localhost:8001/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                print("✅ TEST 1: Backend health check PASSED")
                return True
            else:
                print(f"❌ TEST 1: Backend status is not 'healthy': {data}")
                return False
        else:
            print(f"❌ TEST 1: Backend health check failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 1: Backend health check failed with error: {e}")
        return False

def test_typescript_compilation():
    """TEST 2: TypeScript compiles clean for all modified files"""
    success, output = run_command(
        "cd /app/backend && npx tsc --noEmit 2>&1 | grep -E 'paymentController|walletController|webhookProcessor|merchantApiRouter|webhooks/index|paymentStateMachine'",
        "TEST 2: Checking TypeScript compilation for modified files"
    )
    
    # If grep finds nothing (exit code 1), that means no errors in our target files
    if not success:  # grep returns 1 when no matches found
        print("✅ TEST 2: TypeScript compilation clean for target files")
        return True
    else:
        print(f"❌ TEST 2: TypeScript errors found in target files:\n{output}")
        return False

def test_state_machine_tests():
    """TEST 3: State machine tests still pass"""
    success, output = run_command(
        'cd /app/backend && npx jest __tests__/paymentStateMachine.test.ts --passWithNoTests 2>&1 | grep -E "Tests:|passed|failed|total"',
        "TEST 3: Running state machine tests"
    )
    
    if success and ("132 passed" in output or "132 tests" in output):
        print("✅ TEST 3: State machine tests PASSED (132 tests)")
        return True
    else:
        print(f"❌ TEST 3: State machine tests FAILED")
        return False

def test_webhook_processor_tests():
    """TEST 4: Webhook processor tests still pass"""
    success, output = run_command(
        'cd /app/backend && npx jest __tests__/webhookProcessor.test.ts --passWithNoTests 2>&1 | grep -E "Tests:|passed|failed|total"',
        "TEST 4: Running webhook processor tests"
    )
    
    if success and ("52 passed" in output or "52 tests" in output):
        print("✅ TEST 4: Webhook processor tests PASSED (52 tests)")
        return True
    else:
        print(f"❌ TEST 4: Webhook processor tests FAILED")
        return False

def test_payment_status_in_webhook_processor():
    """TEST 5: Verify payment_status field exists in webhookProcessor webhook payloads"""
    success, output = run_command(
        "grep -c 'payment_status' /app/backend/services/webhookProcessor.ts",
        "TEST 5: Checking payment_status field in webhookProcessor"
    )
    
    if success and output.strip():
        count = int(output.strip())
        if count >= 4:
            print(f"✅ TEST 5: payment_status found {count} times in webhookProcessor (>= 4 required)")
            return True
        else:
            print(f"❌ TEST 5: payment_status found only {count} times in webhookProcessor (< 4 required)")
            return False
    else:
        print("❌ TEST 5: payment_status not found in webhookProcessor")
        return False

def test_payment_status_in_payment_controller():
    """TEST 6: Verify payment_status field exists in verify endpoint responses"""
    success, output = run_command(
        "grep -c 'payment_status' /app/backend/controller/paymentController.ts",
        "TEST 6: Checking payment_status field in paymentController"
    )
    
    if success and output.strip():
        count = int(output.strip())
        if count >= 7:
            print(f"✅ TEST 6: payment_status found {count} times in paymentController (>= 7 required)")
            return True
        else:
            print(f"❌ TEST 6: payment_status found only {count} times in paymentController (< 7 required)")
            return False
    else:
        print("❌ TEST 6: payment_status not found in paymentController")
        return False

def test_payment_status_in_merchant_api():
    """TEST 7: Verify payment_status field exists in merchant API endpoints"""
    success, output = run_command(
        "grep -c 'payment_status' /app/backend/routes/merchantApiRouter.ts",
        "TEST 7: Checking payment_status field in merchantApiRouter"
    )
    
    if success and output.strip():
        count = int(output.strip())
        if count >= 2:
            print(f"✅ TEST 7: payment_status found {count} times in merchantApiRouter (>= 2 required)")
            return True
        else:
            print(f"❌ TEST 7: payment_status found only {count} times in merchantApiRouter (< 2 required)")
            return False
    else:
        print("❌ TEST 7: payment_status not found in merchantApiRouter")
        return False

def test_display_status_in_merchant_api():
    """TEST 8: Verify display_status exists for auto-convert in merchant API"""
    success, output = run_command(
        "grep -c 'display_status' /app/backend/routes/merchantApiRouter.ts",
        "TEST 8: Checking display_status field in merchantApiRouter"
    )
    
    if success and output.strip():
        count = int(output.strip())
        if count >= 2:
            print(f"✅ TEST 8: display_status found {count} times in merchantApiRouter (>= 2 required)")
            return True
        else:
            print(f"❌ TEST 8: display_status found only {count} times in merchantApiRouter (< 2 required)")
            return False
    else:
        print("❌ TEST 8: display_status not found in merchantApiRouter")
        return False

def test_conversion_display_status_export():
    """TEST 9: Verify toConversionDisplayStatus is exported from state machine"""
    success, output = run_command(
        "grep 'export function toConversionDisplayStatus' /app/backend/services/paymentStateMachine.ts",
        "TEST 9: Checking toConversionDisplayStatus export"
    )
    
    if success and "export function toConversionDisplayStatus" in output:
        print("✅ TEST 9: toConversionDisplayStatus export found in paymentStateMachine")
        return True
    else:
        print("❌ TEST 9: toConversionDisplayStatus export not found in paymentStateMachine")
        return False

def test_crash_recovery_bug_fix():
    """TEST 10: Verify crash recovery webhook bug is fixed"""
    # Check that payment.confirmed no longer sends status: "processing"
    success1, output1 = run_command(
        "grep -A5 'event: \"payment.confirmed\"' /app/backend/services/webhookProcessor.ts | grep 'status: \"processing\"'",
        "TEST 10a: Checking payment.confirmed doesn't send status: processing"
    )
    
    # Check that payment.confirmed now sends status: "successful"
    success2, output2 = run_command(
        "grep -A5 'event: \"payment.confirmed\"' /app/backend/services/webhookProcessor.ts | grep 'status: \"successful\"'",
        "TEST 10b: Checking payment.confirmed sends status: successful"
    )
    
    # First check should return empty (no matches found - success is False for grep)
    # Second check should return matches (success is True for grep)
    if not success1 and success2:
        print("✅ TEST 10: Crash recovery bug fix VERIFIED - payment.confirmed sends 'successful' not 'processing'")
        return True
    else:
        print("❌ TEST 10: Crash recovery bug fix FAILED")
        if success1:
            print(f"  Still found 'processing' status: {output1}")
        if not success2:
            print("  Did not find 'successful' status")
        return False

def test_legacy_tatum_webhook():
    """TEST 11: Verify legacy tatumWebHook uses state machine"""
    success, output = run_command(
        "grep 'toRedisStatus(PaymentState' /app/backend/webhooks/index.ts",
        "TEST 11: Checking legacy tatumWebHook uses state machine"
    )
    
    if success and output.strip():
        count = len(output.strip().split('\n'))
        if count >= 2:
            print(f"✅ TEST 11: toRedisStatus(PaymentState found {count} matches in webhooks/index.ts (>= 2 required)")
            return True
        else:
            print(f"❌ TEST 11: toRedisStatus(PaymentState found only {count} matches (< 2 required)")
            return False
    else:
        print("❌ TEST 11: toRedisStatus(PaymentState not found in webhooks/index.ts")
        return False

def test_backward_compatibility():
    """TEST 12: Backward compatibility - existing status field still present"""
    success, output = run_command(
        "grep 'status:.*\"confirmed\"\\|status:.*\"waiting\"\\|status:.*\"pending\"\\|status:.*\"failed\"\\|status:.*\"underpaid\"' /app/backend/controller/paymentController.ts | head -10",
        "TEST 12: Checking backward compatibility - existing status field preserved"
    )
    
    if success and output.strip():
        lines = output.strip().split('\n')
        if len(lines) >= 5:
            print(f"✅ TEST 12: Backward compatibility VERIFIED - found {len(lines)} status field references")
            return True
        else:
            print(f"❌ TEST 12: Found only {len(lines)} status field references")
            return False
    else:
        print("❌ TEST 12: No status field references found - backward compatibility issue")
        return False

def test_conversion_display_status_mapping():
    """TEST 13: Conversion display status mapping is correct"""
    test_script = """
import { toConversionDisplayStatus } from './services/paymentStateMachine';
console.log(toConversionDisplayStatus('PENDING_DEPOSIT') === 'pending' ? 'OK' : 'FAIL');
console.log(toConversionDisplayStatus('CONVERTING') === 'converting' ? 'OK' : 'FAIL');
console.log(toConversionDisplayStatus('COMPLETED') === 'settled' ? 'OK' : 'FAIL');
console.log(toConversionDisplayStatus('FAILED') === 'failed' ? 'OK' : 'FAIL');
"""
    
    success, output = run_command(
        f'cd /app/backend && npx ts-node --transpile-only -e "{test_script}"',
        "TEST 13: Testing conversion display status mapping"
    )
    
    if success and output.strip():
        results = output.strip().split('\n')
        if len(results) == 4 and all(result == 'OK' for result in results):
            print("✅ TEST 13: Conversion display status mapping CORRECT - all 4 mappings OK")
            return True
        else:
            print(f"❌ TEST 13: Conversion display status mapping FAILED - results: {results}")
            return False
    else:
        print("❌ TEST 13: Failed to test conversion display status mapping")
        return False

def main():
    """Run all tests for payment_status normalization"""
    print("🚀 DynoPay Backend Testing Suite - Payment Status Normalization")
    print("=" * 80)
    
    # Define all tests
    tests = [
        ("Backend Health Check", test_backend_health),
        ("TypeScript Compilation", test_typescript_compilation),
        ("State Machine Tests", test_state_machine_tests),
        ("Webhook Processor Tests", test_webhook_processor_tests),
        ("Payment Status in WebhookProcessor", test_payment_status_in_webhook_processor),
        ("Payment Status in PaymentController", test_payment_status_in_payment_controller),
        ("Payment Status in MerchantAPI", test_payment_status_in_merchant_api),
        ("Display Status in MerchantAPI", test_display_status_in_merchant_api),
        ("toConversionDisplayStatus Export", test_conversion_display_status_export),
        ("Crash Recovery Bug Fix", test_crash_recovery_bug_fix),
        ("Legacy TatumWebHook State Machine", test_legacy_tatum_webhook),
        ("Backward Compatibility", test_backward_compatibility),
        ("Conversion Display Status Mapping", test_conversion_display_status_mapping),
    ]
    
    passed = 0
    failed = 0
    results = []
    
    # Run each test
    for test_name, test_func in tests:
        print(f"\n{'=' * 20} {test_name} {'=' * 20}")
        try:
            result = test_func()
            if result:
                passed += 1
                results.append(f"✅ {test_name}")
            else:
                failed += 1
                results.append(f"❌ {test_name}")
        except Exception as e:
            print(f"🔥 EXCEPTION in {test_name}: {e}")
            failed += 1
            results.append(f"💥 {test_name} (Exception)")
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 PAYMENT STATUS NORMALIZATION TEST SUMMARY")
    print("=" * 80)
    
    for result in results:
        print(result)
    
    print(f"\n🎯 Total Tests: {len(tests)}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📈 Success Rate: {(passed/len(tests)*100):.1f}%")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED! Payment status normalization is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {failed} test(s) failed. Please check the implementation.")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)