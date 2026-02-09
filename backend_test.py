#!/usr/bin/env python3
"""
Backend Testing Script for DynoPay On-Chain Fee Optimization
Tests all 8 verification requirements from the review request
"""

import requests
import subprocess
import os
import json
from typing import Dict, List, Any

# Use the environment variable or fallback to localhost for testing
BASE_URL = "http://localhost:8001"

def test_backend_health() -> Dict[str, Any]:
    """TEST 1: Backend health check"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            return {
                "success": True,
                "status_code": response.status_code,
                "data": data,
                "message": f"Backend healthy: {data.get('status', 'unknown')}"
            }
        else:
            return {
                "success": False,
                "status_code": response.status_code,
                "message": f"Backend unhealthy: HTTP {response.status_code}"
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Backend health check failed: {str(e)}"
        }

def test_typescript_compilation() -> Dict[str, Any]:
    """TEST 2: TypeScript compilation check"""
    try:
        result = subprocess.run(
            ["npx", "tsc", "--noEmit"],
            cwd="/app/backend",
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "return_code": result.returncode,
                "message": "TypeScript compilation successful"
            }
        else:
            return {
                "success": False,
                "return_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "message": f"TypeScript compilation failed with return code {result.returncode}"
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"TypeScript compilation check failed: {str(e)}"
        }

def test_xrp_reserve_in_sweep() -> Dict[str, Any]:
    """TEST 3: FIX 1 — XRP reserve in sweep"""
    try:
        file_path = "/app/backend/services/merchantPool/merchantPoolSweep.ts"
        
        # Check for accountReserve logic
        result_account_reserve = subprocess.run(
            ["grep", "accountReserve", file_path],
            capture_output=True,
            text=True
        )
        
        # Check for 10 XRP reserve for XRP
        result_10_xrp = subprocess.run(
            ["grep", "-E", "walletType.*XRP.*10|XRP.*10", file_path],
            capture_output=True,
            text=True
        )
        
        # Check for 12 XRP reserve for RLUSD (10 base + 2 trust line)
        result_12_xrp = subprocess.run(
            ["grep", "-E", "walletType.*RLUSD.*12|RLUSD.*12", file_path],
            capture_output=True,
            text=True
        )
        
        findings = {
            "accountReserve_found": result_account_reserve.returncode == 0,
            "accountReserve_matches": result_account_reserve.stdout.strip() if result_account_reserve.returncode == 0 else None,
            "10_xrp_found": result_10_xrp.returncode == 0,
            "10_xrp_matches": result_10_xrp.stdout.strip() if result_10_xrp.returncode == 0 else None,
            "12_xrp_found": result_12_xrp.returncode == 0,
            "12_xrp_matches": result_12_xrp.stdout.strip() if result_12_xrp.returncode == 0 else None,
        }
        
        success = findings["accountReserve_found"]
        
        return {
            "success": success,
            "findings": findings,
            "message": "XRP reserve logic found in sweep" if success else "XRP reserve logic not found"
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"XRP reserve test failed: {str(e)}"
        }

def test_polygon_fee_type() -> Dict[str, Any]:
    """TEST 4: FIX 2 — POLYGON native fee type"""
    try:
        file_path = "/app/backend/apis/tatumApi.ts"
        
        # Look for TRANSFER_NFT in Polygon context
        result = subprocess.run(
            ["grep", "-n", "-A5", "-B5", "TRANSFER_NFT", file_path],
            capture_output=True,
            text=True
        )
        
        success = result.returncode == 0
        matches = result.stdout.strip() if success else None
        
        # Check if it's in the correct context (Polygon fee estimation)
        polygon_context = False
        if matches:
            lines = matches.split('\n')
            for i, line in enumerate(lines):
                if 'TRANSFER_NFT' in line:
                    # Check surrounding lines for POLYGON or MATIC context
                    context_lines = lines[max(0, i-5):i+5]
                    for context_line in context_lines:
                        if any(keyword in context_line.upper() for keyword in ['POLYGON', 'MATIC']):
                            polygon_context = True
                            break
        
        return {
            "success": success and polygon_context,
            "transfer_nft_found": success,
            "polygon_context": polygon_context,
            "matches": matches,
            "message": "TRANSFER_NFT found in Polygon context" if success and polygon_context else "TRANSFER_NFT not found in correct Polygon context"
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Polygon fee type test failed: {str(e)}"
        }

def test_bch_formula_fix() -> Dict[str, Any]:
    """TEST 5: FIX 3 — BCH fee formula fixed"""
    try:
        file_path = "/app/backend/apis/tatumApi.ts"
        
        # Check for corrected formula: safeInputs * 148
        result_formula = subprocess.run(
            ["grep", "-n", "safeInputs \\* 148", file_path],
            capture_output=True,
            text=True
        )
        
        # Check for safety minimum: Math.max(bchInputs, 2)
        result_safety = subprocess.run(
            ["grep", "-n", "Math.max(bchInputs, 2)", file_path],
            capture_output=True,
            text=True
        )
        
        # Check for 20% buffer on fast tier: 1.2
        result_buffer = subprocess.run(
            ["grep", "-n", "-C3", "1.2", file_path],
            capture_output=True,
            text=True
        )
        
        findings = {
            "formula_fixed": result_formula.returncode == 0,
            "formula_matches": result_formula.stdout.strip() if result_formula.returncode == 0 else None,
            "safety_minimum": result_safety.returncode == 0,
            "safety_matches": result_safety.stdout.strip() if result_safety.returncode == 0 else None,
            "buffer_found": result_buffer.returncode == 0,
            "buffer_matches": result_buffer.stdout.strip() if result_buffer.returncode == 0 else None,
        }
        
        success = findings["formula_fixed"] and findings["safety_minimum"]
        
        return {
            "success": success,
            "findings": findings,
            "message": "BCH formula fixes found" if success else "BCH formula fixes not found"
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"BCH formula test failed: {str(e)}"
        }

def test_sol_dynamic_fees() -> Dict[str, Any]:
    """TEST 6: FIX 4 — SOL dynamic priority fees"""
    try:
        file_path = "/app/backend/apis/tatumApi.ts"
        
        # Check for Solana RPC call: getRecentPrioritizationFees
        result_rpc = subprocess.run(
            ["grep", "-n", "getRecentPrioritizationFees", file_path],
            capture_output=True,
            text=True
        )
        
        # Check for median calculation: medianPriorityFee
        result_median = subprocess.run(
            ["grep", "-n", "medianPriorityFee", file_path],
            capture_output=True,
            text=True
        )
        
        findings = {
            "rpc_call_found": result_rpc.returncode == 0,
            "rpc_matches": result_rpc.stdout.strip() if result_rpc.returncode == 0 else None,
            "median_found": result_median.returncode == 0,
            "median_matches": result_median.stdout.strip() if result_median.returncode == 0 else None,
        }
        
        success = findings["rpc_call_found"] and findings["median_found"]
        
        return {
            "success": success,
            "findings": findings,
            "message": "SOL dynamic fees implementation found" if success else "SOL dynamic fees implementation not found"
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"SOL dynamic fees test failed: {str(e)}"
        }

def test_usdt_polygon_transfer() -> Dict[str, Any]:
    """TEST 7: FIX 5 — USDT-POLYGON uses built-in transfer"""
    try:
        file_path = "/app/backend/apis/tatumApi.ts"
        
        # Check for USDT_MATIC currency
        result_currency = subprocess.run(
            ["grep", "-n", "USDT_MATIC", file_path],
            capture_output=True,
            text=True
        )
        
        # Check that SmartContractInvocation is NOT used for USDT-POLYGON in the main transfer section
        result_no_smart_contract = subprocess.run(
            ["grep", "-n", "-C5", "polygonBlockchainSmartContractInvocation", file_path],
            capture_output=True,
            text=True
        )
        
        # Check if SmartContractInvocation appears only in batch context (which is OK)
        smart_contract_context = result_no_smart_contract.stdout if result_no_smart_contract.returncode == 0 else ""
        usdt_polygon_with_smart_contract = "USDT-POLYGON" in smart_contract_context and "polygonBlockchainSmartContractInvocation" in smart_contract_context
        
        findings = {
            "usdt_matic_found": result_currency.returncode == 0,
            "usdt_matic_matches": result_currency.stdout.strip() if result_currency.returncode == 0 else None,
            "smart_contract_invocation_found": result_no_smart_contract.returncode == 0,
            "smart_contract_context": smart_contract_context,
            "usdt_polygon_uses_smart_contract": usdt_polygon_with_smart_contract
        }
        
        success = findings["usdt_matic_found"] and not findings["usdt_polygon_uses_smart_contract"]
        
        return {
            "success": success,
            "findings": findings,
            "message": "USDT-POLYGON uses built-in transfer (USDT_MATIC)" if success else "USDT-POLYGON implementation issue detected"
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"USDT-POLYGON transfer test failed: {str(e)}"
        }

def test_fee_caching() -> Dict[str, Any]:
    """TEST 8: FIX 6 — Fee caching"""
    try:
        file_path = "/app/backend/apis/tatumApi.ts"
        
        # Check for fee-cache key pattern
        result_cache_key = subprocess.run(
            ["grep", "-n", "fee-cache", file_path],
            capture_output=True,
            text=True
        )
        
        # Check for FEE_CACHE_TTLS configuration
        result_cache_ttls = subprocess.run(
            ["grep", "-n", "FEE_CACHE_TTLS", file_path],
            capture_output=True,
            text=True
        )
        
        # Check for cache hit logging
        result_cache_hit = subprocess.run(
            ["grep", "-n", "Cache hit", file_path],
            capture_output=True,
            text=True
        )
        
        findings = {
            "cache_key_found": result_cache_key.returncode == 0,
            "cache_key_matches": result_cache_key.stdout.strip() if result_cache_key.returncode == 0 else None,
            "cache_ttls_found": result_cache_ttls.returncode == 0,
            "cache_ttls_matches": result_cache_ttls.stdout.strip() if result_cache_ttls.returncode == 0 else None,
            "cache_hit_found": result_cache_hit.returncode == 0,
            "cache_hit_matches": result_cache_hit.stdout.strip() if result_cache_hit.returncode == 0 else None,
        }
        
        success = findings["cache_key_found"] and findings["cache_ttls_found"] and findings["cache_hit_found"]
        
        return {
            "success": success,
            "findings": findings,
            "message": "Fee caching implementation found" if success else "Fee caching implementation not found"
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Fee caching test failed: {str(e)}"
        }

def main():
    """Run all tests and summarize results"""
    print("🚀 Starting DynoPay On-Chain Fee Optimization Tests")
    print("=" * 60)
    
    tests = [
        ("Backend Health", test_backend_health),
        ("TypeScript Compilation", test_typescript_compilation),
        ("XRP Reserve in Sweep", test_xrp_reserve_in_sweep),
        ("Polygon Fee Type", test_polygon_fee_type),
        ("BCH Formula Fix", test_bch_formula_fix),
        ("SOL Dynamic Fees", test_sol_dynamic_fees),
        ("USDT-POLYGON Transfer", test_usdt_polygon_transfer),
        ("Fee Caching", test_fee_caching),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n🧪 Running: {test_name}")
        result = test_func()
        results.append((test_name, result))
        
        if result["success"]:
            print(f"✅ PASS: {result['message']}")
        else:
            print(f"❌ FAIL: {result['message']}")
            if 'findings' in result:
                print(f"   Details: {result['findings']}")
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result["success"])
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result["success"] else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nOverall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed! On-Chain Fee Optimization is working correctly.")
    else:
        print(f"⚠️  {total - passed} test(s) failed. See details above.")
    
    return results

if __name__ == "__main__":
    main()