#!/usr/bin/env python3
"""
DynoPay Backend Testing - Orphan Payment Recovery Fixes Verification
Tests the two fixes: Configurable Reservation Timeout + Orphan Payment Detection
READ-ONLY verification as requested
"""

import requests
import json
import os
import subprocess
import time

def log_result(test_name, success, details=""):
    status = "✅" if success else "❌"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")
    return success

def run_bash_command(command):
    """Execute bash command and return output"""
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, cwd="/app/backend")
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except Exception as e:
        return False, "", str(e)

def main():
    print("=" * 80)
    print("DYNOPAY ORPHAN PAYMENT RECOVERY FIXES VERIFICATION")
    print("READ-ONLY testing as requested in review")
    print("=" * 80)
    
    backend_url = "http://localhost:8001"
    total_tests = 0
    passed_tests = 0
    
    # =================================================================
    # FIX 1 VERIFICATION: Configurable Reservation Timeout (120 min)
    # =================================================================
    print("\n🔧 FIX 1: CONFIGURABLE RESERVATION TIMEOUT VERIFICATION")
    print("-" * 60)
    
    # Test 1.1: Check line ~41 for environment variable usage
    total_tests += 1
    success, stdout, stderr = run_bash_command("grep -n 'RESERVATION_TIMEOUT_MINUTES.*parseInt.*process.env' services/merchantPoolService.ts")
    if success and "120" in stdout:
        passed_tests += log_result("Line 41: Uses parseInt(process.env.RESERVATION_TIMEOUT_MINUTES)", True, 
                                 f"Found: {stdout.split(':')[2].strip()}")
    else:
        log_result("Line 41: Uses parseInt(process.env.RESERVATION_TIMEOUT_MINUTES)", False, 
                  "Still hardcoded or incorrect format")
    
    # Test 1.2: Check .env file has RESERVATION_TIMEOUT_MINUTES=120
    total_tests += 1
    success, stdout, stderr = run_bash_command("grep 'RESERVATION_TIMEOUT_MINUTES=120' .env")
    if success:
        passed_tests += log_result(".env has RESERVATION_TIMEOUT_MINUTES=120", True)
    else:
        log_result(".env has RESERVATION_TIMEOUT_MINUTES=120", False, "Missing or incorrect value")
    
    # Test 1.3: Check minutesSinceReserved uses POOL_CONFIG.RESERVATION_TIMEOUT_MINUTES
    total_tests += 1
    success, stdout, stderr = run_bash_command("grep -n 'minutesSinceReserved.*POOL_CONFIG.RESERVATION_TIMEOUT_MINUTES' services/merchantPoolService.ts")
    if success:
        passed_tests += log_result("minutesSinceReserved uses POOL_CONFIG value", True,
                                 f"Line {stdout.split(':')[0]}: Correct implementation")
    else:
        log_result("minutesSinceReserved uses POOL_CONFIG value", False, "Still hardcoded 30")
    
    # =================================================================
    # FIX 2 VERIFICATION: Orphan Payment Detection
    # =================================================================
    print("\n🔧 FIX 2: ORPHAN PAYMENT DETECTION VERIFICATION")
    print("-" * 60)
    
    # Test 2.1: Check DB column exists
    total_tests += 1
    db_check_cmd = '''node -e "const{Sequelize}=require('sequelize');require('dotenv').config();const s=new Sequelize(process.env.DB_NAME,process.env.USER_NAME,process.env.PASSWORD,{host:process.env.HOST,port:process.env.DB_PORT,dialect:'postgres',logging:false});(async()=>{const[c]=await s.query(\\"SELECT column_name FROM information_schema.columns WHERE table_name='tbl_merchant_temp_address' AND column_name='last_payment_context'\\");console.log('exists:',c.length>0);await s.close()})()"'''
    success, stdout, stderr = run_bash_command(db_check_cmd)
    if success and "exists: true" in stdout:
        passed_tests += log_result("DB column last_payment_context exists", True)
    else:
        log_result("DB column last_payment_context exists", False, f"Output: {stdout}")
    
    # Test 2.2: Check model has DataTypes.TEXT definition
    total_tests += 1
    success, stdout, stderr = run_bash_command("grep -A2 -B2 'last_payment_context' models/merchantPoolModels/index.ts")
    if success and "DataTypes.TEXT" in stdout:
        passed_tests += log_result("Model has last_payment_context DataTypes.TEXT", True)
    else:
        log_result("Model has last_payment_context DataTypes.TEXT", False)
    
    # Test 2.3: Check ORPHAN RECOVERY comment in releaseExpiredReservations
    total_tests += 1
    success, stdout, stderr = run_bash_command("grep -n 'ORPHAN RECOVERY' services/merchantPoolService.ts")
    if success:
        passed_tests += log_result("ORPHAN RECOVERY comment exists", True, f"Line {stdout.split(':')[0]}")
        
        # Test 2.3b: Verify context saving code exists near the comment
        total_tests += 1
        success2, stdout2, stderr2 = run_bash_command("grep -A10 'ORPHAN RECOVERY' services/merchantPoolService.ts | grep 'JSON.stringify'")
        if success2:
            passed_tests += log_result("Context saving with JSON.stringify found", True)
        else:
            log_result("Context saving with JSON.stringify found", False)
    else:
        log_result("ORPHAN RECOVERY comment exists", False)
        total_tests += 1  # Add the skipped 2.3b test
    
    # Test 2.4: Check detectOrphanPayments function exists
    total_tests += 1
    success, stdout, stderr = run_bash_command("grep -n 'export const detectOrphanPayments' services/merchantPoolService.ts")
    if success:
        passed_tests += log_result("detectOrphanPayments function exists", True, f"Line {stdout.split(':')[0]}")
    else:
        log_result("detectOrphanPayments function exists", False)
    
    # Test 2.5: Check detectOrphanPayments is exported
    total_tests += 1
    success, stdout, stderr = run_bash_command("grep -A10 -B5 'detectOrphanPayments,' services/merchantPoolService.ts")
    if success and "export" in stdout:
        passed_tests += log_result("detectOrphanPayments is exported", True)
    else:
        log_result("detectOrphanPayments is exported", False)
    
    # Test 2.6: Check cron job registered
    total_tests += 1
    success, stdout, stderr = run_bash_command("grep -A3 -B3 'detectOrphanPayments' server.ts")
    if success and "*/10 * * * *" in stdout:
        passed_tests += log_result("Cron job registered (*/10 * * * *)", True)
    else:
        log_result("Cron job registered (*/10 * * * *)", False)
    
    # =================================================================
    # BACKEND HEALTH & FUNCTIONALITY TESTS
    # =================================================================
    print("\n🏥 BACKEND HEALTH & FUNCTIONALITY TESTS")
    print("-" * 60)
    
    # Test 3.1: Backend health endpoint
    total_tests += 1
    try:
        response = requests.get(f"{backend_url}/health", timeout=10)
        if response.status_code == 200 and "healthy" in response.text:
            passed_tests += log_result("Backend health check", True, f"Status: {response.json().get('status', 'unknown')}")
        else:
            log_result("Backend health check", False, f"HTTP {response.status_code}")
    except Exception as e:
        log_result("Backend health check", False, str(e))
    
    # Test 3.2: Check OrphanDetect logs
    total_tests += 1
    success, stdout, stderr = run_bash_command("grep 'OrphanDetect' /var/log/supervisor/backend.out.log | tail -5")
    if success and stdout:
        passed_tests += log_result("OrphanDetect logs present", True, "Cron job is running")
        print(f"   Recent logs: {stdout}")
    else:
        log_result("OrphanDetect logs present", False, "No recent logs found")
    
    # =================================================================
    # SUMMARY
    # =================================================================
    print("\n" + "=" * 80)
    print("VERIFICATION SUMMARY")
    print("=" * 80)
    
    success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
    print(f"Tests Passed: {passed_tests}/{total_tests} ({success_rate:.1f}%)")
    
    # Detailed status for each fix
    print(f"\n📊 FIX STATUS:")
    
    if success_rate >= 90:
        print("🎉 OVERALL STATUS: Both fixes are properly implemented!")
    elif success_rate >= 70:
        print("⚠️  OVERALL STATUS: Most components working, minor issues detected")
    else:
        print("❌ OVERALL STATUS: Critical issues found that need immediate attention")
    
    print(f"\n🔗 Backend URL: {backend_url}")
    print("✅ READ-ONLY verification completed as requested")

if __name__ == "__main__":
    main()