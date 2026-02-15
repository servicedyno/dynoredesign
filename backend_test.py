#!/usr/bin/env python3
"""
Backend Testing for: Add admin sweep notification email for UTXO auto-convert
"""

import requests
import subprocess
import sys
import os
import json
from datetime import datetime

# Base URL for testing
BASE_URL = "http://localhost:8001"

def log(message):
    """Log a message with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def test_backend_health():
    """TEST 1: Backend healthy"""
    log("TEST 1: Testing backend health...")
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                log("✅ TEST 1 PASSED: Backend returns 200 with status 'healthy'")
                return True
            else:
                log(f"❌ TEST 1 FAILED: Backend status is '{data.get('status')}', expected 'healthy'")
                return False
        else:
            log(f"❌ TEST 1 FAILED: Backend returned status {response.status_code}")
            return False
    except Exception as e:
        log(f"❌ TEST 1 FAILED: Connection error - {str(e)}")
        return False

def test_typescript_compilation():
    """TEST 2: TypeScript compiles"""
    log("TEST 2: Testing TypeScript compilation...")
    
    try:
        # Change to backend directory and run TypeScript compiler
        result = subprocess.run(
            ["npx", "tsc", "--noEmit"], 
            cwd="/app/backend",
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            log("✅ TEST 2 PASSED: TypeScript compilation successful (exit code 0)")
            return True
        else:
            log(f"❌ TEST 2 FAILED: TypeScript compilation failed (exit code {result.returncode})")
            if result.stderr:
                log(f"   Error output: {result.stderr[:500]}")
            return False
    except subprocess.TimeoutExpired:
        log("❌ TEST 2 FAILED: TypeScript compilation timed out")
        return False
    except Exception as e:
        log(f"❌ TEST 2 FAILED: Error running TypeScript compiler - {str(e)}")
        return False

def test_sendadminfeesweep_import_usage():
    """TEST 3: sendAdminFeeSweepEmail imported and used in paymentController"""
    log("TEST 3: Testing sendAdminFeeSweepEmail import and usage...")
    
    try:
        with open("/app/backend/controller/paymentController.ts", "r") as f:
            content = f.read()
        
        # Count occurrences of sendAdminFeeSweepEmail
        occurrences = content.count("sendAdminFeeSweepEmail")
        
        if occurrences >= 2:
            log(f"✅ TEST 3 PASSED: Found {occurrences} occurrences of 'sendAdminFeeSweepEmail' (>= 2 required)")
            
            # Check for import
            has_import = "sendAdminFeeSweepEmail" in content.split('\n')[0:20]
            # Check for usage
            has_usage = "sendAdminFeeSweepEmail(" in content
            
            if has_import and has_usage:
                log("   ✓ Both import and usage found")
                return True
            else:
                log(f"   ⚠️ Found {occurrences} total occurrences but missing import or usage")
                return False
        else:
            log(f"❌ TEST 3 FAILED: Found only {occurrences} occurrences of 'sendAdminFeeSweepEmail' (need >= 2)")
            return False
    except Exception as e:
        log(f"❌ TEST 3 FAILED: Error reading file - {str(e)}")
        return False

def test_utxo_sweep_email_block():
    """TEST 4: UTXO sweep email block exists"""
    log("TEST 4: Testing UTXO sweep email block...")
    
    try:
        with open("/app/backend/controller/paymentController.ts", "r") as f:
            content = f.read()
        
        # Check for admin sweep notification log message
        log_message_found = "Admin sweep notification" in content and "UTXO" in content
        
        # Check for auto-convert UTXO direct sweep mode parameter
        sweep_mode_found = "auto-convert" in content and "UTXO direct" in content
        
        if log_message_found and sweep_mode_found:
            log("✅ TEST 4 PASSED: Found both admin sweep notification log and UTXO direct sweep mode")
            
            # Show specific lines found
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if "Admin sweep notification" in line and "UTXO" in line:
                    log(f"   ✓ Log message found at line {i+1}: {line.strip()[:100]}...")
                if "auto-convert" in line and "UTXO direct" in line:
                    log(f"   ✓ Sweep mode found at line {i+1}: {line.strip()[:100]}...")
            
            return True
        else:
            log(f"❌ TEST 4 FAILED: Missing components - log_message: {log_message_found}, sweep_mode: {sweep_mode_found}")
            return False
    except Exception as e:
        log(f"❌ TEST 4 FAILED: Error reading file - {str(e)}")
        return False

def test_sweep_mode_email_template():
    """TEST 5: Sweep mode display updated in email template"""
    log("TEST 5: Testing sweep mode display in email template...")
    
    try:
        with open("/app/backend/helper/sendEmail.ts", "r") as f:
            content = f.read()
        
        # Check for 'auto-convert' in email template
        auto_convert_found = "auto-convert" in content.lower()
        
        if auto_convert_found:
            log("✅ TEST 5 PASSED: Found 'auto-convert' in sendEmail.ts")
            
            # Show the ternary operator for sweep mode display
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if "auto-convert" in line.lower() and ("ternary" in line.lower() or "?" in line):
                    log(f"   ✓ Sweep mode ternary found at line {i+1}: {line.strip()[:150]}...")
                elif "Auto-Convert (Direct Transfer)" in line:
                    log(f"   ✓ Auto-convert display found at line {i+1}: {line.strip()[:150]}...")
            
            return True
        else:
            log("❌ TEST 5 FAILED: 'auto-convert' not found in sendEmail.ts")
            return False
    except Exception as e:
        log(f"❌ TEST 5 FAILED: Error reading file - {str(e)}")
        return False

def test_account_based_sweep_email():
    """TEST 6: Account-based sweep still has email"""
    log("TEST 6: Testing account-based sweep email in merchantPoolSweep.ts...")
    
    try:
        with open("/app/backend/services/merchantPool/merchantPoolSweep.ts", "r") as f:
            content = f.read()
        
        # Check for sendAdminFeeSweepEmail call in sweep function
        sweep_email_found = "sendAdminFeeSweepEmail" in content
        
        if sweep_email_found:
            log("✅ TEST 6 PASSED: Found 'sendAdminFeeSweepEmail' in merchantPoolSweep.ts")
            
            # Count occurrences and show context
            occurrences = content.count("sendAdminFeeSweepEmail")
            log(f"   ✓ Found {occurrences} occurrence(s) of sendAdminFeeSweepEmail")
            
            return True
        else:
            log("❌ TEST 6 FAILED: 'sendAdminFeeSweepEmail' not found in merchantPoolSweep.ts")
            return False
    except Exception as e:
        log(f"❌ TEST 6 FAILED: Error reading file - {str(e)}")
        return False

def run_comprehensive_test():
    """Run all tests and provide summary"""
    log("=" * 80)
    log("BACKEND TESTING: Add admin sweep notification email for UTXO auto-convert")
    log("=" * 80)
    
    tests = [
        ("Backend Health", test_backend_health),
        ("TypeScript Compilation", test_typescript_compilation), 
        ("sendAdminFeeSweepEmail Import/Usage", test_sendadminfeesweep_import_usage),
        ("UTXO Sweep Email Block", test_utxo_sweep_email_block),
        ("Email Template Sweep Mode", test_sweep_mode_email_template),
        ("Account-Based Sweep Email", test_account_based_sweep_email),
    ]
    
    results = []
    for test_name, test_func in tests:
        log(f"\n{'=' * 60}")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            log(f"❌ {test_name}: EXCEPTION - {str(e)}")
            results.append((test_name, False))
    
    log(f"\n{'=' * 80}")
    log("TEST SUMMARY")
    log("=" * 80)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        log(f"{status}: {test_name}")
        if result:
            passed += 1
    
    log(f"\nOVERALL RESULT: {passed}/{total} tests passed ({(passed/total*100):.1f}%)")
    
    if passed == total:
        log("🎉 ALL TESTS PASSED! UTXO admin sweep notification email implementation is working correctly.")
        return True
    else:
        log(f"⚠️  {total-passed} test(s) failed. Implementation needs attention.")
        return False

if __name__ == "__main__":
    success = run_comprehensive_test()
    sys.exit(0 if success else 1)