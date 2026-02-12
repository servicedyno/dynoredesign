#!/usr/bin/env python3
"""
Backend Test Script for Auto-Convert Wallet Lookup + Binance 418 WAF User-Agent Fix

This script tests the specific implementations mentioned in the review request:
1. Backend health check
2. TypeScript compilation  
3. User-Agent headers in volatilityMonitorService.ts
4. User-Agent headers in binanceService.ts (should be >= 2)
5. Auto-convert wallet lookup logic
6. Available settlement options functionality

Base URL: http://localhost:8001
"""

import requests
import subprocess
import sys
import os

def run_test(test_name, test_func):
    """Run a test and report results"""
    print(f"\n🧪 TEST: {test_name}")
    print("-" * 50)
    try:
        result = test_func()
        if result:
            print(f"✅ PASSED: {test_name}")
            return True
        else:
            print(f"❌ FAILED: {test_name}")
            return False
    except Exception as e:
        print(f"❌ ERROR in {test_name}: {str(e)}")
        return False

def test_backend_health():
    """TEST 1: GET http://localhost:8001/health returns 200 with status 'healthy'"""
    response = requests.get("http://localhost:8001/health", timeout=10)
    data = response.json()
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {data}")
    
    if response.status_code == 200 and data.get("status") == "healthy":
        return True
    else:
        print(f"Expected status 'healthy', got: {data.get('status')}")
        return False

def test_typescript_compilation():
    """TEST 2: TypeScript compiles clean - cd /app/backend && npx tsc --noEmit exits 0"""
    os.chdir("/app/backend")
    result = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, text=True)
    
    print(f"Exit Code: {result.returncode}")
    if result.stdout:
        print(f"STDOUT: {result.stdout}")
    if result.stderr:
        print(f"STDERR: {result.stderr}")
    
    return result.returncode == 0

def test_volatility_service_user_agent():
    """TEST 3: User-Agent in volatility service"""
    result = subprocess.run(
        ["grep", "User-Agent", "/app/backend/services/volatilityMonitorService.ts"], 
        capture_output=True, text=True
    )
    
    print(f"Grep Exit Code: {result.returncode}")
    if result.stdout:
        print(f"Found User-Agent: {result.stdout.strip()}")
        return True
    else:
        print("No User-Agent header found in volatilityMonitorService.ts")
        return False

def test_binance_service_user_agent():
    """TEST 4: User-Agent in binance service - should be >= 2 occurrences"""
    result = subprocess.run(
        ["grep", "-c", "User-Agent", "/app/backend/services/binanceService.ts"], 
        capture_output=True, text=True
    )
    
    print(f"Grep Exit Code: {result.returncode}")
    if result.stdout:
        count = int(result.stdout.strip())
        print(f"User-Agent occurrences found: {count}")
        return count >= 2
    else:
        print("No User-Agent headers found in binanceService.ts")
        return False

def test_auto_convert_wallet_lookup():
    """TEST 5: Auto-convert wallet lookup logic"""
    patterns = ["mapSettlementToWalletType", "userWalletModel.findOne"]
    
    for pattern in patterns:
        result = subprocess.run(
            ["grep", pattern, "/app/backend/controller/companyController.ts"], 
            capture_output=True, text=True
        )
        
        print(f"Pattern '{pattern}' - Exit Code: {result.returncode}")
        if result.stdout:
            print(f"Found: {result.stdout.strip()}")
        else:
            print(f"Pattern '{pattern}' not found")
            return False
    
    print("All auto-convert wallet lookup patterns found")
    return True

def test_available_settlement_options():
    """TEST 6: Available options returned - grep 'available_settlement_options'"""
    result = subprocess.run(
        ["grep", "available_settlement_options", "/app/backend/controller/companyController.ts"], 
        capture_output=True, text=True
    )
    
    print(f"Grep Exit Code: {result.returncode}")
    if result.stdout:
        print(f"Found available_settlement_options: {result.stdout.strip()}")
        return True
    else:
        print("available_settlement_options field not found")
        return False

def main():
    """Run all tests"""
    print("=" * 80)
    print("BACKEND TESTING: Auto-Convert Wallet Lookup + Binance 418 WAF User-Agent Fix")
    print("=" * 80)
    
    tests = [
        ("Backend Health Check", test_backend_health),
        ("TypeScript Compilation", test_typescript_compilation),
        ("Volatility Service User-Agent", test_volatility_service_user_agent),
        ("Binance Service User-Agent Count", test_binance_service_user_agent),
        ("Auto-Convert Wallet Lookup Logic", test_auto_convert_wallet_lookup),
        ("Available Settlement Options", test_available_settlement_options),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        if run_test(test_name, test_func):
            passed += 1
    
    print("\n" + "=" * 80)
    print(f"RESULTS: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    print("=" * 80)
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Features are working correctly!")
        return 0
    else:
        print(f"❌ {total - passed} test(s) failed - Please check implementation")
        return 1

if __name__ == "__main__":
    sys.exit(main())