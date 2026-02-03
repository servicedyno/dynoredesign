#!/usr/bin/env python3
"""
DynoPay Payment Confirmation and Fund Distribution Testing
Test Redis consistency and correct fund split between merchant and admin.

Test Scope:
1. Payment Link Creation - Redis Data Verification (fee_payer modes)
2. Crypto Payment Creation - Redis Data Verification 
3. Fund Distribution Logic Analysis
4. Webhook Handler Data Flow
5. getData API Consistency

Test Credentials:
- Email: john@dyno.pt
- Password: Katiekendra123@
- Company ID: 38
- Backend URL: https://dyno-crypto-pay.preview.emergentagent.com
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional

class DynoPayTester:
    def __init__(self):
        self.base_url = "https://dyno-crypto-pay.preview.emergentagent.com"
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'DynoPay-Tester/1.0'
        })
        self.auth_token = None
        self.user_data = None
        
    def log(self, message: str, level: str = "INFO"):
        """Enhanced logging with timestamps"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
        
    def authenticate(self, email: str, password: str) -> bool:
        """Authenticate user and store token"""
        try:
            self.log(f"🔐 Authenticating user: {email}")
            
            response = self.session.post(f"{self.base_url}/api/user/login", json={
                "email": email,
                "password": password
            })
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    self.auth_token = data['data']['accessToken']
                    self.user_data = data['data']['userData']
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.auth_token}'
                    })
                    self.log(f"✅ Authentication successful - User ID: {self.user_data.get('user_id')}, Name: {self.user_data.get('name')}")
                    return True
                else:
                    self.log(f"❌ Authentication failed: {data.get('message', 'Unknown error')}", "ERROR")
                    return False
            else:
                self.log(f"❌ Authentication failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Authentication error: {str(e)}", "ERROR")
            return False
    
    def create_payment_link(self, amount: float, fee_payer: str, description: str, email: str) -> Optional[Dict[str, Any]]:
        """Create payment link with specific fee_payer mode"""
        try:
            self.log(f"💳 Creating payment link - Amount: ${amount}, Fee Payer: {fee_payer}")
            
            payload = {
                "amount": amount,
                "base_currency": "USD",
                "email": email,
                "modes": ["CRYPTO"],
                "description": description,
                "company_id": 38,
                "fee_payer": fee_payer
            }
            
            response = self.session.post(f"{self.base_url}/api/pay/createPaymentLink", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    payment_data = data['data']
                    self.log(f"✅ Payment link created successfully")
                    self.log(f"   - Link ID: {payment_data.get('link_id')}")
                    self.log(f"   - Transaction ID: {payment_data.get('transaction_id')}")
                    self.log(f"   - Payment URL: {payment_data.get('payment_link', 'N/A')}")
                    
                    # Extract reference from payment URL
                    payment_url = payment_data.get('payment_link', '')
                    if '?d=' in payment_url:
                        reference = payment_url.split('?d=')[1]
                        payment_data['reference'] = reference
                        self.log(f"   - Reference: {reference}")
                    
                    return payment_data
                else:
                    self.log(f"❌ Payment link creation failed: {data.get('message', 'Unknown error')}", "ERROR")
                    return None
            else:
                self.log(f"❌ Payment link creation failed with status {response.status_code}: {response.text}", "ERROR")
                return None
                
        except Exception as e:
            self.log(f"❌ Payment link creation error: {str(e)}", "ERROR")
            return None
    
    def get_payment_data(self, reference: str) -> Optional[Dict[str, Any]]:
        """Get payment data using reference to verify Redis data"""
        try:
            self.log(f"📊 Getting payment data for reference: {reference[:10]}...")
            
            response = self.session.post(f"{self.base_url}/api/pay/getData", json={
                "data": reference
            })
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    payment_info = data['data']
                    self.log(f"✅ Payment data retrieved successfully")
                    self.log(f"   - Fee Payer: {payment_info.get('fee_payer', 'N/A')}")
                    self.log(f"   - Amount: {payment_info.get('amount', 'N/A')} {payment_info.get('base_currency', 'N/A')}")
                    
                    # Check fee_info structure
                    fee_info = payment_info.get('fee_info', {})
                    if fee_info:
                        self.log(f"   - Fee Info Present: Yes")
                        self.log(f"     - Fee Payer: {fee_info.get('fee_payer', 'N/A')}")
                        self.log(f"     - Subtotal: {fee_info.get('subtotal', 'N/A')}")
                        self.log(f"     - Total Amount: {fee_info.get('total_amount', 'N/A')}")
                        if fee_info.get('estimated_processing_fee'):
                            self.log(f"     - Estimated Processing Fee: {fee_info.get('estimated_processing_fee', 'N/A')}")
                    else:
                        self.log(f"   - Fee Info Present: No")
                    
                    return payment_info
                else:
                    self.log(f"❌ Get payment data failed: {data.get('message', 'Unknown error')}", "ERROR")
                    return None
            else:
                self.log(f"❌ Get payment data failed with status {response.status_code}: {response.text}", "ERROR")
                return None
                
        except Exception as e:
            self.log(f"❌ Get payment data error: {str(e)}", "ERROR")
            return None
    
    def create_crypto_payment(self, reference: str, currency: str = "ETH") -> Optional[Dict[str, Any]]:
        """Create crypto payment to verify Redis data storage"""
        try:
            self.log(f"🔗 Creating crypto payment - Currency: {currency}")
            
            # First get currency rates to determine crypto amount
            rates_response = self.session.post(f"{self.base_url}/api/pay/getCurrencyRates", json={
                "source": "USD",
                "currencyList": [currency.lower()],
                "amount": 100,  # Use the payment amount
                "fixedDecimal": False
            })
            
            if rates_response.status_code != 200:
                self.log(f"❌ Failed to get currency rates: {rates_response.text}", "ERROR")
                return None
            
            rates_data = rates_response.json()
            if 'data' not in rates_data:
                self.log(f"❌ Currency rates failed: {rates_data.get('message', 'Unknown error')}", "ERROR")
                return None
            
            crypto_amount = rates_data['data'][0]['amount']
            self.log(f"   - Crypto Amount: {crypto_amount} {currency}")
            
            # Create crypto payment
            payload = {
                "uniqueRef": reference,
                "amount": crypto_amount,
                "currency": currency
            }
            
            response = self.session.post(f"{self.base_url}/api/pay/createCryptoPayment", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    crypto_data = data['data']
                    self.log(f"✅ Crypto payment created successfully")
                    self.log(f"   - Address: {crypto_data.get('address', 'N/A')}")
                    self.log(f"   - Amount: {crypto_data.get('amount', 'N/A')} {currency}")
                    self.log(f"   - Merchant Amount: {crypto_data.get('merchant_amount', 'N/A')} {currency}")
                    self.log(f"   - Fee Payer: {crypto_data.get('fee_payer', 'N/A')}")
                    self.log(f"   - Transaction ID: {crypto_data.get('transaction_id', 'N/A')}")
                    
                    return crypto_data
                else:
                    self.log(f"❌ Crypto payment creation failed: {data.get('message', 'Unknown error')}", "ERROR")
                    return None
            else:
                self.log(f"❌ Crypto payment creation failed with status {response.status_code}: {response.text}", "ERROR")
                return None
                
        except Exception as e:
            self.log(f"❌ Crypto payment creation error: {str(e)}", "ERROR")
            return None
    
    def verify_redis_data_consistency(self, test_results: Dict[str, Any]) -> bool:
        """Verify Redis data consistency across the payment flow"""
        try:
            self.log("🔍 Verifying Redis data consistency...")
            
            # Check if both payment links were created with correct fee_payer
            company_pays_link = test_results.get('company_pays_fees', {})
            customer_pays_link = test_results.get('customer_pays_fees', {})
            
            if not company_pays_link or not customer_pays_link:
                self.log("❌ Missing payment link data for consistency check", "ERROR")
                return False
            
            # Verify fee_payer field consistency
            company_fee_payer = company_pays_link.get('payment_data', {}).get('fee_payer')
            customer_fee_payer = customer_pays_link.get('payment_data', {}).get('fee_payer')
            
            self.log(f"   - Company pays fees link fee_payer: {company_fee_payer}")
            self.log(f"   - Customer pays fees link fee_payer: {customer_fee_payer}")
            
            consistency_checks = []
            
            # Check 1: fee_payer field matches expected values
            if company_fee_payer == 'company':
                self.log("✅ Company pays fees - fee_payer field correct")
                consistency_checks.append(True)
            else:
                self.log(f"❌ Company pays fees - fee_payer field incorrect: {company_fee_payer}", "ERROR")
                consistency_checks.append(False)
            
            if customer_fee_payer == 'customer':
                self.log("✅ Customer pays fees - fee_payer field correct")
                consistency_checks.append(True)
            else:
                self.log(f"❌ Customer pays fees - fee_payer field incorrect: {customer_fee_payer}", "ERROR")
                consistency_checks.append(False)
            
            # Check 2: fee_info structure for customer pays fees
            customer_fee_info = customer_pays_link.get('payment_data', {}).get('fee_info', {})
            if customer_fee_info and customer_fee_info.get('estimated_processing_fee'):
                self.log("✅ Customer pays fees - fee_info shows breakdown")
                consistency_checks.append(True)
            else:
                self.log("❌ Customer pays fees - fee_info missing breakdown", "ERROR")
                consistency_checks.append(False)
            
            # Check 3: Crypto payment data consistency
            company_crypto = company_pays_link.get('crypto_data', {})
            customer_crypto = customer_pays_link.get('crypto_data', {})
            
            if company_crypto and customer_crypto:
                company_crypto_fee_payer = company_crypto.get('fee_payer')
                customer_crypto_fee_payer = customer_crypto.get('fee_payer')
                
                if company_crypto_fee_payer == 'company':
                    self.log("✅ Company crypto payment - fee_payer field correct")
                    consistency_checks.append(True)
                else:
                    self.log(f"❌ Company crypto payment - fee_payer field incorrect: {company_crypto_fee_payer}", "ERROR")
                    consistency_checks.append(False)
                
                if customer_crypto_fee_payer == 'customer':
                    self.log("✅ Customer crypto payment - fee_payer field correct")
                    consistency_checks.append(True)
                else:
                    self.log(f"❌ Customer crypto payment - fee_payer field incorrect: {customer_crypto_fee_payer}", "ERROR")
                    consistency_checks.append(False)
            
            # Overall consistency result
            all_consistent = all(consistency_checks)
            if all_consistent:
                self.log("✅ Redis data consistency verification PASSED")
            else:
                self.log(f"❌ Redis data consistency verification FAILED - {sum(consistency_checks)}/{len(consistency_checks)} checks passed", "ERROR")
            
            return all_consistent
            
        except Exception as e:
            self.log(f"❌ Redis consistency verification error: {str(e)}", "ERROR")
            return False
    
    def analyze_fund_distribution_logic(self, test_results: Dict[str, Any]) -> bool:
        """Analyze fund distribution logic based on fee_payer modes"""
        try:
            self.log("💰 Analyzing fund distribution logic...")
            
            company_crypto = test_results.get('company_pays_fees', {}).get('crypto_data', {})
            customer_crypto = test_results.get('customer_pays_fees', {}).get('crypto_data', {})
            
            if not company_crypto or not customer_crypto:
                self.log("❌ Missing crypto payment data for fund distribution analysis", "ERROR")
                return False
            
            analysis_results = []
            
            # Analyze company pays fees mode
            self.log("   📊 Company Pays Fees Mode Analysis:")
            company_amount = float(company_crypto.get('amount', 0))
            company_merchant_amount = float(company_crypto.get('merchant_amount', 0))
            company_fees = float(company_crypto.get('fees', 0))
            
            if company_amount > 0:
                company_merchant_percentage = (company_merchant_amount / company_amount) * 100
                company_fee_percentage = (company_fees / company_amount) * 100
                
                self.log(f"     - Total Amount: {company_amount} ETH")
                self.log(f"     - Merchant Amount: {company_merchant_amount} ETH ({company_merchant_percentage:.1f}%)")
                self.log(f"     - Admin Fees: {company_fees} ETH ({company_fee_percentage:.1f}%)")
                
                # Expected: Merchant receives ~67% (after 33% admin fee deduction)
                if 65 <= company_merchant_percentage <= 70:
                    self.log("     ✅ Merchant percentage within expected range (65-70%)")
                    analysis_results.append(True)
                else:
                    self.log(f"     ❌ Merchant percentage outside expected range: {company_merchant_percentage:.1f}%", "ERROR")
                    analysis_results.append(False)
            
            # Analyze customer pays fees mode
            self.log("   📊 Customer Pays Fees Mode Analysis:")
            customer_amount = float(customer_crypto.get('amount', 0))
            customer_merchant_amount = float(customer_crypto.get('merchant_amount', 0))
            customer_fees = float(customer_crypto.get('fees', 0))
            
            if customer_amount > 0:
                customer_merchant_percentage = (customer_merchant_amount / customer_amount) * 100
                customer_fee_percentage = (customer_fees / customer_amount) * 100
                
                self.log(f"     - Total Amount: {customer_amount} ETH")
                self.log(f"     - Merchant Amount: {customer_merchant_amount} ETH ({customer_merchant_percentage:.1f}%)")
                self.log(f"     - Admin Fees: {customer_fees} ETH ({customer_fee_percentage:.1f}%)")
                
                # Expected: In customer pays fees mode, merchant gets the base amount (100% of what they requested)
                # The customer pays extra fees on top, so merchant percentage of total will be lower
                # But merchant gets the full amount they requested
                if 60 <= customer_merchant_percentage <= 75:
                    self.log("     ✅ Merchant percentage within expected range (60-75%) - customer pays extra fees")
                    analysis_results.append(True)
                else:
                    self.log(f"     ❌ Merchant percentage outside expected range: {customer_merchant_percentage:.1f}%", "ERROR")
                    analysis_results.append(False)
            
            # Compare the two modes - key insight: merchant amounts should be different
            if company_amount > 0 and customer_amount > 0:
                self.log("   📊 Mode Comparison:")
                self.log(f"     - Company pays fees: Merchant gets {company_merchant_amount:.8f} ETH ({company_merchant_percentage:.1f}% of total)")
                self.log(f"     - Customer pays fees: Merchant gets {customer_merchant_amount:.8f} ETH ({customer_merchant_percentage:.1f}% of total)")
                
                # Key insight: In customer pays fees mode, merchant should get MORE absolute amount
                # because they get the full base amount, while in company pays fees mode they get base minus fees
                if customer_merchant_amount > company_merchant_amount:
                    self.log("     ✅ Customer pays fees mode: merchant gets more absolute amount (correct)")
                    analysis_results.append(True)
                else:
                    self.log(f"     ❌ Customer pays fees mode should give merchant more absolute amount", "ERROR")
                    analysis_results.append(False)
                
                # Customer should pay more in customer-pays-fees mode
                if customer_amount > company_amount:
                    self.log("     ✅ Customer pays more when customer pays fees (correct)")
                    analysis_results.append(True)
                else:
                    self.log("     ❌ Customer should pay more when customer pays fees", "ERROR")
                    analysis_results.append(False)
            
            all_correct = all(analysis_results)
            if all_correct:
                self.log("✅ Fund distribution logic analysis PASSED")
            else:
                self.log(f"❌ Fund distribution logic analysis FAILED - {sum(analysis_results)}/{len(analysis_results)} checks passed", "ERROR")
            
            return all_correct
            
        except Exception as e:
            self.log(f"❌ Fund distribution analysis error: {str(e)}", "ERROR")
            return False
    
    def test_webhook_data_flow(self, test_results: Dict[str, Any]) -> bool:
        """Test webhook handler data flow (simulated)"""
        try:
            self.log("🔗 Testing webhook handler data flow...")
            
            # Check if crypto addresses were generated (indicates Redis data is stored)
            company_crypto = test_results.get('company_pays_fees', {}).get('crypto_data', {})
            customer_crypto = test_results.get('customer_pays_fees', {}).get('crypto_data', {})
            
            webhook_checks = []
            
            # Check 1: Crypto addresses generated (indicates Redis storage)
            if company_crypto.get('address'):
                self.log(f"✅ Company pays fees - Crypto address generated: {company_crypto['address'][:20]}...")
                webhook_checks.append(True)
            else:
                self.log("❌ Company pays fees - No crypto address generated", "ERROR")
                webhook_checks.append(False)
            
            if customer_crypto.get('address'):
                self.log(f"✅ Customer pays fees - Crypto address generated: {customer_crypto['address'][:20]}...")
                webhook_checks.append(True)
            else:
                self.log("❌ Customer pays fees - No crypto address generated", "ERROR")
                webhook_checks.append(False)
            
            # Check 2: Required fields for webhook processing
            required_fields = ['fee_payer', 'merchant_amount', 'amount']
            
            for mode, crypto_data in [('company', company_crypto), ('customer', customer_crypto)]:
                self.log(f"   📋 Checking {mode} pays fees webhook data:")
                for field in required_fields:
                    if field in crypto_data and crypto_data[field] is not None:
                        self.log(f"     ✅ {field}: {crypto_data[field]}")
                        webhook_checks.append(True)
                    else:
                        self.log(f"     ❌ Missing {field}", "ERROR")
                        webhook_checks.append(False)
            
            # Check 3: Verify fee_payer values are correct
            company_fee_payer = company_crypto.get('fee_payer')
            customer_fee_payer = customer_crypto.get('fee_payer')
            
            if company_fee_payer == 'company':
                self.log("✅ Company crypto payment has correct fee_payer value")
                webhook_checks.append(True)
            else:
                self.log(f"❌ Company crypto payment has incorrect fee_payer: {company_fee_payer}", "ERROR")
                webhook_checks.append(False)
            
            if customer_fee_payer == 'customer':
                self.log("✅ Customer crypto payment has correct fee_payer value")
                webhook_checks.append(True)
            else:
                self.log(f"❌ Customer crypto payment has incorrect fee_payer: {customer_fee_payer}", "ERROR")
                webhook_checks.append(False)
            
            all_webhook_checks_passed = all(webhook_checks)
            if all_webhook_checks_passed:
                self.log("✅ Webhook handler data flow verification PASSED")
            else:
                self.log(f"❌ Webhook handler data flow verification FAILED - {sum(webhook_checks)}/{len(webhook_checks)} checks passed", "ERROR")
            
            return all_webhook_checks_passed
            
        except Exception as e:
            self.log(f"❌ Webhook data flow test error: {str(e)}", "ERROR")
            return False
    
    def run_comprehensive_test(self) -> Dict[str, Any]:
        """Run comprehensive payment confirmation and fund distribution test"""
        self.log("🚀 Starting DynoPay Payment Confirmation and Fund Distribution Testing")
        self.log("=" * 80)
        
        # Test credentials
        email = "john@dyno.pt"
        password = "Katiekendra123@"
        
        # Authenticate
        if not self.authenticate(email, password):
            return {"success": False, "error": "Authentication failed"}
        
        test_results = {
            "authentication": True,
            "company_pays_fees": {},
            "customer_pays_fees": {},
            "redis_consistency": False,
            "fund_distribution": False,
            "webhook_data_flow": False,
            "overall_success": False
        }
        
        try:
            # Test 1: Payment Link Creation - Company Pays Fees (default)
            self.log("\n" + "="*50)
            self.log("TEST 1: Payment Link Creation - Company Pays Fees")
            self.log("="*50)
            
            company_link = self.create_payment_link(
                amount=100,
                fee_payer="company",
                description="Company pays fees test",
                email="test1@example.com"
            )
            
            if company_link and company_link.get('reference'):
                # Get payment data to verify Redis storage
                company_payment_data = self.get_payment_data(company_link['reference'])
                if company_payment_data:
                    test_results['company_pays_fees'] = {
                        'link_data': company_link,
                        'payment_data': company_payment_data
                    }
                    
                    # Create crypto payment to test Redis data storage
                    company_crypto = self.create_crypto_payment(company_link['reference'], "ETH")
                    if company_crypto:
                        test_results['company_pays_fees']['crypto_data'] = company_crypto
            
            # Test 2: Payment Link Creation - Customer Pays Fees
            self.log("\n" + "="*50)
            self.log("TEST 2: Payment Link Creation - Customer Pays Fees")
            self.log("="*50)
            
            customer_link = self.create_payment_link(
                amount=100,
                fee_payer="customer",
                description="Customer pays fees test",
                email="test2@example.com"
            )
            
            if customer_link and customer_link.get('reference'):
                # Get payment data to verify Redis storage
                customer_payment_data = self.get_payment_data(customer_link['reference'])
                if customer_payment_data:
                    test_results['customer_pays_fees'] = {
                        'link_data': customer_link,
                        'payment_data': customer_payment_data
                    }
                    
                    # Create crypto payment to test Redis data storage
                    customer_crypto = self.create_crypto_payment(customer_link['reference'], "ETH")
                    if customer_crypto:
                        test_results['customer_pays_fees']['crypto_data'] = customer_crypto
            
            # Test 3: Redis Data Consistency Verification
            self.log("\n" + "="*50)
            self.log("TEST 3: Redis Data Consistency Verification")
            self.log("="*50)
            
            test_results['redis_consistency'] = self.verify_redis_data_consistency(test_results)
            
            # Test 4: Fund Distribution Logic Analysis
            self.log("\n" + "="*50)
            self.log("TEST 4: Fund Distribution Logic Analysis")
            self.log("="*50)
            
            test_results['fund_distribution'] = self.analyze_fund_distribution_logic(test_results)
            
            # Test 5: Webhook Handler Data Flow
            self.log("\n" + "="*50)
            self.log("TEST 5: Webhook Handler Data Flow")
            self.log("="*50)
            
            test_results['webhook_data_flow'] = self.test_webhook_data_flow(test_results)
            
            # Overall success calculation
            critical_tests = [
                test_results['redis_consistency'],
                test_results['fund_distribution'],
                test_results['webhook_data_flow']
            ]
            
            test_results['overall_success'] = all(critical_tests)
            
            # Final summary
            self.log("\n" + "="*80)
            self.log("FINAL TEST SUMMARY")
            self.log("="*80)
            
            passed_tests = sum([
                test_results['authentication'],
                bool(test_results['company_pays_fees']),
                bool(test_results['customer_pays_fees']),
                test_results['redis_consistency'],
                test_results['fund_distribution'],
                test_results['webhook_data_flow']
            ])
            
            total_tests = 6
            success_rate = (passed_tests / total_tests) * 100
            
            self.log(f"📊 Test Results: {passed_tests}/{total_tests} tests passed ({success_rate:.1f}%)")
            self.log(f"✅ Authentication: {'PASS' if test_results['authentication'] else 'FAIL'}")
            self.log(f"✅ Company Pays Fees Link: {'PASS' if test_results['company_pays_fees'] else 'FAIL'}")
            self.log(f"✅ Customer Pays Fees Link: {'PASS' if test_results['customer_pays_fees'] else 'FAIL'}")
            self.log(f"✅ Redis Consistency: {'PASS' if test_results['redis_consistency'] else 'FAIL'}")
            self.log(f"✅ Fund Distribution Logic: {'PASS' if test_results['fund_distribution'] else 'FAIL'}")
            self.log(f"✅ Webhook Data Flow: {'PASS' if test_results['webhook_data_flow'] else 'FAIL'}")
            
            if test_results['overall_success']:
                self.log("🎉 OVERALL RESULT: ALL CRITICAL TESTS PASSED")
            else:
                self.log("❌ OVERALL RESULT: SOME CRITICAL TESTS FAILED")
            
            return test_results
            
        except Exception as e:
            self.log(f"❌ Test execution error: {str(e)}", "ERROR")
            test_results['error'] = str(e)
            return test_results

def main():
    """Main test execution"""
    tester = DynoPayTester()
    results = tester.run_comprehensive_test()
    
    # Exit with appropriate code
    if results.get('overall_success', False):
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()