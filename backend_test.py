#!/usr/bin/env python3
"""
XRP Reserve & Gas Fee Optimization Testing
Testing for post-Dec 2024 XRPL reserve updates
"""

import requests
import subprocess
import json
import sys

def test_backend_health():
    """TEST 1: Backend health check"""
    try:
        response = requests.get('http://localhost:8001/health', timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                print("✅ TEST 1: Backend health check PASSED")
                return True
            else:
                print(f"❌ TEST 1: Backend health check FAILED - status: {data.get('status')}")
                return False
        else:
            print(f"❌ TEST 1: Backend health check FAILED - status code: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 1: Backend health check FAILED - error: {e}")
        return False

def test_typescript_compilation():
    """TEST 2: TypeScript compilation"""
    try:
        result = subprocess.run(
            ['npx', 'tsc', '--noEmit'],
            cwd='/app/backend',
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode == 0:
            print("✅ TEST 2: TypeScript compilation PASSED")
            return True
        else:
            print(f"❌ TEST 2: TypeScript compilation FAILED")
            print(f"STDOUT: {result.stdout}")
            print(f"STDERR: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ TEST 2: TypeScript compilation FAILED - error: {e}")
        return False

def read_file_content(file_path):
    """Helper to read file content"""
    try:
        with open(file_path, 'r') as f:
            return f.read()
    except Exception as e:
        print(f"❌ ERROR: Could not read {file_path}: {e}")
        return None

def test_xrp_gas_fallback():
    """TEST 3: XRP_GAS_FALLBACK should be 0.001 (NOT 15)"""
    content = read_file_content('/app/backend/services/merchantPool/merchantPoolConfig.ts')
    if content is None:
        return False
    
    # Check for XRP_GAS_FALLBACK value
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'XRP_GAS_FALLBACK:' in line:
            if '0.001' in line:
                print("✅ TEST 3: XRP_GAS_FALLBACK correctly set to 0.001")
                return True
            elif '15' in line:
                print(f"❌ TEST 3: XRP_GAS_FALLBACK incorrectly set to 15 at line {i+1}")
                print(f"   Line: {line.strip()}")
                return False
            else:
                print(f"❌ TEST 3: XRP_GAS_FALLBACK has unexpected value at line {i+1}")
                print(f"   Line: {line.strip()}")
                return False
    
    print("❌ TEST 3: XRP_GAS_FALLBACK not found in config")
    return False

def test_xrp_min_deficit():
    """TEST 4: XRP_MIN_DEFICIT should be 0.001 (NOT 1)"""
    content = read_file_content('/app/backend/services/merchantPool/merchantPoolConfig.ts')
    if content is None:
        return False
    
    # Check for XRP_MIN_DEFICIT value
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'XRP_MIN_DEFICIT:' in line:
            if '0.001' in line:
                print("✅ TEST 4: XRP_MIN_DEFICIT correctly set to 0.001")
                return True
            elif line.strip().endswith('1,') and '0.001' not in line:
                print(f"❌ TEST 4: XRP_MIN_DEFICIT incorrectly set to 1 at line {i+1}")
                print(f"   Line: {line.strip()}")
                return False
            else:
                print(f"❌ TEST 4: XRP_MIN_DEFICIT has unexpected value at line {i+1}")
                print(f"   Line: {line.strip()}")
                return False
    
    print("❌ TEST 4: XRP_MIN_DEFICIT not found in config")
    return False

def test_xrp_sweep_reserve():
    """TEST 5: XRP sweep reserve should be 1 (NOT 10)"""
    content = read_file_content('/app/backend/services/merchantPool/merchantPoolSweep.ts')
    if content is None:
        return False
    
    # Check for XRP reserve in sweep
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if "walletType === 'XRP'" in line and 'accountReserve' in line:
            if 'accountReserve = 1' in line and 'post Dec 2024' in lines[i-1]:
                print("✅ TEST 5: XRP sweep reserve correctly set to 1 with post-Dec 2024 comment")
                return True
            elif 'accountReserve = 10' in line:
                print(f"❌ TEST 5: XRP sweep reserve incorrectly set to 10 at line {i+1}")
                print(f"   Line: {line.strip()}")
                return False
    
    # Alternative check - look for the pattern more broadly
    if 'accountReserve = 1; // 1 XRP base reserve (post Dec 2024)' in content:
        print("✅ TEST 5: XRP sweep reserve correctly set to 1 with post-Dec 2024 comment")
        return True
    elif 'accountReserve = 10' in content:
        print("❌ TEST 5: XRP sweep reserve incorrectly set to 10")
        return False
    
    print("❌ TEST 5: XRP sweep reserve configuration not found")
    return False

def test_rlusd_sweep_reserve():
    """TEST 6: RLUSD sweep reserve should be 1.2 (NOT 12)"""
    content = read_file_content('/app/backend/services/merchantPool/merchantPoolSweep.ts')
    if content is None:
        return False
    
    # Check for RLUSD reserve in sweep
    if 'accountReserve = 1.2; // 1 XRP base reserve + 0.2 XRP trust line reserve (post Dec 2024)' in content:
        print("✅ TEST 6: RLUSD sweep reserve correctly set to 1.2 with post-Dec 2024 comment")
        return True
    elif 'accountReserve = 12' in content:
        print("❌ TEST 6: RLUSD sweep reserve incorrectly set to 12")
        return False
    
    print("❌ TEST 6: RLUSD sweep reserve configuration not found")
    return False

def test_rlusd_wallet_funding():
    """TEST 7: RLUSD wallet funding amount should be 2 (NOT 13)"""
    content = read_file_content('/app/backend/services/merchantPool/merchantPoolWallet.ts')
    if content is None:
        return False
    
    # Check for RLUSD wallet funding amount
    if 'amount: 2,' in content and 'Fund with 2 XRP' in content:
        print("✅ TEST 7: RLUSD wallet funding correctly set to 2 XRP")
        return True
    elif 'amount: 13' in content:
        print("❌ TEST 7: RLUSD wallet funding incorrectly set to 13")
        return False
    
    print("❌ TEST 7: RLUSD wallet funding configuration not found")
    return False

def test_comments_and_references():
    """TEST 8: Comments should reference "post Dec 2024" and xrpl.org blog link"""
    files_to_check = [
        '/app/backend/services/merchantPool/merchantPoolSweep.ts',
        '/app/backend/services/merchantPool/merchantPoolWallet.ts'
    ]
    
    found_post_dec_2024 = False
    found_xrpl_blog = False
    
    for file_path in files_to_check:
        content = read_file_content(file_path)
        if content is None:
            continue
        
        if 'post Dec 2024' in content or 'post-Dec 2024' in content:
            found_post_dec_2024 = True
        
        if 'xrpl.org/blog' in content:
            found_xrpl_blog = True
    
    if found_post_dec_2024 and found_xrpl_blog:
        print("✅ TEST 8: Comments correctly reference 'post Dec 2024' and xrpl.org blog link")
        return True
    else:
        missing = []
        if not found_post_dec_2024:
            missing.append("'post Dec 2024' reference")
        if not found_xrpl_blog:
            missing.append("xrpl.org blog link")
        print(f"❌ TEST 8: Missing {', '.join(missing)}")
        return False

def main():
    """Run all tests"""
    print("=" * 80)
    print("XRP Reserve & Gas Fee Optimization Testing")
    print("Testing post-Dec 2024 XRPL reserve updates")
    print("=" * 80)
    
    tests = [
        test_backend_health,
        test_typescript_compilation,
        test_xrp_gas_fallback,
        test_xrp_min_deficit,
        test_xrp_sweep_reserve,
        test_rlusd_sweep_reserve,
        test_rlusd_wallet_funding,
        test_comments_and_references
    ]
    
    results = []
    
    for test in tests:
        print(f"\nRunning {test.__doc__}...")
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"❌ {test.__doc__} FAILED with exception: {e}")
            results.append(False)
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(results)
    total = len(results)
    
    for i, (test, result) in enumerate(zip(tests, results), 1):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - TEST {i}: {test.__doc__.split(':')[1].strip()}")
    
    print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! XRP Reserve & Gas Fee Optimization is working correctly.")
        sys.exit(0)
    else:
        print("⚠️  SOME TESTS FAILED! Review the failed tests above.")
        sys.exit(1)

if __name__ == "__main__":
    main()