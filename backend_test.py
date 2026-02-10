#!/usr/bin/env python3
"""
RLUSD Trust Line Setup Fix Backend Test Suite
Tests the fallback implementation for Tatum SDK xrpTrustLineBlockchain failures
"""

import requests
import subprocess
import sys
import os
import json

# Base URL configuration
BASE_URL = "http://localhost:8001"

def run_test(test_name, test_func):
    """Run a single test and return result"""
    print(f"\n{'='*60}")
    print(f"TEST {test_name}")
    print('='*60)
    try:
        result = test_func()
        if result:
            print(f"✅ PASS: {test_name}")
            return True
        else:
            print(f"❌ FAIL: {test_name}")
            return False
    except Exception as e:
        print(f"❌ ERROR: {test_name} - {str(e)}")
        return False

def test_1_backend_healthy():
    """TEST 1: Backend healthy - GET /health returns 200 with status "healthy" """
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                print(f"Backend health check passed: {data}")
                return True
            else:
                print(f"Backend status not healthy: {data}")
                return False
        else:
            print(f"Health check failed: HTTP {response.status_code}")
            return False
    except requests.RequestException as e:
        print(f"Health check request failed: {e}")
        return False

def test_2_typescript_compiles():
    """TEST 2: TypeScript compiles clean - npx tsc --noEmit should exit 0"""
    try:
        os.chdir("/app/backend")
        result = subprocess.run(
            ["npx", "tsc", "--noEmit"], 
            capture_output=True, 
            text=True, 
            timeout=60
        )
        
        if result.returncode == 0:
            print("TypeScript compilation successful - no errors detected")
            return True
        else:
            print(f"TypeScript compilation failed with exit code {result.returncode}")
            print(f"STDOUT: {result.stdout}")
            print(f"STDERR: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        print("TypeScript compilation timed out")
        return False
    except Exception as e:
        print(f"TypeScript compilation error: {e}")
        return False

def test_3_dual_strategy_code():
    """TEST 3: Code - setupXrpTrustLine has dual strategy"""
    file_path = "/app/backend/apis/tatumApi.ts"
    
    tests = [
        ("xrpTrustLineBlockchain", "Tatum SDK attempt"),
        ("Tatum RPC.*local signing", "Fallback comment"),
        ("tatumXrpRpc.*submit", "RPC submit call"),
        ("XrplWallet.fromSecret", "Local signing")
    ]
    
    all_passed = True
    for pattern, description in tests:
        result = subprocess.run(
            ["grep", pattern, file_path],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print(f"✅ Found {description}: {result.stdout.strip()}")
        else:
            print(f"❌ Missing {description} (pattern: {pattern})")
            all_passed = False
    
    return all_passed

def test_4_tatumXrpRpc_helper():
    """TEST 4: Code - tatumXrpRpc helper exists"""
    file_path = "/app/backend/apis/tatumApi.ts"
    
    tests = [
        ("const tatumXrpRpc", "tatumXrpRpc function"),
        ("ripple-mainnet", "RPC chain name")
    ]
    
    all_passed = True
    for pattern, description in tests:
        result = subprocess.run(
            ["grep", pattern, file_path],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print(f"✅ Found {description}: {result.stdout.strip()}")
        else:
            print(f"❌ Missing {description} (pattern: {pattern})")
            all_passed = False
    
    return all_passed

def test_5_verify_account_fallback():
    """TEST 5: Code - verifyXrpAccountActivated has fallback"""
    file_path = "/app/backend/apis/tatumApi.ts"
    
    # Check for the function and both SDK and RPC paths
    result = subprocess.run(
        ["grep", "-A5", "verifyXrpAccountActivated", file_path],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        output = result.stdout
        if "account_info" in output:
            print("✅ Found verifyXrpAccountActivated with SDK and RPC fallback paths")
            print("Key lines found:")
            for line in output.split('\n')[:10]:  # Show first 10 lines
                if line.strip():
                    print(f"  {line}")
            return True
        else:
            print("❌ verifyXrpAccountActivated found but missing account_info RPC fallback")
            return False
    else:
        print("❌ verifyXrpAccountActivated function not found")
        return False

def test_6_verify_trustline_fallback():
    """TEST 6: Code - verifyXrpTrustLine has fallback"""
    file_path = "/app/backend/apis/tatumApi.ts"
    
    result = subprocess.run(
        ["grep", "account_lines", file_path],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print("✅ Found account_lines RPC fallback for trust line verification")
        print(f"Found: {result.stdout.strip()}")
        return True
    else:
        print("❌ Missing account_lines RPC fallback")
        return False

def test_7_xrpl_import():
    """TEST 7: Code - xrpl import"""
    file_path = "/app/backend/apis/tatumApi.ts"
    
    result = subprocess.run(
        ["grep", "import.*XrplWallet.*from.*xrpl", file_path],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print("✅ Found xrpl import")
        print(f"Import statement: {result.stdout.strip()}")
        return True
    else:
        print("❌ Missing xrpl import")
        return False

def test_8_tatum_rpc_gateway():
    """TEST 8: Functional - Tatum RPC gateway working"""
    try:
        os.chdir("/app/backend")
        
        # Node.js test script to verify RPC connectivity
        test_script = '''
require('dotenv').config();
const axios = require('axios');
axios.post('https://api.tatum.io/v3/blockchain/node/ripple-mainnet', {
  method: 'server_info',
  params: [{}]
}, {
  headers: {
    'x-api-key': process.env.TATUM_KEY,
    'Content-Type': 'application/json'
  }
}).then(r => {
  console.log('RPC status:', r.status);
  console.log('server_state:', r.data?.result?.info?.server_state);
  process.exit(0);
}).catch(e => {
  console.log('RPC error:', e.response?.status || e.message);
  process.exit(1);
});
        '''
        
        result = subprocess.run(
            ["node", "-e", test_script],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print("✅ Tatum RPC gateway connectivity test passed")
            print(f"Output: {result.stdout.strip()}")
            return True
        else:
            print("❌ Tatum RPC gateway test failed")
            print(f"STDOUT: {result.stdout}")
            print(f"STDERR: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ Tatum RPC gateway test timed out")
        return False
    except Exception as e:
        print(f"❌ Tatum RPC gateway test error: {e}")
        return False

def main():
    """Run all RLUSD Trust Line Setup tests"""
    print("🔧 RLUSD Trust Line Setup Fix - Backend Test Suite")
    print("Testing Tatum SDK fallback with RPC gateway + local signing")
    print("="*80)
    
    # List of all tests
    tests = [
        ("1", test_1_backend_healthy),
        ("2", test_2_typescript_compiles),
        ("3", test_3_dual_strategy_code),
        ("4", test_4_tatumXrpRpc_helper),
        ("5", test_5_verify_account_fallback),
        ("6", test_6_verify_trustline_fallback),
        ("7", test_7_xrpl_import),
        ("8", test_8_tatum_rpc_gateway)
    ]
    
    # Run all tests
    results = []
    for test_num, test_func in tests:
        passed = run_test(test_num, test_func)
        results.append((test_num, passed))
    
    # Summary
    print(f"\n{'='*80}")
    print("TEST SUMMARY")
    print('='*80)
    
    passed_count = 0
    for test_num, passed in results:
        status = "PASS" if passed else "FAIL"
        print(f"TEST {test_num}: {status}")
        if passed:
            passed_count += 1
    
    print(f"\nOVERALL RESULT: {passed_count}/{len(tests)} tests passed")
    
    if passed_count == len(tests):
        print("🎉 All RLUSD Trust Line Setup tests PASSED!")
        return 0
    else:
        print(f"⚠️  {len(tests) - passed_count} test(s) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())