#!/usr/bin/env python3
"""
Backend Testing for Merchant Pool Sweep Bug Fixes
Testing the four specific bug fixes in merchantPoolSweep.ts
"""

import requests
import json
import re
import subprocess
import sys
from typing import Dict, Any, List

# Test configuration
BASE_URL = "https://code-analyzer-256.preview.emergentagent.com"
CREDENTIALS = {
    "email": "richard@dyno.pt", 
    "password": "Katiekendra123@"
}

class MerchantPoolSweepTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.token = None
        
    def authenticate(self) -> bool:
        """Authenticate and get JWT token"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/user/login", 
                json=CREDENTIALS,
                timeout=30
            )
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('accessToken')
                if self.token:
                    self.session.headers.update({'Authorization': f'Bearer {self.token}'})
                    print("✅ Authentication successful")
                    return True
                else:
                    print("❌ No access token in response")
                    return False
            else:
                print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False
    
    def verify_bug_fix_a_fast_property(self) -> bool:
        """BUG A — Verify 'fast' property extraction is FIRST in checkSweepProfitability"""
        print("\n🔍 BUG A - Testing 'fast' property extraction priority...")
        
        try:
            # Read the file and check the order of checks
            with open('/app/backend/services/merchantPool/merchantPoolSweep.ts', 'r') as f:
                content = f.read()
            
            # Find the checkSweepProfitability function
            func_start = content.find('const checkSweepProfitability = async')
            if func_start == -1:
                print("❌ checkSweepProfitability function not found")
                return False
            
            # Extract the function content (rough extraction)
            func_content = content[func_start:func_start + 3000]
            
            # Check if feeData?.fast exists
            fast_matches = re.findall(r'feeData\?\.fast', func_content)
            if len(fast_matches) == 0:
                print("❌ No feeData?.fast found in checkSweepProfitability")
                return False
            
            print(f"✅ Found {len(fast_matches)} feeData?.fast references")
            
            # Check the order: fast should come before gasPrice/gasLimit, fee, and slow
            patterns = [
                (r'} else if \(feeData\?\.fast\)', 'fast'),
                (r'} else if \(feeData\?\.gasPrice && feeData\?\.gasLimit\)', 'gasPrice/gasLimit'),
                (r'} else if \(feeData\?\.fee\)', 'fee'),
                (r'} else if \(feeData\?\.slow\)', 'slow')
            ]
            
            positions = []
            for pattern, name in patterns:
                match = re.search(pattern, func_content)
                if match:
                    positions.append((match.start(), name))
            
            if len(positions) < 2:
                print("❌ Not enough extraction patterns found")
                return False
            
            positions.sort()  # Sort by position
            order = [name for pos, name in positions]
            
            print(f"✅ Extraction order: {' → '.join(order)}")
            
            # Verify fast is first
            if order[0] == 'fast':
                print("✅ BUG A: 'fast' property extraction is correctly FIRST in priority")
                return True
            else:
                print(f"❌ BUG A: Expected 'fast' to be first, but got: {order[0]}")
                return False
                
        except Exception as e:
            print(f"❌ BUG A verification error: {str(e)}")
            return False
    
    def verify_bug_fix_b_divisor_fix(self) -> bool:
        """BUG B — Verify gasPrice/gasLimit divisor changed from 1e18 to 1e9"""
        print("\n🔍 BUG B - Testing gasPrice/gasLimit divisor fix...")
        
        try:
            # Check for 1e9 presence
            result_1e9 = subprocess.run(['grep', '-n', '1e9', '/app/backend/services/merchantPool/merchantPoolSweep.ts'], 
                                       capture_output=True, text=True)
            
            # Check for 1e18 absence
            result_1e18 = subprocess.run(['grep', '-n', '1e18', '/app/backend/services/merchantPool/merchantPoolSweep.ts'], 
                                        capture_output=True, text=True)
            
            if result_1e9.returncode == 0 and result_1e18.returncode != 0:
                print(f"✅ Found 1e9 divisor: {result_1e9.stdout.strip()}")
                print("✅ No 1e18 divisor found (correctly removed)")
                print("✅ BUG B: Divisor correctly changed from 1e18 to 1e9")
                return True
            else:
                if result_1e9.returncode != 0:
                    print("❌ BUG B: 1e9 divisor not found")
                if result_1e18.returncode == 0:
                    print(f"❌ BUG B: 1e18 divisor still found: {result_1e18.stdout.strip()}")
                return False
                
        except Exception as e:
            print(f"❌ BUG B verification error: {str(e)}")
            return False
    
    def verify_bug_fix_c_fee_currency(self) -> bool:
        """BUG C — Verify fee converted using gas token (TRX/ETH) not token currency"""
        print("\n🔍 BUG C - Testing fee currency conversion fix...")
        
        try:
            # Check for feeCurrency variable and its usage
            result = subprocess.run(['grep', '-n', 'feeCurrency', '/app/backend/services/merchantPool/merchantPoolSweep.ts'], 
                                   capture_output=True, text=True)
            
            if result.returncode != 0:
                print("❌ BUG C: feeCurrency not found")
                return False
            
            lines = result.stdout.strip().split('\n')
            found_mapping = False
            found_conversion = False
            found_log = False
            
            for line in lines:
                if 'GAS_TOKEN_MAPPING[walletType] || walletType' in line:
                    found_mapping = True
                    print(f"✅ Found feeCurrency mapping: {line.strip()}")
                elif 'convertToUSD(feeCurrency, estimatedFee)' in line:
                    found_conversion = True
                    print(f"✅ Found fee conversion using feeCurrency: {line.strip()}")
                elif 'feeCurrency' in line and 'console.log' in line:
                    found_log = True
                    print(f"✅ Found profitability logging: {line.strip()}")
            
            # Verify balanceUSD still uses walletType
            balance_result = subprocess.run(['grep', '-n', 'convertToUSD(walletType, balance)', 
                                          '/app/backend/services/merchantPool/merchantPoolSweep.ts'], 
                                          capture_output=True, text=True)
            
            balance_correct = balance_result.returncode == 0
            if balance_correct:
                print(f"✅ Balance conversion still uses walletType: {balance_result.stdout.strip()}")
            
            if found_mapping and found_conversion and found_log and balance_correct:
                print("✅ BUG C: Fee currency conversion correctly uses gas token (TRX/ETH)")
                return True
            else:
                print("❌ BUG C: Not all required components found")
                print(f"  Mapping: {found_mapping}, Conversion: {found_conversion}, Log: {found_log}, Balance: {balance_correct}")
                return False
                
        except Exception as e:
            print(f"❌ BUG C verification error: {str(e)}")
            return False
    
    def verify_bug_fix_d_actual_params(self) -> bool:
        """BUG D — Verify fundGasIfNeeded receives actual transfer params"""
        print("\n🔍 BUG D - Testing fundGasIfNeeded actual parameter fix...")
        
        try:
            # Check for adminWalletForGas variable declaration
            result1 = subprocess.run(['grep', '-n', 'const adminWalletForGas', 
                                    '/app/backend/services/merchantPool/merchantPoolSweep.ts'], 
                                    capture_output=True, text=True)
            
            # Check for fundGasIfNeeded call with actual parameters
            result2 = subprocess.run(['grep', '-n', 'actualBalance, adminWalletForGas', 
                                    '/app/backend/services/merchantPool/merchantPoolSweep.ts'], 
                                    capture_output=True, text=True)
            
            admin_wallet_declared = result1.returncode == 0
            actual_params_used = result2.returncode == 0
            
            if admin_wallet_declared:
                print(f"✅ adminWalletForGas variable declared: {result1.stdout.strip()}")
            
            if actual_params_used:
                print(f"✅ fundGasIfNeeded called with actual parameters: {result2.stdout.strip()}")
            
            if admin_wallet_declared and actual_params_used:
                print("✅ BUG D: fundGasIfNeeded correctly receives actual transfer params")
                return True
            else:
                print("❌ BUG D: Missing components")
                print(f"  adminWalletForGas declared: {admin_wallet_declared}")
                print(f"  Actual parameters used: {actual_params_used}")
                return False
                
        except Exception as e:
            print(f"❌ BUG D verification error: {str(e)}")
            return False
    
    def run_health_checks(self) -> bool:
        """Run TypeScript compilation and backend health checks"""
        print("\n🔍 HEALTH CHECKS - Running TypeScript compilation and API health...")
        
        try:
            # TypeScript compilation check
            print("Checking TypeScript compilation...")
            ts_result = subprocess.run(['npx', 'tsc', '--noEmit'], 
                                     cwd='/app/backend', 
                                     capture_output=True, text=True)
            
            ts_success = ts_result.returncode == 0
            if ts_success:
                print("✅ TypeScript compilation: 0 errors")
            else:
                print(f"❌ TypeScript compilation errors:\n{ts_result.stderr}")
            
            # Backend health check
            print("Checking backend health...")
            health_response = self.session.get(f"{self.base_url}/api/status/health", timeout=30)
            
            health_success = False
            if health_response.status_code == 200:
                health_data = health_response.json()
                if health_data.get('status') == 'healthy':
                    print(f"✅ Backend health: {health_data}")
                    health_success = True
                else:
                    print(f"❌ Backend unhealthy: {health_data}")
            else:
                print(f"❌ Health check failed: {health_response.status_code}")
            
            return ts_success and health_success
            
        except Exception as e:
            print(f"❌ Health check error: {str(e)}")
            return False
    
    def run_all_tests(self) -> Dict[str, bool]:
        """Run all bug fix verification tests"""
        print("🚀 MERCHANT POOL SWEEP BUG FIXES TESTING")
        print("=" * 50)
        
        results = {}
        
        # Authentication
        if not self.authenticate():
            return {"authentication": False}
        
        # Bug fix verifications
        results["bug_a_fast_property"] = self.verify_bug_fix_a_fast_property()
        results["bug_b_divisor_fix"] = self.verify_bug_fix_b_divisor_fix()
        results["bug_c_fee_currency"] = self.verify_bug_fix_c_fee_currency()
        results["bug_d_actual_params"] = self.verify_bug_fix_d_actual_params()
        results["health_checks"] = self.run_health_checks()
        
        return results

def main():
    tester = MerchantPoolSweepTester()
    results = tester.run_all_tests()
    
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name.replace('_', ' ').title()}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed ({(passed_tests/total_tests)*100:.1f}%)")
    
    if passed_tests == total_tests:
        print("🎉 ALL BUG FIXES VERIFIED SUCCESSFULLY!")
        return 0
    else:
        print("⚠️ SOME BUG FIXES NEED ATTENTION")
        return 1

if __name__ == "__main__":
    sys.exit(main())