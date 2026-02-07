#!/usr/bin/env python3
"""
DynoPay Backend Testing - Direct API Underpayment Fix Verification
=================================================================

This script tests the fix for Direct API underpayment handling in DynoPay's webhook handler.
The fix ensures Direct API underpayments are processed immediately with actual received amount,
while Payment Link underpayments still wait for remaining payment.

Test Focus:
1. Code review verification of branching logic
2. Backend health check
3. TypeScript compilation verification
"""

import requests
import json
import os
from datetime import datetime

# Configuration
BASE_URL = "https://setup-deps-6.preview.emergentagent.com"
API_BASE_URL = f"{BASE_URL}/api"

# Test credentials from review request
TEST_EMAIL = "richard@dyno.pt"
TEST_PASSWORD = "Katiekendra123@"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.jwt_token = None
        self.company_id = None
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "tests": [],
            "summary": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "success_rate": 0
            }
        }

    def log_test(self, test_name, status, details, expected=None, actual=None):
        """Log test result"""
        test_result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        
        if expected is not None:
            test_result["expected"] = expected
        if actual is not None:
            test_result["actual"] = actual
            
        self.results["tests"].append(test_result)
        self.results["summary"]["total"] += 1
        
        if status == "PASS":
            self.results["summary"]["passed"] += 1
            print(f"✅ {test_name}")
        else:
            self.results["summary"]["failed"] += 1
            print(f"❌ {test_name}: {details}")
            
        return status == "PASS"

    def authenticate(self):
        """Authenticate with DynoPay backend"""
        try:
            response = self.session.post(f"{API_BASE_URL}/user/login", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.jwt_token = data.get('accessToken')
                self.company_id = data.get('user', {}).get('company_id')
                
                if self.jwt_token and self.company_id:
                    self.session.headers.update({"Authorization": f"Bearer {self.jwt_token}"})
                    return self.log_test(
                        "Authentication",
                        "PASS",
                        f"Successfully authenticated user (company_id: {self.company_id})"
                    )
                else:
                    return self.log_test(
                        "Authentication", 
                        "FAIL",
                        f"Missing token or company_id in response: {data}"
                    )
            else:
                return self.log_test(
                    "Authentication",
                    "FAIL", 
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            return self.log_test("Authentication", "FAIL", f"Exception: {str(e)}")

    def test_backend_health(self):
        """Test backend health endpoint"""
        try:
            response = requests.get(f"{API_BASE_URL}/status/health")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for required health indicators
                required_fields = ['status', 'timestamp']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields and data.get('status') == 'healthy':
                    return self.log_test(
                        "Backend Health Check",
                        "PASS",
                        f"Backend healthy - Status: {data.get('status')}, Timestamp: {data.get('timestamp')}"
                    )
                else:
                    return self.log_test(
                        "Backend Health Check",
                        "FAIL",
                        f"Unhealthy response - Missing fields: {missing_fields}, Data: {data}"
                    )
            else:
                return self.log_test(
                    "Backend Health Check",
                    "FAIL",
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            return self.log_test("Backend Health Check", "FAIL", f"Exception: {str(e)}")

    def verify_webhook_code_structure(self):
        """Verify the webhook handler code structure for Direct API vs Payment Link logic"""
        try:
            # Read the webhook file to verify code structure
            webhook_file_path = "/app/backend/webhooks/index.ts"
            
            if not os.path.exists(webhook_file_path):
                return self.log_test(
                    "Code Structure - Webhook File Exists",
                    "FAIL",
                    f"Webhook file not found at {webhook_file_path}"
                )
            
            with open(webhook_file_path, 'r') as f:
                content = f.read()
            
            # Test 1: Check for Direct API vs Payment Link branching logic
            required_patterns = [
                "const linkIdUnderpaid = customerData?.link_id || items?.link_id || null;",
                "const isDirectApi = !linkIdUnderpaid;",
                "if (isDirectApi) {",
                "// DIRECT API: Process immediately",
                "status: \"processing\"",
                "// PAYMENT LINK: Wait for remaining payment",
                "status: \"underpaid\"",
                "incomplete: \"true\"",
                "return res.status(200).end();"
            ]
            
            missing_patterns = []
            for pattern in required_patterns:
                if pattern not in content:
                    missing_patterns.append(pattern)
            
            if not missing_patterns:
                self.log_test(
                    "Code Structure - Direct API vs Payment Link Branching",
                    "PASS",
                    "All required branching logic patterns found in webhook handler"
                )
            else:
                self.log_test(
                    "Code Structure - Direct API vs Payment Link Branching",
                    "FAIL",
                    f"Missing patterns: {missing_patterns}"
                )
            
            # Test 2: Check finalReceivedAmount calculation
            final_amount_patterns = [
                "const isDirectApiUnderpayment = isUnderpayment && !isMinorUnderpayment && !(customerData?.link_id || items?.link_id);",
                "const finalReceivedAmount = (isCompletionPayment || isDirectApiUnderpayment) ? totalReceivedAmount : incomingAmount;"
            ]
            
            missing_final_patterns = []
            for pattern in final_amount_patterns:
                if pattern not in content:
                    missing_final_patterns.append(pattern)
            
            if not missing_final_patterns:
                self.log_test(
                    "Code Structure - finalReceivedAmount Calculation",
                    "PASS",
                    "Correct finalReceivedAmount calculation logic found"
                )
            else:
                self.log_test(
                    "Code Structure - finalReceivedAmount Calculation",
                    "FAIL",
                    f"Missing finalReceivedAmount patterns: {missing_final_patterns}"
                )
            
            # Test 3: Verify Direct API path does NOT return early
            lines = content.split('\n')
            direct_api_block_started = False
            found_fall_through_comment = False
            found_early_return = False
            
            for i, line in enumerate(lines):
                if "if (isDirectApi) {" in line:
                    direct_api_block_started = True
                elif direct_api_block_started and "} else {" in line:
                    # End of Direct API block, start of Payment Link block
                    break
                elif direct_api_block_started:
                    if "// Fall through to cryptoVerification" in line or "falling through to cryptoVerification" in line:
                        found_fall_through_comment = True
                    if "return res.status(200).end()" in line:
                        found_early_return = True
            
            if found_fall_through_comment and not found_early_return:
                self.log_test(
                    "Code Structure - Direct API No Early Return",
                    "PASS",
                    "Direct API path has fall-through comment and no early return"
                )
            else:
                self.log_test(
                    "Code Structure - Direct API No Early Return",
                    "FAIL",
                    f"Fall-through comment found: {found_fall_through_comment}, Early return found: {found_early_return}"
                )
            
            # Test 4: Verify Payment Link path has early return
            payment_link_has_return = False
            lines = content.split('\n')
            payment_link_block_started = False
            
            for line in lines:
                if "} else {" in line and "PAYMENT LINK" in content[content.find(line):content.find(line)+200]:
                    payment_link_block_started = True
                elif payment_link_block_started and "return res.status(200).end()" in line:
                    payment_link_has_return = True
                    break
                elif payment_link_block_started and line.strip() == "}":
                    break
            
            if payment_link_has_return:
                self.log_test(
                    "Code Structure - Payment Link Early Return",
                    "PASS",
                    "Payment Link path correctly returns early after setting underpaid status"
                )
            else:
                self.log_test(
                    "Code Structure - Payment Link Early Return",
                    "FAIL",
                    "Payment Link path missing early return"
                )
            
            return True
            
        except Exception as e:
            return self.log_test("Code Structure Verification", "FAIL", f"Exception: {str(e)}")

    def verify_cryptoverification_fund_distribution(self):
        """Verify cryptoVerification handles fund distribution correctly"""
        try:
            payment_controller_path = "/app/backend/controller/paymentController.ts"
            
            if not os.path.exists(payment_controller_path):
                return self.log_test(
                    "Fund Distribution - Payment Controller Exists",
                    "FAIL",
                    f"Payment controller not found at {payment_controller_path}"
                )
            
            with open(payment_controller_path, 'r') as f:
                content = f.read()
            
            # Check for fund distribution logic
            fund_distribution_patterns = [
                "if (Number(amountInUSD[0].amount) < Number(minForwarding)) {",
                "adminAmountToSend = Number(totalAmountReceived);",
                "userAmountToSend = 0;",
                "// Under threshold - all to admin",
                "// Normal distribution"
            ]
            
            missing_fund_patterns = []
            for pattern in fund_distribution_patterns:
                if pattern not in content:
                    missing_fund_patterns.append(pattern)
            
            if not missing_fund_patterns:
                return self.log_test(
                    "Fund Distribution Logic",
                    "PASS",
                    "Correct fund distribution logic found in cryptoVerification"
                )
            else:
                return self.log_test(
                    "Fund Distribution Logic",
                    "FAIL",
                    f"Missing fund distribution patterns: {missing_fund_patterns}"
                )
                
        except Exception as e:
            return self.log_test("Fund Distribution Verification", "FAIL", f"Exception: {str(e)}")

    def check_typescript_compilation(self):
        """Check for TypeScript compilation errors"""
        try:
            # Check supervisor logs for TypeScript errors
            import subprocess
            result = subprocess.run(
                ["tail", "-n", "100", "/var/log/supervisor/backend.err.log"], 
                capture_output=True, 
                text=True
            )
            
            error_indicators = [
                "error TS",
                "TypeError:",
                "SyntaxError:",
                "ReferenceError:",
                "Cannot find module",
                "Property does not exist"
            ]
            
            found_errors = []
            for line in result.stdout.split('\n'):
                for error_indicator in error_indicators:
                    if error_indicator in line:
                        found_errors.append(line.strip())
            
            if not found_errors:
                return self.log_test(
                    "TypeScript Compilation Check",
                    "PASS",
                    "No TypeScript compilation errors found in backend logs"
                )
            else:
                return self.log_test(
                    "TypeScript Compilation Check",
                    "FAIL",
                    f"TypeScript errors found: {found_errors[:3]}"  # Show first 3 errors
                )
                
        except Exception as e:
            return self.log_test("TypeScript Compilation Check", "FAIL", f"Exception: {str(e)}")

    def run_comprehensive_test(self):
        """Run all tests for Direct API underpayment fix verification"""
        print("=" * 80)
        print("DYNOPAY DIRECT API UNDERPAYMENT FIX TESTING")
        print("=" * 80)
        print(f"Testing against: {BASE_URL}")
        print(f"Test user: {TEST_EMAIL}")
        print()

        # Test 1: Backend Health
        print("1. Backend Health Check")
        self.test_backend_health()
        print()

        # Test 2: Authentication
        print("2. Authentication")
        if not self.authenticate():
            print("❌ Authentication failed - skipping API tests")
            print()
        else:
            print()

        # Test 3: Code Structure Verification
        print("3. Code Structure Verification")
        self.verify_webhook_code_structure()
        print()

        # Test 4: Fund Distribution Logic
        print("4. Fund Distribution Logic")
        self.verify_cryptoverification_fund_distribution()
        print()

        # Test 5: TypeScript Compilation
        print("5. TypeScript Compilation Check")
        self.check_typescript_compilation()
        print()

        # Calculate final results
        self.results["summary"]["success_rate"] = (
            self.results["summary"]["passed"] / self.results["summary"]["total"] * 100
            if self.results["summary"]["total"] > 0 else 0
        )

        # Print final summary
        print("=" * 80)
        print("DIRECT API UNDERPAYMENT FIX TEST SUMMARY")
        print("=" * 80)
        print(f"Total Tests: {self.results['summary']['total']}")
        print(f"Passed: {self.results['summary']['passed']}")
        print(f"Failed: {self.results['summary']['failed']}")
        print(f"Success Rate: {self.results['summary']['success_rate']:.1f}%")
        print()

        # Print failed tests details
        failed_tests = [test for test in self.results["tests"] if test["status"] == "FAIL"]
        if failed_tests:
            print("FAILED TESTS:")
            for test in failed_tests:
                print(f"❌ {test['test']}: {test['details']}")
            print()

        # Determine overall status
        if self.results["summary"]["success_rate"] >= 95:
            print("🎉 OVERALL STATUS: ALL CRITICAL TESTS PASSED")
            print("   Direct API underpayment fix is properly implemented")
        elif self.results["summary"]["success_rate"] >= 75:
            print("⚠️  OVERALL STATUS: MOSTLY WORKING WITH MINOR ISSUES")
            print("   Core functionality implemented but some minor issues detected")
        else:
            print("🚨 OVERALL STATUS: CRITICAL ISSUES FOUND")
            print("   Direct API underpayment fix needs attention")

        return self.results

if __name__ == "__main__":
    tester = BackendTester()
    results = tester.run_comprehensive_test()
    
    # Save results
    with open('/app/direct_api_underpayment_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nDetailed results saved to: /app/direct_api_underpayment_test_results.json")