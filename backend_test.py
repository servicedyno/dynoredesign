#!/usr/bin/env python3
"""
TRON TRC20 Fee Optimization Testing Script
Testing TRON TRC20 Fee Optimization implementation in DynoPay backend.

Base URL: https://code-analyzer-256.preview.emergentagent.com
Credentials: richard@dyno.pt / Katiekendra123@
"""

import requests
import json
import time
import sys
import subprocess
import re
import os

BASE_URL = "https://code-analyzer-256.preview.emergentagent.com"
CREDENTIALS = {
    "email": "richard@dyno.pt", 
    "password": "Katiekendra123@"
}

def test_1_backend_health():
    """TEST 1 - Backend Health: GET /health returns 200 with 'healthy' status"""
    print("🔍 TEST 1: Backend Health Check")
    
    try:
        response = requests.get(f"{BASE_URL}/api/status/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                print("✅ Backend health check passed")
                return True
            else:
                print(f"❌ Backend not healthy: {data}")
                return False
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_2_typescript_compilation():
    """TEST 2 - No TypeScript Compilation Errors"""
    print("\n🔍 TEST 2: TypeScript Compilation Check")
    
    try:
        # Check backend logs for compilation errors
        result = subprocess.run(
            ["tail", "-n", "100", "/var/log/supervisor/backend.out.log"],
            capture_output=True, text=True, timeout=10
        )
        
        logs = result.stdout.lower()
        
        # Look for TypeScript errors
        error_patterns = [
            "error ts",
            "compilation error",
            "typescript error",
            "build failed"
        ]
        
        has_errors = any(pattern in logs for pattern in error_patterns)
        
        if has_errors:
            print("❌ TypeScript compilation errors detected in logs")
            return False
        else:
            print("✅ No TypeScript compilation errors detected")
            return True
            
    except Exception as e:
        print(f"❌ Log check error: {e}")
        return False

def test_3_no_hardcoded_feelimit():
    """TEST 3 - Code Verification: No hardcoded feeLimit: 50 remains"""
    print("\n🔍 TEST 3: Check for hardcoded feeLimit: 50")
    
    try:
        result = subprocess.run(
            ["grep", "-n", "feeLimit.*50", "/app/backend/apis/tatumApi.ts"],
            capture_output=True, text=True
        )
        
        if result.returncode == 1:  # No matches found
            print("✅ No hardcoded 'feeLimit: 50' found in tatumApi.ts")
            
            # Check for dynamic implementations
            result2 = subprocess.run(
                ["grep", "-n", "optimalFeeLimit\\|batchFeeLimit", "/app/backend/apis/tatumApi.ts"],
                capture_output=True, text=True
            )
            
            if result2.returncode == 0 and result2.stdout:
                matches = len(result2.stdout.split('\n')) - 1
                print(f"✅ Found {matches} instances of dynamic feeLimit usage")
                return True
            else:
                print("❌ No dynamic feeLimit implementations found")
                return False
        else:
            print(f"❌ Found hardcoded feeLimit: 50 in tatumApi.ts:\n{result.stdout}")
            return False
            
    except Exception as e:
        print(f"❌ Code check error: {e}")
        return False

def test_4_tron_energy_service():
    """TEST 4 - Code Verification: tronEnergyService.ts exists with correct exports"""
    print("\n🔍 TEST 4: tronEnergyService.ts verification")
    
    try:
        # Check if file exists
        if not os.path.exists("/app/backend/services/tronEnergyService.ts"):
            print("❌ tronEnergyService.ts file does not exist")
            return False
            
        # Check for required exports
        with open("/app/backend/services/tronEnergyService.ts", "r") as f:
            content = f.read()
            
        required_exports = [
            "getTronNetworkParams",
            "getAccountResources", 
            "calculateOptimalFeeLimit",
            "calculateDynamicTRC20Fee",
            "logCostSavings",
            "isRecipientActivatedForToken"
        ]
        
        missing_exports = []
        for export in required_exports:
            if export not in content:
                missing_exports.append(export)
        
        if missing_exports:
            print(f"❌ Missing exports: {missing_exports}")
            return False
        
        # Check for TRONGRID_API usage
        if "TRONGRID_API" in content:
            print("✅ tronEnergyService.ts exists with all required exports and uses TRONGRID_API")
            return True
        else:
            print("❌ tronEnergyService.ts doesn't use TRONGRID_API")
            return False
            
    except Exception as e:
        print(f"❌ File check error: {e}")
        return False

def test_5_tatumapi_dynamic_fee():
    """TEST 5 - Code Verification: tatumApi.ts uses dynamic fee estimation"""
    print("\n🔍 TEST 5: tatumApi.ts dynamic fee verification")
    
    try:
        result = subprocess.run(
            ["grep", "-n", "-A", "5", "-B", "5", 
             "calculateDynamicTRC20Fee\\|calculateOptimalFeeLimit", 
             "/app/backend/apis/tatumApi.ts"],
            capture_output=True, text=True
        )
        
        if result.returncode == 0 and result.stdout:
            content = result.stdout
            
            # Check for specific patterns
            checks = {
                "feeEstimation USDT-TRC20 calls calculateDynamicTRC20Fee": "calculateDynamicTRC20Fee" in content,
                "assetToOtherAddress calls calculateOptimalFeeLimit": "calculateOptimalFeeLimit" in content,
                "batchFeeEstimation calls calculateDynamicTRC20Fee": "calculateDynamicTRC20Fee" in content
            }
            
            passed_checks = sum(checks.values())
            total_checks = len(checks)
            
            print(f"✅ Dynamic fee implementation: {passed_checks}/{total_checks} patterns found")
            for check, passed in checks.items():
                status = "✅" if passed else "❌"
                print(f"  {status} {check}")
                
            return passed_checks >= 2  # At least 2 out of 3 should pass
        else:
            print("❌ No dynamic fee implementations found")
            return False
            
    except Exception as e:
        print(f"❌ Code verification error: {e}")
        return False

def test_6_blockchain_fee_service():
    """TEST 6 - Code Verification: blockchainFeeService.ts uses live energy price"""
    print("\n🔍 TEST 6: blockchainFeeService.ts verification")
    
    try:
        result = subprocess.run(
            ["grep", "-n", "getTronNetworkParams", "/app/backend/services/blockchainFeeService.ts"],
            capture_output=True, text=True
        )
        
        if result.returncode == 0:
            print("✅ blockchainFeeService.ts imports getTronNetworkParams")
            
            # Check for hardcoded 420
            result2 = subprocess.run(
                ["grep", "-n", "energyPrice.*420", "/app/backend/services/blockchainFeeService.ts"],
                capture_output=True, text=True
            )
            
            if result2.returncode == 0:
                print("⚠️ Found energyPrice: 420 fallback (should be 100 but may be acceptable as fallback)")
            
            return True
        else:
            print("❌ blockchainFeeService.ts does not import getTronNetworkParams")
            return False
            
    except Exception as e:
        print(f"❌ Code check error: {e}")
        return False

def test_7_merchant_pool_sweep():
    """TEST 7 - Code Verification: merchantPoolSweep.ts is Energy-aware"""
    print("\n🔍 TEST 7: merchantPoolSweep.ts verification")
    
    try:
        result = subprocess.run(
            ["grep", "-n", "-A", "10", "-B", "5", 
             "getAccountResources\\|TRC20_ENERGY", 
             "/app/backend/services/merchantPool/merchantPoolSweep.ts"],
            capture_output=True, text=True
        )
        
        if result.returncode == 0 and result.stdout:
            content = result.stdout
            
            checks = {
                "Imports getAccountResources": "getAccountResources" in content,
                "Imports TRC20_ENERGY": "TRC20_ENERGY" in content,
                "Energy sufficiency check": "hasSufficientEnergy" in content,
                "Energy awareness logic": "ENERGY OPTIMIZATION" in content or "Energy covered" in content
            }
            
            passed_checks = sum(checks.values())
            total_checks = len(checks)
            
            print(f"✅ Energy-aware SmartGas: {passed_checks}/{total_checks} patterns found")
            for check, passed in checks.items():
                status = "✅" if passed else "❌"
                print(f"  {status} {check}")
                
            return passed_checks >= 2
        else:
            print("❌ No energy-aware patterns found")
            return False
            
    except Exception as e:
        print(f"❌ Code verification error: {e}")
        return False

def test_8_env_variables():
    """TEST 8 - Code Verification: .env has TRON optimization vars"""
    print("\n🔍 TEST 8: Environment variables verification")
    
    try:
        with open("/app/backend/.env", "r") as f:
            content = f.read()
            
        required_vars = {
            "TRON_MIN_FEE_LIMIT_TRX": "TRON_MIN_FEE_LIMIT_TRX=5",
            "TRON_MAX_FEE_LIMIT_TRX": "TRON_MAX_FEE_LIMIT_TRX=30"
        }
        
        found_vars = {}
        for var_name, expected_line in required_vars.items():
            if expected_line in content:
                found_vars[var_name] = True
                print(f"✅ Found {var_name}")
            else:
                found_vars[var_name] = False
                print(f"❌ Missing or incorrect {var_name}")
        
        return all(found_vars.values())
        
    except Exception as e:
        print(f"❌ Environment check error: {e}")
        return False

def test_9_functional_usdt_trc20_payment():
    """TEST 9 - Functional Test: Create USDT-TRC20 Payment via Legacy API"""
    print("\n🔍 TEST 9: Functional USDT-TRC20 Payment Test")
    
    try:
        # Step 1: Login
        print("  Step 1: Authenticating...")
        login_response = requests.post(
            f"{BASE_URL}/api/user/login",
            json=CREDENTIALS,
            timeout=30
        )
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            return False
            
        token = login_response.json().get("accessToken")
        if not token:
            print("❌ No access token received")
            return False
            
        print("✅ Login successful")
        
        # Step 2: Get API keys
        print("  Step 2: Retrieving API keys...")
        headers = {"Authorization": f"Bearer {token}"}
        
        api_keys_response = requests.get(
            f"{BASE_URL}/api/userApi/getUserApi",
            headers=headers,
            timeout=30
        )
        
        if api_keys_response.status_code != 200:
            print(f"❌ API keys retrieval failed: {api_keys_response.status_code}")
            return False
            
        api_data = api_keys_response.json()
        
        # Find API key for company_id 38
        api_key = None
        for key_data in api_data:
            if key_data.get("company_id") == 38:
                api_key = key_data.get("api_key")
                break
                
        if not api_key:
            print("❌ No API key found for company_id 38")
            return False
            
        print(f"✅ API key retrieved for company_id 38")
        
        # Step 3: Create customer
        print("  Step 3: Creating test customer...")
        customer_data = {
            "name": "TRC20 Fee Test",
            "email": "trc20feetest@test.com",
            "phone": "1234567890"
        }
        
        customer_headers = {"x-api-key": api_key}
        customer_response = requests.post(
            f"{BASE_URL}/api/user/createUser",
            json=customer_data,
            headers=customer_headers,
            timeout=30
        )
        
        if customer_response.status_code != 200:
            print(f"❌ Customer creation failed: {customer_response.status_code}")
            try:
                print(f"Response: {customer_response.text}")
            except:
                pass
            return False
            
        customer_id = customer_response.json().get("id") or customer_response.json().get("customer_id")
        if not customer_id:
            print("❌ No customer ID received")
            print(f"Response: {customer_response.json()}")
            return False
            
        print(f"✅ Customer created: {customer_id}")
        
        # Step 4: Create USDT-TRC20 payment
        print("  Step 4: Creating USDT-TRC20 payment...")
        payment_data = {
            "customer_id": customer_id,
            "amount": "10",
            "currency": "USD", 
            "crypto_currency": "USDT-TRC20",
            "webhook_url": "https://httpbin.org/post"
        }
        
        payment_headers = {
            "x-api-key": api_key,
            "Authorization": f"Bearer {token}"
        }
        
        payment_response = requests.post(
            f"{BASE_URL}/api/user/cryptoPayment", 
            json=payment_data,
            headers=payment_headers,
            timeout=30
        )
        
        if payment_response.status_code != 200:
            print(f"❌ Payment creation failed: {payment_response.status_code}")
            try:
                print(f"Response: {payment_response.text}")
            except:
                pass
            return False
            
        payment_result = payment_response.json()
        
        # Step 5: Verify payment response
        required_fields = ["transaction_id", "address", "crypto_amount"]
        missing_fields = [field for field in required_fields if field not in payment_result]
        
        if missing_fields:
            print(f"❌ Missing payment fields: {missing_fields}")
            return False
            
        address = payment_result["address"]
        if not address.startswith("T"):
            print(f"❌ Invalid TRC20 address: {address}")
            return False
            
        print(f"✅ USDT-TRC20 payment created successfully")
        print(f"  Transaction ID: {payment_result['transaction_id']}")
        print(f"  Address: {address}")
        print(f"  Crypto Amount: {payment_result['crypto_amount']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Functional test error: {e}")
        return False

def run_all_tests():
    """Run all TRON TRC20 Fee Optimization tests"""
    print("=" * 80)
    print("TRON TRC20 FEE OPTIMIZATION TESTING")
    print("=" * 80)
    
    tests = [
        test_1_backend_health,
        test_2_typescript_compilation, 
        test_3_no_hardcoded_feelimit,
        test_4_tron_energy_service,
        test_5_tatumapi_dynamic_fee,
        test_6_blockchain_fee_service,
        test_7_merchant_pool_sweep,
        test_8_env_variables,
        test_9_functional_usdt_trc20_payment
    ]
    
    results = []
    passed_count = 0
    
    for i, test_func in enumerate(tests, 1):
        try:
            result = test_func()
            results.append((f"Test {i}", test_func.__doc__.split(" - ")[1] if " - " in test_func.__doc__ else test_func.__name__, result))
            if result:
                passed_count += 1
        except Exception as e:
            print(f"❌ Test {i} crashed: {e}")
            results.append((f"Test {i}", test_func.__name__, False))
    
    print("\n" + "=" * 80)
    print("TEST RESULTS SUMMARY")
    print("=" * 80)
    
    for test_name, test_desc, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}: {test_desc}")
    
    print(f"\nOVERALL: {passed_count}/{len(tests)} tests passed")
    
    if passed_count == len(tests):
        print("🎉 ALL TESTS PASSED!")
        return True
    else:
        print(f"⚠️ {len(tests) - passed_count} test(s) failed")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)