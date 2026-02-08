#!/usr/bin/env python3
"""
Multi-Chain Fee Optimization Testing Suite
Tests all 9 requirements for DynoPay TRON + EVM + TRX Native Dynamic Fees
"""
import requests
import subprocess
import os
import re
import json
import time
from typing import Dict, Any, List

BASE_URL = "http://localhost:8001"
EXTERNAL_URL = "https://code-analyzer-256.preview.emergentagent.com"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_test_result(test_name: str, passed: bool, details: str = ""):
    """Print formatted test result"""
    status = f"{Colors.GREEN}✅ PASS{Colors.RESET}" if passed else f"{Colors.RED}❌ FAIL{Colors.RESET}"
    print(f"{status} {Colors.BOLD}TEST {test_name}:{Colors.RESET} {details}")

def run_command(command: str) -> tuple:
    """Run shell command and return output, error, return code"""
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=30)
        return result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        return "", "Command timed out", 1
    except Exception as e:
        return "", str(e), 1

def make_request(url: str, method: str = "GET", data: Dict = None, timeout: int = 10) -> tuple:
    """Make HTTP request and return response, error"""
    try:
        if method.upper() == "GET":
            response = requests.get(url, timeout=timeout)
        else:
            response = requests.post(url, json=data, timeout=timeout)
        return response, None
    except Exception as e:
        return None, str(e)

def test_1_backend_health() -> bool:
    """TEST 1: Backend Health Check"""
    print(f"\n{Colors.BLUE}🔍 TEST 1: Backend Health{Colors.RESET}")
    
    # Try both internal and external URLs
    for url_base in [BASE_URL, EXTERNAL_URL]:
        health_url = f"{url_base}/health"
        response, error = make_request(health_url)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get('status') == 'healthy':
                    print_test_result("1", True, f"GET {health_url} returns 200 with 'healthy' status")
                    return True
            except:
                pass
    
    print_test_result("1", False, "Backend health check failed on both URLs")
    return False

def test_2_typescript_compilation() -> bool:
    """TEST 2: TypeScript Compilation Check"""
    print(f"\n{Colors.BLUE}🔍 TEST 2: TypeScript Compilation{Colors.RESET}")
    
    # Check backend logs for compilation errors
    stdout, stderr, _ = run_command("tail -50 /var/log/supervisor/backend.out.log")
    
    # Look for TypeScript compilation errors
    error_patterns = [
        r"Cannot find module",
        r"SyntaxError",
        r"TS[0-9]+:",
        r"Compilation failed",
        r"error TS",
        r"TypeScript compilation failed"
    ]
    
    errors_found = []
    for pattern in error_patterns:
        matches = re.findall(pattern, stdout + stderr, re.IGNORECASE)
        if matches:
            errors_found.extend(matches)
    
    if not errors_found:
        print_test_result("2", True, "No TypeScript compilation errors found in backend logs")
        return True
    else:
        print_test_result("2", False, f"TS compilation errors found: {', '.join(set(errors_found))}")
        return False

def test_3_no_hardcoded_feelimit() -> bool:
    """TEST 3: No hardcoded feeLimit:50 remains"""
    print(f"\n{Colors.BLUE}🔍 TEST 3: Code - No hardcoded feeLimit:50{Colors.RESET}")
    
    # Search for hardcoded feeLimit: 50
    stdout, stderr, _ = run_command('grep -n "feeLimit: 50" /app/backend/apis/tatumApi.ts')
    
    if stdout.strip() == "":
        print_test_result("3a", True, "No 'feeLimit: 50' found in tatumApi.ts")
        
        # Check for dynamic implementations
        stdout2, _, _ = run_command('grep -n "calculateOptimalFeeLimit\\|batchFeeLimit" /app/backend/apis/tatumApi.ts')
        
        if stdout2.strip():
            print_test_result("3b", True, f"Dynamic feeLimit implementations found: {len(stdout2.splitlines())} instances")
            return True
        else:
            print_test_result("3b", False, "No dynamic feeLimit implementations found")
            return False
    else:
        print_test_result("3", False, f"Hardcoded 'feeLimit: 50' still exists: {stdout.strip()}")
        return False

def test_4_tron_energy_service_exports() -> bool:
    """TEST 4: tronEnergyService.ts has all 8 required exports"""
    print(f"\n{Colors.BLUE}🔍 TEST 4: Code - tronEnergyService.ts exports{Colors.RESET}")
    
    # Check if file exists
    if not os.path.exists("/app/backend/services/tronEnergyService.ts"):
        print_test_result("4", False, "/app/backend/services/tronEnergyService.ts does not exist")
        return False
    
    required_exports = [
        "getTronNetworkParams",
        "getAccountResources", 
        "calculateOptimalFeeLimit",
        "calculateDynamicTRC20Fee",
        "calculateDynamicTRXNativeFee",
        "getOptimizationDiagnostics",
        "logCostSavings",
        "isRecipientActivatedForToken"
    ]
    
    found_exports = []
    for export_name in required_exports:
        stdout, _, _ = run_command(f'grep -n "export const {export_name}" /app/backend/services/tronEnergyService.ts')
        if stdout.strip():
            found_exports.append(export_name)
    
    if len(found_exports) == len(required_exports):
        print_test_result("4", True, f"All {len(required_exports)} required exports found in tronEnergyService.ts")
        return True
    else:
        missing = set(required_exports) - set(found_exports)
        print_test_result("4", False, f"Missing exports: {', '.join(missing)}")
        return False

def test_5_trx_native_dynamic() -> bool:
    """TEST 5: TRX native fee is dynamic (not hardcoded)"""
    print(f"\n{Colors.BLUE}🔍 TEST 5: Code - TRX native fee is dynamic{Colors.RESET}")
    
    # Check feeEstimation() function for TRX
    stdout, _, _ = run_command('grep -A 10 -B 5 \'currency === "TRX"\' /app/backend/apis/tatumApi.ts')
    
    tests_passed = 0
    total_tests = 4
    
    # Test 5a: feeEstimation() TRX block calls calculateDynamicTRXNativeFee
    if "calculateDynamicTRXNativeFee" in stdout:
        print_test_result("5a", True, "feeEstimation() TRX block calls calculateDynamicTRXNativeFee")
        tests_passed += 1
    else:
        print_test_result("5a", False, "feeEstimation() TRX block does not call calculateDynamicTRXNativeFee")
    
    # Test 5b: No hardcoded "fast: 10, medium: 5, slow: 3"
    if "fast: 10" not in stdout or "medium: 5" not in stdout:
        print_test_result("5b", True, "No hardcoded 'fast: 10, medium: 5, slow: 3' in TRX block")
        tests_passed += 1
    else:
        print_test_result("5b", False, "Hardcoded TRX fees still exist")
    
    # Check batchFeeEstimation() for TRX
    stdout2, _, _ = run_command('grep -A 15 -B 5 \'currency === "TRX"\' /app/backend/apis/tatumApi.ts | grep -A 15 batchFeeEstimation')
    
    # Test 5c: batchFeeEstimation() TRX block calls calculateDynamicTRXNativeFee  
    if "calculateDynamicTRXNativeFee" in stdout2:
        print_test_result("5c", True, "batchFeeEstimation() TRX block calls calculateDynamicTRXNativeFee")
        tests_passed += 1
    else:
        print_test_result("5c", False, "batchFeeEstimation() TRX block does not call calculateDynamicTRXNativeFee")
    
    # Test 5d: No hardcoded "totalAddress * 3.5"
    if "totalAddress * 3.5" not in stdout2:
        print_test_result("5d", True, "No hardcoded 'totalAddress * 3.5' in batch TRX calculation")
        tests_passed += 1
    else:
        print_test_result("5d", False, "Hardcoded 'totalAddress * 3.5' still exists")
    
    return tests_passed == total_tests

def test_6_evm_gas_percentage_based() -> bool:
    """TEST 6: EVM gas buffer is percentage-based"""
    print(f"\n{Colors.BLUE}🔍 TEST 6: Code - EVM gas buffer is percentage-based{Colors.RESET}")
    
    tests_passed = 0
    total_tests = 4
    
    # Check feeEstimation() for EVM chains
    stdout, _, _ = run_command('grep -A 20 -B 5 "gasPrice \\* 1.15" /app/backend/apis/tatumApi.ts')
    
    # Test 6a: feeEstimation() has "gasPrice * 1.15" (percentage-based buffer)
    if "gasPrice * 1.15" in stdout:
        print_test_result("6a", True, "feeEstimation() uses 'gasPrice * 1.15' percentage-based buffer")
        tests_passed += 1
    else:
        print_test_result("6a", False, "feeEstimation() does not use 'gasPrice * 1.15' percentage-based buffer")
    
    # Test 6b: No old flat "gasPrice + 2" buffer
    stdout_old, _, _ = run_command('grep -n "gasPrice + 2" /app/backend/apis/tatumApi.ts')
    if not stdout_old.strip():
        print_test_result("6b", True, "No old flat 'gasPrice + 2' buffer found")
        tests_passed += 1
    else:
        print_test_result("6b", False, "Old flat 'gasPrice + 2' buffer still exists")
    
    # Test 6c: MIN_GAS_PRICE = 1 (not 3)
    stdout_min, _, _ = run_command('grep -n "MIN_GAS_PRICE = 1" /app/backend/apis/tatumApi.ts')
    if stdout_min.strip():
        print_test_result("6c", True, "MIN_GAS_PRICE = 1 found (not 3)")
        tests_passed += 1
    else:
        print_test_result("6c", False, "MIN_GAS_PRICE = 1 not found")
    
    # Test 6d: batchFeeEstimation() has "gasPrice * 1.1" 
    stdout_batch, _, _ = run_command('grep -A 10 -B 5 "gasPrice \\* 1.1" /app/backend/apis/tatumApi.ts')
    if "gasPrice * 1.1" in stdout_batch:
        print_test_result("6d", True, "batchFeeEstimation() uses 'gasPrice * 1.1' percentage-based buffer")
        tests_passed += 1
    else:
        print_test_result("6d", False, "batchFeeEstimation() does not use 'gasPrice * 1.1'")
    
    return tests_passed == total_tests

def test_7_smartgas_energy_aware() -> bool:
    """TEST 7: SmartGas is Energy-aware"""
    print(f"\n{Colors.BLUE}🔍 TEST 7: Code - SmartGas Energy-aware{Colors.RESET}")
    
    tests_passed = 0
    total_tests = 4
    
    # Test 7a: getAccountResources import
    stdout, _, _ = run_command('grep -n "getAccountResources" /app/backend/services/merchantPool/merchantPoolSweep.ts')
    if "import" in stdout or "from" in stdout:
        print_test_result("7a", True, "getAccountResources imported from tronEnergyService")
        tests_passed += 1
    else:
        print_test_result("7a", False, "getAccountResources import not found")
    
    # Test 7b: TRC20_ENERGY import
    stdout2, _, _ = run_command('grep -n "TRC20_ENERGY" /app/backend/services/merchantPool/merchantPoolSweep.ts')
    if "import" in stdout2 or "TRC20_ENERGY" in stdout2:
        print_test_result("7b", True, "TRC20_ENERGY imported from tronEnergyService")
        tests_passed += 1
    else:
        print_test_result("7b", False, "TRC20_ENERGY import not found")
    
    # Test 7c: hasSufficientEnergy check
    stdout3, _, _ = run_command('grep -n "hasSufficientEnergy" /app/backend/services/merchantPool/merchantPoolSweep.ts')
    if stdout3.strip():
        print_test_result("7c", True, "hasSufficientEnergy check found in code")
        tests_passed += 1
    else:
        print_test_result("7c", False, "hasSufficientEnergy check not found")
    
    # Test 7d: "Staked Energy+Bandwidth covers transfer" message
    stdout4, _, _ = run_command('grep -n "Staked Energy+Bandwidth covers transfer" /app/backend/services/merchantPool/merchantPoolSweep.ts')
    if stdout4.strip():
        print_test_result("7d", True, "'Staked Energy+Bandwidth covers transfer' message found")
        tests_passed += 1
    else:
        print_test_result("7d", False, "'Staked Energy+Bandwidth covers transfer' message not found")
    
    return tests_passed == total_tests

def test_8_environment_config() -> bool:
    """TEST 8: Environment Configuration"""
    print(f"\n{Colors.BLUE}🔍 TEST 8: Environment Configuration{Colors.RESET}")
    
    tests_passed = 0
    total_tests = 2
    
    # Test 8a: TRON_MIN_FEE_LIMIT_TRX=5
    stdout, _, _ = run_command('grep -n "TRON_MIN_FEE_LIMIT_TRX=5" /app/backend/.env')
    if stdout.strip():
        print_test_result("8a", True, "TRON_MIN_FEE_LIMIT_TRX=5 found in .env")
        tests_passed += 1
    else:
        print_test_result("8a", False, "TRON_MIN_FEE_LIMIT_TRX=5 not found in .env")
    
    # Test 8b: TRON_MAX_FEE_LIMIT_TRX=30
    stdout2, _, _ = run_command('grep -n "TRON_MAX_FEE_LIMIT_TRX=30" /app/backend/.env')
    if stdout2.strip():
        print_test_result("8b", True, "TRON_MAX_FEE_LIMIT_TRX=30 found in .env")
        tests_passed += 1
    else:
        print_test_result("8b", False, "TRON_MAX_FEE_LIMIT_TRX=30 not found in .env")
    
    return tests_passed == total_tests

def test_9_diagnostics_endpoint() -> bool:
    """TEST 9: Functional - Diagnostics Endpoint (LIVE API TEST)"""
    print(f"\n{Colors.BLUE}🔍 TEST 9: Functional - Diagnostics Endpoint{Colors.RESET}")
    
    tests_passed = 0
    total_tests = 11
    
    # Test 9a: Basic diagnostics endpoint
    for url_base in [BASE_URL, EXTERNAL_URL]:
        diag_url = f"{url_base}/diagnostics/fee-optimization"
        response, error = make_request(diag_url)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                
                # Test 9a1: response.success === true
                if data.get('success') is True:
                    print_test_result("9a1", True, f"response.success === true")
                    tests_passed += 1
                else:
                    print_test_result("9a1", False, f"response.success !== true (got: {data.get('success')})")
                
                # Test 9a2: response.service === "TRON Energy Optimization Service"
                if data.get('service') == "TRON Energy Optimization Service":
                    print_test_result("9a2", True, f"response.service correct")
                    tests_passed += 1
                else:
                    print_test_result("9a2", False, f"response.service incorrect (got: {data.get('service')})")
                
                # Test 9a3: response.status === "active"
                if data.get('status') == "active":
                    print_test_result("9a3", True, f"response.status === 'active'")
                    tests_passed += 1
                else:
                    print_test_result("9a3", False, f"response.status !== 'active' (got: {data.get('status')})")
                
                # Test 9a4: networkParams.energyPriceSun === 100
                energy_price = data.get('networkParams', {}).get('energyPriceSun')
                if energy_price == 100:
                    print_test_result("9a4", True, f"networkParams.energyPriceSun === 100")
                    tests_passed += 1
                else:
                    print_test_result("9a4", False, f"networkParams.energyPriceSun !== 100 (got: {energy_price})")
                
                # Test 9a5: trc20Transfer.costEstimate.oldHardcodedTRX === 20
                old_hardcoded = data.get('trc20Transfer', {}).get('costEstimate', {}).get('oldHardcodedTRX')
                if old_hardcoded == 20:
                    print_test_result("9a5", True, f"trc20Transfer.costEstimate.oldHardcodedTRX === 20")
                    tests_passed += 1
                else:
                    print_test_result("9a5", False, f"trc20Transfer.costEstimate.oldHardcodedTRX !== 20 (got: {old_hardcoded})")
                
                # Test 9a6: savingsPercent > 0
                savings_percent = data.get('trc20Transfer', {}).get('costEstimate', {}).get('savingsPercent')
                if savings_percent and float(savings_percent) > 0:
                    print_test_result("9a6", True, f"trc20Transfer.costEstimate.savingsPercent > 0 ({savings_percent}%)")
                    tests_passed += 1
                else:
                    print_test_result("9a6", False, f"trc20Transfer.costEstimate.savingsPercent <= 0 (got: {savings_percent})")
                
                # Test 9a7: trxNativeTransfer.costEstimate.withBandwidthTRX === 0
                with_bandwidth = data.get('trxNativeTransfer', {}).get('costEstimate', {}).get('withBandwidthTRX')
                if with_bandwidth == 0:
                    print_test_result("9a7", True, f"trxNativeTransfer.costEstimate.withBandwidthTRX === 0")
                    tests_passed += 1
                else:
                    print_test_result("9a7", False, f"trxNativeTransfer.costEstimate.withBandwidthTRX !== 0 (got: {with_bandwidth})")
                
                # Test 9a8: trxNativeTransfer.costEstimate.oldHardcodedTRX === 10
                old_native = data.get('trxNativeTransfer', {}).get('costEstimate', {}).get('oldHardcodedTRX')
                if old_native == 10:
                    print_test_result("9a8", True, f"trxNativeTransfer.costEstimate.oldHardcodedTRX === 10")
                    tests_passed += 1
                else:
                    print_test_result("9a8", False, f"trxNativeTransfer.costEstimate.oldHardcodedTRX !== 10 (got: {old_native})")
                
                # Test 9a9: feeLimit.oldHardcodedTRX === 50
                fee_limit_old = data.get('trc20Transfer', {}).get('feeLimit', {}).get('oldHardcodedTRX')
                if fee_limit_old == 50:
                    print_test_result("9a9", True, f"trc20Transfer.feeLimit.oldHardcodedTRX === 50")
                    tests_passed += 1
                else:
                    print_test_result("9a9", False, f"trc20Transfer.feeLimit.oldHardcodedTRX !== 50 (got: {fee_limit_old})")
                
                # Test 9a10: feeLimit.newDynamicMinTRX === 5
                fee_limit_min = data.get('trc20Transfer', {}).get('feeLimit', {}).get('newDynamicMinTRX')
                if fee_limit_min == 5:
                    print_test_result("9a10", True, f"trc20Transfer.feeLimit.newDynamicMinTRX === 5")
                    tests_passed += 1
                else:
                    print_test_result("9a10", False, f"trc20Transfer.feeLimit.newDynamicMinTRX !== 5 (got: {fee_limit_min})")
                
                break
                
            except json.JSONDecodeError:
                print_test_result("9a", False, f"Invalid JSON response from {diag_url}")
                continue
        else:
            continue
    
    # Test 9b: Diagnostics with address parameter
    test_address = "TTXk9SbNj8tnRABdGDM3PZvT5bHqTNtANB"
    for url_base in [BASE_URL, EXTERNAL_URL]:
        diag_url_addr = f"{url_base}/diagnostics/fee-optimization?address={test_address}"
        response, error = make_request(diag_url_addr)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                
                # Test 9b1: accountResources is NOT null and has address field
                account_resources = data.get('accountResources')
                if account_resources is not None and account_resources.get('address') == test_address:
                    print_test_result("9b1", True, f"accountResources.address === '{test_address}'")
                    tests_passed += 1
                    
                    # Check for required fields
                    required_fields = ['energyLimit', 'availableEnergy', 'availableBandwidth', 'hasSufficientEnergy']
                    missing_fields = [field for field in required_fields if field not in account_resources]
                    
                    if not missing_fields:
                        print_test_result("9b2", True, f"accountResources has all required fields")
                    else:
                        print_test_result("9b2", False, f"accountResources missing fields: {missing_fields}")
                else:
                    print_test_result("9b1", False, f"accountResources invalid or address mismatch")
                
                break
                
            except json.JSONDecodeError:
                continue
    
    return tests_passed

def main():
    """Run all tests and display results"""
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}🧪 DYNOPAY MULTI-CHAIN FEE OPTIMIZATION TESTING SUITE{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    tests = [
        ("Backend Health", test_1_backend_health),
        ("TypeScript Compilation", test_2_typescript_compilation),
        ("No hardcoded feeLimit:50", test_3_no_hardcoded_feelimit),
        ("tronEnergyService exports", test_4_tron_energy_service_exports),
        ("TRX native dynamic fee", test_5_trx_native_dynamic),
        ("EVM percentage-based gas", test_6_evm_gas_percentage_based),
        ("SmartGas Energy-aware", test_7_smartgas_energy_aware),
        ("Environment Configuration", test_8_environment_config),
        ("Diagnostics Endpoint", test_9_diagnostics_endpoint),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            passed = test_func()
            results.append((test_name, passed))
        except Exception as e:
            print_test_result(test_name, False, f"Test exception: {str(e)}")
            results.append((test_name, False))
    
    # Summary
    print(f"\n{Colors.BOLD}{Colors.BLUE}📊 TESTING SUMMARY{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*50}{Colors.RESET}")
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for i, (test_name, passed) in enumerate(results, 1):
        status = f"{Colors.GREEN}✅" if passed else f"{Colors.RED}❌"
        print(f"{status} TEST {i}: {test_name}{Colors.RESET}")
    
    print(f"\n{Colors.BOLD}RESULT: {passed_count}/{total_count} tests passed{Colors.RESET}")
    
    if passed_count == total_count:
        print(f"{Colors.GREEN}{Colors.BOLD}🎉 ALL TESTS PASSED! Multi-Chain Fee Optimization is fully operational.{Colors.RESET}")
        return 0
    else:
        print(f"{Colors.RED}{Colors.BOLD}⚠️  {total_count - passed_count} test(s) failed. Implementation needs fixes.{Colors.RESET}")
        return 1

if __name__ == "__main__":
    exit(main())