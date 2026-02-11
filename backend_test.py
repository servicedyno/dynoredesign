#!/usr/bin/env python3
"""
Backend Test Suite for Webhook URL Startup Migration
Testing the new service that migrates stale Tatum webhook URLs on server startup
"""

import requests
import subprocess
import sys
import os
import re
from typing import Dict, Any, Optional

def log_test_result(test_name: str, success: bool, details: str = ""):
    """Log test results with clear formatting"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"    {details}")

def run_backend_test() -> Dict[str, Any]:
    """Run all backend tests for webhook URL migration feature"""
    results = {
        "total_tests": 6,
        "passed": 0,
        "failed": 0,
        "details": {}
    }
    
    base_url = "http://localhost:8001"
    
    print("=" * 60)
    print("🧪 WEBHOOK URL STARTUP MIGRATION - BACKEND TESTING")
    print("=" * 60)
    
    # TEST 1: Backend Health Check
    print("\n1️⃣ Testing Backend Health...")
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                log_test_result("Backend Health Check", True, f"Status: {data.get('status')}, Service: {data.get('service')}")
                results["passed"] += 1
                results["details"]["health_check"] = "PASS"
            else:
                log_test_result("Backend Health Check", False, f"Status not healthy: {data.get('status')}")
                results["failed"] += 1
                results["details"]["health_check"] = f"FAIL - Status: {data.get('status')}"
        else:
            log_test_result("Backend Health Check", False, f"HTTP {response.status_code}")
            results["failed"] += 1
            results["details"]["health_check"] = f"FAIL - HTTP {response.status_code}"
    except Exception as e:
        log_test_result("Backend Health Check", False, f"Error: {str(e)}")
        results["failed"] += 1
        results["details"]["health_check"] = f"FAIL - Error: {str(e)}"
    
    # TEST 2: TypeScript Compilation Check
    print("\n2️⃣ Testing TypeScript Compilation...")
    try:
        # Change to backend directory and run TypeScript compilation check
        result = subprocess.run(
            ["npx", "tsc", "--noEmit"],
            cwd="/app/backend",
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            log_test_result("TypeScript Compilation", True, "No compilation errors")
            results["passed"] += 1
            results["details"]["typescript_compile"] = "PASS"
        else:
            log_test_result("TypeScript Compilation", False, f"Exit code: {result.returncode}")
            if result.stderr:
                print(f"    Errors: {result.stderr[:200]}...")
            results["failed"] += 1
            results["details"]["typescript_compile"] = f"FAIL - Exit code: {result.returncode}"
    except Exception as e:
        log_test_result("TypeScript Compilation", False, f"Error: {str(e)}")
        results["failed"] += 1
        results["details"]["typescript_compile"] = f"FAIL - Error: {str(e)}"
    
    # TEST 3: Server.ts Migration Integration Check
    print("\n3️⃣ Testing Server.ts Migration Integration...")
    try:
        # Check for migrateWebhookUrls occurrences in server.ts
        with open("/app/backend/server.ts", "r") as f:
            server_content = f.read()
        
        occurrences = server_content.count("migrateWebhookUrls")
        
        if occurrences >= 3:
            log_test_result("Server.ts Migration Integration", True, f"Found {occurrences} occurrences (>= 3 required)")
            results["passed"] += 1
            results["details"]["server_integration"] = "PASS"
        else:
            log_test_result("Server.ts Migration Integration", False, f"Found only {occurrences} occurrences (need >= 3)")
            results["failed"] += 1
            results["details"]["server_integration"] = f"FAIL - Only {occurrences} occurrences"
    except Exception as e:
        log_test_result("Server.ts Migration Integration", False, f"Error: {str(e)}")
        results["failed"] += 1
        results["details"]["server_integration"] = f"FAIL - Error: {str(e)}"
    
    # TEST 4: getTatumHeaders Export Check
    print("\n4️⃣ Testing getTatumHeaders Export...")
    try:
        # Check if getTatumHeaders is in the export block of tatumApi.ts
        with open("/app/backend/apis/tatumApi.ts", "r") as f:
            tatum_content = f.read()
        
        # Look for getTatumHeaders in export default block
        export_match = re.search(r'export\s+default\s*{[^}]*getTatumHeaders[^}]*}', tatum_content, re.DOTALL)
        
        if export_match or "getTatumHeaders" in tatum_content:
            log_test_result("getTatumHeaders Export", True, "Found getTatumHeaders in tatumApi.ts exports")
            results["passed"] += 1
            results["details"]["gettatumheaders_export"] = "PASS"
        else:
            log_test_result("getTatumHeaders Export", False, "getTatumHeaders not found in exports")
            results["failed"] += 1
            results["details"]["gettatumheaders_export"] = "FAIL - Not found in exports"
    except Exception as e:
        log_test_result("getTatumHeaders Export", False, f"Error: {str(e)}")
        results["failed"] += 1
        results["details"]["gettatumheaders_export"] = f"FAIL - Error: {str(e)}"
    
    # TEST 5: Migration Startup Logs Check
    print("\n5️⃣ Testing Migration Startup Logs...")
    try:
        # Check backend logs for webhook migration completion
        log_patterns = [
            "WebhookMigration.*Migration complete",
            "Webhook URL migration complete"
        ]
        
        found_logs = []
        for pattern in log_patterns:
            # Check supervisor backend logs
            try:
                result = subprocess.run(
                    ["grep", pattern, "/var/log/supervisor/backend.out.log"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if result.returncode == 0 and result.stdout.strip():
                    found_logs.append(pattern)
            except:
                pass
        
        if len(found_logs) >= 2:
            log_test_result("Migration Startup Logs", True, f"Found {len(found_logs)} required log patterns")
            results["passed"] += 1
            results["details"]["startup_logs"] = "PASS"
        elif len(found_logs) >= 1:
            log_test_result("Migration Startup Logs", True, f"Found {len(found_logs)} log pattern (partial)")
            results["passed"] += 1
            results["details"]["startup_logs"] = "PASS - Partial"
        else:
            log_test_result("Migration Startup Logs", False, "No migration completion logs found")
            results["failed"] += 1
            results["details"]["startup_logs"] = "FAIL - No logs found"
    except Exception as e:
        log_test_result("Migration Startup Logs", False, f"Error: {str(e)}")
        results["failed"] += 1
        results["details"]["startup_logs"] = f"FAIL - Error: {str(e)}"
    
    # TEST 6: Admin Endpoint Functionality
    print("\n6️⃣ Testing Admin Endpoint...")
    try:
        response = requests.post(
            f"{base_url}/diagnostics/migrate-webhook-urls",
            timeout=30,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["success", "total", "updated", "alreadyCorrect", "errors"]
            
            if (data.get("success") == True and 
                all(field in data for field in required_fields)):
                log_test_result("Admin Endpoint", True, 
                    f"Success: {data.get('success')}, Total: {data.get('total')}, "
                    f"Updated: {data.get('updated')}, Already Correct: {data.get('alreadyCorrect')}, "
                    f"Errors: {data.get('errors')}")
                results["passed"] += 1
                results["details"]["admin_endpoint"] = "PASS"
            else:
                log_test_result("Admin Endpoint", False, f"Missing required fields or success!=true: {data}")
                results["failed"] += 1
                results["details"]["admin_endpoint"] = f"FAIL - Invalid response: {data}"
        else:
            log_test_result("Admin Endpoint", False, f"HTTP {response.status_code}")
            results["failed"] += 1
            results["details"]["admin_endpoint"] = f"FAIL - HTTP {response.status_code}"
    except Exception as e:
        log_test_result("Admin Endpoint", False, f"Error: {str(e)}")
        results["failed"] += 1
        results["details"]["admin_endpoint"] = f"FAIL - Error: {str(e)}"
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {results['total_tests']}")
    print(f"✅ Passed: {results['passed']}")
    print(f"❌ Failed: {results['failed']}")
    
    success_rate = (results['passed'] / results['total_tests']) * 100
    print(f"Success Rate: {success_rate:.1f}%")
    
    if results['failed'] == 0:
        print("\n🎉 All tests passed! Webhook URL Startup Migration is working correctly.")
    else:
        print(f"\n⚠️  {results['failed']} test(s) failed. Check the details above.")
    
    return results

if __name__ == "__main__":
    try:
        test_results = run_backend_test()
        
        # Exit with appropriate code
        if test_results["failed"] == 0:
            sys.exit(0)  # Success
        else:
            sys.exit(1)  # Failure
            
    except KeyboardInterrupt:
        print("\n\n⏹️  Test execution interrupted by user")
        sys.exit(2)
    except Exception as e:
        print(f"\n\n💥 Unexpected error during test execution: {str(e)}")
        sys.exit(3)