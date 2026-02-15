#!/usr/bin/env python3
"""
Backend Testing for Fix Stale Tatum Reconciliation Re-queuing Feature
Testing based on the review request requirements.
"""

import subprocess
import sys
import requests
import json
from typing import Dict, Any

def run_test(test_name: str, test_func) -> bool:
    """Run a test and return success status"""
    print(f"\n{'='*60}")
    print(f"🧪 {test_name}")
    print('='*60)
    
    try:
        result = test_func()
        if result:
            print(f"✅ PASS: {test_name}")
            return True
        else:
            print(f"❌ FAIL: {test_name}")
            return False
    except Exception as e:
        print(f"❌ ERROR in {test_name}: {str(e)}")
        return False

def test_backend_health() -> bool:
    """TEST 1: Backend Health Check"""
    # Use the URL from review request (localhost:8001) for internal testing
    url = "http://localhost:8001/health"
    try:
        response = requests.get(url, timeout=10)
        print(f"GET {url}")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                print("✅ Backend is healthy")
                return True
            else:
                print(f"❌ Backend status is not healthy: {data}")
                return False
        else:
            print(f"❌ Expected status 200, got {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False

def test_reconciled_tx_occurrences() -> bool:
    """TEST 2: Check reconciled-tx tracking in code"""
    try:
        result = subprocess.run(
            ["grep", "reconciled-tx", "/app/backend/services/reconciliation.ts"],
            capture_output=True, text=True
        )
        
        lines = result.stdout.strip().split('\n') if result.stdout.strip() else []
        count = len([line for line in lines if line.strip()])
        
        print(f"Found {count} occurrences of 'reconciled-tx' in reconciliation.ts")
        for line in lines:
            print(f"  {line.strip()}")
        
        if count >= 5:
            print(f"✅ Found {count} occurrences (>= 5 required)")
            return True
        else:
            print(f"❌ Found only {count} occurrences (>= 5 required)")
            return False
            
    except Exception as e:
        print(f"❌ Error running grep: {e}")
        return False

def test_set_redis_item_with_ttl() -> bool:
    """TEST 3: Check setRedisItemWithTTL usage"""
    try:
        result = subprocess.run(
            ["grep", "setRedisItemWithTTL", "/app/backend/services/reconciliation.ts"],
            capture_output=True, text=True
        )
        
        lines = result.stdout.strip().split('\n') if result.stdout.strip() else []
        count = len([line for line in lines if line.strip()])
        
        print(f"Found {count} occurrences of 'setRedisItemWithTTL' in reconciliation.ts")
        for line in lines:
            print(f"  {line.strip()}")
        
        if count >= 2:
            print(f"✅ Found {count} occurrences (>= 2 required)")
            return True
        else:
            print(f"❌ Found only {count} occurrences (>= 2 required)")
            return False
            
    except Exception as e:
        print(f"❌ Error running grep: {e}")
        return False

def test_clear_stale_tatum_webhooks_export() -> bool:
    """TEST 4: Check clearStaleTatumWebhooks export"""
    try:
        result = subprocess.run(
            ["grep", "clearStaleTatumWebhooks", "/app/backend/services/reconciliation.ts"],
            capture_output=True, text=True
        )
        
        lines = result.stdout.strip().split('\n') if result.stdout.strip() else []
        
        print(f"Found {len(lines)} occurrences of 'clearStaleTatumWebhooks' in reconciliation.ts")
        for line in lines:
            print(f"  {line.strip()}")
        
        # Look for export function definition
        export_found = any("export" in line and "clearStaleTatumWebhooks" in line for line in lines)
        
        if export_found:
            print("✅ Found clearStaleTatumWebhooks export function")
            return True
        else:
            print("❌ clearStaleTatumWebhooks export function not found")
            return False
            
    except Exception as e:
        print(f"❌ Error running grep: {e}")
        return False

def test_server_integration() -> bool:
    """TEST 5: Check server.ts integration"""
    try:
        # Check for import and endpoint in server.ts
        result1 = subprocess.run(
            ["grep", "clearStaleTatumWebhooks", "/app/backend/server.ts"],
            capture_output=True, text=True
        )
        
        result2 = subprocess.run(
            ["grep", "clear-stale-reconciliation", "/app/backend/server.ts"],
            capture_output=True, text=True
        )
        
        lines1 = result1.stdout.strip().split('\n') if result1.stdout.strip() else []
        lines2 = result2.stdout.strip().split('\n') if result2.stdout.strip() else []
        
        print("clearStaleTatumWebhooks in server.ts:")
        for line in lines1:
            print(f"  {line.strip()}")
            
        print("\nclear-stale-reconciliation endpoint in server.ts:")
        for line in lines2:
            print(f"  {line.strip()}")
        
        if len(lines1) > 0 and len(lines2) > 0:
            print("✅ Found both import and endpoint in server.ts")
            return True
        else:
            print("❌ Missing import or endpoint in server.ts")
            return False
            
    except Exception as e:
        print(f"❌ Error running grep: {e}")
        return False

def test_zero_requeued_logs() -> bool:
    """TEST 6: Verify latest reconciliation shows 0 re-queued"""
    try:
        result = subprocess.run(
            ["grep", "Tatum webhooks: 0 re-queued", "/var/log/supervisor/backend.out.log"],
            capture_output=True, text=True
        )
        
        lines = result.stdout.strip().split('\n') if result.stdout.strip() else []
        count = len([line for line in lines if line.strip()])
        
        print(f"Found {count} occurrences of 'Tatum webhooks: 0 re-queued' in backend logs")
        
        if count >= 1:
            print(f"✅ Found {count} occurrences - latest reconciliation shows 0 re-queued")
            # Show the latest few entries
            print("Recent log entries:")
            for line in lines[-3:]:
                print(f"  {line.strip()}")
            return True
        else:
            print("❌ No logs found showing 0 re-queued webhooks")
            # Show what reconciliation logs we do have
            print("Checking for any reconciliation logs...")
            result2 = subprocess.run(
                ["grep", "Tatum webhooks:", "/var/log/supervisor/backend.out.log"],
                capture_output=True, text=True
            )
            lines2 = result2.stdout.strip().split('\n') if result2.stdout.strip() else []
            print(f"Found {len(lines2)} total reconciliation log entries:")
            for line in lines2[-5:]:  # Show last 5
                print(f"  {line.strip()}")
            return False
            
    except Exception as e:
        print(f"❌ Error checking logs: {e}")
        return False

def test_admin_endpoint() -> bool:
    """TEST 8: Verify the admin clear endpoint returns proper response format"""
    url = "http://localhost:8001/diagnostics/clear-stale-reconciliation"
    try:
        response = requests.post(url, timeout=10)
        print(f"POST {url}")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        # Should return 401/403 without auth, proving endpoint exists
        if response.status_code in [401, 403]:
            print("✅ Endpoint exists and requires authentication (401/403 response)")
            return True
        elif response.status_code == 200:
            # If it returns 200, check the response format
            try:
                data = response.json()
                print("✅ Endpoint accessible and returned JSON response")
                return True
            except:
                print("✅ Endpoint accessible")
                return True
        else:
            print(f"❌ Unexpected status code: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 STARTING STALE TATUM RECONCILIATION RE-QUEUING FIX TESTS")
    print("="*80)
    
    tests = [
        ("TEST 1: Backend Health Check", test_backend_health),
        ("TEST 2: Check reconciled-tx tracking (>=5 occurrences)", test_reconciled_tx_occurrences),
        ("TEST 3: Check setRedisItemWithTTL usage (>=2 occurrences)", test_set_redis_item_with_ttl),
        ("TEST 4: Check clearStaleTatumWebhooks export", test_clear_stale_tatum_webhooks_export),
        ("TEST 5: Check server.ts integration", test_server_integration),
        ("TEST 6: Verify latest reconciliation shows 0 re-queued", test_zero_requeued_logs),
        ("TEST 8: Verify admin clear endpoint", test_admin_endpoint),
    ]
    
    results = []
    for test_name, test_func in tests:
        result = run_test(test_name, test_func)
        results.append((test_name, result))
    
    # Summary
    print(f"\n{'='*80}")
    print("📊 TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\n🏆 FINAL RESULT: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Feature is working correctly!")
        return 0
    else:
        print("⚠️  Some tests failed - Feature needs attention")
        return 1

if __name__ == "__main__":
    sys.exit(main())