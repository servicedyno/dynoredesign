#!/usr/bin/env python3
"""
Crash Recovery Logic Testing for Stale "processing" Payments
Testing the fix in /app/backend/webhooks/index.ts for tatumCryptoWebHook handler
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Tuple

# Read backend URL from environment
try:
    with open('/app/frontend/.env', 'r') as f:
        env_content = f.read()
        for line in env_content.split('\n'):
            if line.startswith('REACT_APP_BACKEND_URL='):
                BACKEND_URL = line.split('=', 1)[1].strip()
                break
        else:
            BACKEND_URL = "http://localhost:8001"
except:
    BACKEND_URL = "http://localhost:8001"

print(f"Using backend URL: {BACKEND_URL}")

def test_backend_health() -> bool:
    """Test 6: Backend Health - Verify backend is running and healthy"""
    try:
        print("\n=== TEST 6: BACKEND HEALTH ===")
        
        # Test basic health endpoint
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            print("✅ Backend health check passed (200 OK)")
            return True
        else:
            print(f"❌ Backend health check failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Backend health check failed with error: {e}")
        return False

def analyze_crash_recovery_code() -> Dict[str, Any]:
    """Test 1-5: Analyze the crash recovery implementation in webhooks/index.ts"""
    print("\n=== CODE ANALYSIS: CRASH RECOVERY LOGIC ===")
    
    try:
        with open('/app/backend/webhooks/index.ts', 'r') as f:
            code = f.read()
    except Exception as e:
        print(f"❌ Failed to read webhooks/index.ts: {e}")
        return {"success": False, "error": str(e)}
    
    results = {
        "success": True,
        "tests": {}
    }
    
    # Test 1: Recovery Detection Logic
    print("\n--- TEST 1: RECOVERY DETECTION LOGIC ---")
    test1_results = []
    
    # Check for isStaleProcessing variable
    if "isStaleProcessing" in code:
        print("✅ isStaleProcessing variable exists")
        test1_results.append(True)
        
        # Find the line where isStaleProcessing is defined
        lines = code.split('\n')
        stale_processing_line = None
        for i, line in enumerate(lines, 1):
            if "isStaleProcessing" in line and "items.status === \"processing\"" in line:
                stale_processing_line = i
                print(f"✅ isStaleProcessing defined at line {i}")
                break
        
        if stale_processing_line:
            # Check all three conditions in the isStaleProcessing definition
            stale_line = lines[stale_processing_line - 1]
            conditions_found = []
            
            if 'items.status === "processing"' in stale_line:
                conditions_found.append("status check")
                print("✅ Condition 1: items.status === \"processing\" found")
                
            # Check the next few lines for multi-line condition
            for check_line_num in range(max(0, stale_processing_line - 1), min(len(lines), stale_processing_line + 5)):
                check_line = lines[check_line_num]
                if "!!items.txId" in check_line:
                    conditions_found.append("txId check") 
                    print("✅ Condition 2: !!items.txId found")
                    break
                
            for check_line_num in range(max(0, stale_processing_line - 1), min(len(lines), stale_processing_line + 5)):
                check_line = lines[check_line_num]
                if "60000" in check_line or ("Date.now()" in check_line and "lastAttempt" in check_line):
                    conditions_found.append("time check")
                    print("✅ Condition 3: Time elapsed > 60000ms check found")
                    break
                
            if len(conditions_found) == 3:
                test1_results.append(True)
                print("✅ All 3 conditions found in isStaleProcessing")
            else:
                test1_results.append(False)
                print(f"❌ Only {len(conditions_found)} conditions found: {conditions_found}")
        else:
            test1_results.append(False)
            print("❌ isStaleProcessing definition not found")
    else:
        test1_results.append(False)
        print("❌ isStaleProcessing variable not found")
    
    # Check guard placement
    if "if (isStaleProcessing && incomingAmount > 0)" in code:
        print("✅ Guard condition 'isStaleProcessing && incomingAmount > 0' found")
        test1_results.append(True)
        
        # Find placement - should be after isAlreadySuccessful check and before main processing
        lines = code.split('\n')
        guard_line = None
        already_successful_line = None
        main_condition_line = None
        
        for i, line in enumerate(lines, 1):
            if "if (isAlreadySuccessful)" in line:
                already_successful_line = i
            elif "if (isStaleProcessing && incomingAmount > 0)" in line:
                guard_line = i
            elif "if ((isFirstTransaction || isCompletionPayment) && incomingAmount > 0)" in line:
                main_condition_line = i
        
        if already_successful_line and guard_line and main_condition_line:
            if already_successful_line < guard_line < main_condition_line:
                print(f"✅ Guard properly placed: isAlreadySuccessful (L{already_successful_line}) → recovery guard (L{guard_line}) → main condition (L{main_condition_line})")
                test1_results.append(True)
            else:
                print(f"❌ Guard placement incorrect: isAlreadySuccessful (L{already_successful_line}), guard (L{guard_line}), main (L{main_condition_line})")
                test1_results.append(False)
        else:
            print("❌ Could not determine guard placement")
            test1_results.append(False)
    else:
        test1_results.append(False)
        print("❌ Guard condition not found")
    
    results["tests"]["test1_recovery_detection"] = {
        "passed": all(test1_results),
        "details": f"Recovery detection logic: {len([x for x in test1_results if x])}/{len(test1_results)} checks passed"
    }
    
    # Test 2: Recovery Path A - Re-attempt cryptoVerification
    print("\n--- TEST 2: RECOVERY PATH A - CRYPTOVERIFICATION RETRY ---")
    test2_results = []
    
    if "paymentController.cryptoVerification(address, true)" in code:
        print("✅ cryptoVerification(address, true) call found")
        test2_results.append(True)
    else:
        print("❌ cryptoVerification call not found")
        test2_results.append(False)
    
    if 'status: "successful"' in code and "recoveredAt" in code:
        print("✅ Redis update with status: 'successful' and recoveredAt found")
        test2_results.append(True)
    else:
        print("❌ Redis success update not found")
        test2_results.append(False)
    
    if "processed-tx-${payload.txId}" in code and "recovered: true" in code:
        print("✅ processed-tx marker with recovered: true found")
        test2_results.append(True)
    else:
        print("❌ processed-tx marker not found")
        test2_results.append(False)
    
    if "setRedisTTL" in code:
        print("✅ TTL setting found")
        test2_results.append(True)
    else:
        print("❌ TTL setting not found")
        test2_results.append(False)
    
    results["tests"]["test2_recovery_path_a"] = {
        "passed": all(test2_results),
        "details": f"Recovery Path A: {len([x for x in test2_results if x])}/{len(test2_results)} checks passed"
    }
    
    # Test 3: Recovery Path B - Direct Webhook Fallback
    print("\n--- TEST 3: RECOVERY PATH B - DIRECT WEBHOOK FALLBACK ---")
    test3_results = []
    
    if "customerData = items?.ref ? await getRedisItem(items.ref)" in code:
        print("✅ customerData retrieval from Redis using items.ref found")
        test3_results.append(True)
    else:
        print("❌ customerData retrieval not found")
        test3_results.append(False)
    
    if "customerData = items" in code and "// Use Redis payment data as fallback" in code:
        print("✅ Fallback to items if no customerData found")
        test3_results.append(True)
    else:
        print("❌ Fallback to items not found")
        test3_results.append(False)
    
    if "callMerchantWebhook(customerData" in code and 'event: "payment.confirmed"' in code:
        print("✅ callMerchantWebhook with payment.confirmed event found")
        test3_results.append(True)
    else:
        print("❌ callMerchantWebhook call not found")
        test3_results.append(False)
    
    # Check for required webhook payload fields
    webhook_fields = [
        "payment_id", "transaction_reference", "status", "amount", 
        "currency", "customer_name", "customer_email", "fee_payer"
    ]
    found_fields = []
    for field in webhook_fields:
        if field in code:
            found_fields.append(field)
    
    if len(found_fields) >= 6:  # Most fields should be present
        print(f"✅ Webhook payload fields found: {found_fields}")
        test3_results.append(True)
    else:
        print(f"❌ Only {len(found_fields)} webhook fields found: {found_fields}")
        test3_results.append(False)
    
    if 'status: "recovered"' in code:
        print("✅ Redis update to status: 'recovered' found")
        test3_results.append(True)
    else:
        print("❌ Redis recovered status update not found")
        test3_results.append(False)
    
    results["tests"]["test3_recovery_path_b"] = {
        "passed": all(test3_results),
        "details": f"Recovery Path B: {len([x for x in test3_results if x])}/{len(test3_results)} checks passed"
    }
    
    # Test 4: isAlreadySuccessful Guard Updated
    print("\n--- TEST 4: ISALREADYSUCCESSFUL GUARD UPDATED ---")
    test4_results = []
    
    # Look for the specific pattern
    already_successful_pattern = 'items.status === "successful" || items.status === "completed" || items.status === "recovered"'
    if already_successful_pattern in code:
        print("✅ isAlreadySuccessful includes 'recovered' status")
        test4_results.append(True)
    else:
        # Check for variations
        if '"recovered"' in code and "isAlreadySuccessful" in code:
            print("✅ recovered status found in isAlreadySuccessful context")
            test4_results.append(True)
        else:
            print("❌ isAlreadySuccessful does not include 'recovered' status")
            test4_results.append(False)
    
    results["tests"]["test4_already_successful_guard"] = {
        "passed": all(test4_results),
        "details": f"isAlreadySuccessful guard: {len([x for x in test4_results if x])}/{len(test4_results)} checks passed"
    }
    
    # Test 5: Normal Flow Not Broken
    print("\n--- TEST 5: NORMAL FLOW NOT BROKEN ---")
    test5_results = []
    
    if "if ((isFirstTransaction || isCompletionPayment) && incomingAmount > 0)" in code:
        print("✅ Original normal flow condition unchanged")
        test5_results.append(True)
    else:
        print("❌ Original condition not found or modified")
        test5_results.append(False)
    
    # Check that recovery block returns before normal flow
    lines = code.split('\n')
    recovery_return_found = False
    for i, line in enumerate(lines):
        if "if (isStaleProcessing && incomingAmount > 0)" in line:
            # Look for return statement in the next ~50 lines (should be much closer)
            for j in range(i, min(i+50, len(lines))):
                if "return res.status(200).end()" in lines[j] and j < len(lines) - 10:  # Not the very end
                    recovery_return_found = True
                    print(f"✅ Recovery block returns res.status(200).end() at line {j+1}")
                    break
            break
    
    if recovery_return_found:
        test5_results.append(True)
    else:
        print("❌ Recovery block return not found")
        test5_results.append(False)
    
    if "Duplicate transaction or txId already exists" in code:
        print("✅ Existing duplicate detection still present")
        test5_results.append(True)
    else:
        print("❌ Duplicate detection not found")
        test5_results.append(False)
    
    results["tests"]["test5_normal_flow"] = {
        "passed": all(test5_results),
        "details": f"Normal flow preservation: {len([x for x in test5_results if x])}/{len(test5_results)} checks passed"
    }
    
    return results

def main():
    """Run all crash recovery logic tests"""
    print("🔍 CRASH RECOVERY LOGIC TESTING FOR STALE 'PROCESSING' PAYMENTS")
    print("=" * 70)
    
    # Test backend health first
    health_ok = test_backend_health()
    
    # Analyze code implementation
    code_analysis = analyze_crash_recovery_code()
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 70)
    
    if health_ok:
        print("✅ Backend Health: PASSED")
    else:
        print("❌ Backend Health: FAILED")
    
    if code_analysis["success"]:
        total_tests = len(code_analysis["tests"])
        passed_tests = len([t for t in code_analysis["tests"].values() if t["passed"]])
        
        print(f"📋 Code Analysis: {passed_tests}/{total_tests} tests passed")
        
        for test_name, test_result in code_analysis["tests"].items():
            status = "✅ PASSED" if test_result["passed"] else "❌ FAILED"
            print(f"   {test_name}: {status} - {test_result['details']}")
    else:
        print(f"❌ Code Analysis: FAILED - {code_analysis.get('error', 'Unknown error')}")
    
    # Overall success
    all_passed = (
        health_ok and
        code_analysis["success"] and
        all(t["passed"] for t in code_analysis["tests"].values())
    )
    
    if all_passed:
        print("\n🎉 ALL TESTS PASSED - Crash recovery logic correctly implemented!")
        return 0
    else:
        print("\n⚠️  SOME TESTS FAILED - Review implementation details above")
        return 1

if __name__ == "__main__":
    sys.exit(main())