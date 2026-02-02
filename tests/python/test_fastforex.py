#!/usr/bin/env python3
"""
FastForex API Test
Tests if FastForex API is working correctly
"""

import requests
import json
import os

# API Key from .env
FASTFOREX_API_KEY = "88d0f6fc99-ddde24c462-t97lpe"
BASE_URL = "https://api.fastforex.io"

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def test_fiat_conversion():
    """Test fiat to fiat conversion (USD to EUR)"""
    print_section("TEST 1: Fiat-to-Fiat Conversion (USD → EUR)")
    
    url = f"{BASE_URL}/convert"
    params = {
        "api_key": FASTFOREX_API_KEY,
        "from": "USD",
        "to": "EUR",
        "amount": 100
    }
    
    print(f"Request: {url}")
    print(f"Params: from=USD, to=EUR, amount=100")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ SUCCESS!")
            print(f"\nResponse:")
            print(json.dumps(data, indent=2))
            
            if 'result' in data:
                result = data['result']
                print(f"\n💱 Conversion Result:")
                print(f"   $100 USD = €{result.get('EUR', 'N/A')} EUR")
                print(f"   Exchange Rate: 1 USD = {result.get('rate', 'N/A')} EUR")
            return True
        else:
            print(f"❌ FAILED!")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False

def test_crypto_conversion_btc():
    """Test USD to BTC conversion"""
    print_section("TEST 2: Fiat-to-Crypto Conversion (USD → BTC)")
    
    url = f"{BASE_URL}/convert"
    params = {
        "api_key": FASTFOREX_API_KEY,
        "from": "USD",
        "to": "BTC",
        "amount": 10
    }
    
    print(f"Request: {url}")
    print(f"Params: from=USD, to=BTC, amount=10")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ SUCCESS!")
            print(f"\nResponse:")
            print(json.dumps(data, indent=2))
            
            if 'result' in data:
                result = data['result']
                btc_amount = result.get('BTC', 0)
                rate = result.get('rate', 0)
                print(f"\n₿ BTC Conversion Result:")
                print(f"   $10 USD = {btc_amount} BTC")
                print(f"   Exchange Rate: 1 USD = {rate} BTC")
                print(f"   BTC Price: ${1/rate:.2f} USD" if rate > 0 else "   BTC Price: N/A")
            return True
        else:
            print(f"❌ FAILED!")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False

def test_crypto_conversion_eth():
    """Test USD to ETH conversion"""
    print_section("TEST 3: Fiat-to-Crypto Conversion (USD → ETH)")
    
    url = f"{BASE_URL}/convert"
    params = {
        "api_key": FASTFOREX_API_KEY,
        "from": "USD",
        "to": "ETH",
        "amount": 10
    }
    
    print(f"Request: {url}")
    print(f"Params: from=USD, to=ETH, amount=10")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ SUCCESS!")
            print(f"\nResponse:")
            print(json.dumps(data, indent=2))
            
            if 'result' in data:
                result = data['result']
                eth_amount = result.get('ETH', 0)
                rate = result.get('rate', 0)
                print(f"\n⟠ ETH Conversion Result:")
                print(f"   $10 USD = {eth_amount} ETH")
                print(f"   Exchange Rate: 1 USD = {rate} ETH")
                print(f"   ETH Price: ${1/rate:.2f} USD" if rate > 0 else "   ETH Price: N/A")
            return True
        else:
            print(f"❌ FAILED!")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False

def test_multi_currency():
    """Test multiple currency fetch"""
    print_section("TEST 4: Fetch All Rates (USD base)")
    
    url = f"{BASE_URL}/fetch-all"
    params = {
        "api_key": FASTFOREX_API_KEY,
        "from": "USD"
    }
    
    print(f"Request: {url}")
    print(f"Params: from=USD")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ SUCCESS!")
            
            if 'results' in data:
                results = data['results']
                print(f"\n📊 Sample Rates (USD base):")
                
                # Show some key currencies
                key_currencies = ['EUR', 'GBP', 'NGN', 'BTC', 'ETH', 'TRX', 'USDT']
                for currency in key_currencies:
                    if currency in results:
                        print(f"   1 USD = {results[currency]} {currency}")
                
                print(f"\n✅ Total currencies available: {len(results)}")
            return True
        else:
            print(f"❌ FAILED!")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False

def test_api_quota():
    """Test API quota/usage"""
    print_section("TEST 5: API Quota Check")
    
    url = f"{BASE_URL}/fetch-one"
    params = {
        "api_key": FASTFOREX_API_KEY,
        "from": "USD",
        "to": "EUR"
    }
    
    print(f"Request: {url}")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ API is accessible")
            
            # Check response headers for quota info
            headers = response.headers
            print(f"\n📋 API Information:")
            
            for header in ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']:
                if header in headers:
                    print(f"   {header}: {headers[header]}")
            
            print(f"\nResponse:")
            print(json.dumps(data, indent=2))
            return True
        else:
            print(f"❌ FAILED!")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False

def main():
    print("\n" + "="*80)
    print("  FASTFOREX API TESTING")
    print("  API Key: 88d0f6fc99-ddde24c462-t97lpe")
    print("="*80)
    
    results = []
    
    # Run all tests
    results.append(("Fiat-to-Fiat (USD→EUR)", test_fiat_conversion()))
    results.append(("USD to BTC", test_crypto_conversion_btc()))
    results.append(("USD to ETH", test_crypto_conversion_eth()))
    results.append(("Fetch All Rates", test_multi_currency()))
    results.append(("API Quota Check", test_api_quota()))
    
    # Summary
    print_section("TEST SUMMARY")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\n{'='*80}")
    print(f"Total: {passed}/{total} tests passed")
    print(f"{'='*80}")
    
    if passed == total:
        print("\n🎉 All tests passed! FastForex API is working correctly!")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Check API key or network connection.")
    
    print("\n")

if __name__ == "__main__":
    main()
