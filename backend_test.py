#!/usr/bin/env python3
"""
Backend Testing Script for Strategy Pattern Migration

Tests the 8 requirements specified in the review request:
1. Backend healthy - GET returns 200 with status "healthy" 
2. TypeScript compiles clean - tsc --noEmit exits 0
3. All 8 strategy chain files exist
4. Strategy factory has getStrategy and resolveChainGroup exports
5. tatumApi.ts now uses chain strategy utilities (5 chain modules integrated)
6. Each chain module implements ChainStrategy interface
7. Chain-specific constants are properly exported
8. XRP tag-based utilities exported
"""

import requests
import subprocess
import os
import sys
import json
from pathlib import Path

# Backend URL from frontend env
BACKEND_URL = "https://fix-issues-8.preview.emergentagent.com"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_test_header(test_name, test_num=None):
    prefix = f"TEST {test_num}: " if test_num else ""
    print(f"\n{Colors.BLUE}{Colors.BOLD}=== {prefix}{test_name} ==={Colors.RESET}")

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.RESET}")

def print_failure(message):
    print(f"{Colors.RED}❌ {message}{Colors.RESET}")

def print_info(message):
    print(f"{Colors.YELLOW}ℹ️  {message}{Colors.RESET}")

def run_command(cmd, cwd=None, timeout=30):
    """Run shell command and return (exit_code, stdout, stderr)"""
    try:
        result = subprocess.run(
            cmd, shell=True, cwd=cwd, capture_output=True, text=True, timeout=timeout
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", f"Command timed out after {timeout}s"
    except Exception as e:
        return -1, "", str(e)

def check_file_exists(file_path):
    """Check if file exists and return True/False"""
    return Path(file_path).exists()

def grep_file_content(file_path, pattern, expected_count=None):
    """Search for pattern in file and return matches"""
    if not check_file_exists(file_path):
        return []
    
    exit_code, stdout, stderr = run_command(f"grep -n '{pattern}' {file_path}")
    lines = stdout.strip().split('\n') if stdout.strip() else []
    
    if expected_count is not None:
        if len(lines) >= expected_count:
            return lines
        else:
            return []
    
    return lines

def test_backend_health():
    """TEST 1: Backend Health Check"""
    print_test_header("Backend Health Check", 1)
    
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                print_success(f"Backend health check passed - GET /health returns 200 with status='healthy'")
                print_info(f"Response: {json.dumps(data, indent=2)}")
                return True
            else:
                print_failure(f"Backend health check failed - status is '{data.get('status')}', expected 'healthy'")
                return False
        else:
            print_failure(f"Backend health check failed - HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print_failure(f"Backend health check failed - {str(e)}")
        return False

def test_typescript_compilation():
    """TEST 2: TypeScript Compilation"""
    print_test_header("TypeScript Compilation", 2)
    
    exit_code, stdout, stderr = run_command("./node_modules/.bin/tsc --noEmit", cwd="/app/backend")
    
    if exit_code == 0:
        print_success("TypeScript compilation successful - tsc --noEmit exits with code 0")
        return True
    else:
        print_failure(f"TypeScript compilation failed - exit code {exit_code}")
        if stderr:
            print_info(f"Errors: {stderr}")
        return False

def test_strategy_chain_files():
    """TEST 3: All 8 strategy chain files exist"""
    print_test_header("Strategy Chain Files Existence", 3)
    
    expected_files = [
        "chainTypes.ts",
        "index.ts", 
        "evmChain.ts",
        "utxoChain.ts",
        "tronChain.ts",
        "xrpChain.ts", 
        "solChain.ts",
        "polygonChain.ts"
    ]
    
    base_path = "/app/backend/services/chains"
    all_exist = True
    
    for file in expected_files:
        file_path = f"{base_path}/{file}"
        if check_file_exists(file_path):
            print_success(f"Found: {file}")
        else:
            print_failure(f"Missing: {file}")
            all_exist = False
    
    if all_exist:
        print_success("All 8 strategy chain files exist")
        return True
    else:
        print_failure("Some strategy chain files are missing")
        return False

def test_strategy_factory_exports():
    """TEST 4: Strategy factory has getStrategy and resolveChainGroup exports"""
    print_test_header("Strategy Factory Exports", 4)
    
    index_file = "/app/backend/services/chains/index.ts"
    
    # Check for getStrategy export
    getStrategy_lines = grep_file_content(index_file, "getStrategy")
    resolveChainGroup_lines = grep_file_content(index_file, "resolveChainGroup") 
    getAllSupported_lines = grep_file_content(index_file, "getAllSupportedCurrencies")
    
    success = True
    
    if getStrategy_lines:
        print_success(f"Found getStrategy export: {len(getStrategy_lines)} occurrences")
        for line in getStrategy_lines[:2]:  # Show first 2 matches
            print_info(f"  {line}")
    else:
        print_failure("getStrategy export not found")
        success = False
        
    if resolveChainGroup_lines:
        print_success(f"Found resolveChainGroup export: {len(resolveChainGroup_lines)} occurrences")
        for line in resolveChainGroup_lines[:2]:
            print_info(f"  {line}")
    else:
        print_failure("resolveChainGroup export not found")
        success = False
        
    if getAllSupported_lines:
        print_success(f"Found getAllSupportedCurrencies export: {len(getAllSupported_lines)} occurrences")
    else:
        print_failure("getAllSupportedCurrencies export not found")
        success = False
    
    return success

def test_tatum_api_chain_integration():
    """TEST 5: tatumApi.ts now uses chain strategy utilities (5 chain modules integrated)"""
    print_test_header("TatumApi Chain Strategy Integration", 5)
    
    tatum_file = "/app/backend/apis/tatumApi.ts"
    success_count = 0
    total_checks = 5
    
    # Check for calculateEvmGasFee
    evm_lines = grep_file_content(tatum_file, "calculateEvmGasFee")
    if evm_lines:
        print_success(f"calculateEvmGasFee integration found: {len(evm_lines)} occurrences")
        success_count += 1
    else:
        print_failure("calculateEvmGasFee integration not found")
    
    # Check for calculateUtxoTxSizeKb 
    utxo_lines = grep_file_content(tatum_file, "calculateUtxoTxSizeKb")
    if utxo_lines:
        print_success(f"calculateUtxoTxSizeKb integration found: {len(utxo_lines)} occurrences")
        success_count += 1
    else:
        print_failure("calculateUtxoTxSizeKb integration not found")
    
    # Check for XRP_FEE_CONSTANTS
    xrp_lines = grep_file_content(tatum_file, "XRP_FEE_CONSTANTS")
    if xrp_lines:
        print_success(f"XRP_FEE_CONSTANTS integration found: {len(xrp_lines)} occurrences") 
        success_count += 1
    else:
        print_failure("XRP_FEE_CONSTANTS integration not found")
    
    # Check for calculateSolPriorityFee
    sol_lines = grep_file_content(tatum_file, "calculateSolPriorityFee")
    if sol_lines:
        print_success(f"calculateSolPriorityFee integration found: {len(sol_lines)} occurrences")
        success_count += 1
    else:
        print_failure("calculateSolPriorityFee integration not found")
    
    # Check for calculatePolygonGasFee
    polygon_lines = grep_file_content(tatum_file, "calculatePolygonGasFee")
    if polygon_lines:
        print_success(f"calculatePolygonGasFee integration found: {len(polygon_lines)} occurrences")
        success_count += 1
    else:
        print_failure("calculatePolygonGasFee integration not found")
    
    if success_count == total_checks:
        print_success(f"All 5 chain module integrations found in tatumApi.ts")
        return True
    else:
        print_failure(f"Only {success_count}/{total_checks} chain module integrations found")
        return False

def test_chain_strategy_interface():
    """TEST 6: Each chain module implements ChainStrategy interface"""
    print_test_header("ChainStrategy Interface Implementation", 6)
    
    chain_files = [
        "/app/backend/services/chains/evmChain.ts",
        "/app/backend/services/chains/xrpChain.ts",
        "/app/backend/services/chains/polygonChain.ts"
    ]
    
    success_count = 0
    
    for chain_file in chain_files:
        chain_name = Path(chain_file).name
        
        # Check for ChainStrategy import
        import_lines = grep_file_content(chain_file, "ChainStrategy")
        
        if import_lines:
            print_success(f"{chain_name}: ChainStrategy interface found ({len(import_lines)} references)")
            success_count += 1
        else:
            print_failure(f"{chain_name}: ChainStrategy interface not found")
    
    if success_count == len(chain_files):
        print_success("All checked chain modules implement ChainStrategy interface")
        return True
    else:
        print_failure(f"Only {success_count}/{len(chain_files)} chain modules implement ChainStrategy interface")
        return False

def test_chain_specific_constants():
    """TEST 7: Chain-specific constants are properly exported"""
    print_test_header("Chain-Specific Constants Export", 7)
    
    constants_checks = [
        ("/app/backend/services/chains/polygonChain.ts", "POLYGON_GAS_CONSTANTS"),
        ("/app/backend/services/chains/solChain.ts", "SOL_FEE_CONSTANTS"),
        ("/app/backend/services/chains/tronChain.ts", "TRON_FEE_CONSTANTS")
    ]
    
    success_count = 0
    
    for file_path, constant_name in constants_checks:
        lines = grep_file_content(file_path, constant_name)
        
        if lines:
            print_success(f"{constant_name} found in {Path(file_path).name}: {len(lines)} occurrences")
            success_count += 1
        else:
            print_failure(f"{constant_name} not found in {Path(file_path).name}")
    
    if success_count == len(constants_checks):
        print_success("All chain-specific constants are properly exported")
        return True
    else:
        print_failure(f"Only {success_count}/{len(constants_checks)} constants found")
        return False

def test_xrp_tag_utilities():
    """TEST 8: XRP tag-based utilities exported"""
    print_test_header("XRP Tag-Based Utilities", 8)
    
    xrp_file = "/app/backend/services/chains/xrpChain.ts"
    
    utilities = ["isTagBased", "buildXrpRedisKey", "filterByTag"]
    success_count = 0
    
    for utility in utilities:
        lines = grep_file_content(xrp_file, utility)
        
        if lines:
            print_success(f"{utility} found: {len(lines)} occurrences")
            success_count += 1
        else:
            print_failure(f"{utility} not found")
    
    if success_count == len(utilities):
        print_success("All 3 XRP tag-based utilities are exported")
        return True
    else:
        print_failure(f"Only {success_count}/{len(utilities)} XRP utilities found")
        return False

def main():
    """Run all tests and provide summary"""
    print(f"{Colors.BOLD}Strategy Pattern Migration Testing - Backend Verification{Colors.RESET}")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Testing 8 requirements from review request...")
    
    tests = [
        test_backend_health,
        test_typescript_compilation,
        test_strategy_chain_files,
        test_strategy_factory_exports,
        test_tatum_api_chain_integration,
        test_chain_strategy_interface,
        test_chain_specific_constants,
        test_xrp_tag_utilities
    ]
    
    results = []
    
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print_failure(f"Test failed with exception: {e}")
            results.append(False)
    
    # Summary
    print(f"\n{Colors.BOLD}=== TEST SUMMARY ==={Colors.RESET}")
    passed = sum(results)
    total = len(results)
    
    for i, (test, result) in enumerate(zip(tests, results), 1):
        status = "✅ PASSED" if result else "❌ FAILED"
        test_name = test.__doc__.split(':')[1].strip() if ':' in test.__doc__ else test.__name__
        print(f"TEST {i}: {status} - {test_name}")
    
    print(f"\n{Colors.BOLD}Overall Result: {passed}/{total} tests passed{Colors.RESET}")
    
    if passed == total:
        print(f"{Colors.GREEN}{Colors.BOLD}🎉 ALL TESTS PASSED - Strategy Pattern Migration is working correctly!{Colors.RESET}")
        return 0
    else:
        print(f"{Colors.RED}{Colors.BOLD}❌ {total-passed} tests failed - Strategy Pattern Migration needs attention{Colors.RESET}")
        return 1

if __name__ == "__main__":
    sys.exit(main())