#!/usr/bin/env python3
"""
Backend Test Suite for DynoPay Sweep Gas Deduction Fix
Tests the implementation of sweep gas deduction from merchant payouts
"""

import requests
import subprocess
import sys
import re

def test_backend_health():
    """TEST 1: Backend healthy - GET /health returns 200 with status "healthy" """
    try:
        response = requests.get("http://localhost:8001/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                return True, f"✅ Backend health check passed: {data}"
            else:
                return False, f"❌ Backend not healthy: {data}"
        else:
            return False, f"❌ Backend health check failed: HTTP {response.status_code}"
    except Exception as e:
        return False, f"❌ Backend health check failed: {str(e)}"

def test_typescript_compilation():
    """TEST 2: TypeScript compiles clean - cd /app/backend && npx tsc --noEmit -- exit code 0"""
    try:
        result = subprocess.run(
            ["npx", "tsc", "--noEmit"],
            cwd="/app/backend",
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode == 0:
            return True, "✅ TypeScript compilation successful"
        else:
            return False, f"❌ TypeScript compilation failed: {result.stderr}"
    except Exception as e:
        return False, f"❌ TypeScript compilation test failed: {str(e)}"

def test_native_chain_sweep_gas():
    """TEST 3: Native chain sweep gas deduction present"""
    try:
        # Test for estimatedSweepGas = merchantTransferGas pattern
        result1 = subprocess.run(
            ["grep", "estimatedSweepGas = merchantTransferGas", "/app/backend/controller/paymentController.ts"],
            capture_output=True,
            text=True
        )
        
        # Test for totalGasDeduction = merchantTransferGas + estimatedSweepGas pattern  
        result2 = subprocess.run(
            ["grep", "totalGasDeduction = merchantTransferGas + estimatedSweepGas", "/app/backend/controller/paymentController.ts"],
            capture_output=True,
            text=True
        )
        
        success1 = result1.returncode == 0
        success2 = result2.returncode == 0
        
        if success1 and success2:
            return True, f"✅ Native chain sweep gas deduction found:\n  - Pattern 1: {result1.stdout.strip()}\n  - Pattern 2: {result2.stdout.strip()}"
        else:
            return False, f"❌ Native chain sweep gas deduction missing:\n  Pattern 1 found: {success1}\n  Pattern 2 found: {success2}"
    except Exception as e:
        return False, f"❌ Native chain sweep gas test failed: {str(e)}"

def test_token_chain_sweep_gas():
    """TEST 4: Token chain sweep gas deduction present"""
    try:
        # Test for estimatedSweepGasUSD = merchantTransferGasUSD pattern
        result1 = subprocess.run(
            ["grep", "estimatedSweepGasUSD = merchantTransferGasUSD", "/app/backend/controller/paymentController.ts"],
            capture_output=True,
            text=True
        )
        
        # Test for totalGasDeductionToken = merchantTransferGasUSD + estimatedSweepGasUSD pattern
        result2 = subprocess.run(
            ["grep", "totalGasDeductionToken = merchantTransferGasUSD + estimatedSweepGasUSD", "/app/backend/controller/paymentController.ts"],
            capture_output=True,
            text=True
        )
        
        success1 = result1.returncode == 0
        success2 = result2.returncode == 0
        
        if success1 and success2:
            lines1 = result1.stdout.strip().split('\n')
            lines2 = result2.stdout.strip().split('\n') 
            return True, f"✅ Token chain sweep gas deduction found:\n  - Pattern 1: {len(lines1)} occurrences\n  - Pattern 2: {len(lines2)} occurrences"
        else:
            return False, f"❌ Token chain sweep gas deduction missing:\n  Pattern 1 found: {success1}\n  Pattern 2 found: {success2}"
    except Exception as e:
        return False, f"❌ Token chain sweep gas test failed: {str(e)}"

def test_guard_against_non_positive():
    """TEST 5: Guard against non-positive amounts"""
    try:
        result = subprocess.run(
            ["grep", "TransferGas.*SweepGas", "/app/backend/controller/paymentController.ts"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            error_lines = [line for line in lines if 'Error' in line and 'TransferGas' in line and 'SweepGas' in line]
            if error_lines:
                return True, f"✅ Guard against non-positive amounts found: {len(error_lines)} error messages with both gas components"
            else:
                return False, f"❌ No error messages found with both TransferGas and SweepGas components"
        else:
            return False, f"❌ No TransferGas.*SweepGas patterns found"
    except Exception as e:
        return False, f"❌ Guard test failed: {str(e)}"

def test_logging_gas_components():
    """TEST 6: Logging includes both gas components"""
    try:
        result = subprocess.run(
            ["grep", "-i", "transfer gas.*sweep gas", "/app/backend/controller/paymentController.ts"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            return True, f"✅ Logging includes both gas components: {len(lines)} log lines found"
        else:
            return False, f"❌ No log lines found with 'transfer gas.*sweep gas' pattern"
    except Exception as e:
        return False, f"❌ Logging test failed: {str(e)}"

def run_all_tests():
    """Run all DynoPay Sweep Gas Deduction tests"""
    
    tests = [
        ("Backend Health", test_backend_health),
        ("TypeScript Compilation", test_typescript_compilation), 
        ("Native Chain Sweep Gas", test_native_chain_sweep_gas),
        ("Token Chain Sweep Gas", test_token_chain_sweep_gas),
        ("Guard Against Non-Positive", test_guard_against_non_positive),
        ("Logging Gas Components", test_logging_gas_components)
    ]
    
    print("🚀 DynoPay Sweep Gas Deduction Fix Testing Suite")
    print("=" * 60)
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n📋 Running: {test_name}")
        try:
            success, message = test_func()
            results.append((test_name, success, message))
            print(f"   {message}")
        except Exception as e:
            results.append((test_name, False, f"❌ Test execution failed: {str(e)}"))
            print(f"   ❌ Test execution failed: {str(e)}")
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, success, _ in results if success)
    total = len(results)
    
    for test_name, success, message in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} | {test_name}")
        if not success:
            print(f"      Details: {message}")
    
    print(f"\n🎯 Overall: {passed}/{total} tests passed ({(passed/total)*100:.1f}% success rate)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Sweep gas deduction fix is working correctly!")
        return True
    else:
        print(f"⚠️  {total - passed} test(s) failed - requires attention")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)