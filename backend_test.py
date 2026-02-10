#!/usr/bin/env python3
"""
DynoPay Backend Testing Suite
Testing XRP Gas Wallet Separation + Destination Tag Support + Fee Alert Expansion
"""

import requests
import subprocess
import os
import json
import sys

# Base configuration
BACKEND_URL = "http://localhost:8001"  # Internal backend URL as specified
TEST_RESULTS = []

def log_test(test_name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = {
        'test': test_name,
        'status': status,
        'passed': passed,
        'details': details
    }
    TEST_RESULTS.append(result)
    print(f"{status}: {test_name}")
    if details:
        print(f"   Details: {details}")

def test_1_backend_health():
    """TEST 1: Backend healthy - GET /api/status/health returns 200 with 'healthy'"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/status/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                log_test("TEST 1: Backend Health Check", True, f"Status: {data}")
                return True
            else:
                log_test("TEST 1: Backend Health Check", False, f"Expected 'healthy' status, got: {data}")
                return False
        else:
            log_test("TEST 1: Backend Health Check", False, f"HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        log_test("TEST 1: Backend Health Check", False, f"Connection error: {str(e)}")
        return False

def test_2_typescript_compilation():
    """TEST 2: TypeScript compiles clean - npx tsc --noEmit should exit with code 0"""
    try:
        os.chdir('/app/backend')
        result = subprocess.run(['npx', 'tsc', '--noEmit'], 
                              capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0:
            log_test("TEST 2: TypeScript Compilation", True, "No compilation errors")
            return True
        else:
            log_test("TEST 2: TypeScript Compilation", False, 
                   f"Exit code {result.returncode}. Stderr: {result.stderr}")
            return False
    except Exception as e:
        log_test("TEST 2: TypeScript Compilation", False, f"Error: {str(e)}")
        return False

def test_3_env_configuration():
    """TEST 3: ENV Configuration - Check XRP wallet addresses are different"""
    try:
        os.chdir('/app/backend')
        
        # Check XRP_MASTER_WALLET
        result1 = subprocess.run(['grep', 'XRP_MASTER_WALLET', '.env'], 
                               capture_output=True, text=True)
        if result1.returncode != 0:
            log_test("TEST 3: ENV Configuration", False, "XRP_MASTER_WALLET not found in .env")
            return False
            
        # Check XRP_FEE_WALLET  
        result2 = subprocess.run(['grep', 'XRP_FEE_WALLET', '.env'], 
                               capture_output=True, text=True)
        if result2.returncode != 0:
            log_test("TEST 3: ENV Configuration", False, "XRP_FEE_WALLET not found in .env")
            return False
        
        # Extract addresses
        master_line = result1.stdout.strip()
        fee_line = result2.stdout.strip()
        
        master_addr = master_line.split('=')[1] if '=' in master_line else ""
        fee_addr = fee_line.split('=')[1] if '=' in fee_line else ""
        
        # Check expected addresses
        expected_master = "rPgBeVA8mLJq5Q6ztsJbN829YKhedWFn85"
        expected_fee = "rNTAMbxNiMVeXVidBK2Xe5Bcza7gKcpvpL"
        
        if master_addr == expected_master and fee_addr == expected_fee and master_addr != fee_addr:
            log_test("TEST 3: ENV Configuration", True, 
                   f"XRP_MASTER_WALLET={master_addr}, XRP_FEE_WALLET={fee_addr} (Different addresses)")
            return True
        else:
            log_test("TEST 3: ENV Configuration", False, 
                   f"Master={master_addr}, Fee={fee_addr}. Expected different addresses")
            return False
            
    except Exception as e:
        log_test("TEST 3: ENV Configuration", False, f"Error: {str(e)}")
        return False

def test_4_fee_wallet_db_records():
    """TEST 4: Fee Wallet DB Records - Check 5 records with correct settings"""
    try:
        os.chdir('/app/backend')
        
        # Run the database query
        query = '''require('dotenv').config(); 
const s = require('./utils/dbInstance').default; 
s.query('SELECT wallet_type, wallet_address, "feeLimit", alert_duration FROM tbl_admin_fee_wallet ORDER BY fee_wallet_id')
.then(([r]) => { 
    console.log(JSON.stringify(r, null, 2)); 
    process.exit(0); 
});'''
        
        result = subprocess.run(['npx', 'ts-node', '--transpile-only', '-e', query],
                              capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            log_test("TEST 4: Fee Wallet DB Records", False, 
                   f"Query failed. Exit code: {result.returncode}, Error: {result.stderr}")
            return False
        
        try:
            records = json.loads(result.stdout.strip())
        except json.JSONDecodeError as e:
            log_test("TEST 4: Fee Wallet DB Records", False, f"Invalid JSON response: {result.stdout}")
            return False
        
        # Expected: 5 records (ETH, TRX, XRP, POLYGON, XRP_MASTER)
        if len(records) != 5:
            log_test("TEST 4: Fee Wallet DB Records", False, 
                   f"Expected 5 records, got {len(records)}: {records}")
            return False
        
        # Check wallet types
        wallet_types = [r['wallet_type'] for r in records]
        expected_types = {'ETH', 'TRX', 'XRP', 'POLYGON', 'XRP_MASTER'}
        actual_types = set(wallet_types)
        
        if actual_types != expected_types:
            log_test("TEST 4: Fee Wallet DB Records", False,
                   f"Expected types {expected_types}, got {actual_types}")
            return False
        
        # Check feeLimit values
        fee_limits_30 = ['ETH', 'TRX', 'XRP', 'POLYGON']
        fee_limit_0 = ['XRP_MASTER']
        
        for record in records:
            wallet_type = record['wallet_type']
            fee_limit = record['feeLimit']
            
            if wallet_type in fee_limits_30 and fee_limit != 30:
                log_test("TEST 4: Fee Wallet DB Records", False,
                       f"{wallet_type} should have feeLimit=30, got {fee_limit}")
                return False
            elif wallet_type in fee_limit_0 and fee_limit != 0:
                log_test("TEST 4: Fee Wallet DB Records", False,
                       f"{wallet_type} should have feeLimit=0, got {fee_limit}")
                return False
        
        log_test("TEST 4: Fee Wallet DB Records", True, 
               f"Found 5 records with correct feeLimit values: {records}")
        return True
        
    except Exception as e:
        log_test("TEST 4: Fee Wallet DB Records", False, f"Error: {str(e)}")
        return False

def test_5_user_wallet_destination_tag():
    """TEST 5: User Wallet destination_tag column exists"""
    try:
        os.chdir('/app/backend')
        
        query = '''require('dotenv').config(); 
const s = require('./utils/dbInstance').default; 
s.query("SELECT column_name FROM information_schema.columns WHERE table_name='tbl_user_wallet' AND column_name='destination_tag'")
.then(([r]) => { 
    console.log(JSON.stringify(r)); 
    process.exit(0); 
});'''
        
        result = subprocess.run(['npx', 'ts-node', '--transpile-only', '-e', query],
                              capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            log_test("TEST 5: User Wallet destination_tag Column", False, 
                   f"Query failed. Exit code: {result.returncode}, Error: {result.stderr}")
            return False
        
        try:
            columns = json.loads(result.stdout.strip())
        except json.JSONDecodeError as e:
            log_test("TEST 5: User Wallet destination_tag Column", False, 
                   f"Invalid JSON response: {result.stdout}")
            return False
        
        if len(columns) == 1 and columns[0]['column_name'] == 'destination_tag':
            log_test("TEST 5: User Wallet destination_tag Column", True, 
                   "destination_tag column exists in tbl_user_wallet")
            return True
        else:
            log_test("TEST 5: User Wallet destination_tag Column", False, 
                   f"destination_tag column not found. Result: {columns}")
            return False
            
    except Exception as e:
        log_test("TEST 5: User Wallet destination_tag Column", False, f"Error: {str(e)}")
        return False

def test_6_code_references_updated():
    """TEST 6: Code references updated correctly"""
    try:
        os.chdir('/app/backend')
        
        tests = []
        
        # Test 6a: XRP_MASTER_WALLET in merchantPoolConfig.ts
        result1 = subprocess.run(['grep', '-c', 'XRP_MASTER_WALLET', 
                                'services/merchantPool/merchantPoolConfig.ts'], 
                               capture_output=True, text=True)
        count1 = int(result1.stdout.strip()) if result1.returncode == 0 else 0
        tests.append(("XRP_MASTER_WALLET in merchantPoolConfig.ts", count1 >= 1, f"Count: {count1}"))
        
        # Test 6b: wallet_type.*XRP_MASTER in merchantPoolWallet.ts  
        result2 = subprocess.run(['grep', '-c', 'wallet_type.*XRP_MASTER', 
                                'services/merchantPool/merchantPoolWallet.ts'], 
                               capture_output=True, text=True)
        count2 = int(result2.stdout.strip()) if result2.returncode == 0 else 0
        tests.append(("wallet_type.*XRP_MASTER in merchantPoolWallet.ts", count2 >= 1, f"Count: {count2}"))
        
        # Test 6c: merchantDestinationTag in paymentController.ts
        result3 = subprocess.run(['grep', '-c', 'merchantDestinationTag', 
                                'controller/paymentController.ts'], 
                               capture_output=True, text=True)
        count3 = int(result3.stdout.strip()) if result3.returncode == 0 else 0
        tests.append(("merchantDestinationTag in paymentController.ts", count3 >= 4, f"Count: {count3}"))
        
        # Test 6d: resolvedDestTag in tatumApi.ts
        result4 = subprocess.run(['grep', '-c', 'resolvedDestTag', 
                                'apis/tatumApi.ts'], 
                               capture_output=True, text=True)
        count4 = int(result4.stdout.strip()) if result4.returncode == 0 else 0
        tests.append(("resolvedDestTag in tatumApi.ts", count4 >= 2, f"Count: {count4}"))
        
        # Test 6e: destinationTag.*null in tatumApi.ts
        result5 = subprocess.run(['grep', '-c', 'destinationTag.*null', 
                                'apis/tatumApi.ts'], 
                               capture_output=True, text=True)
        count5 = int(result5.stdout.strip()) if result5.returncode == 0 else 0
        tests.append(("destinationTag.*null in tatumApi.ts", count5 >= 1, f"Count: {count5}"))
        
        # Evaluate results
        all_passed = True
        details = []
        for test_name, passed, detail in tests:
            if not passed:
                all_passed = False
            details.append(f"{test_name}: {detail}")
        
        log_test("TEST 6: Code References Updated", all_passed, "; ".join(details))
        return all_passed
        
    except Exception as e:
        log_test("TEST 6: Code References Updated", False, f"Error: {str(e)}")
        return False

def test_7_checkfeebalance_skips_xrp_master():
    """TEST 7: checkFeeBalance skips XRP_MASTER"""
    try:
        os.chdir('/app/backend')
        
        # Look for XRP_MASTER skip logic in paymentController.ts
        result = subprocess.run(['grep', '-B2', '-A2', 'XRP_MASTER', 
                               'controller/paymentController.ts'], 
                              capture_output=True, text=True)
        
        if result.returncode != 0:
            log_test("TEST 7: checkFeeBalance skips XRP_MASTER", False, 
                   "XRP_MASTER not found in paymentController.ts")
            return False
        
        skip_logic_found = False
        lines = result.stdout.lower()
        
        # Look for skip patterns
        skip_patterns = ['skip', 'continue', 'return', 'feeLimit.*0', 'feelimit.*0']
        for pattern in skip_patterns:
            if pattern in lines and 'xrp_master' in lines:
                skip_logic_found = True
                break
        
        if skip_logic_found:
            log_test("TEST 7: checkFeeBalance skips XRP_MASTER", True, 
                   f"Skip logic found in checkFeeBalance function")
            return True
        else:
            log_test("TEST 7: checkFeeBalance skips XRP_MASTER", False, 
                   f"No skip logic found. Context: {result.stdout[:200]}...")
            return False
            
    except Exception as e:
        log_test("TEST 7: checkFeeBalance skips XRP_MASTER", False, f"Error: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("DynoPay Backend Testing Suite")
    print("Testing: XRP Gas Wallet Separation + Destination Tag + Fee Alert Expansion")
    print("=" * 60)
    
    # Run all tests
    tests = [
        test_1_backend_health,
        test_2_typescript_compilation, 
        test_3_env_configuration,
        test_4_fee_wallet_db_records,
        test_5_user_wallet_destination_tag,
        test_6_code_references_updated,
        test_7_checkfeebalance_skips_xrp_master
    ]
    
    passed_count = 0
    for test_func in tests:
        try:
            if test_func():
                passed_count += 1
        except Exception as e:
            print(f"ERROR in {test_func.__name__}: {e}")
        print()  # Space between tests
    
    # Summary
    print("=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"PASSED: {passed_count}/{len(tests)}")
    print(f"SUCCESS RATE: {(passed_count/len(tests)*100):.1f}%")
    print()
    
    # Detailed results
    for result in TEST_RESULTS:
        print(f"{result['status']}: {result['test']}")
        if result['details']:
            print(f"   {result['details']}")
    
    print("=" * 60)
    
    # Return exit code
    return 0 if passed_count == len(tests) else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)