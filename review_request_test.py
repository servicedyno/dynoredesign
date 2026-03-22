#!/usr/bin/env python3
"""
DynoPay Backend API Testing Script - Review Request Verification
Tests the specific endpoints mentioned in the review request
"""

import requests
import json
from datetime import datetime

# Base URL from the review request
BASE_URL = "https://setup-wizard-133.preview.emergentagent.com/api"

def test_health_check():
    """Test GET /api/ - Health check endpoint"""
    print("🔍 Testing Health Check...")
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            print("   ✅ Health check PASSED")
            return True
        else:
            print("   ❌ Health check FAILED")
            return False
    except Exception as e:
        print(f"   ❌ Health check ERROR: {e}")
        return False

def test_calculate_fees():
    """Test POST /api/pay/calculateFees - Should return 400 without crypto field"""
    print("\n🔍 Testing Calculate Fees...")
    try:
        payload = {"amount": 100, "currency": "USD"}
        response = requests.post(f"{BASE_URL}/pay/calculateFees", json=payload)
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 400:
            print("   ✅ Calculate fees validation PASSED (correctly requires crypto field)")
            return True
        else:
            print("   ❌ Calculate fees validation FAILED")
            return False
    except Exception as e:
        print(f"   ❌ Calculate fees ERROR: {e}")
        return False

def test_network_fees():
    """Test GET /api/pay/network-fees - Should return 200"""
    print("\n🔍 Testing Network Fees...")
    try:
        response = requests.get(f"{BASE_URL}/pay/network-fees")
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            print("   ✅ Network fees PASSED")
            return True
        else:
            print("   ❌ Network fees FAILED")
            return False
    except Exception as e:
        print(f"   ❌ Network fees ERROR: {e}")
        return False

def test_geo_detect():
    """Test GET /api/geo-detect - Should return 200"""
    print("\n🔍 Testing Geo Detection...")
    try:
        response = requests.get(f"{BASE_URL}/geo-detect")
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            print("   ✅ Geo detection PASSED")
            return True
        else:
            print("   ❌ Geo detection FAILED")
            return False
    except Exception as e:
        print(f"   ❌ Geo detection ERROR: {e}")
        return False

def test_wallet_update():
    """Test PUT /api/wallet/updateWallet/999 - Should return 403 (no auth)"""
    print("\n🔍 Testing Wallet Update (Auth Required)...")
    try:
        response = requests.put(f"{BASE_URL}/wallet/updateWallet/999")
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 403:
            print("   ✅ Wallet update auth PASSED (correctly requires authentication)")
            return True
        else:
            print("   ❌ Wallet update auth FAILED")
            return False
    except Exception as e:
        print(f"   ❌ Wallet update ERROR: {e}")
        return False

def main():
    """Run all API tests"""
    print("🚀 Starting DynoPay Backend API Tests - Review Request Verification")
    print(f"📍 Target URL: {BASE_URL}")
    print(f"⏰ Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 60)
    
    # Run all tests
    tests = [
        test_health_check,
        test_calculate_fees,
        test_network_fees,
        test_geo_detect,
        test_wallet_update
    ]
    
    results = []
    for test in tests:
        results.append(test())
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(results)
    total = len(results)
    
    print(f"✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! Backend API is working correctly.")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Check the details above.")
    
    return passed == total

if __name__ == "__main__":
    main()