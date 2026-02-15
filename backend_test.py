#!/usr/bin/env python3
"""
Backend Testing for UTXO Auto-Convert Stranding Bug Fix
Tests the implementation according to review requirements
"""

import requests
import subprocess
import sys
import os
import json
from typing import Dict, Any, List

# Backend URL from frontend .env
BACKEND_URL = "https://onboarding-flow-52.preview.emergentagent.com"

def run_command(cmd: str, cwd: str = "/app/backend") -> Dict[str, Any]:
    """Execute shell command and return result"""
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True, timeout=30)
        return {
            "success": result.returncode == 0,
            "returncode": result.returncode,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "command": cmd
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "returncode": -1,
            "stdout": "",
            "stderr": "Command timed out after 30 seconds",
            "command": cmd
        }
    except Exception as e:
        return {
            "success": False,
            "returncode": -1,
            "stdout": "",
            "stderr": str(e),
            "command": cmd
        }

def test_backend_health() -> Dict[str, Any]:
    """TEST 1: Backend healthy - GET /health returns 200"""
    print("🔍 TEST 1: Testing backend health...")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        success = response.status_code == 200
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        return {
            "test": "Backend Health",
            "success": success,
            "status_code": response.status_code,
            "response": data,
            "expected": "200 with status 'healthy'"
        }
    except Exception as e:
        return {
            "test": "Backend Health", 
            "success": False,
            "error": str(e),
            "expected": "200 with status 'healthy'"
        }

def test_typescript_compilation() -> Dict[str, Any]:
    """TEST 2: TypeScript compiles clean"""
    print("🔍 TEST 2: Testing TypeScript compilation...")
    result = run_command("npx tsc --noEmit")
    
    return {
        "test": "TypeScript Compilation",
        "success": result["success"],
        "returncode": result["returncode"],
        "output": result["stdout"] + result["stderr"] if result["stderr"] else result["stdout"],
        "expected": "exit code 0"
    }

def test_utxo_auto_convert_patterns() -> Dict[str, Any]:
    """TEST 3: FIX 1 — UTXO auto-convert direct transfer in settleCryptoTransaction"""
    print("🔍 TEST 3: Testing UTXO auto-convert patterns in paymentController...")
    
    tests = []
    
    # Check for 'UTXO auto-convert' occurrences
    result1 = run_command("grep -c 'UTXO auto-convert' /app/backend/controller/paymentController.ts")
    count1 = int(result1["stdout"]) if result1["success"] and result1["stdout"].isdigit() else 0
    tests.append({
        "pattern": "UTXO auto-convert", 
        "expected": "at least 3 occurrences",
        "found": count1,
        "success": count1 >= 3
    })
    
    # Check for isUTXODirect logic
    result2 = run_command("grep 'isUTXODirect' /app/backend/controller/paymentController.ts")
    tests.append({
        "pattern": "isUTXODirect",
        "expected": "UTXO detection logic",
        "found": result2["stdout"] if result2["success"] else "Not found",
        "success": result2["success"]
    })
    
    # Check for UTXO admin-only transfer
    result3 = run_command("grep 'UTXO admin-only transfer' /app/backend/controller/paymentController.ts")
    tests.append({
        "pattern": "UTXO admin-only transfer",
        "expected": "withRetry call",
        "found": result3["stdout"] if result3["success"] else "Not found", 
        "success": result3["success"]
    })
    
    all_success = all(t["success"] for t in tests)
    
    return {
        "test": "UTXO Auto-Convert Direct Transfer",
        "success": all_success,
        "details": tests,
        "expected": "All 3 patterns found in paymentController.ts"
    }

def test_release_address_pending_sweep() -> Dict[str, Any]:
    """TEST 4: FIX 2 — releaseAddress has pendingSweep parameter"""
    print("🔍 TEST 4: Testing releaseAddress pendingSweep parameter...")
    
    tests = []
    
    # Check for pendingSweep occurrences
    result1 = run_command("grep -c 'pendingSweep' /app/backend/services/merchantPool/merchantPoolReservation.ts")
    count1 = int(result1["stdout"]) if result1["success"] and result1["stdout"].isdigit() else 0
    tests.append({
        "pattern": "pendingSweep (all occurrences)",
        "expected": "at least 5 occurrences", 
        "found": count1,
        "success": count1 >= 5
    })
    
    # Check for pendingSweep boolean parameter
    result2 = run_command("grep 'pendingSweep.*boolean' /app/backend/services/merchantPool/merchantPoolReservation.ts")
    tests.append({
        "pattern": "pendingSweep.*boolean",
        "expected": "parameter definition",
        "found": result2["stdout"] if result2["success"] else "Not found",
        "success": result2["success"]
    })
    
    all_success = all(t["success"] for t in tests)
    
    return {
        "test": "releaseAddress pendingSweep Parameter",
        "success": all_success,
        "details": tests,
        "expected": "pendingSweep parameter properly defined"
    }

def test_crypto_verification_pending_sweep() -> Dict[str, Any]:
    """TEST 5: FIX 3 — cryptoVerification passes pendingSweep flag"""
    print("🔍 TEST 5: Testing cryptoVerification pendingSweep flag...")
    
    tests = []
    
    # Check for pendingSweep flag computation
    result1 = run_command("grep 'pendingSweep.*autoConvertEnabled' /app/backend/controller/paymentController.ts")
    tests.append({
        "pattern": "pendingSweep.*autoConvertEnabled",
        "expected": "flag computation",
        "found": result1["stdout"] if result1["success"] else "Not found",
        "success": result1["success"]
    })
    
    # Check for pendingSweep passed to releaseAddress
    result2 = run_command("grep 'pendingSweep' /app/backend/controller/paymentController.ts")
    tests.append({
        "pattern": "pendingSweep in paymentController",
        "expected": "passed to releaseAddress",
        "found": result2["stdout"] if result2["success"] else "Not found",
        "success": result2["success"]
    })
    
    all_success = all(t["success"] for t in tests)
    
    return {
        "test": "cryptoVerification pendingSweep Flag",
        "success": all_success,
        "details": tests,
        "expected": "pendingSweep flag computed and passed"
    }

def test_sweep_by_time_utxo_recovery() -> Dict[str, Any]:
    """TEST 6: FIX 4 — sweepByTime allows UTXO recovery"""
    print("🔍 TEST 6: Testing sweepByTime UTXO recovery...")
    
    tests = []
    
    # Check for isUTXOAutoConvertRecovery
    result1 = run_command("grep 'isUTXOAutoConvertRecovery' /app/backend/services/merchantPool/merchantPoolSweep.ts")
    tests.append({
        "pattern": "isUTXOAutoConvertRecovery",
        "expected": "recovery check", 
        "found": result1["stdout"] if result1["success"] else "Not found",
        "success": result1["success"]
    })
    
    # Check for UTXO_CHAINS import and usage
    result2 = run_command("grep 'UTXO_CHAINS' /app/backend/services/merchantPool/merchantPoolSweep.ts")
    tests.append({
        "pattern": "UTXO_CHAINS",
        "expected": "imported and used in time sweep",
        "found": result2["stdout"] if result2["success"] else "Not found",
        "success": result2["success"]
    })
    
    all_success = all(t["success"] for t in tests)
    
    return {
        "test": "sweepByTime UTXO Recovery",
        "success": all_success,
        "details": tests,
        "expected": "UTXO recovery logic in sweep"
    }

def test_utxo_tatum_api_patterns() -> Dict[str, Any]:
    """TEST 7: UTXO direct transfer uses correct Tatum API patterns"""
    print("🔍 TEST 7: Testing UTXO Tatum API patterns...")
    
    tests = []
    
    # Check for fromUTXO references
    result1 = run_command("grep 'fromUTXO' /app/backend/controller/paymentController.ts")
    tests.append({
        "pattern": "fromUTXO",
        "expected": "UTXO input references in BOTH auto-convert and normal settlement blocks",
        "found": result1["stdout"] if result1["success"] else "Not found",
        "success": result1["success"]
    })
    
    # Check for toUTXO references  
    result2 = run_command("grep 'toUTXO' /app/backend/controller/paymentController.ts")
    tests.append({
        "pattern": "toUTXO",
        "expected": "output references",
        "found": result2["stdout"] if result2["success"] else "Not found",
        "success": result2["success"]
    })
    
    # Check for findUtxoOutputIndex
    result3 = run_command("grep 'findUtxoOutputIndex' /app/backend/controller/paymentController.ts")
    tests.append({
        "pattern": "findUtxoOutputIndex",
        "expected": "UTXO index lookup in both blocks",
        "found": result3["stdout"] if result3["success"] else "Not found",
        "success": result3["success"]
    })
    
    all_success = all(t["success"] for t in tests)
    
    return {
        "test": "UTXO Tatum API Patterns",
        "success": all_success,
        "details": tests,
        "expected": "Correct UTXO API usage patterns"
    }

def test_immediate_sweep_account_based_only() -> Dict[str, Any]:
    """TEST 8: Immediate sweep only triggers for account-based chains now"""
    print("🔍 TEST 8: Testing immediate sweep account-based chain logic...")
    
    tests = []
    
    # Check for adminTransferResult.transactionDetails near autoConvertEnabled
    result1 = run_command("grep 'adminTransferResult.transactionDetails' /app/backend/controller/paymentController.ts")
    tests.append({
        "pattern": "adminTransferResult.transactionDetails",
        "expected": "check near autoConvertEnabled sweep trigger",
        "found": result1["stdout"] if result1["success"] else "Not found",
        "success": result1["success"]
    })
    
    # Look for the specific condition pattern
    result2 = run_command("grep -A 5 -B 5 'autoConvertEnabled.*adminTransferResult.transactionDetails' /app/backend/controller/paymentController.ts")
    condition_found = "!adminTransferResult.transactionDetails" in result2["stdout"]
    tests.append({
        "pattern": "autoConvertEnabled && !adminTransferResult.transactionDetails",
        "expected": "sweep trigger condition (not just autoConvertEnabled)",
        "found": "Condition pattern found" if condition_found else "Pattern not found",
        "success": condition_found
    })
    
    all_success = all(t["success"] for t in tests)
    
    return {
        "test": "Immediate Sweep Account-Based Only", 
        "success": all_success,
        "details": tests,
        "expected": "Sweep only triggers for account-based chains"
    }

def main():
    """Run all UTXO Auto-Convert Stranding Bug fix tests"""
    print("🚀 STARTING UTXO AUTO-CONVERT STRANDING BUG FIX TESTING")
    print("=" * 70)
    
    tests = [
        test_backend_health,
        test_typescript_compilation,
        test_utxo_auto_convert_patterns,
        test_release_address_pending_sweep,
        test_crypto_verification_pending_sweep,
        test_sweep_by_time_utxo_recovery,
        test_utxo_tatum_api_patterns,
        test_immediate_sweep_account_based_only
    ]
    
    results = []
    passed = 0
    total = len(tests)
    
    for test_func in tests:
        try:
            result = test_func()
            results.append(result)
            if result["success"]:
                passed += 1
                print(f"✅ {result['test']}: PASSED")
            else:
                print(f"❌ {result['test']}: FAILED")
                if "details" in result:
                    for detail in result["details"]:
                        status = "✅" if detail["success"] else "❌"
                        print(f"    {status} {detail['pattern']}: {detail['found']}")
                elif "error" in result:
                    print(f"    Error: {result['error']}")
            print()
        except Exception as e:
            print(f"❌ {test_func.__name__}: ERROR - {e}")
            results.append({
                "test": test_func.__name__,
                "success": False,
                "error": str(e)
            })
    
    print("=" * 70)
    print(f"🎯 UTXO AUTO-CONVERT STRANDING BUG FIX TEST SUMMARY")
    print(f"   Passed: {passed}/{total} tests")
    print(f"   Success Rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Fix implementation verified!")
    else:
        print("⚠️  Some tests failed - Fix needs attention")
    
    return results

if __name__ == "__main__":
    main()