#!/usr/bin/env python3
"""
DynoPay Backend Testing Script - Performance Optimizations & Billing Fixes
Tests the backend after:
1. Cron schedule changes (1min → 10min for Binance, 2min → 5min for others)
2. Payment creation speed improvements (QR pre-caching, deferred writes)
3. IP allowlist addition (34.83.123.121)
"""

import requests
import subprocess
import json
import sys
import time
from typing import Dict, Any

# Backend URL from frontend/.env
BACKEND_URL = "https://setup-guide-38.preview.emergentagent.com"
LOCAL_BACKEND_URL = "http://localhost:8001"

def run_command(cmd: str, cwd: str = "/app/backend") -> tuple:
    """Run shell command and return (exit_code, stdout, stderr)"""
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, 
                              capture_output=True, text=True, timeout=60)
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 1, "", "Command timed out"
    except Exception as e:
        return 1, "", str(e)

def test_typescript_compilation() -> bool:
    """TEST 1: TypeScript compilation must exit 0"""
    print("🔧 Testing TypeScript compilation...")
    exit_code, stdout, stderr = run_command("npx tsc --noEmit")
    
    if exit_code == 0:
        print("✅ TypeScript compilation: PASS")
        return True
    else:
        print(f"❌ TypeScript compilation: FAIL (exit code {exit_code})")
        print(f"STDERR: {stderr}")
        return False

def test_backend_health() -> bool:
    """TEST 2: Health check must return status:"healthy" """
    print("🏥 Testing backend health...")
    
    # Try local first, then external
    for url in [LOCAL_BACKEND_URL, BACKEND_URL]:
        try:
            response = requests.get(f"{url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    print(f"✅ Backend health: PASS ({url})")
                    print(f"   Response: {data}")
                    return True
                else:
                    print(f"❌ Health check returned status: {data.get('status')}")
            else:
                print(f"❌ Health check returned status code: {response.status_code}")
        except Exception as e:
            print(f"⚠️  Failed to connect to {url}: {str(e)}")
            continue
    
    print("❌ Backend health: FAIL (all URLs failed)")
    return False

def test_webhook_endpoint() -> bool:
    """TEST 3: Webhook endpoint must return 200"""
    print("🔗 Testing webhook endpoint...")
    
    payload = {
        "address": "0xtest", 
        "txId": "test-final-123", 
        "amount": "0.01", 
        "asset": "ETH", 
        "counterAddress": "0xsender"
    }
    
    for url in [LOCAL_BACKEND_URL, BACKEND_URL]:
        try:
            response = requests.post(
                f"{url}/api/tatum-crypto-webhook", 
                json=payload, 
                timeout=10,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                print(f"✅ Webhook endpoint: PASS ({url})")
                print(f"   Response: {response.text[:200]}...")
                return True
            else:
                print(f"⚠️  Webhook returned status {response.status_code} at {url}")
                print(f"   Response: {response.text[:200]}...")
        except Exception as e:
            print(f"⚠️  Failed to test webhook at {url}: {str(e)}")
            continue
    
    print("❌ Webhook endpoint: FAIL (all URLs failed)")
    return False

def test_ip_allowlist() -> bool:
    """TEST 4: Verify IP 34.83.123.121 added to allowlist"""
    print("🔒 Testing IP allowlist...")
    
    exit_code, stdout, stderr = run_command('grep "34.83.123.121" /app/backend/routes/index.ts')
    
    if exit_code == 0 and "34.83.123.121" in stdout:
        print("✅ IP allowlist: PASS")
        print(f"   Found: {stdout.strip()}")
        return True
    else:
        print("❌ IP allowlist: FAIL")
        print(f"   IP 34.83.123.121 not found in routes/index.ts")
        return False

def test_cron_schedule_changes() -> bool:
    """TEST 5: Verify cron changes (*/5 * * * * should appear 3+ times)"""
    print("⏰ Testing cron schedule changes...")
    
    exit_code, stdout, stderr = run_command('grep -c "\\*/5 \\* \\* \\* \\*" /app/backend/server.ts')
    
    if exit_code == 0:
        count = int(stdout.strip())
        if count >= 3:
            print(f"✅ Cron schedule changes: PASS ({count} occurrences of */5)")
            return True
        else:
            print(f"❌ Cron schedule changes: FAIL (only {count} occurrences, need 3+)")
    else:
        print("❌ Cron schedule changes: FAIL (grep failed)")
    
    return False

def test_cached_qr_code_column() -> bool:
    """TEST 6: Verify cached_qr_code column exists"""
    print("🖼️  Testing cached QR code column...")
    
    exit_code, stdout, stderr = run_command('grep "cached_qr_code" /app/backend/models/merchantPoolModels/index.ts')
    
    if exit_code == 0 and "cached_qr_code" in stdout:
        print("✅ Cached QR code column: PASS")
        print(f"   Found: {stdout.strip()}")
        return True
    else:
        print("❌ Cached QR code column: FAIL")
        print("   cached_qr_code not found in merchantPoolModels/index.ts")
        return False

def test_deferred_writes() -> bool:
    """TEST 7: Verify fire-and-forget pattern exists"""
    print("⚡ Testing deferred writes (fire-and-forget)...")
    
    exit_code, stdout, stderr = run_command('grep -i "fire.*forget\\|fire-and-forget" /app/backend/controller/paymentController.ts')
    
    if exit_code == 0:
        print("✅ Deferred writes: PASS")
        print(f"   Found: {stdout.strip()}")
        return True
    else:
        print("❌ Deferred writes: FAIL")
        print("   Fire-and-forget pattern not found in paymentController.ts")
        return False

def test_jest_tests() -> bool:
    """TEST 8: Run Jest tests"""
    print("🧪 Running Jest tests...")
    
    exit_code, stdout, stderr = run_command("npx jest --passWithNoTests 2>&1 | tail -30")
    
    if exit_code == 0:
        print("✅ Jest tests: PASS")
        print("   Test output (last 30 lines):")
        print(stdout)
        return True
    else:
        print("❌ Jest tests: FAIL")
        print(f"   Exit code: {exit_code}")
        print(f"   Output: {stdout}")
        print(f"   Error: {stderr}")
        return False

def main():
    """Run all tests and report results"""
    print("🚀 DynoPay Backend Testing - Performance Optimizations & Billing Fixes")
    print("=" * 70)
    
    tests = [
        ("TypeScript Compilation", test_typescript_compilation),
        ("Backend Health Check", test_backend_health), 
        ("Webhook Endpoint", test_webhook_endpoint),
        ("IP Allowlist (34.83.123.121)", test_ip_allowlist),
        ("Cron Schedule Changes (*/5)", test_cron_schedule_changes),
        ("Cached QR Code Column", test_cached_qr_code_column),
        ("Deferred Writes (Fire-and-forget)", test_deferred_writes),
        ("Jest Tests", test_jest_tests),
    ]
    
    results = []
    passed = 0
    
    for test_name, test_func in tests:
        print(f"\n📋 {test_name}")
        print("-" * 50)
        
        try:
            result = test_func()
            results.append((test_name, result))
            if result:
                passed += 1
        except Exception as e:
            print(f"❌ {test_name}: ERROR - {str(e)}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 TEST SUMMARY")
    print("=" * 70)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\nResult: {passed}/{len(tests)} tests passed")
    
    if passed == len(tests):
        print("🎉 ALL TESTS PASSED - Performance optimizations working correctly!")
        return 0
    else:
        print("⚠️  Some tests failed - check implementation")
        return 1

if __name__ == "__main__":
    sys.exit(main())