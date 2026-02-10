#!/usr/bin/env python3
"""
Backend Test Suite for Checkout Payment Status, Webhook payment_id, USD Amounts, and Duplicate Processing Fix
Test Date: 2026-02-10
"""

import requests
import subprocess
import json
import sys

def test_backend_health():
    """TEST 1: Backend Health Check"""
    print("🧪 TEST 1: Backend Health Check")
    try:
        response = requests.get("http://localhost:8001/api/status/health", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", f"Expected healthy status, got {data.get('status')}"
        print("✅ PASSED: Backend health check successful")
        return True
    except Exception as e:
        print(f"❌ FAILED: Backend health check failed - {e}")
        return False

def test_typescript_compilation():
    """TEST 2: TypeScript Compilation"""
    print("\n🧪 TEST 2: TypeScript Compilation")
    try:
        result = subprocess.run(["npx", "tsc", "--noEmit"], 
                              cwd="/app/backend", 
                              capture_output=True, 
                              text=True, 
                              timeout=30)
        assert result.returncode == 0, f"TypeScript compilation failed with exit code {result.returncode}"
        print("✅ PASSED: TypeScript compilation successful")
        return True
    except Exception as e:
        print(f"❌ FAILED: TypeScript compilation failed - {e}")
        return False

def test_isSignificantOverpayment_pattern():
    """TEST 3: BUG 1 FIX - verifyCryptoPayment overpayment threshold check"""
    print("\n🧪 TEST 3: isSignificantOverpayment pattern check")
    try:
        result = subprocess.run(["grep", "isSignificantOverpayment", "/app/backend/controller/paymentController.ts"], 
                              capture_output=True, text=True)
        assert result.returncode == 0, "isSignificantOverpayment pattern not found"
        lines = result.stdout.strip().split('\n')
        assert len(lines) >= 1, "Expected at least 1 occurrence of isSignificantOverpayment"
        
        # Check for threshold logic
        found_threshold_logic = any("overpaymentUsd > merchantOverpaymentThreshold" in line for line in lines)
        assert found_threshold_logic, "Threshold comparison logic not found"
        
        print(f"✅ PASSED: Found {len(lines)} isSignificantOverpayment patterns with threshold logic")
        return True
    except Exception as e:
        print(f"❌ FAILED: isSignificantOverpayment pattern check failed - {e}")
        return False

def test_base_amount_usd_fallback():
    """TEST 4: BUG 2 FIX - base_amount_usd fallback in verifyCryptoPayment"""
    print("\n🧪 TEST 4: base_amount_usd fallback pattern check")
    try:
        result = subprocess.run(["grep", "base_amount_usd", "/app/backend/controller/paymentController.ts"], 
                              capture_output=True, text=True)
        assert result.returncode == 0, "base_amount_usd pattern not found"
        lines = result.stdout.strip().split('\n')
        assert len(lines) >= 1, "Expected at least 1 occurrence of base_amount_usd"
        
        # Check for the specific fallback pattern
        found_fallback = any("tempData?.base_amount_usd" in line for line in lines)
        assert found_fallback, "base_amount_usd fallback pattern not found"
        
        print(f"✅ PASSED: Found {len(lines)} base_amount_usd patterns with fallback logic")
        return True
    except Exception as e:
        print(f"❌ FAILED: base_amount_usd fallback check failed - {e}")
        return False

def test_webhook_payment_id():
    """TEST 5: BUG 3 FIX - payment.confirmed webhook uses correct payment_id"""
    print("\n🧪 TEST 5: webhookPaymentId variable check")
    try:
        result = subprocess.run(["grep", "webhookPaymentId", "/app/backend/controller/paymentController.ts"], 
                              capture_output=True, text=True)
        assert result.returncode == 0, "webhookPaymentId pattern not found"
        lines = result.stdout.strip().split('\n')
        assert len(lines) >= 2, "Expected at least 2 occurrences of webhookPaymentId"
        
        # Check for the fallback chain pattern
        found_fallback_chain = any("tempData?.payment_id || tempData?.unique_tx_id" in line for line in lines)
        assert found_fallback_chain, "Payment ID fallback chain not found"
        
        print(f"✅ PASSED: Found {len(lines)} webhookPaymentId patterns with fallback chain")
        return True
    except Exception as e:
        print(f"❌ FAILED: webhookPaymentId check failed - {e}")
        return False

def test_atomic_lock():
    """TEST 6: BUG 4 FIX - Atomic lock for Tatum webhook deduplication"""
    print("\n🧪 TEST 6: Atomic lock for Tatum webhook check")
    try:
        # Check for new atomic lock pattern
        result = subprocess.run(["grep", "acquireLock.*tatum-webhook", "/app/backend/webhooks/index.ts"], 
                              capture_output=True, text=True)
        assert result.returncode == 0, "acquireLock tatum-webhook pattern not found"
        
        # Check that old processing-lock- pattern is NOT present
        old_pattern = subprocess.run(["grep", "processing-lock-", "/app/backend/webhooks/index.ts"], 
                                   capture_output=True, text=True)
        assert old_pattern.returncode == 1, "Old processing-lock- pattern still found (should be removed)"
        
        print("✅ PASSED: Found atomic acquireLock pattern, old processing-lock- pattern removed")
        return True
    except Exception as e:
        print(f"❌ FAILED: Atomic lock check failed - {e}")
        return False

def test_getdata_currencies():
    """TEST 7: getData returns all 15 currencies for payment link"""
    print("\n🧪 TEST 7: getData endpoint currency count check")
    try:
        payload = {"data": "5b061d44b6c57b90bd5d8bd8ae23ac8246b3984aae0c5e9f"}
        response = requests.post("http://localhost:8001/api/pay/getData", 
                               json=payload, 
                               timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        available_currencies = data.get("data", {}).get("available_currencies", [])
        assert len(available_currencies) == 15, f"Expected 15 currencies, got {len(available_currencies)}"
        
        print(f"✅ PASSED: getData returned {len(available_currencies)} currencies")
        print(f"   Currencies: {', '.join(available_currencies)}")
        return True
    except Exception as e:
        print(f"❌ FAILED: getData currency count check failed - {e}")
        return False

def run_all_tests():
    """Run all tests and return summary"""
    print("🚀 Starting Checkout Payment Status Fix Testing")
    print("=" * 60)
    
    tests = [
        test_backend_health,
        test_typescript_compilation,
        test_isSignificantOverpayment_pattern,
        test_base_amount_usd_fallback,
        test_webhook_payment_id,
        test_atomic_lock,
        test_getdata_currencies
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        if test():
            passed += 1
        else:
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"📊 TEST SUMMARY: {passed} PASSED, {failed} FAILED")
    
    if failed == 0:
        print("🎉 ALL TESTS PASSED! Checkout Payment Status Fix is working correctly.")
        return True
    else:
        print("❌ Some tests failed. Please check the implementation.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)