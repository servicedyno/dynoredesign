#!/usr/bin/env python3
"""
Error Monitoring Service Backend Testing
Testing Agent: Comprehensive testing of Error Monitoring Service implementation
"""

import requests
import subprocess
import os
import sys

def test_backend_health():
    """TEST 1: Backend health check"""
    print("🧪 TEST 1: Backend Health Check")
    try:
        response = requests.get("http://localhost:8001/health", timeout=10)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {data}")
            if data.get("status") == "healthy":
                print("   ✅ PASSED: Backend healthy")
                return True
            else:
                print("   ❌ FAILED: Backend not healthy")
                return False
        else:
            print("   ❌ FAILED: Non-200 status code")
            return False
    except Exception as e:
        print(f"   ❌ FAILED: {e}")
        return False

def test_typescript_compilation():
    """TEST 2: TypeScript compilation"""
    print("\n🧪 TEST 2: TypeScript Compilation")
    try:
        os.chdir("/app/backend")
        result = subprocess.run(["npx", "tsc", "--noEmit"], 
                              capture_output=True, text=True, timeout=60)
        print(f"   Exit code: {result.returncode}")
        if result.returncode == 0:
            print("   ✅ PASSED: TypeScript compiles without errors")
            return True
        else:
            print(f"   ❌ FAILED: TypeScript compilation errors:")
            print(f"   stdout: {result.stdout}")
            print(f"   stderr: {result.stderr}")
            return False
    except Exception as e:
        print(f"   ❌ FAILED: {e}")
        return False
    finally:
        os.chdir("/app")

def test_error_monitor_started():
    """TEST 3: Error monitor startup log"""
    print("\n🧪 TEST 3: Error Monitor Startup Log")
    try:
        result = subprocess.run(["grep", "ErrorMonitor.*Started", 
                               "/var/log/supervisor/backend.out.log"], 
                              capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            print(f"   ✅ PASSED: Found startup log:")
            print(f"   {result.stdout.strip()}")
            return True
        else:
            print("   ❌ FAILED: ErrorMonitor startup log not found")
            print(f"   grep exit code: {result.returncode}")
            return False
    except Exception as e:
        print(f"   ❌ FAILED: {e}")
        return False

def test_capture_error_usage():
    """TEST 4: captureError usage across files"""
    print("\n🧪 TEST 4: captureError Usage Verification")
    
    files_to_check = [
        ("/app/backend/helper/sendEmail.ts", 15),
        ("/app/backend/utils/cronJobs.ts", 6),
        ("/app/backend/server.ts", 8)
    ]
    
    all_passed = True
    
    for file_path, min_count in files_to_check:
        try:
            result = subprocess.run(["grep", "-c", "captureError", file_path], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                count = int(result.stdout.strip())
                print(f"   {file_path}: {count} occurrences (minimum: {min_count})")
                if count >= min_count:
                    print(f"   ✅ PASSED: {file_path}")
                else:
                    print(f"   ❌ FAILED: {file_path} - insufficient occurrences")
                    all_passed = False
            else:
                print(f"   ❌ FAILED: {file_path} - file not found or no matches")
                all_passed = False
        except Exception as e:
            print(f"   ❌ FAILED: {file_path} - {e}")
            all_passed = False
    
    return all_passed

def test_service_file_exists():
    """TEST 5: Error monitoring service file exists"""
    print("\n🧪 TEST 5: Service File Existence")
    try:
        result = subprocess.run(["ls", "/app/backend/services/errorMonitoringService.ts"], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("   ✅ PASSED: errorMonitoringService.ts exists")
            return True
        else:
            print("   ❌ FAILED: errorMonitoringService.ts not found")
            return False
    except Exception as e:
        print(f"   ❌ FAILED: {e}")
        return False

def test_diagnostics_endpoints():
    """TEST 6: Diagnostics endpoints in server.ts"""
    print("\n🧪 TEST 6: Diagnostics Endpoints")
    try:
        result = subprocess.run(["grep", "error-monitor", "/app/backend/server.ts"], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            count = len([line for line in lines if line.strip()])
            print(f"   Found {count} error-monitor route references:")
            for line in lines:
                print(f"   {line.strip()}")
            if count >= 3:
                print("   ✅ PASSED: Found 3+ error-monitor routes")
                return True
            else:
                print("   ❌ FAILED: Less than 3 error-monitor routes found")
                return False
        else:
            print("   ❌ FAILED: No error-monitor routes found")
            return False
    except Exception as e:
        print(f"   ❌ FAILED: {e}")
        return False

def main():
    """Run all Error Monitoring Service tests"""
    print("=" * 60)
    print("🔍 ERROR MONITORING SERVICE BACKEND TESTING")
    print("=" * 60)
    
    tests = [
        test_backend_health,
        test_typescript_compilation,
        test_error_monitor_started,
        test_capture_error_usage,
        test_service_file_exists,
        test_diagnostics_endpoints
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"   ❌ TEST FAILED: {e}")
            results.append(False)
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(results)
    total = len(results)
    
    test_names = [
        "Backend Health",
        "TypeScript Compilation", 
        "Error Monitor Startup",
        "captureError Usage",
        "Service File Exists",
        "Diagnostics Endpoints"
    ]
    
    for i, (name, result) in enumerate(zip(test_names, results)):
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"   TEST {i+1}: {name} - {status}")
    
    print(f"\n🎯 OVERALL RESULT: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Error Monitoring Service is working correctly!")
        return 0
    else:
        print("⚠️ SOME TESTS FAILED - Error Monitoring Service needs attention!")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)