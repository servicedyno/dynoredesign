#!/usr/bin/env python3
"""
Backend Test Suite for Railway Usage Optimization Phase 2
Tests health check DB retention + startup import consolidation
"""

import requests
import subprocess
import os
import sys
from typing import Dict, Any, Tuple

def log_test(test_name: str, passed: bool, details: str = ""):
    """Log test results with emoji indicators"""
    icon = "✅" if passed else "❌"
    print(f"{icon} TEST {test_name}: {'PASS' if passed else 'FAIL'}")
    if details:
        print(f"   {details}")
    return passed

def run_command(cmd: str, cwd: str = None) -> Tuple[int, str, str]:
    """Run shell command and return exit code, stdout, stderr"""
    try:
        result = subprocess.run(
            cmd, shell=True, cwd=cwd, 
            capture_output=True, text=True, timeout=30
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 1, "", "Command timed out"
    except Exception as e:
        return 1, "", str(e)

def test_backend_health() -> bool:
    """TEST 1: Backend Health"""
    try:
        response = requests.get("http://localhost:8001/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                return log_test("1", True, f"Health check passed: {data}")
            else:
                return log_test("1", False, f"Status not healthy: {data}")
        else:
            return log_test("1", False, f"HTTP {response.status_code}: {response.text}")
    except Exception as e:
        return log_test("1", False, f"Request failed: {str(e)}")

def test_typescript_compilation() -> bool:
    """TEST 2: TypeScript Compilation"""
    exit_code, stdout, stderr = run_command("npx tsc --noEmit", cwd="/app/backend")
    if exit_code == 0:
        return log_test("2", True, "TypeScript compilation successful")
    else:
        return log_test("2", False, f"Compilation failed: {stderr}")

def test_health_check_frequency() -> bool:
    """TEST 3: Health check frequency reduced to */15 * * * *"""
    exit_code, stdout, stderr = run_command("grep -n 'setupHealthCheckCron' /app/backend/utils/cronJobs.ts")
    if exit_code != 0:
        return log_test("3", False, "setupHealthCheckCron function not found")
    
    # Check for */15 * * * * schedule
    exit_code, stdout, stderr = run_command("grep '\\*/15 \\* \\* \\* \\*' /app/backend/utils/cronJobs.ts")
    if exit_code == 0:
        return log_test("3", True, f"Found 15-minute schedule: {stdout.strip()}")
    else:
        return log_test("3", False, "*/15 * * * * schedule not found")

def test_retention_cleanup_exists() -> bool:
    """TEST 4: Retention cleanup function exists"""
    exit_code, stdout, stderr = run_command("grep 'pruneOldHealthChecks' /app/backend/services/monitoringService.ts")
    if exit_code == 0 and "pruneOldHealthChecks" in stdout:
        return log_test("4", True, f"pruneOldHealthChecks function found: {stdout.strip()}")
    else:
        return log_test("4", False, "pruneOldHealthChecks function not found")

def test_daily_prune_cron() -> bool:
    """TEST 5: Daily prune cron schedule at 3:00 AM UTC"""
    exit_code, stdout, stderr = run_command("grep -A5 '0 3' /app/backend/utils/cronJobs.ts")
    if exit_code == 0:
        # Check if it calls pruneOldHealthChecks (also check for dynamic require pattern)
        if "monitoringService.pruneOldHealthChecks" in stdout or "pruneOldHealthChecks" in stdout:
            return log_test("5", True, f"Daily cleanup cron found calling pruneOldHealthChecks")
        else:
            return log_test("5", False, f"Found '0 3' but doesn't call pruneOldHealthChecks: {stdout}")
    else:
        return log_test("5", False, "Daily cleanup cron '0 3 * * *' not found")

def test_startup_log_15min() -> bool:
    """TEST 6: Startup log confirms 15 min schedule"""
    exit_code, stdout, stderr = run_command("grep 'every 15 minutes' /var/log/supervisor/backend.out.log")
    if exit_code == 0:
        return log_test("6", True, f"Found 15-minute confirmation log: {stdout.strip()}")
    else:
        return log_test("6", False, "'every 15 minutes' not found in startup logs")

def test_startup_log_retention() -> bool:
    """TEST 7: Startup log confirms retention cron"""
    exit_code, stdout, stderr = run_command("grep '7-day retention' /var/log/supervisor/backend.out.log")
    if exit_code == 0:
        return log_test("7", True, f"Found retention confirmation log: {stdout.strip()}")
    else:
        return log_test("7", False, "'7-day retention' not found in startup logs")

def test_single_import() -> bool:
    """TEST 8: Single consolidated import"""
    # Count actual import statements, not comments
    exit_code, stdout, stderr = run_command("grep -c '} = await import(\"./models\")' /app/backend/server.ts")
    if exit_code == 0:
        count = int(stdout.strip())
        if count == 1:
            return log_test("8", True, f"Exactly 1 'await import(\"./models\")' found")
        else:
            return log_test("8", False, f"Found {count} imports, expected exactly 1")
    else:
        return log_test("8", False, "Error counting import statements")

def test_models_in_single_import() -> bool:
    """TEST 9: All models in single import block"""
    # Check for refereeCodeModel in same import as merchantWalletModel
    exit_code, stdout, stderr = run_command("grep 'refereeCodeModel' /app/backend/server.ts")
    if exit_code != 0:
        return log_test("9", False, "refereeCodeModel not found")
    
    # Check for userModel in same import as merchantWalletModel  
    exit_code, stdout, stderr = run_command("grep 'userModel' /app/backend/server.ts")
    if exit_code != 0:
        return log_test("9", False, "userModel not found")
    
    # Check they're in the same destructured import (not separate await import calls)
    exit_code, stdout, stderr = run_command("grep -A10 -B5 'await import.*models' /app/backend/server.ts")
    if exit_code == 0:
        import_block = stdout
        if "refereeCodeModel" in import_block and "userModel" in import_block and "merchantWalletModel" in import_block:
            return log_test("9", True, "All models found in single import block")
        else:
            return log_test("9", False, "Models not in same import block")
    else:
        return log_test("9", False, "Could not find import block")

def main():
    """Run all tests and provide summary"""
    print("🔍 RAILWAY USAGE OPTIMIZATION PHASE 2 TESTING")
    print("=" * 60)
    
    tests = [
        test_backend_health,
        test_typescript_compilation,  
        test_health_check_frequency,
        test_retention_cleanup_exists,
        test_daily_prune_cron,
        test_startup_log_15min,
        test_startup_log_retention,
        test_single_import,
        test_models_in_single_import
    ]
    
    results = []
    for test in tests:
        try:
            results.append(test())
        except Exception as e:
            print(f"❌ TEST ERROR: {e}")
            results.append(False)
    
    print("\n" + "=" * 60)
    passed = sum(results)
    total = len(results)
    success_rate = (passed / total) * 100
    
    print(f"📊 RESULTS: {passed}/{total} tests passed ({success_rate:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Railway Usage Optimization Phase 2 is working!")
    else:
        print(f"⚠️  {total - passed} tests failed - see details above")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)