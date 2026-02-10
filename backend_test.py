#!/usr/bin/env python3

"""
Backend Test for "Fix 7 Backend Log Issues" Task
Tests 1-9 from the review request covering BCH pageSize, TrustLine backoff, 
FastForex crypto skip, Stale orphan caching, CoinGecko rate-limit, Lock contention, Tatum 403 noise
"""

import requests
import subprocess
import sys
import os
import re

BASE_URL = "http://localhost:8001"

def run_command(command, cwd=None):
    """Run a shell command and return (stdout, stderr, exit_code)"""
    try:
        result = subprocess.run(
            command, 
            shell=True, 
            capture_output=True, 
            text=True,
            cwd=cwd,
            timeout=30
        )
        return result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        return "", "Command timed out", 1
    except Exception as e:
        return "", str(e), 1

def search_file(file_path, pattern, exclude_comments=False):
    """Search for pattern in file, optionally excluding comments"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        lines = content.split('\n')
        matches = []
        
        for i, line in enumerate(lines, 1):
            if exclude_comments and line.strip().startswith('//'):
                continue
            if re.search(pattern, line):
                matches.append((i, line.strip()))
        
        return len(matches), matches
    except Exception as e:
        return 0, []

def test_1_backend_health():
    """TEST 1: GET /api/status/health returns 200"""
    print("🔍 TEST 1: Backend Health Check")
    try:
        response = requests.get(f"{BASE_URL}/api/status/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Backend healthy: {response.status_code} - {data.get('status', 'unknown')}")
            return True
        else:
            print(f"❌ Backend unhealthy: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_2_typescript_compilation():
    """TEST 2: TypeScript compiles clean"""
    print("\n🔍 TEST 2: TypeScript Compilation")
    stdout, stderr, exit_code = run_command("npx tsc --noEmit", cwd="/app/backend")
    
    if exit_code == 0:
        print("✅ TypeScript compilation successful (0 errors)")
        return True
    else:
        print(f"❌ TypeScript compilation failed (exit code: {exit_code})")
        if stderr:
            print(f"Errors: {stderr[:500]}")
        return False

def test_3_bch_direct_http():
    """TEST 3: BCH direct HTTP - no bchGetTxByAddress calls remaining, 2 matches for bcash/transaction/address"""
    print("\n🔍 TEST 3: BCH Direct HTTP Implementation")
    
    # Check no bchGetTxByAddress calls remaining (excluding comments)
    bch_sdk_count, bch_matches = search_file("/app/backend/apis/tatumApi.ts", r"bchGetTxByAddress", exclude_comments=True)
    
    # Check bcash/transaction/address direct HTTP calls
    bcash_count, bcash_matches = search_file("/app/backend/apis/tatumApi.ts", r"bcash/transaction/address")
    
    print(f"bchGetTxByAddress calls (non-comment): {bch_sdk_count}")
    if bch_matches:
        print("Found bchGetTxByAddress calls:")
        for line_num, line in bch_matches[:3]:
            print(f"  Line {line_num}: {line[:100]}")
    
    print(f"bcash/transaction/address calls: {bcash_count}")
    if bcash_matches:
        print("Found bcash/transaction/address calls:")
        for line_num, line in bcash_matches:
            print(f"  Line {line_num}: {line[:100]}")
    
    # Check pageSize parameter in direct HTTP calls
    pagesize_count, pagesize_matches = search_file("/app/backend/apis/tatumApi.ts", r"pageSize.*skip")
    print(f"pageSize.*skip patterns: {pagesize_count}")
    
    success = (bch_sdk_count == 0) and (bcash_count >= 2) and (pagesize_count >= 1)
    
    if success:
        print("✅ BCH direct HTTP implementation correct")
    else:
        print("❌ BCH direct HTTP implementation issues found")
    
    return success

def test_4_trustline_backoff():
    """TEST 4: TrustLine backoff - trustline-backoff key in merchantPoolWallet.ts"""
    print("\n🔍 TEST 4: TrustLine Backoff Implementation")
    
    # Search for trustline-backoff Redis key
    backoff_count, backoff_matches = search_file("/app/backend/services/merchantPool/merchantPoolWallet.ts", r"trustline-backoff")
    
    # Search for backing off message
    backing_count, backing_matches = search_file("/app/backend/services/merchantPool/merchantPoolWallet.ts", r"Backing off for 1 hour")
    
    # Search for setRedisItemWithTTL with backoff
    redis_set_count, redis_matches = search_file("/app/backend/services/merchantPool/merchantPoolWallet.ts", r"setRedisItemWithTTL.*backoff")
    
    print(f"trustline-backoff key: {backoff_count} matches")
    print(f"'Backing off for 1 hour' message: {backing_count} matches")  
    print(f"setRedisItemWithTTL.*backoff: {redis_set_count} matches")
    
    if backoff_matches:
        print("Found trustline-backoff implementation:")
        for line_num, line in backoff_matches[:2]:
            print(f"  Line {line_num}: {line[:100]}")
    
    success = (backoff_count >= 1) and (backing_count >= 1) and (redis_set_count >= 1)
    
    if success:
        print("✅ TrustLine backoff implementation found")
    else:
        print("❌ TrustLine backoff implementation missing")
    
    return success

def test_5_fastforex_crypto_skip():
    """TEST 5: FastForex crypto skip - if (!isCryptoConversion) guard"""
    print("\n🔍 TEST 5: FastForex Crypto Skip Implementation")
    
    # Search for isCryptoConversion check
    crypto_check_count, crypto_matches = search_file("/app/backend/helper/currencyConvert.ts", r"isCryptoConversion")
    
    # Search for the specific guard
    guard_count, guard_matches = search_file("/app/backend/helper/currencyConvert.ts", r"if \(!isCryptoConversion\)")
    
    print(f"isCryptoConversion references: {crypto_check_count}")
    print(f"if (!isCryptoConversion) guard: {guard_count}")
    
    if guard_matches:
        print("Found FastForex crypto skip guard:")
        for line_num, line in guard_matches[:2]:
            print(f"  Line {line_num}: {line[:100]}")
    
    success = (crypto_check_count >= 1) and (guard_count >= 1)
    
    if success:
        print("✅ FastForex crypto skip guard implemented")
    else:
        print("❌ FastForex crypto skip guard missing")
    
    return success

def test_6_orphan_skip_caching():
    """TEST 6: Orphan skip caching - orphan-skip key with 86400 TTL"""
    print("\n🔍 TEST 6: Orphan Skip Caching Implementation")
    
    # Search for orphan-skip Redis key
    orphan_key_count, orphan_matches = search_file("/app/backend/services/merchantPool/merchantPoolMonitoring.ts", r"orphan-skip")
    
    # Search for 24h caching message
    cache_msg_count, cache_matches = search_file("/app/backend/services/merchantPool/merchantPoolMonitoring.ts", r"cached for 24h")
    
    # Search for 86400 TTL
    ttl_count, ttl_matches = search_file("/app/backend/services/merchantPool/merchantPoolMonitoring.ts", r"86400")
    
    print(f"orphan-skip key: {orphan_key_count} matches")
    print(f"'cached for 24h' message: {cache_msg_count} matches")
    print(f"86400 TTL: {ttl_count} matches")
    
    if orphan_matches:
        print("Found orphan-skip caching:")
        for line_num, line in orphan_matches[:2]:
            print(f"  Line {line_num}: {line[:100]}")
    
    success = (orphan_key_count >= 1) and (ttl_count >= 1)
    
    if success:
        print("✅ Orphan skip caching implementation found")
    else:
        print("❌ Orphan skip caching implementation missing")
    
    return success

def test_7_coingecko_interval():
    """TEST 7: CoinGecko 2-min interval - */2 * * * * cron schedule"""
    print("\n🔍 TEST 7: CoinGecko 2-Minute Interval")
    
    # Search for the 2-minute cron schedule
    cron_count, cron_matches = search_file("/app/backend/server.ts", r"\*/2 \* \* \* \*")
    
    # Search for TTL update to 180_000
    ttl_count, ttl_matches = search_file("/app/backend/helper/currencyConvert.ts", r"180_000")
    
    print(f"*/2 * * * * cron schedule: {cron_count} matches")
    print(f"180_000 TTL: {ttl_count} matches")
    
    if cron_matches:
        print("Found 2-minute cron schedule:")
        for line_num, line in cron_matches[:2]:
            print(f"  Line {line_num}: {line[:100]}")
    
    success = (cron_count >= 1) and (ttl_count >= 1)
    
    if success:
        print("✅ CoinGecko 2-minute interval implemented")
    else:
        print("❌ CoinGecko 2-minute interval missing")
    
    return success

def test_8_lock_ttl_increase():
    """TEST 8: Lock TTL - 900 seconds for detectOrphanPayments"""
    print("\n🔍 TEST 8: Lock TTL Increase for Orphan Detection")
    
    # Search for acquireLock with detectOrphanPayments and 900
    lock_count, lock_matches = search_file("/app/backend/server.ts", r"acquireLock.*detectOrphanPayments.*900")
    
    print(f"acquireLock.*detectOrphanPayments.*900: {lock_count} matches")
    
    if lock_matches:
        print("Found 900s lock TTL for detectOrphanPayments:")
        for line_num, line in lock_matches:
            print(f"  Line {line_num}: {line[:100]}")
    
    success = (lock_count >= 1)
    
    if success:
        print("✅ 900s lock TTL for detectOrphanPayments found")
    else:
        print("❌ 900s lock TTL for detectOrphanPayments missing")
    
    return success

def test_9_tatum_403_message():
    """TEST 9: Tatum 403 - 'cross-rate recovery will fill the gap' message"""
    print("\n🔍 TEST 9: Tatum 403 Error Message Improvement")
    
    # Search for the improved 403 message
    msg_count, msg_matches = search_file("/app/backend/helper/currencyConvert.ts", r"cross-rate recovery will fill the gap")
    
    print(f"'cross-rate recovery will fill the gap' message: {msg_count} matches")
    
    if msg_matches:
        print("Found improved Tatum 403 message:")
        for line_num, line in msg_matches:
            print(f"  Line {line_num}: {line[:100]}")
    
    success = (msg_count >= 1)
    
    if success:
        print("✅ Improved Tatum 403 message found")
    else:
        print("❌ Improved Tatum 403 message missing")
    
    return success

def main():
    """Run all backend log issue fix tests"""
    print("🧪 TESTING: Fix 7 Backend Log Issues")
    print("=" * 60)
    
    tests = [
        ("Backend Health", test_1_backend_health),
        ("TypeScript Compilation", test_2_typescript_compilation),
        ("BCH Direct HTTP", test_3_bch_direct_http),
        ("TrustLine Backoff", test_4_trustline_backoff),
        ("FastForex Crypto Skip", test_5_fastforex_crypto_skip),
        ("Orphan Skip Caching", test_6_orphan_skip_caching),
        ("CoinGecko 2-min Interval", test_7_coingecko_interval),
        ("Lock TTL Increase", test_8_lock_ttl_increase),
        ("Tatum 403 Message", test_9_tatum_403_message),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            success = test_func()
            results.append((test_name, success))
        except Exception as e:
            print(f"❌ {test_name} test failed with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if success:
            passed += 1
    
    success_rate = (passed / total) * 100
    print(f"\n🎯 Overall Success Rate: {passed}/{total} ({success_rate:.1f}%)")
    
    if passed == total:
        print("🎉 All backend log issue fixes verified successfully!")
        return 0
    else:
        print(f"⚠️ {total - passed} tests failed - see details above")
        return 1

if __name__ == "__main__":
    sys.exit(main())