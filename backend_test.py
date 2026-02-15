#!/usr/bin/env python3
"""
Backend Testing Script for QR Code Currency Logo Overlay + JSON Parse Error Fix
Tests all requirements specified in the review request
"""

import subprocess
import sys
import json
import requests
import re
import time

class BackendTester:
    def __init__(self):
        self.base_url = "http://localhost:8001"
        self.results = []
        self.passed = 0
        self.failed = 0
        
    def log(self, message, level="INFO"):
        print(f"[{level}] {message}")
        
    def run_command(self, cmd, cwd="/app/backend", timeout=30):
        """Run a shell command and return result"""
        try:
            result = subprocess.run(
                cmd, 
                shell=True, 
                capture_output=True, 
                text=True, 
                timeout=timeout,
                cwd=cwd
            )
            return {
                'success': result.returncode == 0,
                'stdout': result.stdout.strip(),
                'stderr': result.stderr.strip(),
                'returncode': result.returncode
            }
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'stdout': '',
                'stderr': 'Command timed out',
                'returncode': -1
            }
        except Exception as e:
            return {
                'success': False,
                'stdout': '',
                'stderr': str(e),
                'returncode': -1
            }
    
    def test_1_backend_health(self):
        """TEST 1: Backend healthy - GET /health returns 200 with status "healthy" """
        try:
            self.log("Running TEST 1: Backend Health Check")
            response = requests.get(f"{self.base_url}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'healthy':
                    self.log("✅ TEST 1 PASSED: Backend health check successful")
                    self.passed += 1
                    return True
                else:
                    self.log(f"❌ TEST 1 FAILED: Status is '{data.get('status')}', expected 'healthy'")
                    self.failed += 1
                    return False
            else:
                self.log(f"❌ TEST 1 FAILED: HTTP {response.status_code}, expected 200")
                self.failed += 1
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 1 FAILED: Exception - {e}")
            self.failed += 1
            return False
    
    def test_2_typescript_compilation(self):
        """TEST 2: TypeScript compiles clean - npx tsc --noEmit exits with 0"""
        try:
            self.log("Running TEST 2: TypeScript Compilation")
            result = self.run_command("npx tsc --noEmit", timeout=60)
            
            if result['success']:
                self.log("✅ TEST 2 PASSED: TypeScript compilation successful")
                self.passed += 1
                return True
            else:
                self.log(f"❌ TEST 2 FAILED: TypeScript compilation errors")
                self.log(f"STDERR: {result['stderr']}")
                self.failed += 1
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 2 FAILED: Exception - {e}")
            self.failed += 1
            return False
    
    def test_3_qr_generation_all_currencies(self):
        """TEST 3: QR code generation with logo works for all 15 currencies"""
        try:
            self.log("Running TEST 3: QR Code Generation for All 15 Currencies")
            
            # Command to test all currencies
            test_command = """npx ts-node --transpile-only -e "
import { generateQRCodeWithLogo } from './utils/qrCodeWithLogo'; 
async function t() { 
    const currencies = ['BTC','ETH','LTC','DOGE','TRX','SOL','XRP','RLUSD','POLYGON','BCH','USDT-ERC20','USDC-ERC20','RLUSD-ERC20','USDT-POLYGON','USDT-TRC20']; 
    for (const c of currencies) { 
        const r = await generateQRCodeWithLogo('test123', c, 400); 
        console.log(c + ': ' + (r.startsWith('data:image/png;base64,') ? 'OK' : 'FAIL')); 
    } 
} 
t();"
            """
            
            result = self.run_command(test_command, timeout=60)
            
            if result['success']:
                # Check output for all currencies showing OK
                output_lines = result['stdout'].split('\n')
                currencies = ['BTC','ETH','LTC','DOGE','TRX','SOL','XRP','RLUSD','POLYGON','BCH','USDT-ERC20','USDC-ERC20','RLUSD-ERC20','USDT-POLYGON','USDT-TRC20']
                
                failed_currencies = []
                passed_currencies = []
                
                for line in output_lines:
                    if ': ' in line:
                        currency, status = line.split(': ', 1)
                        if currency in currencies:
                            if status.strip() == 'OK':
                                passed_currencies.append(currency)
                            else:
                                failed_currencies.append(currency)
                
                if len(passed_currencies) == 15 and len(failed_currencies) == 0:
                    self.log(f"✅ TEST 3 PASSED: All 15 currencies generated QR codes successfully")
                    self.passed += 1
                    return True
                else:
                    self.log(f"❌ TEST 3 FAILED: {len(passed_currencies)}/15 currencies passed, {len(failed_currencies)} failed")
                    if failed_currencies:
                        self.log(f"Failed currencies: {failed_currencies}")
                    self.failed += 1
                    return False
            else:
                self.log(f"❌ TEST 3 FAILED: Command execution failed")
                self.log(f"STDERR: {result['stderr']}")
                self.failed += 1
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 3 FAILED: Exception - {e}")
            self.failed += 1
            return False
    
    def test_4_qr_output_format(self):
        """TEST 4: QR code output is valid png data URL"""
        try:
            self.log("Running TEST 4: QR Code Output Format Validation")
            
            test_command = """npx ts-node --transpile-only -e "
import { generateQRCodeWithLogo } from './utils/qrCodeWithLogo'; 
async function t() { 
    const result = await generateQRCodeWithLogo('test123', 'BTC', 400); 
    console.log('FORMAT_CHECK:' + (result.startsWith('data:image/png;base64,') ? 'VALID' : 'INVALID')); 
    console.log('LENGTH:' + result.length);
} 
t();"
            """
            
            result = self.run_command(test_command, timeout=30)
            
            if result['success']:
                output = result['stdout']
                if 'FORMAT_CHECK:VALID' in output:
                    # Extract length for additional validation
                    length_match = re.search(r'LENGTH:(\d+)', output)
                    if length_match:
                        length = int(length_match.group(1))
                        if length > 1000:  # Base64 PNG should be reasonably sized
                            self.log(f"✅ TEST 4 PASSED: QR code output format is valid (length: {length})")
                            self.passed += 1
                            return True
                        else:
                            self.log(f"❌ TEST 4 FAILED: QR code too small (length: {length})")
                            self.failed += 1
                            return False
                    else:
                        self.log(f"✅ TEST 4 PASSED: QR code output format is valid")
                        self.passed += 1
                        return True
                else:
                    self.log(f"❌ TEST 4 FAILED: QR code output format is invalid")
                    self.log(f"Output: {output}")
                    self.failed += 1
                    return False
            else:
                self.log(f"❌ TEST 4 FAILED: Command execution failed")
                self.log(f"STDERR: {result['stderr']}")
                self.failed += 1
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 4 FAILED: Exception - {e}")
            self.failed += 1
            return False
    
    def test_5_malformed_json_400_error(self):
        """TEST 5: Malformed JSON body returns 400 (not 500)"""
        try:
            self.log("Running TEST 5: Malformed JSON Error Handling")
            
            # Use curl command as specified in review request
            result = self.run_command(
                f'curl -s -X POST {self.base_url}/api/payment -H "Content-Type: application/json" -d "not valid json"',
                timeout=10
            )
            
            if result['success']:
                try:
                    response_data = json.loads(result['stdout'])
                    expected_response = {
                        "success": False,
                        "message": "Invalid JSON in request body",
                        "statusCode": 400
                    }
                    
                    if (response_data.get('success') == False and 
                        response_data.get('message') == "Invalid JSON in request body" and
                        response_data.get('statusCode') == 400):
                        self.log("✅ TEST 5 PASSED: Malformed JSON returns 400 with correct message")
                        self.passed += 1
                        return True
                    else:
                        self.log(f"❌ TEST 5 FAILED: Unexpected response format")
                        self.log(f"Expected: {expected_response}")
                        self.log(f"Got: {response_data}")
                        self.failed += 1
                        return False
                        
                except json.JSONDecodeError:
                    self.log(f"❌ TEST 5 FAILED: Response is not valid JSON")
                    self.log(f"Response: {result['stdout']}")
                    self.failed += 1
                    return False
            else:
                self.log(f"❌ TEST 5 FAILED: Curl command failed")
                self.log(f"STDERR: {result['stderr']}")
                self.failed += 1
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 5 FAILED: Exception - {e}")
            self.failed += 1
            return False
    
    def test_6_valid_json_no_regression(self):
        """TEST 6: Valid JSON body still works (no regression)"""
        try:
            self.log("Running TEST 6: Valid JSON - No Regression")
            
            # Use curl command as specified in review request
            result = self.run_command(
                'curl -s -X POST http://localhost:8001/api/payment -H "Content-Type: application/json" -d \'{"test":true}\'',
                timeout=10
            )
            
            if result['success']:
                response_text = result['stdout']
                
                # Check if it's JSON response
                try:
                    response_data = json.loads(response_text)
                    # Should NOT return the JSON parse error
                    if (response_data.get('message') == "Invalid JSON in request body" and
                        response_data.get('statusCode') == 400):
                        self.log(f"❌ TEST 6 FAILED: Valid JSON incorrectly triggers JSON parse error")
                        self.failed += 1
                        return False
                    else:
                        # Any other error is fine (auth error, business logic error, etc.)
                        self.log(f"✅ TEST 6 PASSED: Valid JSON does not trigger JSON parse error")
                        self.log(f"Response: {response_data}")
                        self.passed += 1
                        return True
                        
                except json.JSONDecodeError:
                    # If it's not JSON, check if it contains the JSON parse error message
                    if "Invalid JSON in request body" in response_text:
                        self.log(f"❌ TEST 6 FAILED: Valid JSON incorrectly triggers JSON parse error")
                        self.log(f"Response: {response_text}")
                        self.failed += 1
                        return False
                    else:
                        # Any other non-JSON response is fine (HTML error page, etc.)
                        self.log(f"✅ TEST 6 PASSED: Valid JSON does not trigger JSON parse error")
                        self.log(f"Response (non-JSON): {response_text[:100]}...")
                        self.passed += 1
                        return True
            else:
                self.log(f"❌ TEST 6 FAILED: Curl command failed")
                self.log(f"STDERR: {result['stderr']}")
                self.failed += 1
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 6 FAILED: Exception - {e}")
            self.failed += 1
            return False
    
    def test_7_import_in_payment_controller(self):
        """TEST 7: Import in paymentController - grep -c 'generateQRCodeWithLogo' >= 4"""
        try:
            self.log("Running TEST 7: Import verification in paymentController")
            
            result = self.run_command("grep -c 'generateQRCodeWithLogo' /app/backend/controller/paymentController.ts")
            
            if result['success']:
                count = int(result['stdout'])
                if count >= 4:
                    self.log(f"✅ TEST 7 PASSED: Found {count} occurrences of 'generateQRCodeWithLogo' in paymentController (>= 4 required)")
                    self.passed += 1
                    return True
                else:
                    self.log(f"❌ TEST 7 FAILED: Found only {count} occurrences, expected >= 4")
                    self.failed += 1
                    return False
            else:
                self.log(f"❌ TEST 7 FAILED: grep command failed")
                self.log(f"STDERR: {result['stderr']}")
                self.failed += 1
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 7 FAILED: Exception - {e}")
            self.failed += 1
            return False
    
    def test_8_import_in_wallet_controller(self):
        """TEST 8: Import in walletController - grep -c 'generateQRCodeWithLogo' >= 2"""
        try:
            self.log("Running TEST 8: Import verification in walletController")
            
            result = self.run_command("grep -c 'generateQRCodeWithLogo' /app/backend/controller/walletController.ts")
            
            if result['success']:
                count = int(result['stdout'])
                if count >= 2:
                    self.log(f"✅ TEST 8 PASSED: Found {count} occurrences of 'generateQRCodeWithLogo' in walletController (>= 2 required)")
                    self.passed += 1
                    return True
                else:
                    self.log(f"❌ TEST 8 FAILED: Found only {count} occurrences, expected >= 2")
                    self.failed += 1
                    return False
            else:
                self.log(f"❌ TEST 8 FAILED: grep command failed")
                self.log(f"STDERR: {result['stderr']}")
                self.failed += 1
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 8 FAILED: Exception - {e}")
            self.failed += 1
            return False
    
    def test_9_no_remaining_plain_qr_calls(self):
        """TEST 9: No remaining plain QR_Code.toDataURL calls"""
        try:
            self.log("Running TEST 9: Verify no remaining plain QR_Code.toDataURL calls")
            
            # Test paymentController.ts
            result1 = self.run_command("grep 'QR_Code.toDataURL' /app/backend/controller/paymentController.ts")
            # Test walletController.ts  
            result2 = self.run_command("grep 'QR_Code.toDataURL' /app/backend/controller/walletController.ts")
            
            # Both greps should return exit code 1 (no matches found)
            if (not result1['success'] and result1['returncode'] == 1 and 
                not result2['success'] and result2['returncode'] == 1):
                self.log("✅ TEST 9 PASSED: No remaining QR_Code.toDataURL calls found")
                self.passed += 1
                return True
            else:
                failures = []
                if result1['success'] or result1['returncode'] == 0:
                    failures.append(f"paymentController.ts: {result1['stdout']}")
                if result2['success'] or result2['returncode'] == 0:
                    failures.append(f"walletController.ts: {result2['stdout']}")
                    
                self.log(f"❌ TEST 9 FAILED: Found remaining QR_Code.toDataURL calls:")
                for failure in failures:
                    self.log(f"  {failure}")
                self.failed += 1
                return False
                
        except Exception as e:
            self.log(f"❌ TEST 9 FAILED: Exception - {e}")
            self.failed += 1
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        self.log("=" * 80)
        self.log("QR CODE CURRENCY LOGO OVERLAY + JSON PARSE ERROR FIX - BACKEND TESTING")
        self.log("=" * 80)
        
        # List of all test methods
        tests = [
            self.test_1_backend_health,
            self.test_2_typescript_compilation,
            self.test_3_qr_generation_all_currencies,
            self.test_4_qr_output_format,
            self.test_5_malformed_json_400_error,
            self.test_6_valid_json_no_regression,
            self.test_7_import_in_payment_controller,
            self.test_8_import_in_wallet_controller,
            self.test_9_no_remaining_plain_qr_calls,
        ]
        
        for i, test in enumerate(tests, 1):
            try:
                test()
                self.log("-" * 40)
            except Exception as e:
                self.log(f"❌ TEST {i} CRASHED: {e}")
                self.failed += 1
                self.log("-" * 40)
        
        # Summary
        self.log("=" * 80)
        self.log("TESTING SUMMARY")
        self.log("=" * 80)
        total_tests = self.passed + self.failed
        success_rate = (self.passed / total_tests * 100) if total_tests > 0 else 0
        
        self.log(f"Total Tests: {total_tests}")
        self.log(f"Passed: {self.passed}")
        self.log(f"Failed: {self.failed}")
        self.log(f"Success Rate: {success_rate:.1f}%")
        
        if self.failed == 0:
            self.log("🎉 ALL TESTS PASSED! QR Code Currency Logo Overlay + JSON Parse Error Fix is working correctly.")
            return True
        else:
            self.log(f"❌ {self.failed} TEST(S) FAILED. Please review the issues above.")
            return False

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)