#!/usr/bin/env python3
"""
Test script for XRP/RLUSD destination_tag verification
Testing all 6 requirements from review request
"""

import requests
import subprocess
import sys

def test_backend_health():
    """TEST 1: Backend health check"""
    try:
        response = requests.get("http://localhost:8001/api/status/health")
        if response.status_code == 200 and "healthy" in response.text:
            print("✅ TEST 1 - Backend Health: PASSED (200 with 'healthy')")
            return True
        else:
            print(f"❌ TEST 1 - Backend Health: FAILED ({response.status_code})")
            return False
    except Exception as e:
        print(f"❌ TEST 1 - Backend Health: FAILED ({str(e)})")
        return False

def test_typescript_compilation():
    """TEST 2: TypeScript compilation"""
    try:
        result = subprocess.run(
            ["npx", "tsc", "--noEmit"], 
            cwd="/app/backend", 
            capture_output=True, 
            text=True
        )
        if result.returncode == 0:
            print("✅ TEST 2 - TypeScript Compilation: PASSED (exit code 0)")
            return True
        else:
            print(f"❌ TEST 2 - TypeScript Compilation: FAILED (exit code {result.returncode})")
            print(f"STDERR: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ TEST 2 - TypeScript Compilation: FAILED ({str(e)})")
        return False

def test_waiting_response_destination_tag():
    """TEST 3: destination_tag in verifyCryptoPayment 'waiting' response"""
    try:
        result = subprocess.run(
            ["grep", "-A5", 'status: "waiting"', "/app/backend/controller/paymentController.ts"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0 and "destination_tag" in result.stdout:
            print("✅ TEST 3 - Waiting Response destination_tag: PASSED")
            print("  Found destination_tag line after status: 'waiting'")
            return True
        else:
            print("❌ TEST 3 - Waiting Response destination_tag: FAILED")
            print(f"  Output: {result.stdout}")
            return False
    except Exception as e:
        print(f"❌ TEST 3 - Waiting Response destination_tag: FAILED ({str(e)})")
        return False

def test_destination_tag_count():
    """TEST 4: Count destination_tag patterns in verifyCryptoPayment"""
    try:
        result = subprocess.run(
            ["grep", "-c", "tempData.*destination_tag.*destination_tag.*Number", "/app/backend/controller/paymentController.ts"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            count = int(result.stdout.strip())
            if count >= 6:
                print(f"✅ TEST 4 - destination_tag Count: PASSED ({count} occurrences >= 6 required)")
                return True
            else:
                print(f"❌ TEST 4 - destination_tag Count: FAILED ({count} occurrences < 6 required)")
                return False
        else:
            print("❌ TEST 4 - destination_tag Count: FAILED (grep returned error)")
            return False
    except Exception as e:
        print(f"❌ TEST 4 - destination_tag Count: FAILED ({str(e)})")
        return False

def test_phase12_existing_address():
    """TEST 5: destination_tag in Phase 12.1 existing address return"""
    try:
        result = subprocess.run(
            ["grep", "existingDestTag.*destination_tag", "/app/backend/controller/paymentController.ts"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print("✅ TEST 5 - Phase 12.1 Existing Address: PASSED")
            print(f"  Found: {result.stdout.strip()}")
            return True
        else:
            print("❌ TEST 5 - Phase 12.1 Existing Address: FAILED")
            return False
    except Exception as e:
        print(f"❌ TEST 5 - Phase 12.1 Existing Address: FAILED ({str(e)})")
        return False

def test_crypto_function_destination_tag():
    """TEST 6: Crypto function returns destination_tag"""
    try:
        result = subprocess.run(
            ["grep", "destination_tag: destinationTag", "/app/backend/controller/paymentController.ts"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print("✅ TEST 6 - Crypto Function Return: PASSED")
            print(f"  Found: {result.stdout.strip()}")
            return True
        else:
            print("❌ TEST 6 - Crypto Function Return: FAILED")
            return False
    except Exception as e:
        print(f"❌ TEST 6 - Crypto Function Return: FAILED ({str(e)})")
        return False

def main():
    """Run all 6 tests and provide summary"""
    print("=" * 60)
    print("XRP/RLUSD DESTINATION_TAG VERIFICATION TESTS")
    print("=" * 60)
    
    tests = [
        test_backend_health,
        test_typescript_compilation,
        test_waiting_response_destination_tag,
        test_destination_tag_count,
        test_phase12_existing_address,
        test_crypto_function_destination_tag
    ]
    
    results = []
    for i, test_func in enumerate(tests, 1):
        print(f"\nRunning Test {i}:")
        results.append(test_func())
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(results)
    total = len(results)
    
    for i, result in enumerate(results, 1):
        status = "PASS" if result else "FAIL"
        print(f"Test {i}: {status}")
    
    print(f"\nOverall Result: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - XRP/RLUSD destination_tag implementation is working correctly!")
        return True
    else:
        print(f"⚠️  {total - passed} test(s) failed - implementation needs attention")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)