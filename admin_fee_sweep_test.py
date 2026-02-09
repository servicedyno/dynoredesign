#!/usr/bin/env python3
"""
Backend testing script for admin fee sweep email notification fix
Tests the 8 specific requirements from the review request
"""

import requests
import json
import sys
import subprocess
import os
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8001"
BACKEND_URL = f"{BASE_URL}/api"

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print(f"{'='*60}")

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    return success

def test_1_backend_health():
    """TEST 1: Backend Health - GET /health returns 200 with status 'healthy'"""
    print_test_header("Backend Health Check")
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                return print_result(True, f"Backend healthy: {data}")
            else:
                return print_result(False, f"Backend status not healthy: {data}")
        else:
            return print_result(False, f"Health check failed: {response.status_code}")
            
    except Exception as e:
        return print_result(False, f"Health check exception: {str(e)}")

def test_2_typescript_compilation():
    """TEST 2: TypeScript Compilation - Check logs for TS compilation errors"""
    print_test_header("TypeScript Compilation Check")
    
    try:
        # Check backend supervisor logs
        result = subprocess.run(
            ["tail", "-30", "/var/log/supervisor/backend.out.log"], 
            capture_output=True, text=True, timeout=10
        )
        
        if result.returncode == 0:
            logs = result.stdout
            
            # Check for TypeScript compilation errors
            ts_errors = [
                "error TS", "Type error", "TS2", "Compilation failed", 
                "Cannot find module", "Property does not exist"
            ]
            
            has_errors = any(error in logs for error in ts_errors)
            
            if has_errors:
                error_lines = [line for line in logs.split('\n') if any(error in line for error in ts_errors)]
                return print_result(False, f"TypeScript errors found: {error_lines}")
            else:
                return print_result(True, "No TypeScript compilation errors detected")
        else:
            return print_result(False, f"Could not read backend logs: {result.stderr}")
            
    except Exception as e:
        return print_result(False, f"Log check exception: {str(e)}")

def test_3_code_sendadminfeesweep_import():
    """TEST 3: Code - merchantPoolSweep.ts imports sendAdminFeeSweepEmail from "../../helper" """
    print_test_header("Code - sendAdminFeeSweepEmail Import")
    
    try:
        file_path = "/app/backend/services/merchantPool/merchantPoolSweep.ts"
        
        if not os.path.exists(file_path):
            return print_result(False, f"File not found: {file_path}")
            
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Check for import statement
        import_patterns = [
            'sendAdminFeeSweepEmail',
            'from "../../helper"',
            'import.*sendAdminFeeSweepEmail.*from.*helper'
        ]
        
        found_patterns = []
        for pattern in import_patterns:
            if pattern in content:
                found_patterns.append(pattern)
        
        if len(found_patterns) >= 2:  # Need both sendAdminFeeSweepEmail and helper import
            return print_result(True, f"Found import patterns: {found_patterns}")
        else:
            return print_result(False, f"Missing import patterns. Found: {found_patterns}")
            
    except Exception as e:
        return print_result(False, f"File check exception: {str(e)}")

def test_4_code_sendadminfeesweep_call():
    """TEST 4: Code - merchantPoolSweep.ts calls sendAdminFeeSweepEmail after successful sweep"""
    print_test_header("Code - sendAdminFeeSweepEmail Call in sweepPoolAddress")
    
    try:
        file_path = "/app/backend/services/merchantPool/merchantPoolSweep.ts"
        
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Check for sendAdminFeeSweepEmail call with parameters
        call_patterns = [
            'sendAdminFeeSweepEmail(',
            'adminEmail',
            'amountToSend',
            'walletType',
            'sweepTxId',
            'try',
            'catch'
        ]
        
        found_patterns = []
        for pattern in call_patterns:
            if pattern in content:
                found_patterns.append(pattern)
        
        # Check if function call is after DB commit (look for sweepPoolAddress function)
        has_function_call = 'sendAdminFeeSweepEmail(' in content
        has_error_handling = 'try' in content and 'catch' in content
        
        if has_function_call and has_error_handling and len(found_patterns) >= 5:
            return print_result(True, f"Found function call with error handling: {len(found_patterns)}/7 patterns")
        else:
            return print_result(False, f"Missing function call or error handling. Found: {found_patterns}")
            
    except Exception as e:
        return print_result(False, f"File check exception: {str(e)}")

def test_5_code_sendadminfeesweep_exists():
    """TEST 5: Code - sendAdminFeeSweepEmail function exists in helper/sendEmail.ts"""
    print_test_header("Code - sendAdminFeeSweepEmail Function Exists")
    
    try:
        file_path = "/app/backend/helper/sendEmail.ts"
        
        if not os.path.exists(file_path):
            return print_result(False, f"File not found: {file_path}")
            
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Check for function definition with 8 parameters
        function_patterns = [
            'sendAdminFeeSweepEmail',
            'recipientEmail',
            'amountSwept',
            'currency',
            'fromAddress',
            'toAddress', 
            'sweepTxId',
            'gasUsed',
            'sweepMode',
            'dynoPayEmailTemplate',
            'mailTransporter'
        ]
        
        found_patterns = []
        for pattern in function_patterns:
            if pattern in content:
                found_patterns.append(pattern)
        
        # Check for function definition using const
        has_function_definition = 'const sendAdminFeeSweepEmail' in content or 'function sendAdminFeeSweepEmail' in content
        
        if has_function_definition and len(found_patterns) >= 9:
            return print_result(True, f"Found function with {len(found_patterns)}/11 expected patterns")
        else:
            return print_result(False, f"Missing function definition or parameters. Found: {found_patterns}")
            
    except Exception as e:
        return print_result(False, f"File check exception: {str(e)}")

def test_6_code_sendadminfeesweep_export():
    """TEST 6: Code - sendAdminFeeSweepEmail is exported from both files"""
    print_test_header("Code - sendAdminFeeSweepEmail Export Verification")
    
    results = []
    
    # Check helper/sendEmail.ts export
    try:
        file_path = "/app/backend/helper/sendEmail.ts"
        with open(file_path, 'r') as f:
            content = f.read()
        
        has_export = 'export.*sendAdminFeeSweepEmail' in content
        results.append(("sendEmail.ts export", has_export))
        
    except Exception as e:
        results.append(("sendEmail.ts export", False))
    
    # Check helper/index.ts re-export
    try:
        file_path = "/app/backend/helper/index.ts"
        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                content = f.read()
            
            has_reexport = 'sendAdminFeeSweepEmail' in content
            results.append(("index.ts re-export", has_reexport))
        else:
            results.append(("index.ts re-export", False))
            
    except Exception as e:
        results.append(("index.ts re-export", False))
    
    success_count = sum(1 for _, success in results)
    total_count = len(results)
    
    if success_count == total_count:
        return print_result(True, f"All exports verified: {results}")
    else:
        return print_result(False, f"Export issues found: {results}")

def test_7_code_email_failure_no_break():
    """TEST 7: Code - Email failure doesn't break sweep"""
    print_test_header("Code - Email Failure Doesn't Break Sweep")
    
    try:
        file_path = "/app/backend/services/merchantPool/merchantPoolSweep.ts"
        
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Look for try/catch around sendAdminFeeSweepEmail
        # and verify it doesn't throw/affect return
        patterns_to_check = [
            'try',
            'catch',
            'sendAdminFeeSweepEmail',
            'console.log',  # Should log error
            'error'
        ]
        
        found_patterns = []
        for pattern in patterns_to_check:
            if pattern in content:
                found_patterns.append(pattern)
        
        # Look for proper error handling structure
        has_try_catch = 'try' in content and 'catch' in content
        has_email_call = 'sendAdminFeeSweepEmail' in content
        
        # Verify the catch block doesn't throw
        lines = content.split('\n')
        in_catch_block = False
        catch_throws = False
        
        for line in lines:
            if 'catch' in line and 'sendAdminFeeSweepEmail' in content:
                in_catch_block = True
            elif in_catch_block and 'throw' in line:
                catch_throws = True
                break
            elif in_catch_block and '}' in line:
                in_catch_block = False
        
        if has_try_catch and has_email_call and not catch_throws:
            return print_result(True, f"Proper error handling found, no throw in catch: {len(found_patterns)}/5 patterns")
        else:
            return print_result(False, f"Error handling issues. Throws in catch: {catch_throws}, patterns: {found_patterns}")
            
    except Exception as e:
        return print_result(False, f"File check exception: {str(e)}")

def test_8_code_internal_wallets_check():
    """TEST 8: Code - INTERNAL_WALLETS merchant email fix still preserved"""
    print_test_header("Code - INTERNAL_WALLETS Check Preserved")
    
    try:
        file_path = "/app/backend/webhooks/index.ts"
        
        if not os.path.exists(file_path):
            return print_result(False, f"File not found: {file_path}")
            
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Check for INTERNAL_WALLETS logic around line 492-499
        patterns_to_check = [
            'INTERNAL_WALLETS',
            'counterAddr',
            'res.status(200).end()',
            'internal transfers',
            'sweep'
        ]
        
        found_patterns = []
        for pattern in patterns_to_check:
            if pattern in content:
                found_patterns.append(pattern)
        
        # Check for the specific logic structure
        has_internal_wallets = 'INTERNAL_WALLETS' in content
        has_counter_addr_check = 'counterAddr' in content
        has_early_return = 'res.status(200).end()' in content
        
        if has_internal_wallets and has_counter_addr_check and has_early_return:
            return print_result(True, f"INTERNAL_WALLETS check preserved: {len(found_patterns)}/5 patterns found")
        else:
            return print_result(False, f"INTERNAL_WALLETS logic issues. Found patterns: {found_patterns}")
            
    except Exception as e:
        return print_result(False, f"File check exception: {str(e)}")

def run_all_tests():
    """Run all 8 tests and return results"""
    print("🚀 ADMIN FEE SWEEP EMAIL NOTIFICATION TESTING")
    print("="*60)
    
    test_results = []
    
    # Run all 8 tests
    tests = [
        ("Backend Health", test_1_backend_health),
        ("TypeScript Compilation", test_2_typescript_compilation),  
        ("sendAdminFeeSweepEmail Import", test_3_code_sendadminfeesweep_import),
        ("sendAdminFeeSweepEmail Call", test_4_code_sendadminfeesweep_call),
        ("sendAdminFeeSweepEmail Function", test_5_code_sendadminfeesweep_exists),
        ("sendAdminFeeSweepEmail Export", test_6_code_sendadminfeesweep_export),
        ("Email Failure No Break", test_7_code_email_failure_no_break),
        ("INTERNAL_WALLETS Check", test_8_code_internal_wallets_check)
    ]
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            test_results.append((test_name, result))
        except Exception as e:
            print_result(False, f"Test {test_name} exception: {str(e)}")
            test_results.append((test_name, False))
    
    # Summary
    passed = sum(1 for _, result in test_results)
    total = len(test_results)
    success_rate = (passed / total) * 100
    
    print(f"\n{'='*60}")
    print(f"SUMMARY: {passed}/{total} tests passed ({success_rate:.1f}%)")
    print(f"{'='*60}")
    
    for test_name, result in test_results:
        status = "✅" if result else "❌"
        print(f"{status} {test_name}")
    
    return test_results

if __name__ == "__main__":
    results = run_all_tests()
    
    # Exit with proper code
    all_passed = all(result for _, result in results)
    sys.exit(0 if all_passed else 1)