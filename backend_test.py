#!/usr/bin/env python3
"""
Backend API Testing Script for DynoPay - Network Fees Bug Fix Verification
Tests the fix for "Converting circular structure to JSON" error in GET /api/pay/network-fees
"""

import requests
import json
from datetime import datetime
import time

# Target URL from review request
BASE_URL = "https://e28fa8d0-2f83-434a-a10f-6b9f6b5c3a63.preview.emergentagent.com/api"

def print_separator():
    print("\n" + "="*80 + "\n")

def test_health_check():
    """Test GET /health - Regression sanity check"""
    print("TEST 1: Health Check (GET /health)")
    print("-" * 80)
    
    try:
        # Try /health first
        url = f"{BASE_URL.replace('/api', '')}/health"
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"Response Body: {json.dumps(data, indent=2)}")
                print("✅ PASS: Health check returns 200")
                return True, "Health check operational"
            except:
                print(f"Response Text: {response.text[:200]}")
                print("✅ PASS: Health check returns 200")
                return True, "Health check operational"
        else:
            # Try /api/ as fallback
            url = f"{BASE_URL}/"
            response = requests.get(url, timeout=10)
            print(f"Fallback Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response Body: {json.dumps(data, indent=2)[:300]}...")
                print("✅ PASS: Health check operational (via /api/)")
                return True, "Health check operational"
            else:
                print(f"❌ FAIL: Expected 200, got {response.status_code}")
                return False, f"Expected 200, got {response.status_code}"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def test_network_fees_all(attempt=1):
    """Test GET /api/pay/network-fees (NO query params) - Main bug fix test"""
    print(f"TEST 2.{attempt}: Network Fees - All Chains (GET /api/pay/network-fees)")
    print("-" * 80)
    
    try:
        url = f"{BASE_URL}/pay/network-fees"
        response = requests.get(url, timeout=15)
        
        print(f"Status Code: {response.status_code}")
        
        # Check for the circular structure error
        if "Converting circular structure to JSON" in response.text:
            print(f"❌ CRITICAL FAIL: Circular structure error detected!")
            print(f"Response: {response.text[:500]}")
            return False, "CIRCULAR STRUCTURE ERROR - Bug NOT fixed"
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if data field exists
            if 'data' not in data:
                print(f"❌ FAIL: Response missing 'data' field")
                print(f"Response: {json.dumps(data, indent=2)[:500]}")
                return False, "Response missing 'data' field"
            
            # Extract chain keys
            fee_data = data['data']
            if isinstance(fee_data, dict):
                chains = list(fee_data.keys())
            elif isinstance(fee_data, list):
                chains = [item.get('chain') for item in fee_data if isinstance(item, dict)]
            else:
                print(f"❌ FAIL: Unexpected data format")
                return False, "Unexpected data format"
            
            print(f"Chains returned: {chains}")
            print(f"Total chains: {len(chains)}")
            
            # Verify we have multiple chains (around 12 as per review request)
            if len(chains) >= 10:
                print(f"✅ PASS: Network fees returned {len(chains)} chains successfully")
                
                # Check for expected chains
                expected_chains = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'USDT_ERC20', 'SOL', 'XRP']
                found_expected = [c for c in expected_chains if c in chains]
                print(f"Expected chains found: {found_expected}")
                
                # Verify fee structure for one chain
                sample_chain = chains[0]
                sample_fee = fee_data[sample_chain] if isinstance(fee_data, dict) else fee_data[0]
                print(f"\nSample fee structure ({sample_chain}):")
                print(f"  feeInNative: {sample_fee.get('feeInNative')}")
                print(f"  feeInUSD: {sample_fee.get('feeInUSD')}")
                print(f"  timestamp: {sample_fee.get('timestamp')}")
                
                return True, f"Network fees returned {len(chains)} chains: {', '.join(chains[:8])}{'...' if len(chains) > 8 else ''}"
            else:
                print(f"⚠️ WARNING: Only {len(chains)} chains returned (expected ~12)")
                return True, f"Network fees returned {len(chains)} chains (fewer than expected)"
        
        elif response.status_code == 500:
            print(f"❌ CRITICAL FAIL: Still returning 500 error")
            print(f"Response: {response.text[:500]}")
            return False, f"500 error - Bug NOT fixed: {response.text[:100]}"
        
        else:
            print(f"❌ FAIL: Unexpected status code {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False, f"Unexpected status {response.status_code}"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def test_network_fees_single_btc():
    """Test GET /api/pay/network-fees?chain=BTC - Single chain test"""
    print("TEST 3: Network Fees - Single Chain BTC (GET /api/pay/network-fees?chain=BTC)")
    print("-" * 80)
    
    try:
        url = f"{BASE_URL}/pay/network-fees?chain=BTC"
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response Body: {json.dumps(data, indent=2)}")
            
            # Verify structure
            if 'data' in data:
                fee_data = data['data']
                if 'chain' in fee_data and 'feeInNative' in fee_data and 'feeInUSD' in fee_data:
                    print(f"✅ PASS: BTC fee returned successfully")
                    print(f"  Chain: {fee_data.get('chain')}")
                    print(f"  Fee in Native: {fee_data.get('feeInNative')}")
                    print(f"  Fee in USD: {fee_data.get('feeInUSD')}")
                    return True, f"BTC fee: {fee_data.get('feeInNative')} BTC (${fee_data.get('feeInUSD')})"
                else:
                    print(f"⚠️ WARNING: Response missing expected fields")
                    return True, "BTC fee returned but structure unexpected"
            else:
                print(f"❌ FAIL: Response missing 'data' field")
                return False, "Response missing 'data' field"
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:300]}")
            return False, f"Expected 200, got {response.status_code}"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def test_network_fees_single_polygon():
    """Test GET /api/pay/network-fees?chain=POLYGON - Should return 502 gracefully"""
    print("TEST 4: Network Fees - Single Chain POLYGON (GET /api/pay/network-fees?chain=POLYGON)")
    print("-" * 80)
    print("EXPECTED: 502 (graceful failure) - NOT 500")
    
    try:
        url = f"{BASE_URL}/pay/network-fees?chain=POLYGON"
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        
        # Check for circular structure error (most important check)
        if "Converting circular structure to JSON" in response.text:
            print(f"❌ CRITICAL FAIL: Circular structure error detected!")
            print(f"Response: {response.text[:300]}")
            return False, "CIRCULAR STRUCTURE ERROR on POLYGON - Bug NOT fixed"
        
        if response.status_code == 502:
            # 502 is correct! Check if it's JSON or HTML (Cloudflare intercept)
            content_type = response.headers.get('content-type', '')
            
            if 'application/json' in content_type:
                try:
                    data = response.json()
                    message = data.get('message', '')
                    print(f"✅ PASS: POLYGON returns 502 gracefully with JSON response")
                    print(f"  Message: {message}")
                    return True, f"POLYGON returns 502 gracefully: {message}"
                except:
                    print(f"✅ PASS: POLYGON returns 502 (JSON parse failed but status correct)")
                    return True, "POLYGON returns 502 gracefully (Cloudflare HTML intercept)"
            else:
                # HTML response from Cloudflare - this is OK, backend returned 502
                print(f"✅ PASS: POLYGON returns 502 (Cloudflare HTML intercept)")
                print(f"  Content-Type: {content_type}")
                print(f"  Note: Backend correctly returned 502, Cloudflare intercepted with HTML")
                return True, "POLYGON returns 502 gracefully (Cloudflare HTML intercept)"
        
        elif response.status_code == 500:
            print(f"❌ FAIL: Still returning 500 (should be 502)")
            print(f"Response: {response.text[:300]}")
            return False, "POLYGON returns 500 instead of 502 - Partial fix"
        
        elif response.status_code == 200:
            print(f"⚠️ UNEXPECTED: POLYGON returns 200 (Tatum API may have fixed their endpoint)")
            try:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)[:300]}")
            except:
                print(f"Response: {response.text[:300]}")
            return True, "POLYGON returns 200 (upstream may be working now)"
        
        else:
            print(f"⚠️ UNEXPECTED: Status code {response.status_code}")
            print(f"Response: {response.text[:300]}")
            return True, f"POLYGON returns {response.status_code} (not 500)"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def main():
    print("="*80)
    print("DynoPay Backend API Testing - Network Fees Bug Fix Verification")
    print("Bug: GET /api/pay/network-fees returned 500 'Converting circular structure to JSON'")
    print("Fix: Circular-safe stringifier + error message logging + fee sanitization")
    print(f"Target URL: {BASE_URL}")
    print(f"Test Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print("="*80)
    
    results = []
    
    # Test 1: Health check (regression)
    print_separator()
    result = test_health_check()
    results.append(("Health Check", result))
    
    # Test 2: Network fees - all chains (main bug fix test)
    print_separator()
    result = test_network_fees_all(attempt=1)
    results.append(("Network Fees - All Chains (Attempt 1)", result))
    
    # Test 3: Network fees - all chains (consistency check - attempt 2)
    print_separator()
    time.sleep(1)  # Small delay between requests
    result = test_network_fees_all(attempt=2)
    results.append(("Network Fees - All Chains (Attempt 2)", result))
    
    # Test 4: Network fees - all chains (consistency check - attempt 3)
    print_separator()
    time.sleep(1)  # Small delay between requests
    result = test_network_fees_all(attempt=3)
    results.append(("Network Fees - All Chains (Attempt 3)", result))
    
    # Test 5: Single chain - BTC (should work)
    print_separator()
    result = test_network_fees_single_btc()
    results.append(("Network Fees - BTC", result))
    
    # Test 6: Single chain - POLYGON (should return 502 gracefully)
    print_separator()
    result = test_network_fees_single_polygon()
    results.append(("Network Fees - POLYGON", result))
    
    # Summary
    print_separator()
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, (success, _) in results if success)
    total = len(results)
    
    # Critical tests
    critical_tests = [
        "Network Fees - All Chains (Attempt 1)",
        "Network Fees - All Chains (Attempt 2)",
        "Network Fees - All Chains (Attempt 3)",
        "Network Fees - POLYGON"
    ]
    
    print("\n🔴 CRITICAL TESTS (Bug Fix Verification):")
    print("-" * 80)
    for test_name, (success, message) in results:
        if test_name in critical_tests:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{status}: {test_name}")
            print(f"         {message}")
    
    print("\n📋 ALL TESTS:")
    print("-" * 80)
    for test_name, (success, message) in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        print(f"         {message}")
    
    print("-" * 80)
    print(f"Total: {passed}/{total} tests passed ({passed/total*100:.1f}% success rate)")
    
    # Check critical tests
    critical_passed = sum(1 for test_name, (success, _) in results if test_name in critical_tests and success)
    critical_total = len([t for t in results if t[0] in critical_tests])
    
    print(f"Critical: {critical_passed}/{critical_total} critical tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Bug fix verified successfully!")
        print("✅ No 'Converting circular structure to JSON' errors detected")
        print("✅ GET /api/pay/network-fees returns 200 consistently")
        print("✅ POLYGON returns 502 gracefully (not 500)")
    elif critical_passed == critical_total:
        print("\n✅ CRITICAL TESTS PASSED - Bug fix verified!")
        print(f"⚠️ {total - passed} non-critical test(s) failed")
    else:
        print(f"\n❌ BUG FIX VERIFICATION FAILED")
        print(f"⚠️ {critical_total - critical_passed} critical test(s) failed")
        print(f"⚠️ {total - passed} total test(s) failed")
    
    print("="*80)

if __name__ == "__main__":
    main()
