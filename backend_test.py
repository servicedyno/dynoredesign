#!/usr/bin/env python3
"""
Backend testing script for P1/P2 Performance Optimization verification.
Tests webhook receiver parallelization, KYC optimization, cached wallet validation,
pre-reserved address pool, and request rate caching.
"""

import subprocess
import sys
import requests
import time
import json
import re

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def log_test(test_name, status, details=""):
    """Log test results with colors."""
    if status == "PASS":
        print(f"{Colors.GREEN}✅ TEST {test_name}: PASS{Colors.END}")
    elif status == "FAIL":
        print(f"{Colors.RED}❌ TEST {test_name}: FAIL{Colors.END}")
    else:
        print(f"{Colors.YELLOW}⚠️ TEST {test_name}: {status}{Colors.END}")
    
    if details:
        print(f"   {details}")

def run_command(cmd, capture_output=True, timeout=60):
    """Run a shell command and return the result."""
    try:
        if capture_output:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
            return result.returncode, result.stdout, result.stderr
        else:
            result = subprocess.run(cmd, shell=True, timeout=timeout)
            return result.returncode, "", ""
    except subprocess.TimeoutExpired:
        return -1, "", f"Command timed out after {timeout} seconds"
    except Exception as e:
        return -1, "", str(e)

def test_backend_health():
    """TEST 1: Backend healthy after all changes"""
    try:
        response = requests.get("http://localhost:8001/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                log_test("1", "PASS", "Backend is healthy and operational")
                return True
            else:
                log_test("1", "FAIL", f"Backend status: {data.get('status', 'unknown')}")
                return False
        else:
            log_test("1", "FAIL", f"HTTP {response.status_code}")
            return False
    except Exception as e:
        log_test("1", "FAIL", f"Connection error: {e}")
        return False

def test_typescript_compilation():
    """TEST 2: TypeScript compiles clean"""
    print(f"{Colors.BLUE}Running TypeScript compilation check...{Colors.END}")
    
    code, stdout, stderr = run_command("cd /app/backend && npx tsc --noEmit --skipLibCheck")
    
    if code == 0:
        log_test("2", "PASS", "TypeScript compiles cleanly")
        return True
    else:
        log_test("2", "FAIL", f"Compilation errors:\n{stderr}")
        return False

def test_webhook_parallelization():
    """TEST 3: P2 — Webhook receiver parallelization"""
    webhook_file = "/app/backend/webhooks/index.ts"
    
    try:
        with open(webhook_file, 'r') as f:
            content = f.read()
        
        # Test 3a: Check for Promise.all with all 3 Redis reads
        promise_all_pattern = r"const\s+\[.*alreadyReceived.*alreadyProcessed.*isOutgoingTx.*\]\s*=\s*await\s+Promise\.all"
        if not re.search(promise_all_pattern, content, re.DOTALL):
            log_test("3a", "FAIL", "Promise.all not found for 3 Redis reads")
            return False
        
        # Test 3b: Check for fire-and-forget setRedisItemWithTTL with .catch()
        fire_forget_pattern = r"setRedisItemWithTTL.*receiverDedupKey.*\.catch\("
        if not re.search(fire_forget_pattern, content, re.DOTALL):
            log_test("3b", "FAIL", "Fire-and-forget setRedisItemWithTTL with .catch() not found")
            return False
        
        # Test 3c: Check that setRedisItemWithTTL is NOT awaited
        await_pattern = r"await\s+setRedisItemWithTTL.*receiverDedupKey"
        if re.search(await_pattern, content):
            log_test("3c", "FAIL", "setRedisItemWithTTL is being awaited (should be fire-and-forget)")
            return False
        
        log_test("3", "PASS", "Webhook receiver parallelization verified - Promise.all + fire-and-forget dedup")
        return True
        
    except Exception as e:
        log_test("3", "FAIL", f"Error checking webhook file: {e}")
        return False

def test_parallel_kyc():
    """TEST 4: P1 Fix 1 — Parallel KYC"""
    controller_file = "/app/backend/controller/paymentController.ts"
    
    try:
        with open(controller_file, 'r') as f:
            content = f.read()
        
        # Test 4a: Check KYC promise is started early
        kyc_promise_pattern = r"const\s+kycPromise\s*=\s*merchantUserId\s*\?\s*checkKycEnforcement"
        if not re.search(kyc_promise_pattern, content):
            log_test("4a", "FAIL", "KYC promise not started immediately")
            return False
        
        # Test 4b: Check KYC is awaited later (after validation checks)
        kyc_await_pattern = r"const\s+kycResult\s*=\s*await\s+kycPromise"
        if not re.search(kyc_await_pattern, content):
            log_test("4b", "FAIL", "KYC promise not awaited later")
            return False
        
        # Test 4c: Check timing - await should be after expiry/currency checks
        # Look for the pattern where kycResult = await kycPromise comes after other validation
        parts = content.split("const kycResult = await kycPromise")
        if len(parts) < 2:
            log_test("4c", "FAIL", "KYC await pattern not found")
            return False
        
        before_await = parts[0]
        # Check that expiry and currency validation happen before the await
        if "expires_at" not in before_await or "currencyAliasMap" not in before_await:
            log_test("4c", "FAIL", "KYC not awaited after validation checks")
            return False
        
        log_test("4", "PASS", "Parallel KYC implementation verified - started early, awaited after validation")
        return True
        
    except Exception as e:
        log_test("4", "FAIL", f"Error checking controller file: {e}")
        return False

def test_cached_wallet_validation():
    """TEST 5: P1 Fix 2 — Cached wallet validation"""
    controller_file = "/app/backend/controller/paymentController.ts"
    
    try:
        with open(controller_file, 'r') as f:
            content = f.read()
        
        # Test 5a: Check walletCacheKey format
        cache_key_pattern = r"walletCacheKey\s*=\s*`wallet-cache:\$\{userId\}:\$\{requestedCurrency\}:\$\{.*\}`"
        if not re.search(cache_key_pattern, content):
            log_test("5a", "FAIL", "walletCacheKey format not correct")
            return False
        
        # Test 5b: Check Redis cache lookup before DB query
        cache_lookup_pattern = r"getRedisItem\(walletCacheKey\)"
        if not re.search(cache_lookup_pattern, content):
            log_test("5b", "FAIL", "Redis cache lookup not found")
            return False
        
        # Test 5c: Check cache TTLs (300s positive, 60s negative)
        positive_cache_pattern = r"setRedisItemWithTTL.*300.*\.catch"
        negative_cache_pattern = r"setRedisItemWithTTL.*60.*\.catch"
        if not re.search(positive_cache_pattern, content):
            log_test("5c", "FAIL", "300s positive cache TTL not found")
            return False
        if not re.search(negative_cache_pattern, content):
            log_test("5c", "FAIL", "60s negative cache TTL not found")
            return False
        
        # Test 5d: Check _walletFound flag
        wallet_found_pattern = r"_walletFound"
        if not re.search(wallet_found_pattern, content):
            log_test("5d", "FAIL", "_walletFound flag not found")
            return False
        
        log_test("5", "PASS", "Cached wallet validation verified - proper cache keys, TTLs, and flags")
        return True
        
    except Exception as e:
        log_test("5", "FAIL", f"Error checking wallet validation: {e}")
        return False

def test_pre_reserved_pool():
    """TEST 6: P1 Fix 3 — Pre-reserved warm pool"""
    reservation_file = "/app/backend/services/merchantPool/merchantPoolReservation.ts"
    server_file = "/app/backend/server.ts"
    
    try:
        # Test 6a: Check preWarmAddressPool and replenishPreReservedPool exports
        with open(reservation_file, 'r') as f:
            reservation_content = f.read()
        
        if "export const preWarmAddressPool" not in reservation_content:
            log_test("6a", "FAIL", "preWarmAddressPool not exported")
            return False
        if "export const replenishPreReservedPool" not in reservation_content:
            log_test("6a", "FAIL", "replenishPreReservedPool not exported") 
            return False
        
        # Test 6b: Check fast path for PRE_RESERVED status
        pre_reserved_pattern = r'status:\s*"PRE_RESERVED"'
        if not re.search(pre_reserved_pattern, reservation_content):
            log_test("6b", "FAIL", "PRE_RESERVED status check not found")
            return False
        
        # Test 6c: Check optimistic lock pattern
        optimistic_lock_pattern = r"status.*PRE_RESERVED.*Optimistic lock"
        if not re.search(optimistic_lock_pattern, reservation_content, re.DOTALL):
            log_test("6c", "FAIL", "Optimistic lock pattern not found")
            return False
        
        # Test 6d: Check fire-and-forget replenishment
        fire_forget_replenish = r"replenishPreReservedPool.*\.catch"
        if not re.search(fire_forget_replenish, reservation_content):
            log_test("6d", "FAIL", "Fire-and-forget replenishment not found")
            return False
        
        # Test 6e: Check cron schedule in server.ts
        with open(server_file, 'r') as f:
            server_content = f.read()
        
        cron_pattern = r'cron\.schedule\(".*\*/2.*\*.*\*.*\*.*\*".*preWarmAddressPool'
        if not re.search(cron_pattern, server_content, re.DOTALL):
            log_test("6e", "FAIL", "*/2 cron schedule for preWarmAddressPool not found")
            return False
        
        # Test 6f: Check PRE_RESERVE_TARGET = 2
        target_pattern = r"PRE_RESERVE_TARGET\s*=\s*2"
        if not re.search(target_pattern, reservation_content):
            log_test("6f", "FAIL", "PRE_RESERVE_TARGET = 2 not found")
            return False
        
        log_test("6", "PASS", "Pre-reserved warm pool verified - exports, fast path, cron, target=2")
        return True
        
    except Exception as e:
        log_test("6", "FAIL", f"Error checking pre-reserved pool: {e}")
        return False

def test_rate_cache():
    """TEST 7: P1 Fix 4 — Rate cache"""
    currency_file = "/app/backend/helper/currencyConvert.ts"
    
    try:
        with open(currency_file, 'r') as f:
            content = f.read()
        
        # Test 7a: Check requestRateCache Map with 30s TTL
        cache_map_pattern = r"requestRateCache\s*=\s*new\s+Map"
        ttl_pattern = r"REQUEST_RATE_CACHE_TTL_MS\s*=\s*30.*1000"
        if not re.search(cache_map_pattern, content):
            log_test("7a", "FAIL", "requestRateCache Map not found")
            return False
        if not re.search(ttl_pattern, content):
            log_test("7a", "FAIL", "30s TTL not found")
            return False
        
        # Test 7b: Check getCachedRequestRate called before external APIs
        get_cached_pattern = r"getCachedRequestRate\(source,\s*currentCurrency\)"
        if not re.search(get_cached_pattern, content):
            log_test("7b", "FAIL", "getCachedRequestRate call not found")
            return False
        
        # Test 7c: Check setCachedRequestRate called after rate resolved
        set_cached_pattern = r"setCachedRequestRate\(source,\s*currentCurrency,\s*rate\)"
        if not re.search(set_cached_pattern, content):
            log_test("7c", "FAIL", "setCachedRequestRate call not found")
            return False
        
        # Test 7d: Check that cache is checked before external API calls
        # Look for the order: getCachedRequestRate -> rate strategies
        cache_check_pattern = r"cachedRate\s*=\s*getCachedRequestRate\(source,\s*currentCurrency\)"
        if not re.search(cache_check_pattern, content):
            log_test("7d", "FAIL", "Cache check pattern not found")
            return False
        
        # Verify cache check happens before external API strategies
        if content.find("getCachedRequestRate(source, currentCurrency)") > content.find("getFastForexRate"):
            log_test("7d", "FAIL", "Cache check not before external APIs")
            return False
        
        log_test("7", "PASS", "Rate cache verified - 30s TTL, get/set functions, proper ordering")
        return True
        
    except Exception as e:
        log_test("7", "FAIL", f"Error checking rate cache: {e}")
        return False

def test_jest_tests():
    """TEST 8: All tests pass"""
    print(f"{Colors.BLUE}Running Jest tests...{Colors.END}")
    
    code, stdout, stderr = run_command(
        "cd /app/backend && npx jest --forceExit --testPathPatterns=\"paymentStateMachine|webhookProcessor|webhookHandler\"",
        timeout=120
    )
    
    if code == 0:
        # Extract test results
        if "207 passed" in stdout:
            log_test("8", "PASS", "All 207 tests passed")
            return True
        else:
            # Try to extract actual numbers
            passed_match = re.search(r"(\d+) passed", stdout)
            if passed_match:
                passed_count = passed_match.group(1)
                log_test("8", "PASS", f"{passed_count} tests passed")
                return True
            else:
                log_test("8", "PASS", "Tests passed (count not extracted)")
                return True
    else:
        log_test("8", "FAIL", f"Jest tests failed: {stderr}")
        return False

def main():
    """Run all performance optimization tests."""
    print(f"{Colors.BOLD}P1/P2 PERFORMANCE OPTIMIZATION TESTING{Colors.END}")
    print(f"{Colors.BOLD}Testing DynoPay backend performance improvements{Colors.END}\n")
    
    test_results = []
    
    # Run all tests in sequence
    tests = [
        ("Backend Health", test_backend_health),
        ("TypeScript Compilation", test_typescript_compilation), 
        ("P2 Webhook Parallelization", test_webhook_parallelization),
        ("P1 Fix 1: Parallel KYC", test_parallel_kyc),
        ("P1 Fix 2: Cached Wallet Validation", test_cached_wallet_validation),
        ("P1 Fix 3: Pre-reserved Warm Pool", test_pre_reserved_pool),
        ("P1 Fix 4: Rate Cache", test_rate_cache),
        ("Jest Tests", test_jest_tests),
    ]
    
    for test_name, test_func in tests:
        print(f"\n{Colors.BLUE}Running {test_name}...{Colors.END}")
        result = test_func()
        test_results.append(result)
        time.sleep(0.5)  # Brief pause between tests
    
    # Summary
    print(f"\n{Colors.BOLD}=== TEST SUMMARY ==={Colors.END}")
    passed = sum(test_results)
    total = len(test_results)
    
    print(f"Tests passed: {Colors.GREEN}{passed}{Colors.END}/{total}")
    print(f"Success rate: {Colors.GREEN}{passed/total*100:.1f}%{Colors.END}")
    
    if passed == total:
        print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 ALL P1/P2 PERFORMANCE OPTIMIZATIONS VERIFIED SUCCESSFULLY!{Colors.END}")
        print(f"{Colors.GREEN}Payment creation and webhook receiver optimizations are operational.{Colors.END}")
    else:
        print(f"\n{Colors.YELLOW}⚠️ Some tests failed. Please review the implementation.{Colors.END}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())