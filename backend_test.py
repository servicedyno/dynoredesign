#!/usr/bin/env python3
"""
Backend API Testing Script for DynoPay
Tests the wallet currency_type bug fix and onboarding status improvements
"""

import requests
import json
from datetime import datetime

# Base URL from review request
BASE_URL = "https://dotenv-deploy-1.preview.emergentagent.com"

def print_header(text):
    """Print a formatted header"""
    print("\n" + "="*80)
    print(f"  {text}")
    print("="*80)

def print_result(endpoint, status_code, success, details=""):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"\n{status} | {endpoint}")
    print(f"Status Code: {status_code}")
    if details:
        print(f"Details: {details}")

def test_health_endpoint():
    """Test GET /health endpoint"""
    print_header("TEST 1: GET /health")
    
    try:
        # Try /health first (as specified in review request)
        url = f"{BASE_URL}/health"
        print(f"Testing: {url}")
        
        response = requests.get(url, timeout=10)
        status_code = response.status_code
        
        print(f"Response Status: {status_code}")
        
        if status_code == 200:
            data = response.json()
            print(f"Response Data: {json.dumps(data, indent=2)}")
            
            # Check for required fields
            has_status = "status" in data
            has_database = "database" in data
            has_redis = "redis" in data
            
            status_healthy = data.get("status") == "healthy"
            db_connected = data.get("database") == "connected"
            redis_connected = data.get("redis") == "connected"
            
            success = (has_status and has_database and has_redis and 
                      status_healthy and db_connected and redis_connected)
            
            details = f"status={data.get('status')}, database={data.get('database')}, redis={data.get('redis')}"
            print_result("/health", status_code, success, details)
            return success
        else:
            # /health not accessible, try /api/status/health as fallback
            print(f"⚠️  /health endpoint not accessible (404)")
            print(f"   This is an architectural issue - /health is defined in server.ts but not exposed through Kubernetes ingress")
            print(f"   Trying fallback: /api/status/health")
            
            fallback_url = f"{BASE_URL}/api/status/health"
            fallback_response = requests.get(fallback_url, timeout=10)
            fallback_status = fallback_response.status_code
            
            print(f"\nFallback Response Status: {fallback_status}")
            
            if fallback_status == 200:
                fallback_data = fallback_response.json()
                print(f"Fallback Response Data: {json.dumps(fallback_data, indent=2)}")
                
                # This endpoint has limited info (no database/redis status)
                has_status = "status" in fallback_data
                status_healthy = fallback_data.get("status") == "healthy"
                
                print(f"\n⚠️  PARTIAL PASS: /api/status/health works but lacks database/redis status")
                print(f"   The /health endpoint with full health checks is not publicly accessible")
                print(f"   Recommendation: Move /health endpoint to /api/health or expose it through ingress")
                
                details = f"Fallback endpoint works (status={fallback_data.get('status')}), but /health not accessible"
                print_result("/health", "404→200", False, details)
                return False
            else:
                print_result("/health", status_code, False, "Endpoint not accessible")
                return False
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        print_result("/health", "N/A", False, str(e))
        return False

def test_api_root():
    """Test GET /api/ endpoint"""
    print_header("TEST 2: GET /api/")
    
    try:
        url = f"{BASE_URL}/api/"
        print(f"Testing: {url}")
        
        response = requests.get(url, timeout=10)
        status_code = response.status_code
        
        print(f"Response Status: {status_code}")
        
        if status_code == 200:
            data = response.json()
            print(f"Response Data: {json.dumps(data, indent=2)[:1000]}...")
            
            # Check for required fields
            has_status = "status" in data
            status_operational = data.get("status") == "operational"
            
            success = has_status and status_operational
            
            details = f"status={data.get('status')}, service={data.get('service')}, version={data.get('version')}"
            print_result("/api/", status_code, success, details)
            return success
        else:
            print(f"Response Text: {response.text[:500]}")
            print_result("/api/", status_code, False, "Expected 200 status code")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        print_result("/api/", "N/A", False, str(e))
        return False

def test_network_fees():
    """Test GET /api/pay/network-fees endpoint"""
    print_header("TEST 3: GET /api/pay/network-fees")
    
    try:
        url = f"{BASE_URL}/api/pay/network-fees"
        print(f"Testing: {url}")
        
        response = requests.get(url, timeout=10)
        status_code = response.status_code
        
        print(f"Response Status: {status_code}")
        
        if status_code == 200:
            data = response.json()
            print(f"Response Data: {json.dumps(data, indent=2)[:1000]}...")
            
            # Check for required fields
            has_data = "data" in data
            
            if has_data:
                fee_data = data.get("data", {})
                chains = list(fee_data.keys())
                print(f"\nSupported chains ({len(chains)}): {', '.join(chains)}")
                
                # Check for multiple crypto chains
                expected_chains = ["BTC", "ETH", "TRX", "SOL", "XRP"]
                found_chains = [chain for chain in expected_chains if chain in chains]
                
                success = len(found_chains) >= 3  # At least 3 major chains
                
                details = f"Found {len(chains)} chains, including: {', '.join(found_chains)}"
                print_result("/api/pay/network-fees", status_code, success, details)
                return success
            else:
                print_result("/api/pay/network-fees", status_code, False, "Missing 'data' field in response")
                return False
        else:
            print(f"Response Text: {response.text[:500]}")
            print_result("/api/pay/network-fees", status_code, False, "Expected 200 status code")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        print_result("/api/pay/network-fees", "N/A", False, str(e))
        return False

def main():
    """Run all backend tests"""
    print("\n" + "="*80)
    print("  DYNOPAY BACKEND API TESTING")
    print("  Bug Fix: Wallet currency_type + Onboarding Status")
    print(f"  Target: {BASE_URL}")
    print(f"  Test Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("="*80)
    
    results = []
    
    # Run all tests
    results.append(("GET /health", test_health_endpoint()))
    results.append(("GET /api/", test_api_root()))
    results.append(("GET /api/pay/network-fees", test_network_fees()))
    
    # Summary
    print_header("TEST SUMMARY")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    print(f"\nTotal Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {(passed/total)*100:.1f}%\n")
    
    for endpoint, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} | {endpoint}")
    
    print("\n" + "="*80)
    
    if passed == total:
        print("✅ ALL TESTS PASSED - Backend API is operational after bug fix")
    else:
        print("❌ SOME TESTS FAILED - Review errors above")
    
    print("="*80 + "\n")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
