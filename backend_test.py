#!/usr/bin/env python3

import re
import requests
import json
import sys

def log_test_result(test_name, success, details=""):
    """Log test results consistently"""
    status = "✅ PASS" if success else "❌ FAIL" 
    print(f"{status}: {test_name}")
    if details:
        print(f"    {details}")
    return success

def check_backend_health():
    """Test 6: Backend health check"""
    try:
        response = requests.get("https://dep-installer-44.preview.emergentagent.com/api/status/health", timeout=10)
        success = response.status_code == 200 and "healthy" in response.text
        return log_test_result("Backend Health Check", success, f"Status: {response.status_code}, Response: {response.text[:100]}")
    except Exception as e:
        return log_test_result("Backend Health Check", False, f"Error: {str(e)}")

def verify_webhooks_index_implementation():
    """Test 1: Code verification in webhooks/index.ts"""
    print("\n=== Testing webhooks/index.ts Implementation ===")
    
    try:
        with open('/app/backend/webhooks/index.ts', 'r') as f:
            content = f.read()
        
        tests_passed = 0
        total_tests = 5
        
        # Test 1.1: merchantGracePeriodMinutes variable exists and initialized to 30
        if 'merchantGracePeriodMinutes = 30' in content:
            log_test_result("merchantGracePeriodMinutes variable initialization", True, "Found: merchantGracePeriodMinutes = 30")
            tests_passed += 1
        else:
            log_test_result("merchantGracePeriodMinutes variable initialization", False, "Not found: merchantGracePeriodMinutes = 30")
        
        # Test 1.2: company.grace_period_minutes fetched and capped with Math.min
        if 'Math.min(parseInt(String(company.dataValues.grace_period_minutes)), 30)' in content:
            log_test_result("Grace period fetch and cap", True, "Found: Math.min with 30 cap")
            tests_passed += 1
        else:
            log_test_result("Grace period fetch and cap", False, "Not found: Math.min capping to 30")
        
        # Test 1.3: Redis TTL uses merchantGracePeriodMinutes * 60
        if 'merchantGracePeriodMinutes * 60' in content and 'graceTtlSeconds' in content:
            log_test_result("Redis TTL uses dynamic grace period", True, "Found: merchantGracePeriodMinutes * 60")
            tests_passed += 1
        else:
            log_test_result("Redis TTL uses dynamic grace period", False, "Not found: merchantGracePeriodMinutes * 60")
        
        # Test 1.4: Webhook payload uses merchantGracePeriodMinutes
        if 'grace_period_minutes: merchantGracePeriodMinutes' in content:
            log_test_result("Webhook payload uses merchantGracePeriodMinutes", True, "Found: grace_period_minutes: merchantGracePeriodMinutes")
            tests_passed += 1
        else:
            log_test_result("Webhook payload uses merchantGracePeriodMinutes", False, "Not found: grace_period_minutes: merchantGracePeriodMinutes")
        
        # Test 1.5: Direct API path does NOT reference grace period
        # Extract Direct API block (between isDirectApi and else block)
        direct_api_pattern = r'if \(isDirectApi\) \{(.*?)\} else \{'
        direct_api_match = re.search(direct_api_pattern, content, re.DOTALL)
        
        if direct_api_match:
            direct_api_code = direct_api_match.group(1)
            if 'grace' not in direct_api_code.lower() and 'merchantGracePeriodMinutes' not in direct_api_code:
                log_test_result("Direct API path does NOT reference grace period", True, "Direct API block clean of grace period references")
                tests_passed += 1
            else:
                log_test_result("Direct API path does NOT reference grace period", False, "Found grace period references in Direct API block")
        else:
            log_test_result("Direct API path does NOT reference grace period", False, "Could not find Direct API block")
        
        return tests_passed == total_tests
    
    except Exception as e:
        log_test_result("webhooks/index.ts verification", False, f"Error reading file: {str(e)}")
        return False

def verify_payment_controller_process_incomplete():
    """Test 2: Code verification in paymentController.ts - processIncompletePayments"""
    print("\n=== Testing paymentController.ts - processIncompletePayments ===")
    
    try:
        with open('/app/backend/controller/paymentController.ts', 'r') as f:
            content = f.read()
        
        tests_passed = 0
        total_tests = 4
        
        # Test 2.1: SQL query uses INTERVAL '5 minutes'
        if "INTERVAL '5 minutes'" in content:
            log_test_result("SQL query uses INTERVAL '5 minutes'", True, "Found: INTERVAL '5 minutes'")
            tests_passed += 1
        else:
            log_test_result("SQL query uses INTERVAL '5 minutes'", False, "Not found: INTERVAL '5 minutes'")
        
        # Test 2.2: Per-company grace period fetched inside loop
        if 'companyModel.findOne' in content and 'companyGracePeriodMinutes' in content:
            log_test_result("Per-company grace period fetched in loop", True, "Found: companyModel.findOne with companyGracePeriodMinutes")
            tests_passed += 1
        else:
            log_test_result("Per-company grace period fetched in loop", False, "Not found: per-company grace period fetch")
        
        # Test 2.3: Grace period capped with Math.min(..., 30)
        if 'Math.min(parseInt(String(companyRecord.dataValues.grace_period_minutes)), 30)' in content:
            log_test_result("Grace period capped at 30 minutes", True, "Found: Math.min capping to 30")
            tests_passed += 1
        else:
            log_test_result("Grace period capped at 30 minutes", False, "Not found: Math.min capping")
        
        # Test 2.4: Skip condition exists
        if 'minutesSincePartial < companyGracePeriodMinutes' in content and 'continue' in content:
            log_test_result("Skip condition for grace period", True, "Found: skip condition with continue")
            tests_passed += 1
        else:
            log_test_result("Skip condition for grace period", False, "Not found: skip condition")
        
        return tests_passed == total_tests
    
    except Exception as e:
        log_test_result("processIncompletePayments verification", False, f"Error reading file: {str(e)}")
        return False

def verify_payment_controller_add_verify():
    """Test 3: Code verification in paymentController.ts - addPayment + verifyCryptoPayment"""
    print("\n=== Testing paymentController.ts - addPayment + verifyCryptoPayment ===")
    
    try:
        with open('/app/backend/controller/paymentController.ts', 'r') as f:
            content = f.read()
        
        tests_passed = 0
        total_tests = 2
        
        # Test 3.1: Check around lines 438-439 area (getData function grace period)
        lines = content.split('\n')
        found_cap_438 = False
        for i, line in enumerate(lines[430:450], 430):  # Check lines 430-450
            if 'Math.min' in line and 'grace_period_minutes' in line and '30' in line:
                log_test_result("Math.min grace period cap around line 439", True, f"Found at line {i+1}: {line.strip()}")
                found_cap_438 = True
                tests_passed += 1
                break
        
        if not found_cap_438:
            log_test_result("Math.min grace period cap around line 439", False, "Not found around lines 438-439")
        
        # Test 3.2: Check around lines 3141-3143 area (another grace period reference)
        found_cap_3141 = False
        for i, line in enumerate(lines[3130:3150], 3130):  # Check lines 3130-3150
            if 'Math.min' in line and 'grace_period_minutes' in line and '30' in line:
                log_test_result("Math.min grace period cap around line 3143", True, f"Found at line {i+1}: {line.strip()}")
                found_cap_3141 = True
                tests_passed += 1
                break
        
        if not found_cap_3141:
            log_test_result("Math.min grace period cap around line 3143", False, "Not found around lines 3141-3143")
        
        return tests_passed == total_tests
    
    except Exception as e:
        log_test_result("addPayment + verifyCryptoPayment verification", False, f"Error reading file: {str(e)}")
        return False

def verify_company_controller_update():
    """Test 4: Code verification in companyController.ts - updateCompany"""
    print("\n=== Testing companyController.ts - updateCompany ===")
    
    try:
        with open('/app/backend/controller/companyController.ts', 'r') as f:
            content = f.read()
        
        tests_passed = 0
        total_tests = 2
        
        # Test 4.1: Validation block exists for grace_period_minutes 1-30
        validation_patterns = [
            'grace_period_minutes must be at least 1 minute',
            'grace_period_minutes cannot exceed 30 minutes',
            'parsed < 1',
            'parsed > 30'
        ]
        
        found_validation = all(pattern in content for pattern in validation_patterns)
        if found_validation:
            log_test_result("Validation block for grace_period_minutes (1-30)", True, "Found all validation patterns")
            tests_passed += 1
        else:
            log_test_result("Validation block for grace_period_minutes (1-30)", False, "Missing validation patterns")
        
        # Test 4.2: Returns 400 error for invalid values
        if 'errorResponseHelper(res, 400' in content and 'grace_period_minutes' in content:
            log_test_result("Returns 400 error for invalid grace period", True, "Found 400 error response")
            tests_passed += 1
        else:
            log_test_result("Returns 400 error for invalid grace period", False, "Not found 400 error response")
        
        return tests_passed == total_tests
    
    except Exception as e:
        log_test_result("updateCompany verification", False, f"Error reading file: {str(e)}")
        return False

def verify_company_model():
    """Test 5: Code verification in companyModel.ts"""
    print("\n=== Testing companyModel.ts ===")
    
    try:
        with open('/app/backend/models/companyModels/companyModel.ts', 'r') as f:
            content = f.read()
        
        tests_passed = 0
        total_tests = 1
        
        # Test 5.1: grace_period_minutes comment mentions "Max 30" and "Payment Links" and "Direct API"
        comment_patterns = ['Max 30', 'Payment Link', 'NOT.*Direct API']
        
        found_comment = all(pattern in content for pattern in comment_patterns)
        if found_comment:
            log_test_result("Comment mentions Max 30, Payment Links, and NOT Direct API", True, "Found all required comment patterns")
            tests_passed += 1
        else:
            log_test_result("Comment mentions Max 30, Payment Links, and NOT Direct API", False, "Missing comment patterns")
        
        return tests_passed == total_tests
    
    except Exception as e:
        log_test_result("companyModel.ts verification", False, f"Error reading file: {str(e)}")
        return False

def check_typescript_compilation():
    """Test 7: Check for TypeScript compilation errors"""
    print("\n=== Testing TypeScript Compilation ===")
    
    try:
        # Check supervisor status
        import subprocess
        result = subprocess.run(['sudo', 'supervisorctl', 'status'], capture_output=True, text=True, timeout=10)
        
        if 'backend' in result.stdout and 'RUNNING' in result.stdout:
            log_test_result("Backend service running", True, "Backend is running via supervisor")
        else:
            log_test_result("Backend service running", False, f"Backend status: {result.stdout}")
            return False
        
        # Check for TypeScript errors in logs
        log_result = subprocess.run(['tail', '-n', '100', '/var/log/supervisor/backend.out.log'], 
                                   capture_output=True, text=True, timeout=10)
        
        ts_errors = [
            'error TS',
            'compilation failed',
            'typescript error',
            'type error',
            'cannot find name'
        ]
        
        has_ts_errors = any(error.lower() in log_result.stdout.lower() for error in ts_errors)
        
        if has_ts_errors:
            log_test_result("No TypeScript compilation errors", False, "Found TypeScript errors in logs")
            return False
        else:
            log_test_result("No TypeScript compilation errors", True, "No TypeScript errors found")
            return True
    
    except Exception as e:
        log_test_result("TypeScript compilation check", False, f"Error checking logs: {str(e)}")
        return False

def main():
    """Run all tests for per-merchant grace period implementation"""
    print("🔍 TESTING: Per-merchant grace period for Payment Link underpayments (max 30 min cap)")
    print("=" * 80)
    
    # Track results
    all_tests = []
    
    # Run all verification tests
    all_tests.append(verify_webhooks_index_implementation())
    all_tests.append(verify_payment_controller_process_incomplete())
    all_tests.append(verify_payment_controller_add_verify())
    all_tests.append(verify_company_controller_update())
    all_tests.append(verify_company_model())
    all_tests.append(check_backend_health())
    all_tests.append(check_typescript_compilation())
    
    # Calculate results
    total_tests = len(all_tests)
    passed_tests = sum(all_tests)
    success_rate = (passed_tests / total_tests) * 100
    
    print("\n" + "=" * 80)
    print(f"📊 TEST RESULTS: {passed_tests}/{total_tests} tests passed ({success_rate:.1f}%)")
    print("=" * 80)
    
    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED! Per-merchant grace period implementation is working correctly.")
        return True
    else:
        print("⚠️ SOME TESTS FAILED! Please review the implementation.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)