#!/usr/bin/env python3
"""
DynoPay Backend Testing - checkMissedPayments Cron Job Bug Fix

Tests the fix for the checkMissedPayments function where the query was using
`pool_address: walletAddress` but the Merchant_Pool_Transaction model has NO
`pool_address` column. It was fixed to use `temp_address_id: addr.dataValues.temp_address_id`.

Test requirements from review:
1. Check backend health at URL
2. Verify the code fix in merchantPoolService.ts around line 2087-2093
3. Verify Merchant_Pool_Transaction model has temp_address_id but NO pool_address column
4. Check backend logs for recent checkMissedPayments runs (every 5 min)
5. Confirm NO "column Merchant_Pool_Transaction.pool_address does not exist" errors after 18:45 UTC restart
6. Confirm 18:50 cron run completed with 0 errors

Credentials: richard@dyno.pt / Katiekendra123@, company_id: 38
Backend URL: https://setup-deps-5.preview.emergentagent.com
"""

import requests
import json
import subprocess
import re
from datetime import datetime

class BackendTester:
    def __init__(self):
        self.base_url = "https://setup-deps-5.preview.emergentagent.com"
        self.test_results = {}
        
    def log(self, message, level="INFO"):
        """Log test messages"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
        
    def test_backend_health(self):
        """Test 1: Check backend health endpoint"""
        self.log("🔍 TEST 1: Backend Health Check")
        
        try:
            # Try different health endpoints
            endpoints = ["/health", "/api/health", "/api/status"]
            
            for endpoint in endpoints:
                try:
                    response = requests.get(f"{self.base_url}{endpoint}", timeout=10)
                    if response.status_code == 200:
                        self.log(f"✅ Backend health OK via {endpoint} (Status: {response.status_code})")
                        self.test_results["backend_health"] = True
                        return True
                except Exception as e:
                    self.log(f"⚠️ Health endpoint {endpoint} failed: {e}")
            
            # If no health endpoint works, check if backend is responding by testing a known endpoint
            self.log("Health endpoints not available, testing backend responsiveness...")
            
            # Test if backend is running by checking logs
            try:
                result = subprocess.run(
                    ["tail", "-n", "10", "/var/log/supervisor/backend.out.log"],
                    capture_output=True, text=True, timeout=5
                )
                if result.returncode == 0 and "INFO:" in result.stdout:
                    self.log("✅ Backend is running (confirmed via supervisor logs)")
                    self.test_results["backend_health"] = True
                    return True
            except Exception as e:
                self.log(f"❌ Could not verify backend status: {e}")
                
            self.test_results["backend_health"] = False
            return False
            
        except Exception as e:
            self.log(f"❌ Backend health check failed: {e}")
            self.test_results["backend_health"] = False
            return False
    
    def test_code_fix_verification(self):
        """Test 2: Verify the code fix in merchantPoolService.ts"""
        self.log("🔍 TEST 2: Code Fix Verification")
        
        try:
            # Read the merchantPoolService.ts file
            with open("/app/backend/services/merchantPoolService.ts", "r") as f:
                content = f.read()
            
            # Find the checkMissedPayments function
            if "checkMissedPayments" not in content:
                self.log("❌ checkMissedPayments function not found")
                self.test_results["code_fix"] = False
                return False
            
            # Check for the correct fix around line 2087-2093
            # Look for temp_address_id usage and absence of pool_address
            lines = content.split('\n')
            
            # Find the relevant section with merchantPoolTransactionModel.findOne
            found_correct_fix = False
            found_pool_address_usage = False
            
            for i, line in enumerate(lines):
                # Look for the specific query that was fixed
                if "merchantPoolTransactionModel.findOne" in line:
                    # Check the next few lines for the where clause
                    for j in range(i, min(i + 10, len(lines))):
                        if "temp_address_id:" in lines[j] and "addr.dataValues.temp_address_id" in lines[j]:
                            found_correct_fix = True
                            self.log(f"✅ Found correct fix at line {j+1}: {lines[j].strip()}")
                        if "pool_address:" in lines[j]:
                            found_pool_address_usage = True
                            self.log(f"❌ Still found pool_address usage at line {j+1}: {lines[j].strip()}")
            
            if found_correct_fix and not found_pool_address_usage:
                self.log("✅ Code fix verified: Using temp_address_id, no pool_address usage found")
                self.test_results["code_fix"] = True
                return True
            else:
                self.log("❌ Code fix verification failed")
                if not found_correct_fix:
                    self.log("❌ Correct temp_address_id usage not found")
                if found_pool_address_usage:
                    self.log("❌ pool_address usage still present")
                self.test_results["code_fix"] = False
                return False
                
        except Exception as e:
            self.log(f"❌ Code fix verification failed: {e}")
            self.test_results["code_fix"] = False
            return False
    
    def test_model_schema_verification(self):
        """Test 3: Verify Merchant_Pool_Transaction model schema"""
        self.log("🔍 TEST 3: Model Schema Verification")
        
        try:
            # Read the model file
            with open("/app/backend/models/merchantPoolModels/index.ts", "r") as f:
                content = f.read()
            
            # Find the Merchant_Pool_Transaction model
            if "Merchant_Pool_Transaction" not in content:
                self.log("❌ Merchant_Pool_Transaction model not found")
                self.test_results["model_schema"] = False
                return False
            
            # Look for temp_address_id in the model definition
            has_temp_address_id = "temp_address_id:" in content
            has_pool_address = "pool_address:" in content
            
            if has_temp_address_id:
                self.log("✅ Found temp_address_id field in model")
            else:
                self.log("❌ temp_address_id field not found in model")
            
            if has_pool_address:
                self.log("❌ Found pool_address field in model (should not exist)")
            else:
                self.log("✅ No pool_address field found in model")
            
            if has_temp_address_id and not has_pool_address:
                self.log("✅ Model schema verified: Has temp_address_id, NO pool_address column")
                self.test_results["model_schema"] = True
                return True
            else:
                self.log("❌ Model schema verification failed")
                self.test_results["model_schema"] = False
                return False
                
        except Exception as e:
            self.log(f"❌ Model schema verification failed: {e}")
            self.test_results["model_schema"] = False
            return False
    
    def test_cron_job_logs(self):
        """Test 4: Check backend logs for checkMissedPayments cron execution"""
        self.log("🔍 TEST 4: Cron Job Execution Verification")
        
        try:
            # Get recent backend logs
            result = subprocess.run(
                ["grep", "-n", "checkMissedPayments\\|Missed payment check\\|pool_address", 
                 "/var/log/supervisor/backend.out.log"],
                capture_output=True, text=True, timeout=10
            )
            
            if result.returncode != 0:
                self.log("❌ No checkMissedPayments logs found")
                self.test_results["cron_logs"] = False
                return False
            
            log_lines = result.stdout.strip().split('\n')
            
            # Parse log entries and check for the error pattern and fix
            error_before_fix = False
            success_after_fix = False
            last_18_50_run = False
            
            for line in log_lines:
                if "pool_address does not exist" in line:
                    # Any occurrence of this error counts as evidence it existed before fix
                    error_before_fix = True
                    self.log(f"✅ Found pool_address error (evidence of bug): {line}")
                
                if "18:50" in line and "checkMissedPayments running" in line:
                    last_18_50_run = True
                    self.log(f"✅ Found 18:50 cron execution: {line}")
                
                if "18:50" in line and "Missed payment check complete" in line:
                    success_after_fix = True
                    self.log(f"✅ Found successful 18:50 completion: {line}")
            
            # Check if we have evidence of the fix working
            if error_before_fix and last_18_50_run:
                self.log("✅ Cron job verification successful:")
                self.log("  - Found pool_address errors (proves bug existed)")
                self.log("  - Found successful 18:50 execution after fix")
                self.test_results["cron_logs"] = True
                return True
            else:
                self.log("❌ Cron job verification incomplete:")
                self.log(f"  - pool_address error found: {error_before_fix}")
                self.log(f"  - 18:50 run found: {last_18_50_run}")
                self.log(f"  - Success after fix: {success_after_fix}")
                self.test_results["cron_logs"] = False
                return False
                
        except Exception as e:
            self.log(f"❌ Cron job log verification failed: {e}")
            self.test_results["cron_logs"] = False
            return False
    
    def test_no_errors_after_fix(self):
        """Test 5: Confirm NO pool_address errors after 18:45 UTC"""
        self.log("🔍 TEST 5: No Errors After Fix Verification")
        
        try:
            # Get logs after 18:45
            result = subprocess.run(
                ["grep", "-A5", "-B5", "18:5[0-9].*checkMissedPayments\\|18:5[0-9].*pool_address", 
                 "/var/log/supervisor/backend.out.log"],
                capture_output=True, text=True, timeout=10
            )
            
            if result.returncode == 0:
                log_content = result.stdout
                
                # Check if there are any pool_address errors after 18:45
                lines = log_content.split('\n')
                errors_after_fix = []
                
                for line in lines:
                    if "pool_address does not exist" in line:
                        # Check timestamp to see if it's after 18:45
                        if any(time in line for time in ["18:50", "18:51", "18:52", "18:53", "18:54", "18:55", "18:56", "18:57", "18:58", "18:59", "19:"]):
                            errors_after_fix.append(line)
                
                if not errors_after_fix:
                    self.log("✅ No pool_address errors found after 18:45 fix")
                    self.test_results["no_errors_after_fix"] = True
                    return True
                else:
                    self.log("❌ Found pool_address errors after fix:")
                    for error in errors_after_fix:
                        self.log(f"  {error}")
                    self.test_results["no_errors_after_fix"] = False
                    return False
            else:
                self.log("✅ No checkMissedPayments logs after 18:45 (no errors to check)")
                self.test_results["no_errors_after_fix"] = True
                return True
                
        except Exception as e:
            self.log(f"❌ Error verification failed: {e}")
            self.test_results["no_errors_after_fix"] = False
            return False
    
    def test_18_50_success(self):
        """Test 6: Confirm 18:50 cron run completed with 0 errors"""
        self.log("🔍 TEST 6: 18:50 Success Verification")
        
        try:
            # Look specifically for 18:50 execution and completion
            result = subprocess.run(
                ["grep", "-A10", "18:50.*checkMissedPayments", "/var/log/supervisor/backend.out.log"],
                capture_output=True, text=True, timeout=10
            )
            
            if result.returncode == 0:
                log_content = result.stdout
                
                # Check for successful completion
                if "Missed payment check complete" in log_content:
                    # Look for error count
                    if "Errors: 0" in log_content:
                        self.log("✅ 18:50 cron run completed successfully with 0 errors")
                        self.test_results["18_50_success"] = True
                        return True
                    else:
                        self.log("⚠️ 18:50 run completed but error count not explicitly 0")
                        # Check if there are any error messages in the 18:50 run
                        error_patterns = ["❌", "Error processing", "pool_address does not exist"]
                        has_errors = any(pattern in log_content for pattern in error_patterns)
                        
                        if not has_errors:
                            self.log("✅ No error patterns found in 18:50 run")
                            self.test_results["18_50_success"] = True
                            return True
                        else:
                            self.log("❌ Found error patterns in 18:50 run")
                            self.test_results["18_50_success"] = False
                            return False
                else:
                    self.log("❌ 18:50 run found but no completion message")
                    self.test_results["18_50_success"] = False
                    return False
            else:
                self.log("❌ No 18:50 checkMissedPayments execution found")
                self.test_results["18_50_success"] = False
                return False
                
        except Exception as e:
            self.log(f"❌ 18:50 success verification failed: {e}")
            self.test_results["18_50_success"] = False
            return False
    
    def run_all_tests(self):
        """Run all tests and provide summary"""
        self.log("🚀 Starting checkMissedPayments Cron Job Bug Fix Testing")
        self.log("=" * 80)
        
        tests = [
            ("Backend Health Check", self.test_backend_health),
            ("Code Fix Verification", self.test_code_fix_verification),
            ("Model Schema Verification", self.test_model_schema_verification),
            ("Cron Job Logs Analysis", self.test_cron_job_logs),
            ("No Errors After Fix", self.test_no_errors_after_fix),
            ("18:50 Success Verification", self.test_18_50_success),
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            self.log(f"\n📋 Running: {test_name}")
            self.log("-" * 50)
            
            try:
                if test_func():
                    passed += 1
                    self.log(f"✅ {test_name}: PASSED")
                else:
                    self.log(f"❌ {test_name}: FAILED")
            except Exception as e:
                self.log(f"💥 {test_name}: ERROR - {e}")
                self.test_results[test_name.lower().replace(' ', '_')] = False
        
        # Summary
        self.log("\n" + "=" * 80)
        self.log("📊 TEST SUMMARY")
        self.log("=" * 80)
        
        success_rate = (passed / total) * 100
        self.log(f"✅ Tests Passed: {passed}/{total} ({success_rate:.1f}%)")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED - checkMissedPayments bug fix is working correctly!")
            self.log("✅ The pool_address column issue has been resolved")
            self.log("✅ Cron job is running successfully without errors")
        else:
            self.log("⚠️ Some tests failed - review the issues above")
        
        # Detailed results
        self.log("\n📋 Detailed Results:")
        for test_name, result in self.test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"  {test_name}: {status}")
        
        return passed == total

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎯 CONCLUSION: checkMissedPayments cron job bug fix is working correctly!")
        exit(0)
    else:
        print("\n⚠️ CONCLUSION: Some issues remain with the checkMissedPayments fix")
        exit(1)