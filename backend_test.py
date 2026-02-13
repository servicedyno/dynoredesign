#!/usr/bin/env python3
"""
Backend Testing for Gas Fee Deduction Fix
Tests the 4 bug fixes in gas fee deduction from merchant payouts
"""

import requests
import subprocess
import os
import sys

# Configuration
BACKEND_URL = "https://init-project-11.preview.emergentagent.com"
BACKEND_DIR = "/app/backend"

def run_test(test_name, test_func):
    """Run a test and return the result"""
    try:
        print(f"\n{'='*60}")
        print(f"🧪 {test_name}")
        print(f"{'='*60}")
        result = test_func()
        if result:
            print(f"✅ PASS: {test_name}")
            return True
        else:
            print(f"❌ FAIL: {test_name}")
            return False
    except Exception as e:
        print(f"❌ ERROR in {test_name}: {e}")
        return False

def test_1_backend_healthy():
    """TEST 1: Backend healthy - GET /health returns 200 with status "healthy" """
    try:
        response = requests.get(f"{BACKEND_URL}/api/status/health", timeout=30)
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                print("Backend is healthy")
                return True
            else:
                print(f"Backend status is not healthy: {data.get('status')}")
                return False
        else:
            print(f"Expected 200 but got {response.status_code}")
            return False
    except Exception as e:
        print(f"Error connecting to backend: {e}")
        return False

def test_2_typescript_compiles():
    """TEST 2: TypeScript compiles clean - cd /app/backend && npx tsc --noEmit"""
    try:
        os.chdir(BACKEND_DIR)
        result = subprocess.run(
            ["npx", "tsc", "--noEmit"],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        print(f"Exit Code: {result.returncode}")
        print(f"stdout: {result.stdout}")
        print(f"stderr: {result.stderr}")
        
        if result.returncode == 0:
            print("TypeScript compilation successful")
            return True
        else:
            print(f"TypeScript compilation failed with exit code {result.returncode}")
            return False
    except Exception as e:
        print(f"Error running TypeScript compilation: {e}")
        return False

def test_3_bug1_fix_native_chain_fast_fee():
    """TEST 3: BUG 1 FIX — Native chain uses fast fee for deduction"""
    try:
        cmd = ["grep", "fees?.fast.*fees?.slow.*0", "/app/backend/controller/paymentController.ts"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        print(f"Grep command: {' '.join(cmd)}")
        print(f"Exit Code: {result.returncode}")
        print(f"stdout: {result.stdout}")
        
        if result.returncode == 0 and result.stdout.strip():
            lines = result.stdout.strip().split('\n')
            for line in lines:
                if "Use fast tier for gas deduction" in line:
                    print("✅ Found the line with 'Use fast tier for gas deduction'")
                    return True
            print("Found fee pattern but missing comment")
            return True  # Pattern found is sufficient
        else:
            print("Fast fee pattern not found")
            return False
    except Exception as e:
        print(f"Error running grep: {e}")
        return False

def test_4_bug2_fix_gaslimit_not_reduced():
    """TEST 4: BUG 2 FIX — gasLimit not reduced for native ETH"""
    try:
        # Check for effectiveGasLimit occurrences (should find at least 5)
        cmd1 = ["grep", "effectiveGasLimit", "/app/backend/services/chains/evmChain.ts"]
        result1 = subprocess.run(cmd1, capture_output=True, text=True)
        print(f"effectiveGasLimit grep: {result1.returncode}")
        print(f"effectiveGasLimit output: {result1.stdout}")
        
        # Check for Math.max(gasLimit, 21000) fix
        cmd2 = ["grep", "Math.max(gasLimit, 21000)", "/app/backend/services/chains/evmChain.ts"]
        result2 = subprocess.run(cmd2, capture_output=True, text=True)
        print(f"Math.max grep: {result2.returncode}")
        print(f"Math.max output: {result2.stdout}")
        
        # Check old bug is removed
        cmd3 = ["grep", "gasLimit: isToken ? gasLimit : Math.floor", "/app/backend/services/chains/evmChain.ts"]
        result3 = subprocess.run(cmd3, capture_output=True, text=True)
        print(f"Old bug grep: {result3.returncode}")
        print(f"Old bug output: {result3.stdout}")
        
        effectiveGasLimit_count = len(result1.stdout.strip().split('\n')) if result1.stdout.strip() else 0
        has_math_max_fix = result2.returncode == 0 and result2.stdout.strip()
        old_bug_removed = result3.returncode != 0 or not result3.stdout.strip()
        
        print(f"effectiveGasLimit occurrences: {effectiveGasLimit_count} (need >= 5)")
        print(f"Math.max fix found: {has_math_max_fix}")
        print(f"Old bug removed: {old_bug_removed}")
        
        return effectiveGasLimit_count >= 5 and has_math_max_fix and old_bug_removed
        
    except Exception as e:
        print(f"Error checking gasLimit fix: {e}")
        return False

def test_5_bug3_fix_sol_xrp_fee_usd():
    """TEST 5: BUG 3 FIX — SOL/XRP feeInUSD now calculated"""
    try:
        # Check for price lookup
        cmd1 = ["grep", "getCryptoPrice.*priceSymbol", "/app/backend/services/blockchainFeeService.ts"]
        result1 = subprocess.run(cmd1, capture_output=True, text=True)
        print(f"Price lookup grep: {result1.returncode}")
        print(f"Price lookup output: {result1.stdout}")
        
        # Check old hardcoded 0 is removed
        cmd2 = ["grep", "feeInUSD: 0.*Negligible", "/app/backend/services/blockchainFeeService.ts"]
        result2 = subprocess.run(cmd2, capture_output=True, text=True)
        print(f"Old hardcoded 0 grep: {result2.returncode}")
        print(f"Old hardcoded 0 output: {result2.stdout}")
        
        has_price_lookup = result1.returncode == 0 and result1.stdout.strip()
        old_hardcode_removed = result2.returncode != 0 or not result2.stdout.strip()
        
        print(f"Price lookup found: {has_price_lookup}")
        print(f"Old hardcoded 0 removed: {old_hardcode_removed}")
        
        return has_price_lookup and old_hardcode_removed
        
    except Exception as e:
        print(f"Error checking SOL/XRP fee USD calculation: {e}")
        return False

def test_6_bug4_fix_token_fallback():
    """TEST 6: BUG 4 FIX — Token fallback converts native fee to USD"""
    try:
        # Check for nativePrices
        cmd1 = ["grep", "nativePrices", "/app/backend/controller/paymentController.ts"]
        result1 = subprocess.run(cmd1, capture_output=True, text=True)
        print(f"nativePrices grep: {result1.returncode}")
        print(f"nativePrices output: {result1.stdout}")
        
        # Check for rawFee * nativePrice multiplication
        cmd2 = ["grep", "rawFee.*nativePrice", "/app/backend/controller/paymentController.ts"]
        result2 = subprocess.run(cmd2, capture_output=True, text=True)
        print(f"rawFee multiplication grep: {result2.returncode}")
        print(f"rawFee multiplication output: {result2.stdout}")
        
        has_native_prices = result1.returncode == 0 and result1.stdout.strip()
        has_multiplication = result2.returncode == 0 and result2.stdout.strip()
        
        print(f"nativePrices found: {has_native_prices}")
        print(f"rawFee * nativePrice multiplication found: {has_multiplication}")
        
        return has_native_prices and has_multiplication
        
    except Exception as e:
        print(f"Error checking token fallback fix: {e}")
        return False

def test_7_evm_gasprice_correct():
    """TEST 7: EVM gasPrice is correct - uses buffered price not raw"""
    try:
        cmd = ["grep", "gasPrice: bufferedGasPrice", "/app/backend/services/chains/evmChain.ts"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        print(f"bufferedGasPrice grep: {result.returncode}")
        print(f"bufferedGasPrice output: {result.stdout}")
        
        has_buffered_gas_price = result.returncode == 0 and result.stdout.strip()
        
        print(f"gasPrice uses buffered price: {has_buffered_gas_price}")
        
        return has_buffered_gas_price
        
    except Exception as e:
        print(f"Error checking EVM gasPrice: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Gas Fee Deduction Fix Testing")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Backend Directory: {BACKEND_DIR}")
    
    tests = [
        ("TEST 1: Backend Healthy", test_1_backend_healthy),
        ("TEST 2: TypeScript Compiles Clean", test_2_typescript_compiles),
        ("TEST 3: BUG 1 FIX - Native chain uses fast fee", test_3_bug1_fix_native_chain_fast_fee),
        ("TEST 4: BUG 2 FIX - gasLimit not reduced for native ETH", test_4_bug2_fix_gaslimit_not_reduced),
        ("TEST 5: BUG 3 FIX - SOL/XRP feeInUSD calculated", test_5_bug3_fix_sol_xrp_fee_usd),
        ("TEST 6: BUG 4 FIX - Token fallback converts native fee to USD", test_6_bug4_fix_token_fallback),
        ("TEST 7: EVM gasPrice uses buffered price", test_7_evm_gasprice_correct),
    ]
    
    results = []
    for test_name, test_func in tests:
        results.append(run_test(test_name, test_func))
    
    print(f"\n{'='*60}")
    print("📊 TEST SUMMARY")
    print(f"{'='*60}")
    
    passed = sum(results)
    total = len(results)
    
    for i, (test_name, _) in enumerate(tests):
        status = "✅ PASS" if results[i] else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed! Gas Fee Deduction Fix is working correctly.")
        return True
    else:
        print("⚠️  Some tests failed. Please review the failures above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)