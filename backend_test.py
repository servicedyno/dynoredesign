#!/usr/bin/env python3
"""
DynoPay Backend API Testing Script
Tests the specific endpoints mentioned in review request:
1. Geo-detect API endpoint for IP-based country detection
2. Login API with specified credentials
3. Wallet API to verify wallet addresses are set
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://pod-integration-hub-2.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials (from review request)
LOGIN_EMAIL = "nomadly@moxx.co"
LOGIN_PASSWORD = "Katiekendra123@"

# Colors for output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'
    BOLD = '\033[1m'

def log_success(message: str):
    print(f"{Colors.GREEN}✅ {message}{Colors.END}")

def log_error(message: str):
    print(f"{Colors.RED}❌ {message}{Colors.END}")

def log_warning(message: str):
    print(f"{Colors.YELLOW}⚠️ {message}{Colors.END}")

def log_info(message: str):
    print(f"{Colors.BLUE}ℹ️ {message}{Colors.END}")

def log_header(message: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{message}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")

def test_geo_detect_no_headers():
    """Test GET /api/geo-detect without headers - should return default country"""
    log_header("Testing Geo-detect API - No Headers")
    
    try:
        response = requests.get(f"{API_BASE}/geo-detect", timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            if 'status' in data and 'countryCode' in data:
                log_success(f"Geo-detect API working - Status: {data.get('status')}, Country: {data.get('countryCode')}")
                
                # Additional fields check
                if 'country' in data:
                    log_info(f"Country name: {data.get('country')}")
                
                return True, data
            else:
                log_error(f"Missing required fields in response: {data}")
                return False, data
        else:
            log_error(f"API returned status {response.status_code}: {response.text}")
            return False, None
            
    except requests.exceptions.RequestException as e:
        log_error(f"Request failed: {str(e)}")
        return False, None
    except json.JSONDecodeError as e:
        log_error(f"Invalid JSON response: {str(e)}")
        return False, None

def test_geo_detect_portugal_ip():
    """Test GET /api/geo-detect with Portugal IP - should return PT"""
    log_header("Testing Geo-detect API - Portugal IP")
    
    headers = {
        "X-Forwarded-For": "85.244.0.1"
    }
    
    try:
        response = requests.get(f"{API_BASE}/geo-detect", headers=headers, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Headers sent: {headers}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            if 'status' in data and 'countryCode' in data:
                expected_country = 'PT'
                actual_country = data.get('countryCode')
                
                if actual_country == expected_country:
                    log_success(f"Portugal IP detection working - Country: {actual_country}")
                    return True, data
                else:
                    log_error(f"Expected country '{expected_country}', got '{actual_country}'")
                    return False, data
            else:
                log_error(f"Missing required fields in response: {data}")
                return False, data
        else:
            log_error(f"API returned status {response.status_code}: {response.text}")
            return False, None
            
    except requests.exceptions.RequestException as e:
        log_error(f"Request failed: {str(e)}")
        return False, None
    except json.JSONDecodeError as e:
        log_error(f"Invalid JSON response: {str(e)}")
        return False, None

def test_login():
    """Test POST /api/user/login with specified credentials"""
    log_header("Testing Login API")
    
    payload = {
        "email": LOGIN_EMAIL,
        "password": LOGIN_PASSWORD
    }
    
    try:
        response = requests.post(f"{API_BASE}/user/login", json=payload, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Payload sent: {json.dumps(payload, indent=2)}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for access token (can be in different locations)
            access_token = None
            if 'access_token' in data:
                access_token = data.get('access_token')
            elif 'data' in data and 'accessToken' in data['data']:
                access_token = data['data'].get('accessToken')
            
            if access_token:
                log_success("Login successful - Access token received")
                
                # Additional field checks (look in userData if nested)
                user_data = data.get('data', {}).get('userData', data)
                if 'referral_code' in user_data:
                    log_info(f"Referral code: {user_data.get('referral_code')}")
                
                if 'last_company_id' in user_data:
                    log_info(f"Last company ID: {user_data.get('last_company_id')}")
                
                return True, access_token, data
            else:
                log_error(f"No access token in response: {data}")
                return False, None, data
        else:
            log_error(f"Login failed with status {response.status_code}: {response.text}")
            return False, None, None
            
    except requests.exceptions.RequestException as e:
        log_error(f"Request failed: {str(e)}")
        return False, None, None
    except json.JSONDecodeError as e:
        log_error(f"Invalid JSON response: {str(e)}")
        return False, None, None

def test_wallet_api(access_token: str):
    """Test GET /api/wallet/getWallet with Bearer token"""
    log_header("Testing Wallet API")
    
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    try:
        response = requests.get(f"{API_BASE}/wallet/getWallet", headers=headers, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Headers sent: Authorization: Bearer {access_token[:20]}...")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Handle the actual response structure from the API
            if isinstance(data, dict) and 'data' in data:
                companies_data = data['data']
                log_success(f"Wallet API working - Retrieved data for {len(companies_data)} companies")
                
                total_wallets = 0
                wallets_with_addresses = 0
                wallets_with_types = 0
                
                for company_idx, company in enumerate(companies_data):
                    company_name = company.get('company_name', 'Unknown')
                    company_id = company.get('company_id', 'Unknown')
                    wallets = company.get('wallets', [])
                    wallet_count = len(wallets)
                    total_wallets += wallet_count
                    
                    print(f"\n--- Company: {company_name} (ID: {company_id}) ---")
                    print(f"Wallets in this company: {wallet_count}")
                    
                    for i, wallet in enumerate(wallets):
                        print(f"\n  --- Wallet {i+1} ---")
                        
                        # Check for wallet_type field
                        if 'wallet_type' in wallet:
                            wallets_with_types += 1
                            print(f"    Wallet Type: {wallet.get('wallet_type')}")
                        else:
                            log_warning(f"    Missing wallet_type field")
                        
                        # Check for wallet_address field
                        if 'wallet_address' in wallet and wallet.get('wallet_address'):
                            wallets_with_addresses += 1
                            address = wallet.get('wallet_address')
                            print(f"    Wallet Address: {address}")
                        else:
                            log_warning(f"    Missing or empty wallet_address field")
                        
                        # Show other relevant fields
                        for key in ['wallet_name', 'wallet_id', 'amount', 'amount_in_usd']:
                            if key in wallet:
                                print(f"    {key.replace('_', ' ').title()}: {wallet.get(key)}")
                
                # Summary
                print(f"\n--- Wallet Analysis Summary ---")
                print(f"Total companies: {len(companies_data)}")
                print(f"Total wallets: {total_wallets}")
                print(f"Wallets with type field: {wallets_with_types}")
                print(f"Wallets with address field: {wallets_with_addresses}")
                
                if wallets_with_addresses > 0:
                    log_success(f"✅ {wallets_with_addresses} wallets have addresses set")
                else:
                    log_error("❌ No wallets have addresses set")
                
                return True, data
            elif isinstance(data, list):
                wallet_count = len(data)
                log_success(f"Wallet API working - Retrieved {wallet_count} wallets")
                
                # Check each wallet for required fields
                wallets_with_addresses = 0
                wallets_with_types = 0
                
                for i, wallet in enumerate(data):
                    print(f"\n--- Wallet {i+1} ---")
                    
                    # Check for wallet_type field
                    if 'wallet_type' in wallet:
                        wallets_with_types += 1
                        print(f"  Wallet Type: {wallet.get('wallet_type')}")
                    else:
                        log_warning(f"  Missing wallet_type field")
                    
                    # Check for wallet_address field
                    if 'wallet_address' in wallet and wallet.get('wallet_address'):
                        wallets_with_addresses += 1
                        address = wallet.get('wallet_address')
                        print(f"  Wallet Address: {address}")
                    else:
                        log_warning(f"  Missing or empty wallet_address field")
                    
                    # Show other relevant fields
                    for key in ['name', 'id', 'company_id', 'status']:
                        if key in wallet:
                            print(f"  {key.title()}: {wallet.get(key)}")
                
                # Summary
                print(f"\n--- Wallet Analysis Summary ---")
                print(f"Total wallets: {wallet_count}")
                print(f"Wallets with type field: {wallets_with_types}")
                print(f"Wallets with address field: {wallets_with_addresses}")
                
                if wallets_with_addresses > 0:
                    log_success(f"✅ {wallets_with_addresses} wallets have addresses set")
                else:
                    log_error("❌ No wallets have addresses set")
                
                return True, data
            else:
                log_error(f"Unexpected response structure: {type(data)}")
                return False, data
        else:
            log_error(f"Wallet API failed with status {response.status_code}: {response.text}")
            return False, None
            
    except requests.exceptions.RequestException as e:
        log_error(f"Request failed: {str(e)}")
        return False, None
    except json.JSONDecodeError as e:
        log_error(f"Invalid JSON response: {str(e)}")
        return False, None

def main():
    """Run all tests in sequence"""
    print(f"{Colors.BOLD}DynoPay Backend API Test Suite{Colors.END}")
    print(f"Testing against: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    
    results = {
        'geo_detect_no_headers': False,
        'geo_detect_portugal': False,
        'login': False,
        'wallet_api': False
    }
    
    # Test 1: Geo-detect without headers
    success, data = test_geo_detect_no_headers()
    results['geo_detect_no_headers'] = success
    
    # Test 2: Geo-detect with Portugal IP
    success, data = test_geo_detect_portugal_ip()
    results['geo_detect_portugal'] = success
    
    # Test 3: Login
    success, access_token, login_data = test_login()
    results['login'] = success
    
    # Test 4: Wallet API (only if login successful)
    if success and access_token:
        success, wallet_data = test_wallet_api(access_token)
        results['wallet_api'] = success
    else:
        log_error("Skipping wallet API test - login failed")
    
    # Final summary
    log_header("Test Results Summary")
    
    passed_tests = 0
    total_tests = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
        if result:
            passed_tests += 1
    
    print(f"\n{Colors.BOLD}Overall: {passed_tests}/{total_tests} tests passed{Colors.END}")
    
    if passed_tests == total_tests:
        log_success("All tests passed! 🎉")
        return 0
    else:
        log_error(f"{total_tests - passed_tests} test(s) failed")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)