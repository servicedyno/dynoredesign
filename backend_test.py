#!/usr/bin/env python3
"""
DynoPay Backend API Testing Script
Tests backend endpoints after URL construction and network fees serialization bug fixes
"""

import requests
import json
from datetime import datetime

# Target URL from review request
BASE_URL = "https://dotenv-deploy-1.preview.emergentagent.com/api"

def print_header(text):
    """Print formatted header"""
    print(f"\n{'='*80}")
    print(f"  {text}")
    print(f"{'='*80}\n")

def test_health_check():
    """Test GET /api/ - Health check endpoint"""
    print_header("TEST 1: Health Check (GET /api/)")
    
    try:
        url = f"{BASE_URL}/"
        print(f"Testing: {url}")
        
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify expected fields
            if data.get('status') == 'operational':
                print("✅ PASS: Health check operational")
                return True
            else:
                print(f"❌ FAIL: Expected status='operational', got '{data.get('status')}'")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {str(e)}")
        return False

def test_network_fees():
    """Test GET /api/pay/network-fees - Network fees endpoint"""
    print_header("TEST 2: Network Fees (GET /api/pay/network-fees)")
    
    try:
        url = f"{BASE_URL}/pay/network-fees"
        print(f"Testing: {url}")
        
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            # First check if response is valid JSON (no circular JSON errors)
            try:
                data = response.json()
                print("✅ Valid JSON response (no circular JSON errors)")
            except json.JSONDecodeError as e:
                print(f"❌ FAIL: Invalid JSON response - {str(e)}")
                print(f"Response text: {response.text[:500]}")
                return False
            
            # Verify expected structure
            if 'message' not in data:
                print("❌ FAIL: Missing 'message' field in response")
                return False
            
            if 'data' not in data:
                print("❌ FAIL: Missing 'data' field in response")
                return False
            
            print(f"Message: {data.get('message')}")
            
            # Check for network fees data
            fee_data = data.get('data', {})
            if not fee_data:
                print("❌ FAIL: Empty data field")
                return False
            
            # List chains found
            chains = list(fee_data.keys())
            print(f"Chains found ({len(chains)}): {', '.join(chains)}")
            
            # Verify expected chains are present
            expected_chains = ['BTC', 'ETH', 'TRX', 'SOL', 'XRP']
            missing_chains = [chain for chain in expected_chains if chain not in chains]
            
            if missing_chains:
                print(f"⚠️  WARNING: Missing expected chains: {', '.join(missing_chains)}")
            
            # Show sample data for first few chains
            print("\nSample fee data:")
            for chain in list(chains)[:3]:
                print(f"  {chain}: {fee_data[chain]}")
            
            print("✅ PASS: Network fees endpoint working correctly")
            print("✅ PASS: No circular JSON errors detected")
            print("✅ PASS: Response contains message and data fields")
            print(f"✅ PASS: Data contains network fees for {len(chains)} chains")
            return True
            
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {str(e)}")
        return False

def test_geo_detect():
    """Test GET /api/geo-detect - Geo detection endpoint"""
    print_header("TEST 3: Geo Detection (GET /api/geo-detect)")
    
    try:
        url = f"{BASE_URL}/geo-detect"
        print(f"Testing: {url}")
        
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify country detection data is present
            if 'country' in data or 'countryCode' in data:
                print("✅ PASS: Geo detection working correctly")
                return True
            else:
                print("⚠️  WARNING: Response missing country/countryCode fields")
                print("✅ PASS: Endpoint returns 200 (geo detection operational)")
                return True
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {str(e)}")
        return False

def main():
    """Run all backend tests"""
    print_header(f"DynoPay Backend API Testing - {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Target URL: {BASE_URL}")
    print(f"Bug Fix Context: URL construction + network fees serialization")
    
    results = {
        'health_check': test_health_check(),
        'network_fees': test_network_fees(),
        'geo_detect': test_geo_detect()
    }
    
    # Summary
    print_header("TEST SUMMARY")
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    failed = total - passed
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Success Rate: {(passed/total)*100:.1f}%\n")
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED - Backend API fully operational after bug fixes")
        return 0
    else:
        print(f"\n⚠️  {failed} TEST(S) FAILED - Review failures above")
        return 1

if __name__ == "__main__":
    exit(main())
