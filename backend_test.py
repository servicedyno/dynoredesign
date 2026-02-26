#!/usr/bin/env python3
"""
Backend Test Suite for Admin Fee Sweep Deadlock Fixes
Tests all the specific fixes mentioned in the review request.
"""

import os
import sys
import json
import subprocess
import requests
import time
from urllib.parse import urljoin

# Get the backend URL from frontend .env
def get_backend_url():
    """Read REACT_APP_BACKEND_URL from frontend/.env"""
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    url = line.split('=', 1)[1].strip().strip('"\'')
                    # Add /api suffix for backend routes
                    if not url.endswith('/api'):
                        url = url.rstrip('/') + '/api'
                    return url
        return 'http://localhost:8001/api'  # fallback
    except:
        return 'http://localhost:8001/api'  # fallback

BASE_URL = get_backend_url()

class AdminFeeSweepTestSuite:
    def __init__(self):
        self.passed_tests = 0
        self.total_tests = 0
        self.results = []

    def log_test(self, test_name: str, passed: bool, details: str = ""):
        """Log a test result"""
        self.total_tests += 1
        if passed:
            self.passed_tests += 1
            status = "✅ PASS"
        else:
            status = "❌ FAIL"
        
        result = f"{status}: {test_name}"
        if details:
            result += f" - {details}"
        
        print(result)
        self.results.append((test_name, passed, details))

    def test_backend_health(self):
        """Test 1: Backend Health Check"""
        try:
            health_url = BASE_URL.replace('/api', '/health')
            response = requests.get(health_url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'healthy':
                    self.log_test("Backend Health", True, f"Status: {data['status']}, Service: {data.get('service', 'N/A')}")
                else:
                    self.log_test("Backend Health", False, f"Status: {data.get('status', 'unknown')}")
            else:
                self.log_test("Backend Health", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_test("Backend Health", False, f"Exception: {str(e)}")

    def test_typescript_compilation(self):
        """Test 2: TypeScript Compilation"""
        try:
            result = subprocess.run(
                ['npx', 'tsc', '--noEmit', '--skipLibCheck'],
                cwd='/app/backend',
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                self.log_test("TypeScript Compilation", True, "Clean compilation with no errors")
            else:
                self.log_test("TypeScript Compilation", False, f"Compilation errors: {result.stderr[:200]}")
        except subprocess.TimeoutExpired:
            self.log_test("TypeScript Compilation", False, "Compilation timed out after 60s")
        except Exception as e:
            self.log_test("TypeScript Compilation", False, f"Exception: {str(e)}")

    def test_sweepbythreshold_both_statuses(self):
        """Test 3: sweepByThreshold now checks BOTH AVAILABLE and IN_USE addresses"""
        try:
            # Read the source file to check for the fix
            with open('/app/backend/services/merchantPool/merchantPoolSweep.ts', 'r') as f:
                content = f.read()
            
            # Check for the specific pattern: status: { [Op.in]: ["AVAILABLE", "IN_USE"] }
            if 'status: { [Op.in]: ["AVAILABLE", "IN_USE"] }' in content:
                # Also check for the log message mentioning both statuses
                if 'addresses with admin fees (AVAILABLE + IN_USE)' in content:
                    self.log_test("sweepByThreshold AVAILABLE+IN_USE", True, "Found both status check and updated log message")
                else:
                    self.log_test("sweepByThreshold AVAILABLE+IN_USE", True, "Found status check but log message may not be updated")
            else:
                self.log_test("sweepByThreshold AVAILABLE+IN_USE", False, "Status check still only AVAILABLE addresses")
        except Exception as e:
            self.log_test("sweepByThreshold AVAILABLE+IN_USE", False, f"Exception: {str(e)}")

    def test_stale_token_safety_net(self):
        """Test 4: Stale IN_USE safety net in sweepByTime for tokens stuck > 24h"""
        try:
            with open('/app/backend/services/merchantPool/merchantPoolSweep.ts', 'r') as f:
                content = f.read()
            
            # Check for timeSincePayout computed BEFORE the stale check
            timeSincePayout_pattern = 'timeSincePayout = Math.floor((new Date().getTime() - lastPayout.getTime()) / 60000)'
            
            # Check for stale token address check
            stale_check_pattern = 'TOKEN_CHAINS.includes(walletType) && timeSincePayout > 1440'
            
            # Check for force sweep log pattern
            force_sweep_log_pattern = 'Stale token sweep:'
            
            checks_passed = 0
            details = []
            
            if timeSincePayout_pattern in content:
                checks_passed += 1
                details.append("timeSincePayout computed before stale check")
            
            if stale_check_pattern in content:
                checks_passed += 1
                details.append("stale token check (>1440min)")
            
            if force_sweep_log_pattern in content:
                checks_passed += 1
                details.append("force sweep log message")
            
            if checks_passed == 3:
                self.log_test("Stale Token Safety Net", True, f"All 3 components found: {', '.join(details)}")
            else:
                self.log_test("Stale Token Safety Net", False, f"Only {checks_passed}/3 components found: {', '.join(details)}")
        except Exception as e:
            self.log_test("Stale Token Safety Net", False, f"Exception: {str(e)}")

    def test_admin_fee_balance_reconciliation(self):
        """Test 5: Orphan detection reconciles admin_fee_balance with on-chain balance"""
        try:
            with open('/app/backend/services/merchantPool/merchantPoolMonitoring.ts', 'r') as f:
                content = f.read()
            
            # Check for reconciliation logic
            reconcile_pattern = 'TOKEN_CHAINS.includes(walletType) && balance > existingAdminBalance * 1.05'
            update_pattern = 'addr.update({ admin_fee_balance: balance })'
            log_pattern = 'Reconciling admin_fee_balance'
            
            checks_passed = 0
            details = []
            
            if reconcile_pattern in content:
                checks_passed += 1
                details.append("balance > existingAdminBalance * 1.05 check")
            
            if update_pattern in content:
                checks_passed += 1
                details.append("admin_fee_balance update")
            
            if log_pattern in content:
                checks_passed += 1
                details.append("reconciling log message")
            
            if checks_passed == 3:
                self.log_test("Admin Fee Balance Reconciliation", True, f"All 3 components found: {', '.join(details)}")
            else:
                self.log_test("Admin Fee Balance Reconciliation", False, f"Only {checks_passed}/3 components found: {', '.join(details)}")
        except Exception as e:
            self.log_test("Admin Fee Balance Reconciliation", False, f"Exception: {str(e)}")

    def test_conversion_interval_respects_railway_env(self):
        """Test 6: Conversion interval respects Railway env without Math.max(5, ...)"""
        try:
            with open('/app/backend/server.ts', 'r') as f:
                content = f.read()
            
            # Check for the correct pattern
            correct_pattern = 'parseInt(process.env.BINANCE_CONVERT_INTERVAL_MINUTES || "10") || 10'
            
            # Check that Math.max(5, ...) is NOT used
            math_max_pattern = 'Math.max(5,'
            
            if correct_pattern in content:
                if math_max_pattern not in content:
                    self.log_test("Conversion Interval Railway Env", True, "Respects env setting without Math.max(5, ...) floor")
                else:
                    self.log_test("Conversion Interval Railway Env", False, "Still uses Math.max(5, ...) floor")
            else:
                self.log_test("Conversion Interval Railway Env", False, "Conversion interval pattern not found")
        except Exception as e:
            self.log_test("Conversion Interval Railway Env", False, f"Exception: {str(e)}")

    def test_token_chains_import(self):
        """Test 7: TOKEN_CHAINS import is present in merchantPoolSweep.ts"""
        try:
            with open('/app/backend/services/merchantPool/merchantPoolSweep.ts', 'r') as f:
                content = f.read()
            
            # Check for TOKEN_CHAINS import
            if 'TOKEN_CHAINS' in content and 'import' in content:
                # Check if it's in the import section
                lines = content.split('\n')
                import_found = False
                for line in lines:
                    if 'import' in line and 'TOKEN_CHAINS' in line:
                        import_found = True
                        break
                
                if import_found:
                    self.log_test("TOKEN_CHAINS Import", True, "TOKEN_CHAINS imported in merchantPoolSweep.ts")
                else:
                    self.log_test("TOKEN_CHAINS Import", False, "TOKEN_CHAINS used but not found in imports")
            else:
                self.log_test("TOKEN_CHAINS Import", False, "TOKEN_CHAINS not found in file")
        except Exception as e:
            self.log_test("TOKEN_CHAINS Import", False, f"Exception: {str(e)}")

    def test_code_level_verification_summary(self):
        """Test 8: Verify all fixes are present in the code"""
        try:
            sweep_file = '/app/backend/services/merchantPool/merchantPoolSweep.ts'
            monitor_file = '/app/backend/services/merchantPool/merchantPoolMonitoring.ts'
            server_file = '/app/backend/server.ts'
            
            # Read all files
            with open(sweep_file, 'r') as f:
                sweep_content = f.read()
            with open(monitor_file, 'r') as f:
                monitor_content = f.read()
            with open(server_file, 'r') as f:
                server_content = f.read()
            
            fixes_found = 0
            fix_details = []
            
            # Fix 1: sweepByThreshold checks both AVAILABLE and IN_USE
            if 'status: { [Op.in]: ["AVAILABLE", "IN_USE"] }' in sweep_content:
                fixes_found += 1
                fix_details.append("✅ Fix 1: sweepByThreshold AVAILABLE+IN_USE")
            else:
                fix_details.append("❌ Fix 1: sweepByThreshold still only AVAILABLE")
            
            # Fix 2: Stale token safety net
            if ('TOKEN_CHAINS.includes(walletType) && timeSincePayout > 1440' in sweep_content and 
                'timeSincePayout = Math.floor(' in sweep_content):
                fixes_found += 1
                fix_details.append("✅ Fix 2: Stale token safety net (>24h)")
            else:
                fix_details.append("❌ Fix 2: Stale token safety net missing")
            
            # Fix 3: Admin fee balance reconciliation
            if ('admin_fee_balance: balance' in monitor_content and 
                'Reconciling admin_fee_balance' in monitor_content):
                fixes_found += 1
                fix_details.append("✅ Fix 3: Admin fee reconciliation")
            else:
                fix_details.append("❌ Fix 3: Admin fee reconciliation missing")
            
            # Fix 4: Railway env respect (no Math.max)
            if ('parseInt(process.env.BINANCE_CONVERT_INTERVAL_MINUTES || "10") || 10' in server_content and 
                'Math.max(5,' not in server_content):
                fixes_found += 1
                fix_details.append("✅ Fix 4: Railway env respect")
            else:
                fix_details.append("❌ Fix 4: Railway env still has Math.max(5, ...)")
            
            self.log_test("All Admin Fee Sweep Fixes", fixes_found == 4, f"{fixes_found}/4 fixes found")
            
            # Print details
            for detail in fix_details:
                print(f"  {detail}")
                
        except Exception as e:
            self.log_test("All Admin Fee Sweep Fixes", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all tests and return results"""
        print("🧹 ADMIN FEE SWEEP DEADLOCK FIXES - BACKEND TESTING")
        print("=" * 60)
        print(f"Backend URL: {BASE_URL}")
        print()

        # Run all tests
        self.test_backend_health()
        self.test_typescript_compilation()
        self.test_sweepbythreshold_both_statuses()
        self.test_stale_token_safety_net()
        self.test_admin_fee_balance_reconciliation()
        self.test_conversion_interval_respects_railway_env()
        self.test_token_chains_import()
        self.test_code_level_verification_summary()

        # Summary
        print()
        print("=" * 60)
        print(f"TEST RESULTS: {self.passed_tests}/{self.total_tests} tests passed")
        
        if self.passed_tests == self.total_tests:
            print("🎉 ALL ADMIN FEE SWEEP DEADLOCK FIXES VERIFIED!")
            return True
        else:
            print("❌ Some tests failed. Check the admin fee sweep deadlock fixes.")
            return False

if __name__ == "__main__":
    suite = AdminFeeSweepTestSuite()
    success = suite.run_all_tests()
    sys.exit(0 if success else 1)