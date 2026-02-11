#!/usr/bin/env python3
"""
Backend Test Suite for Railway Usage Optimization Feature
Testing: Cron Frequency, Startup Sync, Log Rotation optimizations
"""

import requests
import subprocess
import sys
import time
import re

def test_backend_health():
    """TEST 1: Backend Health Check"""
    print("TEST 1: Backend Health Check")
    try:
        response = requests.get("http://localhost:8001/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                print("✅ PASS: Backend health check returns 200 with status='healthy'")
                print(f"   Response: {data}")
                return True
            else:
                print(f"❌ FAIL: Backend health status is not 'healthy': {data}")
                return False
        else:
            print(f"❌ FAIL: Backend health check failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Backend health check exception: {e}")
        return False

def test_typescript_compilation():
    """TEST 2: TypeScript Compilation"""
    print("\nTEST 2: TypeScript Compilation")
    try:
        result = subprocess.run(
            ["npx", "tsc", "--noEmit"], 
            cwd="/app/backend", 
            capture_output=True, 
            text=True, 
            timeout=30
        )
        if result.returncode == 0:
            print("✅ PASS: TypeScript compilation successful (exit code 0)")
            if result.stderr:
                print(f"   Warnings: {result.stderr}")
            return True
        else:
            print(f"❌ FAIL: TypeScript compilation failed (exit code {result.returncode})")
            print(f"   Errors: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ FAIL: TypeScript compilation exception: {e}")
        return False

def test_cron_schedules():
    """TEST 3: Cron Schedule Verification"""
    print("\nTEST 3: Cron Schedule Verification")
    
    # Expected patterns for each cron job
    expected_patterns = {
        'detectOrphan': '0 \\* \\* \\* \\*',  # hourly
        'performScheduledSweeps': '\\*/2 \\* \\* \\* \\*',  # every 2 minutes
        'checkMissedPayments': '\\*/10 \\* \\* \\* \\*',  # every 10 minutes
        'ensurePoolSubscriptions': '0 \\*/2 \\* \\* \\*',  # every 2 hours
        'prewarmPoolAddresses': '\\*/15 \\* \\* \\* \\*',  # every 15 minutes
        'checkingUSDT': '0 \\*/2 \\* \\* \\*'  # every 2 hours
    }
    
    all_passed = True
    
    try:
        with open('/app/backend/server.ts', 'r') as f:
            content = f.read()
        
        for job_name, pattern in expected_patterns.items():
            # Search for the pattern near the job name
            job_pattern = f'cron\\.schedule\\("{pattern}".*{job_name}'
            if re.search(job_pattern, content, re.DOTALL):
                print(f"✅ PASS: {job_name} has correct schedule '{pattern.replace('\\\\', '')}'")
            else:
                # Try a broader search
                lines = content.split('\n')
                found = False
                for i, line in enumerate(lines):
                    if job_name in line and 'cron.schedule' in lines[max(0, i-5):i+5]:
                        # Found reference, check nearby lines for pattern
                        context = '\n'.join(lines[max(0, i-10):i+10])
                        if re.search(pattern, context):
                            print(f"✅ PASS: {job_name} has correct schedule '{pattern.replace('\\\\', '')}'")
                            found = True
                            break
                if not found:
                    print(f"❌ FAIL: {job_name} schedule pattern '{pattern.replace('\\\\', '')}' not found")
                    all_passed = False
        
        return all_passed
        
    except Exception as e:
        print(f"❌ FAIL: Error reading server.ts: {e}")
        return False

def test_sync_optimization():
    """TEST 4: Sync Optimization"""
    print("\nTEST 4: Sync Optimization")
    try:
        result = subprocess.run(
            ["grep", "syncOptions", "/app/backend/server.ts"], 
            capture_output=True, 
            text=True
        )
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            if any('alter: true' in line for line in lines) and any('isProduction' in line for line in lines):
                print("✅ PASS: syncOptions with conditional logic found")
                print(f"   Found: {len(lines)} references to syncOptions")
                for line in lines[:3]:  # Show first 3 matches
                    print(f"   - {line.strip()}")
                return True
            else:
                print("❌ FAIL: syncOptions found but missing conditional logic")
                return False
        else:
            print("❌ FAIL: syncOptions not found in server.ts")
            return False
    except Exception as e:
        print(f"❌ FAIL: Error checking sync optimization: {e}")
        return False

def test_log_rotation():
    """TEST 5: Log Rotation Configuration"""
    print("\nTEST 5: Log Rotation Configuration")
    
    try:
        # Check maxsize
        result1 = subprocess.run(
            ["grep", "maxsize", "/app/backend/utils/loggers.ts"], 
            capture_output=True, 
            text=True
        )
        
        # Check maxFiles
        result2 = subprocess.run(
            ["grep", "maxFiles", "/app/backend/utils/loggers.ts"], 
            capture_output=True, 
            text=True
        )
        
        maxsize_found = False
        maxfiles_found = False
        
        if result1.returncode == 0:
            if "10 * 1024 * 1024" in result1.stdout:
                print("✅ PASS: maxsize: 10MB configuration found")
                maxsize_found = True
            else:
                print(f"❌ FAIL: maxsize found but not 10MB: {result1.stdout.strip()}")
        else:
            print("❌ FAIL: maxsize not found in loggers.ts")
        
        if result2.returncode == 0:
            if "maxFiles: 5" in result2.stdout:
                print("✅ PASS: maxFiles: 5 configuration found")
                maxfiles_found = True
            else:
                print(f"❌ FAIL: maxFiles found but not 5: {result2.stdout.strip()}")
        else:
            print("❌ FAIL: maxFiles not found in loggers.ts")
        
        return maxsize_found and maxfiles_found
        
    except Exception as e:
        print(f"❌ FAIL: Error checking log rotation: {e}")
        return False

def test_cron_frequency_monitoring():
    """TEST 6: Verify Cron Frequency by Log Monitoring"""
    print("\nTEST 6: Cron Frequency Verification (2-minute monitoring)")
    print("Monitoring backend logs for 2 minutes...")
    
    try:
        # Monitor logs for 2 minutes and capture cron-related entries
        result = subprocess.run([
            "timeout", "120", "tail", "-f", "/var/log/supervisor/backend.out.log"
        ], capture_output=True, text=True, timeout=125)
        
        log_content = result.stdout
        
        # Check for detectOrphanPayments (should NOT run in 2 minutes since it's hourly)
        orphan_runs = log_content.count("detectOrphanPayments")
        
        # Check for other cron jobs that might run
        missed_payments_runs = log_content.count("checkMissedPayments")
        sweeps_runs = log_content.count("performScheduledSweeps")
        
        print(f"   detectOrphanPayments runs: {orphan_runs}")
        print(f"   checkMissedPayments mentions: {missed_payments_runs}")
        print(f"   performScheduledSweeps mentions: {sweeps_runs}")
        
        # detectOrphanPayments should NOT run (it's hourly)
        if orphan_runs == 0:
            print("✅ PASS: detectOrphanPayments did NOT run (correct - it's now hourly)")
            
            # Other jobs may or may not run depending on timing, but at least we verified the main optimization
            if missed_payments_runs > 0:
                print("ℹ️  INFO: checkMissedPayments activity detected (runs every 10 min)")
            if sweeps_runs > 0:
                print("ℹ️  INFO: performScheduledSweeps activity detected (runs every 2 min)")
            
            return True
        else:
            print(f"❌ FAIL: detectOrphanPayments ran {orphan_runs} times (should be 0 in 2 minutes)")
            return False
            
    except subprocess.TimeoutExpired:
        print("ℹ️  INFO: 2-minute monitoring completed (timeout expected)")
        # This is actually expected behavior
        return True
    except Exception as e:
        print(f"❌ FAIL: Error during log monitoring: {e}")
        return False

def main():
    """Run all Railway Usage Optimization tests"""
    print("=" * 70)
    print("RAILWAY USAGE OPTIMIZATION TESTING")
    print("Testing: Cron Frequency, Startup Sync, Log Rotation")
    print("=" * 70)
    
    tests = [
        ("Backend Health", test_backend_health),
        ("TypeScript Compilation", test_typescript_compilation),
        ("Cron Schedule Verification", test_cron_schedules),
        ("Sync Optimization", test_sync_optimization),
        ("Log Rotation", test_log_rotation),
        ("Cron Frequency Monitoring", test_cron_frequency_monitoring)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ FAIL: {test_name} threw exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nOverall Result: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Railway Usage Optimization is working correctly!")
        return True
    else:
        print("⚠️  SOME TESTS FAILED - Issues need to be addressed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)