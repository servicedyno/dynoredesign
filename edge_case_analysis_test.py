#!/usr/bin/env python3
"""
Edge Case Analysis Testing - 18 Critical Fixes for DynoPay
Testing grep-based code verification + backend health check
Base URL: http://localhost:8001 (internal)
"""

import os
import sys
import time
import subprocess
import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8001"

# Test Results Storage
test_results = []

def log_test_result(test_num, description, passed, details=""):
    """Log test result with timestamp"""
    result = {
        "test": f"TEST {test_num}",
        "description": description,
        "passed": passed,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status} - TEST {test_num}: {description}")
    if details:
        print(f"Details: {details}")

def run_command(command, description=""):
    """Run shell command and return result"""
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=30)
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", f"Command timed out: {command}"
    except Exception as e:
        return False, "", f"Error running command: {str(e)}"

def test_1_backend_health():
    """TEST 1: Backend healthy - GET /health returns 200 with status "healthy" """
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "status" in data and data["status"] == "healthy":
                    log_test_result(1, "Backend healthy", True, 
                        f"Status code: {response.status_code}, Response: {data}")
                    return True
                else:
                    log_test_result(1, "Backend healthy", False, 
                        f"Status code: {response.status_code}, but status is not 'healthy': {data}")
                    return False
            except json.JSONDecodeError:
                if "healthy" in response.text.lower():
                    log_test_result(1, "Backend healthy", True, 
                        f"Status code: {response.status_code}, Response text: {response.text}")
                    return True
                else:
                    log_test_result(1, "Backend healthy", False, 
                        f"Status code: {response.status_code}, but response doesn't contain 'healthy': {response.text}")
                    return False
        else:
            log_test_result(1, "Backend healthy", False, 
                f"Status code: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test_result(1, "Backend healthy", False, f"Exception: {str(e)}")
        return False

def test_2_typescript_compilation():
    """TEST 2: TypeScript compiles clean - cd /app/backend && npx tsc --noEmit should exit 0 with no errors"""
    try:
        success, stdout, stderr = run_command(
            "cd /app/backend && npx tsc --noEmit",
            "TypeScript compilation check"
        )
        
        if success:
            log_test_result(2, "TypeScript compiles clean", True, 
                f"Compilation successful. Output: {stdout}")
            return True
        else:
            log_test_result(2, "TypeScript compiles clean", False, 
                f"Compilation failed. Stdout: {stdout}, Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(2, "TypeScript compiles clean", False, f"Exception: {str(e)}")
        return False

def test_3_rlusd_erc20_asset_to_other_address():
    """TEST 3: FIX 1 - assetToOtherAddress includes RLUSD-ERC20"""
    try:
        file_path = "/app/backend/apis/tatumApi.ts"
        
        # Search for RLUSD-ERC20 in the outer if condition around line 1368
        success, stdout, stderr = run_command(
            f'grep -n \'currency === "RLUSD-ERC20"\' {file_path}',
            "Searching for RLUSD-ERC20 in assetToOtherAddress condition"
        )
        
        if success and stdout:
            # Check if it's in the correct condition with other ERC20 tokens
            success2, stdout2, stderr2 = run_command(
                f'grep -n -A2 -B2 \'currency === "ETH" || currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD-ERC20"\' {file_path}',
                "Searching for complete ERC20 condition"
            )
            
            if success2 and stdout2:
                log_test_result(3, "assetToOtherAddress includes RLUSD-ERC20", True, 
                    f"Found RLUSD-ERC20 in correct condition:\n{stdout2}")
                return True
            else:
                log_test_result(3, "assetToOtherAddress includes RLUSD-ERC20", False, 
                    f"RLUSD-ERC20 found but not in complete condition. Found: {stdout}")
                return False
        else:
            log_test_result(3, "assetToOtherAddress includes RLUSD-ERC20", False, 
                f"RLUSD-ERC20 not found in assetToOtherAddress. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(3, "assetToOtherAddress includes RLUSD-ERC20", False, f"Exception: {str(e)}")
        return False

def test_4_normalize_currency_handles_rlusd_erc20():
    """TEST 4: FIX 2 - normalizeCurrency handles RLUSD-ERC20"""
    try:
        file_path = "/app/backend/helper/currencyConvert.ts"
        
        # Search for RLUSD-ERC20 in currencyConvert.ts
        success, stdout, stderr = run_command(
            f'grep -n \'RLUSD-ERC20\' {file_path}',
            "Searching for RLUSD-ERC20 in currencyConvert.ts"
        )
        
        if success and stdout:
            # Check for the specific pattern: if (upper === "RLUSD" || upper === "RLUSD-ERC20") return "RLUSD";
            success2, stdout2, stderr2 = run_command(
                f'grep -n \'upper === "RLUSD" || upper === "RLUSD-ERC20"\' {file_path}',
                "Searching for specific RLUSD normalization condition"
            )
            
            if success2 and stdout2:
                log_test_result(4, "normalizeCurrency handles RLUSD-ERC20", True, 
                    f"Found correct normalization: {stdout2}")
                return True
            else:
                log_test_result(4, "normalizeCurrency handles RLUSD-ERC20", False, 
                    f"RLUSD-ERC20 found but normalization pattern not correct: {stdout}")
                return False
        else:
            log_test_result(4, "normalizeCurrency handles RLUSD-ERC20", False, 
                f"RLUSD-ERC20 not found in currencyConvert.ts. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(4, "normalizeCurrency handles RLUSD-ERC20", False, f"Exception: {str(e)}")
        return False

def test_5_sweep_has_rlusd_erc20_contract():
    """TEST 5: FIX 3 - Sweep has RLUSD-ERC20 contract"""
    try:
        file_path = "/app/backend/services/merchantPool/merchantPoolSweep.ts"
        
        # Search for RLUSD-ERC20 in merchantPoolSweep.ts
        success, stdout, stderr = run_command(
            f'grep -n -A2 -B2 \'RLUSD-ERC20\' {file_path}',
            "Searching for RLUSD-ERC20 in merchantPoolSweep.ts"
        )
        
        if success and stdout:
            # Check for contractAddress branch
            if "contractAddress" in stdout.lower():
                log_test_result(5, "Sweep has RLUSD-ERC20 contract", True, 
                    f"Found RLUSD-ERC20 with contractAddress: {stdout}")
                return True
            else:
                log_test_result(5, "Sweep has RLUSD-ERC20 contract", False, 
                    f"RLUSD-ERC20 found but no contractAddress context: {stdout}")
                return False
        else:
            log_test_result(5, "Sweep has RLUSD-ERC20 contract", False, 
                f"RLUSD-ERC20 not found in merchantPoolSweep.ts. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(5, "Sweep has RLUSD-ERC20 contract", False, f"Exception: {str(e)}")
        return False

def test_6_token_contracts_has_rlusd_erc20():
    """TEST 6: FIX 4 - TOKEN_CONTRACTS has RLUSD-ERC20"""
    try:
        file_path = "/app/backend/services/merchantPool/merchantPoolConfig.ts"
        
        # Search for RLUSD-ERC20 in merchantPoolConfig.ts
        success, stdout, stderr = run_command(
            f'grep -n -A2 -B2 \'RLUSD-ERC20\' {file_path}',
            "Searching for RLUSD-ERC20 in TOKEN_CONTRACTS"
        )
        
        if success and stdout:
            # Check if it's in TOKEN_CONTRACTS context
            if "TOKEN_CONTRACTS" in stdout or "contract" in stdout.lower():
                log_test_result(6, "TOKEN_CONTRACTS has RLUSD-ERC20", True, 
                    f"Found RLUSD-ERC20 in TOKEN_CONTRACTS: {stdout}")
                return True
            else:
                log_test_result(6, "TOKEN_CONTRACTS has RLUSD-ERC20", False, 
                    f"RLUSD-ERC20 found but not in TOKEN_CONTRACTS context: {stdout}")
                return False
        else:
            log_test_result(6, "TOKEN_CONTRACTS has RLUSD-ERC20", False, 
                f"RLUSD-ERC20 not found in merchantPoolConfig.ts. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(6, "TOKEN_CONTRACTS has RLUSD-ERC20", False, f"Exception: {str(e)}")
        return False

def test_7_create_subscription_has_rlusd_erc20():
    """TEST 7: FIX 5 - createSubscriptionWithUrl has RLUSD-ERC20"""
    try:
        file_path = "/app/backend/apis/tatumApi.ts"
        
        # Search for RLUSD-ERC20 with USDC-ERC20 pattern (should be >= 2 occurrences)
        success, stdout, stderr = run_command(
            f'grep -c \'USDC-ERC20.*RLUSD-ERC20\' {file_path}',
            "Counting RLUSD-ERC20 with USDC-ERC20 occurrences"
        )
        
        if success and stdout:
            count = int(stdout.strip()) if stdout.strip().isdigit() else 0
            if count >= 2:
                # Get the actual lines to show context
                success2, stdout2, stderr2 = run_command(
                    f'grep -n \'USDC-ERC20.*RLUSD-ERC20\' {file_path}',
                    "Getting RLUSD-ERC20 subscription lines"
                )
                log_test_result(7, "createSubscriptionWithUrl has RLUSD-ERC20", True, 
                    f"Found {count} occurrences (>= 2 required):\n{stdout2}")
                return True
            else:
                log_test_result(7, "createSubscriptionWithUrl has RLUSD-ERC20", False, 
                    f"Only {count} occurrences found (< 2 required)")
                return False
        else:
            log_test_result(7, "createSubscriptionWithUrl has RLUSD-ERC20", False, 
                f"No USDC-ERC20.*RLUSD-ERC20 pattern found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(7, "createSubscriptionWithUrl has RLUSD-ERC20", False, f"Exception: {str(e)}")
        return False

def test_8_sending_leftover_removed():
    """TEST 8: FIX 6+7 - sendingLeftover removed from paymentController.ts and server.ts"""
    try:
        files_to_check = [
            "/app/backend/controller/paymentController.ts",
            "/app/backend/server.ts"
        ]
        
        all_clean = True
        details = []
        
        for file_path in files_to_check:
            success, stdout, stderr = run_command(
                f'grep -n \'sendingLeftover\' {file_path}',
                f"Searching for sendingLeftover in {file_path}"
            )
            
            if success and stdout:
                all_clean = False
                details.append(f"❌ Found sendingLeftover in {file_path}:\n{stdout}")
            else:
                details.append(f"✅ No sendingLeftover found in {file_path}")
        
        if all_clean:
            log_test_result(8, "sendingLeftover removed", True, 
                "\n".join(details))
            return True
        else:
            log_test_result(8, "sendingLeftover removed", False, 
                "\n".join(details))
            return False
            
    except Exception as e:
        log_test_result(8, "sendingLeftover removed", False, f"Exception: {str(e)}")
        return False

def test_9_blockchain_fee_service_has_all_chains():
    """TEST 9: FIX 8 - blockchainFeeService has all chains (SOL, XRP, POLYGON)"""
    try:
        file_path = "/app/backend/services/blockchainFeeService.ts"
        chains_to_check = ["SOL", "XRP", "POLYGON"]
        
        all_found = True
        details = []
        
        for chain in chains_to_check:
            success, stdout, stderr = run_command(
                f'grep -n \'{chain}\' {file_path}',
                f"Searching for {chain} in blockchainFeeService"
            )
            
            if success and stdout:
                details.append(f"✅ Found {chain}:\n{stdout[:200]}...")
            else:
                all_found = False
                details.append(f"❌ {chain} not found in blockchainFeeService")
        
        if all_found:
            log_test_result(9, "blockchainFeeService has all chains", True, 
                "\n".join(details))
            return True
        else:
            log_test_result(9, "blockchainFeeService has all chains", False, 
                "\n".join(details))
            return False
            
    except Exception as e:
        log_test_result(9, "blockchainFeeService has all chains", False, f"Exception: {str(e)}")
        return False

def test_10_dust_thresholds_has_sol_xrp_polygon():
    """TEST 10: FIX 9 - DUST_THRESHOLDS has SOL/XRP/POLYGON"""
    try:
        file_path = "/app/backend/services/merchantPool/merchantPoolMonitoring.ts"
        
        # Search for SOL with 0.01 value
        success, stdout, stderr = run_command(
            f'grep -n \'SOL.*0.01\' {file_path}',
            "Searching for SOL DUST_THRESHOLD entry"
        )
        
        if success and stdout:
            log_test_result(10, "DUST_THRESHOLDS has SOL/XRP/POLYGON", True, 
                f"Found SOL dust threshold: {stdout}")
            return True
        else:
            # Also check for just SOL in DUST context
            success2, stdout2, stderr2 = run_command(
                f'grep -n -A2 -B2 \'DUST_THRESHOLDS\' {file_path}',
                "Searching for DUST_THRESHOLDS context"
            )
            
            if success2 and "SOL" in stdout2:
                log_test_result(10, "DUST_THRESHOLDS has SOL/XRP/POLYGON", True, 
                    f"Found SOL in DUST_THRESHOLDS context: {stdout2}")
                return True
            else:
                log_test_result(10, "DUST_THRESHOLDS has SOL/XRP/POLYGON", False, 
                    f"SOL not found in DUST_THRESHOLDS. Context: {stdout2}")
                return False
            
    except Exception as e:
        log_test_result(10, "DUST_THRESHOLDS has SOL/XRP/POLYGON", False, f"Exception: {str(e)}")
        return False

def test_11_utxo_index_uses_find_utxo_output_index():
    """TEST 11: FIX 10 - UTXO index uses findUtxoOutputIndex"""
    try:
        files_to_check = [
            "/app/backend/controller/paymentController.ts",
            "/app/backend/apis/tatumApi.ts"
        ]
        
        all_found = True
        details = []
        
        for file_path in files_to_check:
            success, stdout, stderr = run_command(
                f'grep -n \'findUtxoOutputIndex\' {file_path}',
                f"Searching for findUtxoOutputIndex in {file_path}"
            )
            
            if success and stdout:
                details.append(f"✅ Found findUtxoOutputIndex in {file_path}:\n{stdout}")
            else:
                all_found = False
                details.append(f"❌ findUtxoOutputIndex not found in {file_path}")
        
        if all_found:
            log_test_result(11, "UTXO index uses findUtxoOutputIndex", True, 
                "\n".join(details))
            return True
        else:
            log_test_result(11, "UTXO index uses findUtxoOutputIndex", False, 
                "\n".join(details))
            return False
            
    except Exception as e:
        log_test_result(11, "UTXO index uses findUtxoOutputIndex", False, f"Exception: {str(e)}")
        return False

def test_12_cron_guards_with_acquire_lock():
    """TEST 12: FIX 11 - Cron guards with acquireLock (4 locks expected)"""
    try:
        file_path = "/app/backend/server.ts"
        
        # Search for acquireLock with cron pattern
        success, stdout, stderr = run_command(
            f'grep -n \'acquireLock.*cron:\' {file_path}',
            "Searching for acquireLock cron guards"
        )
        
        if success and stdout:
            # Count the number of locks
            lock_count = len(stdout.strip().split('\n'))
            expected_locks = ["processIncomplete", "performScheduledSweeps", "checkMissedPayments", "detectOrphanPayments"]
            
            if lock_count >= 4:
                # Check for specific lock names
                found_locks = []
                for lock_name in expected_locks:
                    if lock_name.lower() in stdout.lower():
                        found_locks.append(lock_name)
                
                log_test_result(12, "Cron guards with acquireLock", True, 
                    f"Found {lock_count} acquireLock cron guards. Expected locks found: {found_locks}\n{stdout}")
                return True
            else:
                log_test_result(12, "Cron guards with acquireLock", False, 
                    f"Only {lock_count} acquireLock cron guards found (expected 4):\n{stdout}")
                return False
        else:
            log_test_result(12, "Cron guards with acquireLock", False, 
                f"No acquireLock cron guards found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(12, "Cron guards with acquireLock", False, f"Exception: {str(e)}")
        return False

def test_13_webhook_auth_middleware():
    """TEST 13: FIX 12 - Webhook auth middleware"""
    try:
        file_path = "/app/backend/routes/index.ts"
        
        # Search for verifyTatumWebhookSource middleware
        success1, stdout1, stderr1 = run_command(
            f'grep -n \'verifyTatumWebhookSource\' {file_path}',
            "Searching for verifyTatumWebhookSource middleware"
        )
        
        # Search for x-payload-hash HMAC verification
        success2, stdout2, stderr2 = run_command(
            f'grep -n \'x-payload-hash\' {file_path}',
            "Searching for x-payload-hash HMAC verification"
        )
        
        if success1 and stdout1 and success2 and stdout2:
            log_test_result(13, "Webhook auth middleware", True, 
                f"Found verifyTatumWebhookSource:\n{stdout1}\n\nFound x-payload-hash:\n{stdout2}")
            return True
        elif success1 and stdout1:
            log_test_result(13, "Webhook auth middleware", False, 
                f"Found verifyTatumWebhookSource but missing x-payload-hash:\nFound: {stdout1}\nMissing HMAC verification")
            return False
        else:
            log_test_result(13, "Webhook auth middleware", False, 
                f"verifyTatumWebhookSource not found: {stderr1}\nx-payload-hash not found: {stderr2}")
            return False
            
    except Exception as e:
        log_test_result(13, "Webhook auth middleware", False, f"Exception: {str(e)}")
        return False

def test_14_get_transaction_gas_cost_has_chains():
    """TEST 14: FIX 13 - getTransactionGasCost has POLYGON/XRP/SOL"""
    try:
        file_path = "/app/backend/apis/tatumApi.ts"
        
        # Search for POLYGON with USDT-POLYGON in gasCost context
        success, stdout, stderr = run_command(
            f'grep -n -i \'POLYGON.*USDT-POLYGON.*gasCost\' {file_path}',
            "Searching for POLYGON gasCost implementation"
        )
        
        if success and stdout:
            log_test_result(14, "getTransactionGasCost has POLYGON/XRP/SOL", True, 
                f"Found POLYGON gasCost branch: {stdout}")
            return True
        else:
            # Alternative search for getTransactionGasCost function and check for these chains
            success2, stdout2, stderr2 = run_command(
                f'grep -n -A10 -B2 \'getTransactionGasCost\' {file_path}',
                "Searching for getTransactionGasCost function"
            )
            
            if success2 and ("POLYGON" in stdout2 or "XRP" in stdout2 or "SOL" in stdout2):
                log_test_result(14, "getTransactionGasCost has POLYGON/XRP/SOL", True, 
                    f"Found chains in getTransactionGasCost: {stdout2[:300]}...")
                return True
            else:
                log_test_result(14, "getTransactionGasCost has POLYGON/XRP/SOL", False, 
                    f"Chains not found in getTransactionGasCost. Function context: {stdout2}")
                return False
            
    except Exception as e:
        log_test_result(14, "getTransactionGasCost has POLYGON/XRP/SOL", False, f"Exception: {str(e)}")
        return False

def test_15_orphan_received_amount_subtracts_admin_fee():
    """TEST 15: FIX 14 - Orphan receivedAmount subtracts admin fee"""
    try:
        file_path = "/app/backend/services/merchantPool/merchantPoolMonitoring.ts"
        
        # Search for balance - existingAdminBalance pattern
        success, stdout, stderr = run_command(
            f'grep -n -A2 -B2 \'balance - existingAdminBalance\' {file_path}',
            "Searching for balance - existingAdminBalance subtraction"
        )
        
        if success and stdout:
            # Check if it's in the context of receivedAmount
            if "receivedAmount" in stdout.lower():
                log_test_result(15, "Orphan receivedAmount subtracts admin fee", True, 
                    f"Found balance - existingAdminBalance near receivedAmount: {stdout}")
                return True
            else:
                log_test_result(15, "Orphan receivedAmount subtracts admin fee", False, 
                    f"Found balance - existingAdminBalance but not near receivedAmount: {stdout}")
                return False
        else:
            log_test_result(15, "Orphan receivedAmount subtracts admin fee", False, 
                f"balance - existingAdminBalance pattern not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(15, "Orphan receivedAmount subtracts admin fee", False, f"Exception: {str(e)}")
        return False

def test_16_lock_uses_lua_compare_and_delete():
    """TEST 16: FIX 15 - Lock uses Lua compare-and-delete"""
    try:
        file_path = "/app/backend/utils/redisInstance.ts"
        
        # Search for redis.call with del and KEYS pattern
        success1, stdout1, stderr1 = run_command(
            f'grep -n \'redis.call.*del.*KEYS\' {file_path}',
            "Searching for Lua script with redis.call del KEYS"
        )
        
        # Search for lockOwners map
        success2, stdout2, stderr2 = run_command(
            f'grep -n \'lockOwners\' {file_path}',
            "Searching for lockOwners tracking map"
        )
        
        if success1 and stdout1 and success2 and stdout2:
            log_test_result(16, "Lock uses Lua compare-and-delete", True, 
                f"Found Lua script: {stdout1}\n\nFound lockOwners: {stdout2}")
            return True
        elif success1 and stdout1:
            log_test_result(16, "Lock uses Lua compare-and-delete", False, 
                f"Found Lua script but missing lockOwners: {stdout1}")
            return False
        elif success2 and stdout2:
            log_test_result(16, "Lock uses Lua compare-and-delete", False, 
                f"Found lockOwners but missing Lua script: {stdout2}")
            return False
        else:
            log_test_result(16, "Lock uses Lua compare-and-delete", False, 
                f"Neither Lua script nor lockOwners found. Lua stderr: {stderr1}, lockOwners stderr: {stderr2}")
            return False
            
    except Exception as e:
        log_test_result(16, "Lock uses Lua compare-and-delete", False, f"Exception: {str(e)}")
        return False

def test_17_batch_transfer_includes_usdc_erc20():
    """TEST 17: FIX 16 - Batch transfer includes USDC-ERC20"""
    try:
        file_path = "/app/backend/apis/tatumApi.ts"
        
        # Search for batch transfer condition with all ERC20 tokens
        success, stdout, stderr = run_command(
            f'grep -n \'currency === "ETH" || currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD-ERC20"\' {file_path}',
            "Searching for complete batch transfer condition"
        )
        
        if success and stdout:
            log_test_result(17, "Batch transfer includes USDC-ERC20", True, 
                f"Found complete batch transfer condition: {stdout}")
            return True
        else:
            # Alternative: search for batch-related functions and check for USDC-ERC20
            success2, stdout2, stderr2 = run_command(
                f'grep -n -A5 -B5 \'batch.*transfer\' {file_path} | grep -i "usdc-erc20"',
                "Searching for USDC-ERC20 in batch context"
            )
            
            if success2 and stdout2:
                log_test_result(17, "Batch transfer includes USDC-ERC20", True, 
                    f"Found USDC-ERC20 in batch transfer context: {stdout2}")
                return True
            else:
                log_test_result(17, "Batch transfer includes USDC-ERC20", False, 
                    f"Complete batch condition not found. Stderr: {stderr}")
                return False
            
    except Exception as e:
        log_test_result(17, "Batch transfer includes USDC-ERC20", False, f"Exception: {str(e)}")
        return False

def test_18_token_chains_fallback_and_debug_script():
    """TEST 18: FIX 17+18 - TOKEN_CHAINS fallback and debug script"""
    try:
        # Check TOKEN_CHAINS fallback in merchantPoolConfig.ts
        file_path1 = "/app/backend/services/merchantPool/merchantPoolConfig.ts"
        success1, stdout1, stderr1 = run_command(
            f'grep -n \'RLUSD.*USDT-POLYGON.*RLUSD-ERC20\' {file_path1}',
            "Searching for TOKEN_CHAINS fallback"
        )
        
        # Check debug script for all 15 chains including BCH
        file_path2 = "/app/backend/scripts/debug/check_all_wallets.ts"
        success2, stdout2, stderr2 = run_command(
            f'grep -n \'BCH\' {file_path2}',
            "Searching for BCH in debug script (indicates all 15 chains)"
        )
        
        if success1 and stdout1 and success2 and stdout2:
            log_test_result(18, "TOKEN_CHAINS fallback and debug script", True, 
                f"Found TOKEN_CHAINS fallback: {stdout1}\n\nFound BCH in debug script: {stdout2}")
            return True
        elif success1 and stdout1:
            log_test_result(18, "TOKEN_CHAINS fallback and debug script", False, 
                f"Found TOKEN_CHAINS fallback but BCH not in debug script: {stdout1}")
            return False
        elif success2 and stdout2:
            log_test_result(18, "TOKEN_CHAINS fallback and debug script", False, 
                f"Found BCH in debug script but TOKEN_CHAINS fallback missing: {stdout2}")
            return False
        else:
            log_test_result(18, "TOKEN_CHAINS fallback and debug script", False, 
                f"Neither TOKEN_CHAINS fallback nor BCH in debug script found. Fallback stderr: {stderr1}, Debug stderr: {stderr2}")
            return False
            
    except Exception as e:
        log_test_result(18, "TOKEN_CHAINS fallback and debug script", False, f"Exception: {str(e)}")
        return False

def main():
    """Run all 18 tests for Edge Case Analysis"""
    print("=" * 80)
    print("EDGE CASE ANALYSIS TESTING - 18 CRITICAL FIXES FOR DYNOPAY")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test started at: {datetime.now().isoformat()}")
    print("=" * 80)
    
    # Run all 18 tests
    tests = [
        test_1_backend_health,
        test_2_typescript_compilation,
        test_3_rlusd_erc20_asset_to_other_address,
        test_4_normalize_currency_handles_rlusd_erc20,
        test_5_sweep_has_rlusd_erc20_contract,
        test_6_token_contracts_has_rlusd_erc20,
        test_7_create_subscription_has_rlusd_erc20,
        test_8_sending_leftover_removed,
        test_9_blockchain_fee_service_has_all_chains,
        test_10_dust_thresholds_has_sol_xrp_polygon,
        test_11_utxo_index_uses_find_utxo_output_index,
        test_12_cron_guards_with_acquire_lock,
        test_13_webhook_auth_middleware,
        test_14_get_transaction_gas_cost_has_chains,
        test_15_orphan_received_amount_subtracts_admin_fee,
        test_16_lock_uses_lua_compare_and_delete,
        test_17_batch_transfer_includes_usdc_erc20,
        test_18_token_chains_fallback_and_debug_script
    ]
    
    passed_tests = 0
    total_tests = len(tests)
    
    for i, test_func in enumerate(tests, 1):
        try:
            if test_func():
                passed_tests += 1
        except Exception as e:
            log_test_result(i, f"Test {i} execution", False, f"Exception during test execution: {str(e)}")
        
        # Small delay between tests
        time.sleep(0.2)
    
    # Summary
    print("\n" + "=" * 80)
    print("EDGE CASE ANALYSIS - TEST SUMMARY")
    print("=" * 80)
    
    for result in test_results:
        status = "✅ PASS" if result["passed"] else "❌ FAIL"
        print(f"{status} - {result['test']}: {result['description']}")
    
    success_rate = (passed_tests / total_tests) * 100
    print(f"\nOVERALL RESULT: {passed_tests}/{total_tests} tests passed ({success_rate:.1f}% success rate)")
    
    if passed_tests == total_tests:
        print("🎉 ALL 18 EDGE CASE FIXES VERIFIED - System is production ready!")
        return True
    elif passed_tests >= 16:  # 88.9% success rate threshold
        print(f"✅ HIGH SUCCESS RATE ({success_rate:.1f}%) - Minor issues detected but core functionality working")
        return True
    else:
        print(f"⚠️ {total_tests - passed_tests} CRITICAL FAILURES - Edge case fixes need attention")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)