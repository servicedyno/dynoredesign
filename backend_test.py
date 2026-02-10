#!/usr/bin/env python3
"""
Backend testing for XRP/RLUSD Destination Tag Gap Fixes
Testing Agent for DynoPay Crypto Payment System
"""

import requests
import subprocess
import sys
import os
import json

# Base URL from frontend/.env REACT_APP_BACKEND_URL
BASE_URL = "https://gas-fee-alerts.preview.emergentagent.com"

def test_backend_health():
    """TEST 1: Backend health check"""
    print("=== TEST 1: Backend Health Check ===")
    try:
        response = requests.get(f"{BASE_URL}/api/status/health", timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ TEST 1 PASSED: Backend health check successful")
            return True
        else:
            print(f"❌ TEST 1 FAILED: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 1 FAILED: Exception occurred - {str(e)}")
        return False

def test_typescript_compilation():
    """TEST 2: TypeScript compilation"""
    print("\n=== TEST 2: TypeScript Compilation ===")
    try:
        # Change to backend directory and run tsc --noEmit
        result = subprocess.run(
            ["npx", "tsc", "--noEmit"], 
            cwd="/app/backend",
            capture_output=True, 
            text=True,
            timeout=60
        )
        
        print(f"Exit code: {result.returncode}")
        if result.stdout:
            print(f"Stdout: {result.stdout}")
        if result.stderr:
            print(f"Stderr: {result.stderr}")
            
        if result.returncode == 0:
            print("✅ TEST 2 PASSED: TypeScript compilation successful")
            return True
        else:
            print(f"❌ TEST 2 FAILED: TypeScript compilation failed with exit code {result.returncode}")
            return False
    except Exception as e:
        print(f"❌ TEST 2 FAILED: Exception occurred - {str(e)}")
        return False

def test_merchant_api_destination_tag():
    """TEST 3: Merchant API has destination_tag"""
    print("\n=== TEST 3: Merchant API destination_tag References ===")
    try:
        result = subprocess.run(
            ["grep", "-c", "destination_tag", "/app/backend/routes/merchantApiRouter.ts"],
            capture_output=True, text=True, timeout=10
        )
        
        count = int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
        print(f"destination_tag occurrences found: {count}")
        
        if count >= 2:
            print("✅ TEST 3 PASSED: Merchant API has sufficient destination_tag references")
            return True
        else:
            print(f"❌ TEST 3 FAILED: Expected >= 2, found {count}")
            return False
    except Exception as e:
        print(f"❌ TEST 3 FAILED: Exception occurred - {str(e)}")
        return False

def test_payment_controller_destination_tag():
    """TEST 4: Payment controller has many destination_tag references"""
    print("\n=== TEST 4: Payment Controller destination_tag References ===")
    try:
        result = subprocess.run(
            ["grep", "-c", "destination_tag", "/app/backend/controller/paymentController.ts"],
            capture_output=True, text=True, timeout=10
        )
        
        count = int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
        print(f"destination_tag occurrences found: {count}")
        
        if count >= 20:
            print("✅ TEST 4 PASSED: Payment controller has sufficient destination_tag references")
            return True
        else:
            print(f"❌ TEST 4 FAILED: Expected >= 20, found {count}")
            return False
    except Exception as e:
        print(f"❌ TEST 4 FAILED: Exception occurred - {str(e)}")
        return False

def test_redis_payment_payloads():
    """TEST 5: destination_tag in Redis payment payloads"""
    print("\n=== TEST 5: Redis Payment Payloads with destination_tag ===")
    try:
        result = subprocess.run(
            ["grep", "destination_tag.*paymentRes", "/app/backend/controller/paymentController.ts"],
            capture_output=True, text=True, timeout=10
        )
        
        matches = result.stdout.strip()
        print(f"Matches found:\n{matches}")
        
        if matches:
            print("✅ TEST 5 PASSED: destination_tag found in Redis payment payloads")
            return True
        else:
            print("❌ TEST 5 FAILED: No destination_tag.*paymentRes patterns found")
            return False
    except Exception as e:
        print(f"❌ TEST 5 FAILED: Exception occurred - {str(e)}")
        return False

def test_qr_code_dt_param():
    """TEST 6: QR code for incomplete payments includes tag"""
    print("\n=== TEST 6: QR Code with dt= Parameter ===")
    try:
        result = subprocess.run(
            ["grep", "dt=", "/app/backend/controller/paymentController.ts"],
            capture_output=True, text=True, timeout=10
        )
        
        matches = result.stdout.strip()
        print(f"Matches found:\n{matches}")
        
        if matches:
            print("✅ TEST 6 PASSED: QR code includes dt= parameter for destination tag")
            return True
        else:
            print("❌ TEST 6 FAILED: No dt= patterns found in QR payload")
            return False
    except Exception as e:
        print(f"❌ TEST 6 FAILED: Exception occurred - {str(e)}")
        return False

def test_incomplete_payment_data_interface():
    """TEST 7: IncompletePaymentData interface has destination_tag"""
    print("\n=== TEST 7: IncompletePaymentData Interface ===")
    try:
        result = subprocess.run(
            ["grep", "-A8", "interface IncompletePaymentData", "/app/backend/controller/paymentController.ts"],
            capture_output=True, text=True, timeout=10
        )
        
        interface_definition = result.stdout.strip()
        print(f"Interface definition:\n{interface_definition}")
        
        if "destination_tag" in interface_definition:
            print("✅ TEST 7 PASSED: IncompletePaymentData interface includes destination_tag field")
            return True
        else:
            print("❌ TEST 7 FAILED: destination_tag field not found in interface")
            return False
    except Exception as e:
        print(f"❌ TEST 7 FAILED: Exception occurred - {str(e)}")
        return False

def main():
    """Run all tests and provide summary"""
    print("🚀 STARTING XRP/RLUSD DESTINATION TAG GAP FIXES TESTING")
    print("=" * 60)
    
    tests = [
        ("Backend Health", test_backend_health),
        ("TypeScript Compilation", test_typescript_compilation),
        ("Merchant API destination_tag", test_merchant_api_destination_tag),
        ("Payment Controller destination_tag", test_payment_controller_destination_tag),
        ("Redis Payment Payloads", test_redis_payment_payloads),
        ("QR Code dt= Parameter", test_qr_code_dt_param),
        ("IncompletePaymentData Interface", test_incomplete_payment_data_interface),
    ]
    
    results = []
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
            if result:
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ {test_name} FAILED with exception: {str(e)}")
            results.append((test_name, False))
            failed += 1
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TESTING SUMMARY")
    print("=" * 60)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\nTOTAL: {passed} passed, {failed} failed ({passed}/{len(tests)})")
    success_rate = (passed / len(tests)) * 100
    print(f"SUCCESS RATE: {success_rate:.1f}%")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED! XRP/RLUSD Destination Tag Gap Fixes are working correctly.")
        return 0
    else:
        print(f"\n⚠️  {failed} TEST(S) FAILED - Issues need to be addressed.")
        return 1

if __name__ == "__main__":
    sys.exit(main())