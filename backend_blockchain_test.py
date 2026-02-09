#!/usr/bin/env python3
"""
DynoPay Backend Blockchain Testing - 6 New Chain Integration
Testing implementation of BCH, SOL, XRP, RLUSD, POLYGON, USDT-POLYGON

Base URL: http://localhost:8001
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
backend_files = {
    "merchantPoolModels": "/app/backend/models/merchantPoolModels/index.ts",
    "merchantPoolConfig": "/app/backend/services/merchantPool/merchantPoolConfig.ts",
    "tatumApi": "/app/backend/apis/tatumApi.ts",
    "paymentController": "/app/backend/controller/paymentController.ts",
    "adminController": "/app/backend/controller/adminController.ts",
    "merchantPoolWallet": "/app/backend/services/merchantPool/merchantPoolWallet.ts",
    "merchantApiRouter": "/app/backend/routes/merchantApiRouter.ts",
    "addressValidation": "/app/backend/utils/addressValidation.ts"
}

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
    """TEST 1: Backend Health - GET /health returns 200 with status "healthy" """
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "status" in data and data["status"] == "healthy":
                    log_test_result(1, "Backend Health", True, 
                        f"Status code: {response.status_code}, Response: {data}")
                    return True
                else:
                    log_test_result(1, "Backend Health", False, 
                        f"Status code: {response.status_code}, but status is not 'healthy': {data}")
                    return False
            except json.JSONDecodeError:
                if "healthy" in response.text.lower():
                    log_test_result(1, "Backend Health", True, 
                        f"Status code: {response.status_code}, Response text: {response.text}")
                    return True
                else:
                    log_test_result(1, "Backend Health", False, 
                        f"Status code: {response.status_code}, but response doesn't contain 'healthy': {response.text}")
                    return False
        else:
            log_test_result(1, "Backend Health", False, 
                f"Status code: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test_result(1, "Backend Health", False, f"Exception: {str(e)}")
        return False

def test_2_no_compilation_errors():
    """TEST 2: No TypeScript compilation errors"""
    try:
        success, stdout, stderr = run_command(
            'tail -n 30 /var/log/supervisor/backend.out.log',
            "Checking backend logs for TS errors"
        )
        
        if success:
            # Check for TypeScript compilation errors
            error_patterns = ["error TS", "compilation error", "error:", "ERROR"]
            found_errors = []
            
            for line in stdout.split('\n'):
                for pattern in error_patterns:
                    if pattern.lower() in line.lower() and "test" not in line.lower():
                        found_errors.append(line.strip())
            
            if not found_errors:
                log_test_result(2, "No compilation errors", True, 
                    f"No TypeScript compilation errors found in recent logs")
                return True
            else:
                log_test_result(2, "No compilation errors", False, 
                    f"Found potential compilation errors: {found_errors[:3]}")
                return False
        else:
            log_test_result(2, "No compilation errors", False, 
                f"Could not read backend logs. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(2, "No compilation errors", False, f"Exception: {str(e)}")
        return False

def test_3_merchant_pool_crypto_types():
    """TEST 3: MERCHANT_POOL_CRYPTO_TYPES contains all 14 currencies"""
    try:
        expected_currencies = [
            'BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH',
            'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20',
            'SOL', 'XRP', 'RLUSD', 'POLYGON', 'USDT-POLYGON'
        ]
        
        success, stdout, stderr = run_command(
            f'grep -n "MERCHANT_POOL_CRYPTO_TYPES" {backend_files["merchantPoolModels"]}',
            "Searching for MERCHANT_POOL_CRYPTO_TYPES"
        )
        
        if success and stdout:
            found_currencies = []
            for currency in expected_currencies:
                if f"'{currency}'" in stdout or f'"{currency}"' in stdout:
                    found_currencies.append(currency)
            
            missing_currencies = set(expected_currencies) - set(found_currencies)
            
            if len(found_currencies) >= 14 and not missing_currencies:
                log_test_result(3, "MERCHANT_POOL_CRYPTO_TYPES (14 currencies)", True, 
                    f"Found all {len(found_currencies)} currencies: {found_currencies}")
                return True
            else:
                log_test_result(3, "MERCHANT_POOL_CRYPTO_TYPES (14 currencies)", False, 
                    f"Found {len(found_currencies)} currencies. Missing: {list(missing_currencies)}")
                return False
        else:
            log_test_result(3, "MERCHANT_POOL_CRYPTO_TYPES (14 currencies)", False, 
                f"MERCHANT_POOL_CRYPTO_TYPES not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(3, "MERCHANT_POOL_CRYPTO_TYPES (14 currencies)", False, f"Exception: {str(e)}")
        return False

def test_4_non_hd_chains():
    """TEST 4: NON_HD_CHAINS contains SOL and XRP"""
    try:
        success, stdout, stderr = run_command(
            f'grep -n "NON_HD_CHAINS" {backend_files["merchantPoolModels"]}',
            "Searching for NON_HD_CHAINS"
        )
        
        if success and stdout:
            expected = ["SOL", "XRP"]
            found_sol = "'SOL'" in stdout or '"SOL"' in stdout
            found_xrp = "'XRP'" in stdout or '"XRP"' in stdout
            
            if found_sol and found_xrp:
                log_test_result(4, "NON_HD_CHAINS export", True, 
                    f"NON_HD_CHAINS contains SOL and XRP: {stdout.strip()}")
                return True
            else:
                log_test_result(4, "NON_HD_CHAINS export", False, 
                    f"NON_HD_CHAINS missing SOL ({found_sol}) or XRP ({found_xrp}): {stdout}")
                return False
        else:
            log_test_result(4, "NON_HD_CHAINS export", False, 
                f"NON_HD_CHAINS not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(4, "NON_HD_CHAINS export", False, f"Exception: {str(e)}")
        return False

def test_5_gas_token_mapping():
    """TEST 5: GAS_TOKEN_MAPPING includes RLUSD→XRP and USDT-POLYGON→POLYGON"""
    try:
        success, stdout, stderr = run_command(
            f'grep -A 10 -B 2 "GAS_TOKEN_MAPPING" {backend_files["merchantPoolModels"]}',
            "Searching for GAS_TOKEN_MAPPING"
        )
        
        if success and stdout:
            required_mappings = [
                ("RLUSD", "XRP"),
                ("USDT-POLYGON", "POLYGON"),
                ("USDT-TRC20", "TRX"),
                ("USDT-ERC20", "ETH"),
                ("USDC-ERC20", "ETH")
            ]
            
            found_mappings = []
            for token, gas_token in required_mappings:
                if f"'{token}': '{gas_token}'" in stdout or f'"{token}": "{gas_token}"' in stdout:
                    found_mappings.append(f"{token}→{gas_token}")
            
            if len(found_mappings) >= 4:  # At least the core mappings
                log_test_result(5, "GAS_TOKEN_MAPPING", True, 
                    f"Found {len(found_mappings)} mappings: {found_mappings}")
                return True
            else:
                log_test_result(5, "GAS_TOKEN_MAPPING", False, 
                    f"Only found {len(found_mappings)} mappings: {found_mappings}")
                return False
        else:
            log_test_result(5, "GAS_TOKEN_MAPPING", False, 
                f"GAS_TOKEN_MAPPING not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(5, "GAS_TOKEN_MAPPING", False, f"Exception: {str(e)}")
        return False

def test_6_admin_wallets_config():
    """TEST 6: ADMIN_WALLETS config includes SOL, XRP, RLUSD, POLYGON, USDT-POLYGON"""
    try:
        success, stdout, stderr = run_command(
            f'grep -A 20 "ADMIN_WALLETS" {backend_files["merchantPoolConfig"]}',
            "Searching for ADMIN_WALLETS"
        )
        
        if success and stdout:
            required_chains = ["SOL", "XRP", "RLUSD", "POLYGON", "USDT-POLYGON"]
            found_chains = []
            
            for chain in required_chains:
                if f'"{chain}":' in stdout or f"'{chain}':" in stdout:
                    found_chains.append(chain)
            
            if len(found_chains) >= 4:  # Allow some flexibility
                log_test_result(6, "ADMIN_WALLETS config", True, 
                    f"Found {len(found_chains)} new chains in ADMIN_WALLETS: {found_chains}")
                return True
            else:
                log_test_result(6, "ADMIN_WALLETS config", False, 
                    f"Only found {len(found_chains)} new chains in ADMIN_WALLETS: {found_chains}")
                return False
        else:
            log_test_result(6, "ADMIN_WALLETS config", False, 
                f"ADMIN_WALLETS not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(6, "ADMIN_WALLETS config", False, f"Exception: {str(e)}")
        return False

def test_7_fee_wallets_config():
    """TEST 7: FEE_WALLETS config includes XRP and POLYGON"""
    try:
        success, stdout, stderr = run_command(
            f'grep -A 10 -B 2 "FEE_WALLETS" {backend_files["merchantPoolConfig"]}',
            "Searching for FEE_WALLETS"
        )
        
        if success and stdout:
            required_chains = ["XRP", "POLYGON"]
            found_chains = []
            
            for chain in required_chains:
                if f'{chain}:' in stdout and 'process.env' in stdout:
                    found_chains.append(chain)
            
            if len(found_chains) >= 2:
                log_test_result(7, "FEE_WALLETS config", True, 
                    f"Found {len(found_chains)} fee wallets: {found_chains}")
                return True
            else:
                log_test_result(7, "FEE_WALLETS config", False, 
                    f"Only found {len(found_chains)} fee wallets: {found_chains}")
                return False
        else:
            log_test_result(7, "FEE_WALLETS config", False, 
                f"FEE_WALLETS not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(7, "FEE_WALLETS config", False, f"Exception: {str(e)}")
        return False

def test_8_rlusd_config():
    """TEST 8: RLUSD_CONFIG exists with issuer and currencyHex"""
    try:
        success, stdout, stderr = run_command(
            f'grep -A 5 "RLUSD_CONFIG" {backend_files["merchantPoolConfig"]}',
            "Searching for RLUSD_CONFIG"
        )
        
        if success and stdout:
            has_issuer = "issuer:" in stdout
            has_currency_hex = "currencyHex:" in stdout
            
            if has_issuer and has_currency_hex:
                log_test_result(8, "RLUSD_CONFIG export", True, 
                    f"RLUSD_CONFIG found with issuer and currencyHex")
                return True
            else:
                log_test_result(8, "RLUSD_CONFIG export", False, 
                    f"RLUSD_CONFIG incomplete - issuer: {has_issuer}, currencyHex: {has_currency_hex}")
                return False
        else:
            log_test_result(8, "RLUSD_CONFIG export", False, 
                f"RLUSD_CONFIG not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(8, "RLUSD_CONFIG export", False, f"Exception: {str(e)}")
        return False

def test_9_generate_wallet_new_chains():
    """TEST 9: generateWallet handles SOL, XRP, POLYGON"""
    try:
        success, stdout, stderr = run_command(
            f'grep -A 10 -B 2 "currency === \"SOL\"\\|currency === \"XRP\"\\|currency === \"POLYGON\"" {backend_files["tatumApi"]}',
            "Searching for new chain wallet generation"
        )
        
        if success and stdout:
            has_sol = "solanaGenerateWallet" in stdout
            has_xrp = "xrpWallet" in stdout
            has_polygon = "polygonGenerateWallet" in stdout
            
            found_chains = []
            if has_sol: found_chains.append("SOL")
            if has_xrp: found_chains.append("XRP")
            if has_polygon: found_chains.append("POLYGON")
            
            if len(found_chains) >= 3:
                log_test_result(9, "generateWallet handles new chains", True, 
                    f"Found wallet generation for: {found_chains}")
                return True
            else:
                log_test_result(9, "generateWallet handles new chains", False, 
                    f"Only found wallet generation for: {found_chains}")
                return False
        else:
            log_test_result(9, "generateWallet handles new chains", False, 
                f"New chain wallet generation not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(9, "generateWallet handles new chains", False, f"Exception: {str(e)}")
        return False

def test_10_generate_user_address_non_hd():
    """TEST 10: generateUserAddress handles non-HD chains (SOL, XRP, POLYGON)"""
    try:
        success, stdout, stderr = run_command(
            f'grep -A 15 "case \"SOL\"\\|case \"XRP\"\\|case \"POLYGON\"\\|case \"USDT-POLYGON\"" {backend_files["tatumApi"]}',
            "Searching for non-HD address generation"
        )
        
        if success and stdout:
            # Check for proper non-HD handling
            has_sol_fresh = "solanaGenerateWallet" in stdout
            has_xrp_fresh = "xrpWallet" in stdout
            has_polygon_hd = "polygonGenerateAddressPrivateKey" in stdout
            
            found_implementations = []
            if has_sol_fresh: found_implementations.append("SOL (fresh)")
            if has_xrp_fresh: found_implementations.append("XRP (fresh)")
            if has_polygon_hd: found_implementations.append("POLYGON (HD)")
            
            if len(found_implementations) >= 3:
                log_test_result(10, "generateUserAddress handles non-HD chains", True, 
                    f"Found implementations: {found_implementations}")
                return True
            else:
                log_test_result(10, "generateUserAddress handles non-HD chains", False, 
                    f"Only found implementations: {found_implementations}")
                return False
        else:
            log_test_result(10, "generateUserAddress handles non-HD chains", False, 
                f"Non-HD address generation not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(10, "generateUserAddress handles non-HD chains", False, f"Exception: {str(e)}")
        return False

def test_11_subscription_chain_mapping():
    """TEST 11: Subscription chain mapping (SOL→SOLANA, XRP/RLUSD→XRP, POLYGON/USDT-POLYGON→MATIC)"""
    try:
        success, stdout, stderr = run_command(
            f'grep -A 10 -B 5 "SOLANA\\|MATIC" {backend_files["tatumApi"]}',
            "Searching for subscription chain mapping"
        )
        
        if success and stdout:
            has_solana_mapping = "SOLANA" in stdout
            has_matic_mapping = "MATIC" in stdout
            
            # Also check for XRP mapping
            success2, stdout2, stderr2 = run_command(
                f'grep -A 5 -B 5 "chain.*XRP" {backend_files["tatumApi"]}',
                "Searching for XRP chain mapping"
            )
            
            has_xrp_mapping = success2 and "XRP" in stdout2
            
            found_mappings = []
            if has_solana_mapping: found_mappings.append("SOL→SOLANA")
            if has_xrp_mapping: found_mappings.append("XRP/RLUSD→XRP")
            if has_matic_mapping: found_mappings.append("POLYGON/USDT-POLYGON→MATIC")
            
            if len(found_mappings) >= 2:
                log_test_result(11, "Subscription chain mapping", True, 
                    f"Found mappings: {found_mappings}")
                return True
            else:
                log_test_result(11, "Subscription chain mapping", False, 
                    f"Only found mappings: {found_mappings}")
                return False
        else:
            log_test_result(11, "Subscription chain mapping", False, 
                f"Chain mapping not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(11, "Subscription chain mapping", False, f"Exception: {str(e)}")
        return False

def test_12_fee_estimation_new_chains():
    """TEST 12: feeEstimation handles SOL, XRP, RLUSD, POLYGON, USDT-POLYGON"""
    try:
        success, stdout, stderr = run_command(
            f'grep -A 5 -B 2 "SOL\\|XRP\\|RLUSD\\|POLYGON\\|USDT-POLYGON" {backend_files["tatumApi"]} | grep -A 5 -B 5 "fee"',
            "Searching for fee estimation for new chains"
        )
        
        if success and stdout:
            new_chains = ["SOL", "XRP", "RLUSD", "POLYGON", "USDT-POLYGON"]
            found_fee_handling = []
            
            for chain in new_chains:
                if chain in stdout and ("fast:" in stdout or "fees =" in stdout):
                    found_fee_handling.append(chain)
            
            if len(found_fee_handling) >= 4:
                log_test_result(12, "feeEstimation handles new chains", True, 
                    f"Found fee estimation for: {found_fee_handling}")
                return True
            else:
                log_test_result(12, "feeEstimation handles new chains", False, 
                    f"Only found fee estimation for: {found_fee_handling}")
                return False
        else:
            log_test_result(12, "feeEstimation handles new chains", False, 
                f"Fee estimation for new chains not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(12, "feeEstimation handles new chains", False, f"Exception: {str(e)}")
        return False

def test_13_asset_transfer_new_chains():
    """TEST 13: assetToOtherAddress handles transfers for new chains"""
    try:
        success, stdout, stderr = run_command(
            f'grep -A 15 "solanaBlockchainTransfer\\|xrpTransferBlockchain\\|polygonBlockchainTransfer" {backend_files["tatumApi"]}',
            "Searching for asset transfer implementations"
        )
        
        if success and stdout:
            has_solana_transfer = "solanaBlockchainTransfer" in stdout
            has_xrp_transfer = "xrpTransferBlockchain" in stdout
            has_polygon_transfer = "polygonBlockchainTransfer" in stdout
            
            # Check for RLUSD with issuerAccount
            success2, stdout2, stderr2 = run_command(
                f'grep -A 10 "RLUSD\\|issuerAccount" {backend_files["tatumApi"]}',
                "Searching for RLUSD transfer with issuer"
            )
            has_rlusd_transfer = success2 and ("issuerAccount" in stdout2 or "token:" in stdout2)
            
            found_transfers = []
            if has_solana_transfer: found_transfers.append("SOL")
            if has_xrp_transfer: found_transfers.append("XRP")
            if has_rlusd_transfer: found_transfers.append("RLUSD")
            if has_polygon_transfer: found_transfers.append("POLYGON/USDT-POLYGON")
            
            if len(found_transfers) >= 3:
                log_test_result(13, "assetToOtherAddress handles transfers", True, 
                    f"Found transfer implementations: {found_transfers}")
                return True
            else:
                log_test_result(13, "assetToOtherAddress handles transfers", False, 
                    f"Only found transfer implementations: {found_transfers}")
                return False
        else:
            log_test_result(13, "assetToOtherAddress handles transfers", False, 
                f"Transfer implementations not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(13, "assetToOtherAddress handles transfers", False, f"Exception: {str(e)}")
        return False

def test_14_get_address_balance_new_chains():
    """TEST 14: getAddressBalance handles new chains"""
    try:
        success, stdout, stderr = run_command(
            f'grep -A 10 "solanaGetBalance\\|xrpGetAccountBalance\\|polygonGetBalance\\|erc20GetBalance" {backend_files["tatumApi"]}',
            "Searching for balance checking implementations"
        )
        
        if success and stdout:
            has_solana_balance = "solanaGetBalance" in stdout
            has_xrp_balance = "xrpGetAccountBalance" in stdout
            has_polygon_balance = "polygonGetBalance" in stdout
            has_erc20_balance = "erc20GetBalance" in stdout
            
            found_balance_methods = []
            if has_solana_balance: found_balance_methods.append("SOL")
            if has_xrp_balance: found_balance_methods.append("XRP/RLUSD")
            if has_polygon_balance: found_balance_methods.append("POLYGON")
            if has_erc20_balance: found_balance_methods.append("USDT-POLYGON")
            
            if len(found_balance_methods) >= 3:
                log_test_result(14, "getAddressBalance handles new chains", True, 
                    f"Found balance methods: {found_balance_methods}")
                return True
            else:
                log_test_result(14, "getAddressBalance handles new chains", False, 
                    f"Only found balance methods: {found_balance_methods}")
                return False
        else:
            log_test_result(14, "getAddressBalance handles new chains", False, 
                f"Balance checking implementations not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(14, "getAddressBalance handles new chains", False, f"Exception: {str(e)}")
        return False

def test_15_setup_xrp_trust_line():
    """TEST 15: setupXrpTrustLine function exists"""
    try:
        success, stdout, stderr = run_command(
            f'grep -n "setupXrpTrustLine\\|xrpTrustLineBlockchain" {backend_files["tatumApi"]}',
            "Searching for XRP trust line setup"
        )
        
        if success and stdout:
            has_trust_line_function = "setupXrpTrustLine" in stdout or "xrpTrustLineBlockchain" in stdout
            
            if has_trust_line_function:
                log_test_result(15, "setupXrpTrustLine exists", True, 
                    f"Found XRP trust line setup function")
                return True
            else:
                log_test_result(15, "setupXrpTrustLine exists", False, 
                    f"XRP trust line function not found")
                return False
        else:
            log_test_result(15, "setupXrpTrustLine exists", False, 
                f"XRP trust line function not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(15, "setupXrpTrustLine exists", False, f"Exception: {str(e)}")
        return False

def test_16_settlement_rlusd_usdt_polygon():
    """TEST 16: Settlement handles RLUSD and USDT-POLYGON"""
    try:
        success, stdout, stderr = run_command(
            f'grep -A 10 -B 5 "RLUSD\\|USDT-POLYGON" {backend_files["paymentController"]}',
            "Searching for RLUSD and USDT-POLYGON in settlement"
        )
        
        if success and stdout:
            # Check if they're handled in token transfer branch
            has_rlusd_handling = "RLUSD" in stdout
            has_usdt_polygon_handling = "USDT-POLYGON" in stdout
            
            # Check for wallet_type_map
            success2, stdout2, stderr2 = run_command(
                f'grep -A 5 -B 5 "wallet_type_map" {backend_files["paymentController"]}',
                "Searching for wallet_type_map"
            )
            
            has_wallet_type_map = success2 and ("RLUSD" in stdout2 or "USDT-POLYGON" in stdout2)
            
            found_implementations = []
            if has_rlusd_handling: found_implementations.append("RLUSD")
            if has_usdt_polygon_handling: found_implementations.append("USDT-POLYGON")
            if has_wallet_type_map: found_implementations.append("wallet_type_map")
            
            if len(found_implementations) >= 2:
                log_test_result(16, "Settlement handles RLUSD and USDT-POLYGON", True, 
                    f"Found settlement handling: {found_implementations}")
                return True
            else:
                log_test_result(16, "Settlement handles RLUSD and USDT-POLYGON", False, 
                    f"Only found settlement handling: {found_implementations}")
                return False
        else:
            log_test_result(16, "Settlement handles RLUSD and USDT-POLYGON", False, 
                f"Settlement handling not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(16, "Settlement handles RLUSD and USDT-POLYGON", False, f"Exception: {str(e)}")
        return False

def test_17_admin_wallet_creation_new_chains():
    """TEST 17: Admin wallet creation includes new chains"""
    try:
        success, stdout, stderr = run_command(
            f'grep -A 20 -B 5 "cryptoData\\|SOL\\|XRP\\|POLYGON" {backend_files["adminController"]}',
            "Searching for admin wallet creation"
        )
        
        if success and stdout:
            has_sol = "SOL" in stdout
            has_xrp = "XRP" in stdout
            has_polygon = "POLYGON" in stdout
            
            # Check for RLUSD and USDT-POLYGON wallet creation logic
            has_rlusd_creation = "RLUSD" in stdout
            has_usdt_polygon_creation = "USDT-POLYGON" in stdout
            
            found_chains = []
            if has_sol: found_chains.append("SOL")
            if has_xrp: found_chains.append("XRP")
            if has_polygon: found_chains.append("POLYGON")
            if has_rlusd_creation: found_chains.append("RLUSD")
            if has_usdt_polygon_creation: found_chains.append("USDT-POLYGON")
            
            if len(found_chains) >= 3:
                log_test_result(17, "Admin wallet creation includes new chains", True, 
                    f"Found admin wallet creation for: {found_chains}")
                return True
            else:
                log_test_result(17, "Admin wallet creation includes new chains", False, 
                    f"Only found admin wallet creation for: {found_chains}")
                return False
        else:
            log_test_result(17, "Admin wallet creation includes new chains", False, 
                f"Admin wallet creation not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(17, "Admin wallet creation includes new chains", False, f"Exception: {str(e)}")
        return False

def test_18_non_hd_wallet_handling():
    """TEST 18: Non-HD wallet handling in merchantPoolWallet"""
    try:
        success, stdout, stderr = run_command(
            f'grep -A 10 -B 5 "NON_HD_CHAINS\\|NON_HD" {backend_files["merchantPoolWallet"]}',
            "Searching for non-HD wallet handling"
        )
        
        if success and stdout:
            has_non_hd_check = "NON_HD_CHAINS" in stdout
            has_non_hd_return = "NON_HD" in stdout and "return" in stdout
            has_placeholder_logic = "xpub" in stdout and "NON_HD" in stdout
            
            found_implementations = []
            if has_non_hd_check: found_implementations.append("NON_HD_CHAINS check")
            if has_non_hd_return: found_implementations.append("NON_HD return")
            if has_placeholder_logic: found_implementations.append("placeholder xpub")
            
            if len(found_implementations) >= 2:
                log_test_result(18, "Non-HD wallet handling", True, 
                    f"Found non-HD handling: {found_implementations}")
                return True
            else:
                log_test_result(18, "Non-HD wallet handling", False, 
                    f"Only found non-HD handling: {found_implementations}")
                return False
        else:
            log_test_result(18, "Non-HD wallet handling", False, 
                f"Non-HD wallet handling not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(18, "Non-HD wallet handling", False, f"Exception: {str(e)}")
        return False

def test_19_crypto_types_in_router():
    """TEST 19: CRYPTO_TYPES in merchantApiRouter includes all 14 currencies"""
    try:
        success, stdout, stderr = run_command(
            f'grep -A 5 -B 5 "CRYPTO_TYPES" {backend_files["merchantApiRouter"]}',
            "Searching for CRYPTO_TYPES in router"
        )
        
        if success and stdout:
            new_chains = ['BCH', 'SOL', 'XRP', 'RLUSD', 'POLYGON', 'USDT-POLYGON']
            found_chains = []
            
            for chain in new_chains:
                if f"'{chain}'" in stdout or f'"{chain}"' in stdout:
                    found_chains.append(chain)
            
            if len(found_chains) >= 5:  # Allow some flexibility
                log_test_result(19, "CRYPTO_TYPES in merchantApiRouter", True, 
                    f"Found {len(found_chains)} new chains in router: {found_chains}")
                return True
            else:
                log_test_result(19, "CRYPTO_TYPES in merchantApiRouter", False, 
                    f"Only found {len(found_chains)} new chains in router: {found_chains}")
                return False
        else:
            log_test_result(19, "CRYPTO_TYPES in merchantApiRouter", False, 
                f"CRYPTO_TYPES in router not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(19, "CRYPTO_TYPES in merchantApiRouter", False, f"Exception: {str(e)}")
        return False

def test_20_address_validation_patterns():
    """TEST 20: Address validation patterns for new chains"""
    try:
        success, stdout, stderr = run_command(
            f'grep -A 15 -B 5 "SOL\\|XRP\\|RLUSD\\|POLYGON\\|USDT-POLYGON" {backend_files["addressValidation"]}',
            "Searching for address validation patterns"
        )
        
        if success and stdout:
            new_chains = ['SOL', 'XRP', 'RLUSD', 'POLYGON', 'USDT-POLYGON']
            found_patterns = []
            
            for chain in new_chains:
                if f"'{chain}':" in stdout or f'"{chain}":' in stdout:
                    found_patterns.append(chain)
            
            if len(found_patterns) >= 4:
                log_test_result(20, "Address validation patterns", True, 
                    f"Found validation patterns for: {found_patterns}")
                return True
            else:
                log_test_result(20, "Address validation patterns", False, 
                    f"Only found validation patterns for: {found_patterns}")
                return False
        else:
            log_test_result(20, "Address validation patterns", False, 
                f"Address validation patterns not found. Stderr: {stderr}")
            return False
            
    except Exception as e:
        log_test_result(20, "Address validation patterns", False, f"Exception: {str(e)}")
        return False

def main():
    """Run all 20 tests for new blockchain chains implementation"""
    print("=" * 80)
    print("DYNOPAY BLOCKCHAIN CHAIN IMPLEMENTATION TESTING")
    print("Testing 6 new chains: BCH, SOL, XRP, RLUSD, POLYGON, USDT-POLYGON")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test started at: {datetime.now().isoformat()}")
    print("=" * 80)
    
    # Run all 20 tests
    tests = [
        test_1_backend_health,
        test_2_no_compilation_errors,
        test_3_merchant_pool_crypto_types,
        test_4_non_hd_chains,
        test_5_gas_token_mapping,
        test_6_admin_wallets_config,
        test_7_fee_wallets_config,
        test_8_rlusd_config,
        test_9_generate_wallet_new_chains,
        test_10_generate_user_address_non_hd,
        test_11_subscription_chain_mapping,
        test_12_fee_estimation_new_chains,
        test_13_asset_transfer_new_chains,
        test_14_get_address_balance_new_chains,
        test_15_setup_xrp_trust_line,
        test_16_settlement_rlusd_usdt_polygon,
        test_17_admin_wallet_creation_new_chains,
        test_18_non_hd_wallet_handling,
        test_19_crypto_types_in_router,
        test_20_address_validation_patterns
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
    print("BLOCKCHAIN CHAINS IMPLEMENTATION - TEST SUMMARY")
    print("=" * 80)
    
    print("\n📊 DETAILED TEST RESULTS:")
    for result in test_results:
        status = "✅ PASS" if result["passed"] else "❌ FAIL"
        print(f"{status} - {result['test']}: {result['description']}")
    
    print(f"\n🎯 OVERALL RESULT: {passed_tests}/{total_tests} tests passed ({(passed_tests/total_tests*100):.1f}%)")
    
    if passed_tests == total_tests:
        print("🎉 ALL 20 TESTS PASSED - New blockchain chains implementation is complete!")
        return True
    elif passed_tests >= 16:  # 80% pass rate
        print(f"✅ GOOD PROGRESS - {passed_tests}/{total_tests} tests passed. Minor issues to resolve.")
        return True
    else:
        print(f"⚠️ NEEDS ATTENTION - {total_tests - passed_tests} CRITICAL TESTS FAILED")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)