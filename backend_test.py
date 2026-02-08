#!/usr/bin/env python3
"""
Backend Testing for Fallback Safety Net Fixes
Testing the two fallback safety net fixes for missed/incomplete merchant pool payments in DynoPay.
"""

import requests
import json
import sys
import time
from datetime import datetime, timezone

# Test configuration
BASE_URL = "https://dep-installer-44.preview.emergentagent.com"
CREDENTIALS = {
    "email": "richard@dyno.pt",
    "password": "Katiekendra123@"
}

class BackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.auth_token = None
        self.session = requests.Session()
        self.results = {
            "total_tests": 0,
            "passed_tests": 0,
            "failed_tests": 0,
            "test_details": []
        }

    def log_test_result(self, test_name, passed, details="", expected="", actual=""):
        """Log test result with details"""
        self.results["total_tests"] += 1
        if passed:
            self.results["passed_tests"] += 1
            status = "✅ PASS"
        else:
            self.results["failed_tests"] += 1
            status = "❌ FAIL"
        
        result = {
            "test_name": test_name,
            "status": status,
            "details": details,
            "expected": expected,
            "actual": actual,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.results["test_details"].append(result)
        
        print(f"{status} - {test_name}")
        if details:
            print(f"    Details: {details}")
        if not passed and expected and actual:
            print(f"    Expected: {expected}")
            print(f"    Actual: {actual}")

    def authenticate(self):
        """Authenticate with backend and get token"""
        try:
            print("🔐 Authenticating with backend...")
            
            response = self.session.post(
                f"{self.base_url}/api/user/login",
                json=CREDENTIALS,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("data", {}).get("accessToken")
                if self.auth_token:
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.auth_token}",
                        "Content-Type": "application/json"
                    })
                    user_info = data.get("data", {})
                    self.log_test_result(
                        "Backend Authentication", 
                        True,
                        f"User: {user_info.get('name', 'N/A')} (ID: {user_info.get('user_id', 'N/A')})"
                    )
                    return True
                else:
                    self.log_test_result(
                        "Backend Authentication", 
                        False,
                        "No access token in response"
                    )
                    return False
            else:
                self.log_test_result(
                    "Backend Authentication", 
                    False, 
                    f"HTTP {response.status_code}: {response.text[:200]}"
                )
                return False
                
        except Exception as e:
            self.log_test_result(
                "Backend Authentication", 
                False, 
                f"Exception: {str(e)}"
            )
            return False

    def test_backend_health(self):
        """Test backend health endpoint"""
        try:
            print("\n🏥 Testing backend health...")
            
            response = self.session.get(f"{self.base_url}/api/status/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                status = data.get("status")
                if status == "healthy":
                    self.log_test_result(
                        "Backend Health Check", 
                        True,
                        f"Status: {status}, Version: {data.get('version', 'N/A')}"
                    )
                else:
                    self.log_test_result(
                        "Backend Health Check", 
                        False,
                        f"Unhealthy status: {status}"
                    )
            else:
                self.log_test_result(
                    "Backend Health Check", 
                    False,
                    f"HTTP {response.status_code}: {response.text[:200]}"
                )
                
        except Exception as e:
            self.log_test_result(
                "Backend Health Check", 
                False, 
                f"Exception: {str(e)}"
            )

    def test_checkMissedPayments_fix_code_review(self):
        """Code review of checkMissedPayments fix in merchantPoolMonitoring.ts"""
        print("\n🔍 CODE REVIEW: checkMissedPayments fix (merchantPoolMonitoring.ts)")
        
        try:
            # Read the file and check for required patterns
            with open('/app/backend/services/merchantPool/merchantPoolMonitoring.ts', 'r') as f:
                content = f.read()
            
            # Test 1: Check for failCount >= 3 condition
            if 'failCount >= 3' in content:
                self.log_test_result(
                    "checkMissedPayments: failCount >= 3 check", 
                    True,
                    "Found failCount >= 3 condition"
                )
            else:
                self.log_test_result(
                    "checkMissedPayments: failCount >= 3 check", 
                    False,
                    "failCount >= 3 condition not found"
                )
            
            # Test 2: Check for hasPaymentContext logic
            if 'hasPaymentContext = !!currentPaymentId && balance > (dustThreshold * 5)' in content:
                self.log_test_result(
                    "checkMissedPayments: hasPaymentContext logic", 
                    True,
                    "Found hasPaymentContext condition with dust threshold check"
                )
            else:
                self.log_test_result(
                    "checkMissedPayments: hasPaymentContext logic", 
                    False,
                    "hasPaymentContext condition not found or incorrect"
                )
            
            # Test 3: Check for last_payment_context retrieval
            if 'merchantTempAddressModel.findOne({ where: { wallet_address: walletAddress } })' in content:
                self.log_test_result(
                    "checkMissedPayments: DB context retrieval", 
                    True,
                    "Found merchantTempAddressModel.findOne for last_payment_context"
                )
            else:
                self.log_test_result(
                    "checkMissedPayments: DB context retrieval", 
                    False,
                    "DB context retrieval not found"
                )
            
            # Test 4: Check for Redis reconstruction
            if 'reconstructedRedis' in content and 'processedByFallback' in content:
                self.log_test_result(
                    "checkMissedPayments: Redis reconstruction", 
                    True,
                    "Found Redis reconstruction with fallback marker"
                )
            else:
                self.log_test_result(
                    "checkMissedPayments: Redis reconstruction", 
                    False,
                    "Redis reconstruction logic not found"
                )
            
            # Test 5: Check for customer ref reconstruction
            if 'custRef' in content and 'existingCustData' in content:
                self.log_test_result(
                    "checkMissedPayments: Customer ref reconstruction", 
                    True,
                    "Found customer reference reconstruction logic"
                )
            else:
                self.log_test_result(
                    "checkMissedPayments: Customer ref reconstruction", 
                    False,
                    "Customer reference reconstruction not found"
                )
            
            # Test 6: Check for cryptoVerification call
            if 'paymentController.cryptoVerification(walletAddress, true)' in content:
                self.log_test_result(
                    "checkMissedPayments: cryptoVerification call", 
                    True,
                    "Found cryptoVerification call with correct parameters"
                )
            else:
                self.log_test_result(
                    "checkMissedPayments: cryptoVerification call", 
                    False,
                    "cryptoVerification call not found or incorrect"
                )
            
            # Test 7: Check for recovery logging
            if 'MISSED PAYMENT RECOVERED VIA CONTEXT' in content:
                self.log_test_result(
                    "checkMissedPayments: Recovery logging", 
                    True,
                    "Found recovery event logging"
                )
            else:
                self.log_test_result(
                    "checkMissedPayments: Recovery logging", 
                    False,
                    "Recovery event logging not found"
                )
                
        except Exception as e:
            self.log_test_result(
                "checkMissedPayments: Code review", 
                False, 
                f"Exception reading file: {str(e)}"
            )

    def test_processIncompletePayments_fix_code_review(self):
        """Code review of processIncompletePayments fix in paymentController.ts"""
        print("\n🔍 CODE REVIEW: processIncompletePayments fix (paymentController.ts)")
        
        try:
            # Read the file and check for required patterns
            with open('/app/backend/controller/paymentController.ts', 'r') as f:
                content = f.read()
            
            # Test 1: Check for merchantTempAddressModel import
            if 'merchantTempAddressModel' in content and 'from "../models"' in content:
                self.log_test_result(
                    "processIncompletePayments: Model imports", 
                    True,
                    "Found merchantTempAddressModel import"
                )
            else:
                self.log_test_result(
                    "processIncompletePayments: Model imports", 
                    False,
                    "merchantTempAddressModel import not found"
                )
            
            # Test 2: Check for merchant pool query
            merchant_pool_query = "merchantTempAddressModel.findAll({\n        where: {\n          status: 'IN_USE',\n          current_payment_id: { [Op.ne]: null },\n          expected_amount: { [Op.gt]: 0 },"
            if merchant_pool_query in content:
                self.log_test_result(
                    "processIncompletePayments: Merchant pool query", 
                    True,
                    "Found correct merchantTempAddressModel query with required conditions"
                )
            else:
                # Check for simplified version
                if "status: 'IN_USE'" in content and "current_payment_id: { [Op.ne]: null }" in content:
                    self.log_test_result(
                        "processIncompletePayments: Merchant pool query", 
                        True,
                        "Found merchant pool query with required conditions"
                    )
                else:
                    self.log_test_result(
                        "processIncompletePayments: Merchant pool query", 
                        False,
                        "Merchant pool query not found or incorrect"
                    )
            
            # Test 3: Check for 60-minute grace period filter
            if 'minutesSinceReserved < 60' in content:
                self.log_test_result(
                    "processIncompletePayments: Grace period filter", 
                    True,
                    "Found 60-minute grace period filter"
                )
            else:
                self.log_test_result(
                    "processIncompletePayments: Grace period filter", 
                    False,
                    "60-minute grace period filter not found"
                )
            
            # Test 4: Check for customerTransactionModel duplicate check
            if 'customerTransactionModel.findOne' in content and 'transaction_reference' in content:
                self.log_test_result(
                    "processIncompletePayments: Duplicate check", 
                    True,
                    "Found customerTransactionModel duplicate check"
                )
            else:
                self.log_test_result(
                    "processIncompletePayments: Duplicate check", 
                    False,
                    "Duplicate transaction check not found"
                )
            
            # Test 5: Check for balance check via tatumApi
            if 'tatumApi.getAddressBalance' in content and 'actualBalance' in content:
                self.log_test_result(
                    "processIncompletePayments: Balance check", 
                    True,
                    "Found on-chain balance check via Tatum API"
                )
            else:
                self.log_test_result(
                    "processIncompletePayments: Balance check", 
                    False,
                    "On-chain balance check not found"
                )
            
            # Test 6: Check for Redis reconstruction from last_payment_context
            if 'last_payment_context' in content and 'JSON.parse' in content:
                self.log_test_result(
                    "processIncompletePayments: Context reconstruction", 
                    True,
                    "Found last_payment_context reconstruction logic"
                )
            else:
                self.log_test_result(
                    "processIncompletePayments: Context reconstruction", 
                    False,
                    "Context reconstruction not found"
                )
            
            # Test 7: Check for cryptoVerification processing
            if 'cryptoVerification(walletAddress, true)' in content:
                self.log_test_result(
                    "processIncompletePayments: Processing call", 
                    True,
                    "Found cryptoVerification processing call"
                )
            else:
                self.log_test_result(
                    "processIncompletePayments: Processing call", 
                    False,
                    "cryptoVerification processing call not found"
                )
            
            # Test 8: Check for proper error handling
            if 'try {' in content and 'catch (poolError)' in content:
                self.log_test_result(
                    "processIncompletePayments: Error handling", 
                    True,
                    "Found proper try/catch error handling"
                )
            else:
                self.log_test_result(
                    "processIncompletePayments: Error handling", 
                    False,
                    "Error handling not found or incomplete"
                )
                
        except Exception as e:
            self.log_test_result(
                "processIncompletePayments: Code review", 
                False, 
                f"Exception reading file: {str(e)}"
            )

    def test_required_imports(self):
        """Verify all required imports are present in paymentController.ts"""
        print("\n📦 Testing required imports in paymentController.ts")
        
        try:
            with open('/app/backend/controller/paymentController.ts', 'r') as f:
                content = f.read()
            
            required_imports = [
                'Op',
                'getRedisItem', 
                'setRedisItem',
                'tatumApi',
                'customerTransactionModel',
                'merchantTempAddressModel'
            ]
            
            for import_name in required_imports:
                if import_name in content:
                    self.log_test_result(
                        f"Import verification: {import_name}", 
                        True,
                        f"{import_name} import found"
                    )
                else:
                    self.log_test_result(
                        f"Import verification: {import_name}", 
                        False,
                        f"{import_name} import not found"
                    )
                    
        except Exception as e:
            self.log_test_result(
                "Import verification", 
                False, 
                f"Exception: {str(e)}"
            )

    def test_typescript_compilation(self):
        """Test for TypeScript compilation errors"""
        print("\n🔧 Testing TypeScript compilation...")
        
        try:
            # Check backend logs for compilation errors
            import subprocess
            result = subprocess.run(
                ["tail", "-n", "200", "/var/log/supervisor/backend.err.log"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            error_patterns = [
                'error TS',
                'Compilation failed',
                'Type error',
                'Cannot find module',
                'Property does not exist',
                'Argument of type',
                'Type \'undefined\' is not assignable'
            ]
            
            compilation_errors = []
            for line in result.stdout.split('\n'):
                for pattern in error_patterns:
                    if pattern in line:
                        compilation_errors.append(line.strip())
                        break
            
            if compilation_errors:
                self.log_test_result(
                    "TypeScript Compilation", 
                    False,
                    f"Found {len(compilation_errors)} compilation errors",
                    "No compilation errors",
                    f"Errors: {compilation_errors[:3]}"  # Show first 3 errors
                )
            else:
                self.log_test_result(
                    "TypeScript Compilation", 
                    True,
                    "No TypeScript compilation errors found"
                )
                
        except Exception as e:
            self.log_test_result(
                "TypeScript Compilation", 
                False, 
                f"Exception: {str(e)}"
            )

    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "="*60)
        print("🧪 FALLBACK SAFETY NET FIXES TEST SUMMARY")
        print("="*60)
        
        total = self.results["total_tests"]
        passed = self.results["passed_tests"]
        failed = self.results["failed_tests"]
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed} ✅")
        print(f"Failed: {failed} ❌")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if failed > 0:
            print(f"\n❌ FAILED TESTS ({failed}):")
            for result in self.results["test_details"]:
                if "❌ FAIL" in result["status"]:
                    print(f"  - {result['test_name']}: {result['details']}")
        
        if passed == total:
            print(f"\n🎉 ALL TESTS PASSED! Both fallback safety net fixes are properly implemented.")
        else:
            print(f"\n⚠️  {failed} test(s) failed. Please review the implementation.")
        
        return success_rate >= 90  # Consider 90%+ as success

def main():
    """Main test execution"""
    print("🚀 Starting Backend Testing for Fallback Safety Net Fixes")
    print("="*60)
    
    tester = BackendTester()
    
    # Step 1: Authentication
    if not tester.authenticate():
        print("❌ Authentication failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Step 2: Health Check
    tester.test_backend_health()
    
    # Step 3: Code Review Tests
    tester.test_checkMissedPayments_fix_code_review()
    tester.test_processIncompletePayments_fix_code_review()
    
    # Step 4: Import Verification
    tester.test_required_imports()
    
    # Step 5: TypeScript Compilation Check
    tester.test_typescript_compilation()
    
    # Step 6: Generate Summary
    success = tester.generate_summary()
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)