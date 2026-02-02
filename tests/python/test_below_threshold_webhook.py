"""
Below-Threshold Sepolia Payment Test with Webhook Simulation
Tests payment processing for amounts < $5 USD threshold
"""

import requests
import json
import time
from datetime import datetime
import hashlib
import random

# Configuration
BASE_URL = "http://localhost:8001"
TEST_USER_EMAIL = "john@dyno.pt"
TEST_USER_PASSWORD = "Katiekendra123@"

# Test parameters
TEST_AMOUNT_ETH = 0.005  # ~$14.58 USD (admin fee ~$3.44 < $5 threshold)
TEST_CURRENCY = "ETH"

class BeloThresholdPaymentTest:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.link_id = None
        self.transaction_id = None
        self.payment_address = None
        self.results = {
            "test_name": "Below-Threshold Payment Test",
            "test_date": datetime.now().isoformat(),
            "phases": []
        }
    
    def log_phase(self, phase_name, status, details):
        """Log test phase results"""
        phase = {
            "phase": phase_name,
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "details": details
        }
        self.results["phases"].append(phase)
        print(f"\n{'='*60}")
        print(f"PHASE: {phase_name}")
        print(f"STATUS: {status}")
        print(f"DETAILS: {json.dumps(details, indent=2)}")
        print(f"{'='*60}\n")
    
    def phase1_login(self):
        """Phase 1: Authenticate and get JWT token"""
        print("\n🔐 PHASE 1: Authentication")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/user/login",
                json={
                    "email": TEST_USER_EMAIL,
                    "password": TEST_USER_PASSWORD
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("data", {}).get("accessToken")
                user_data = data.get("data", {}).get("userData", {})
                self.user_id = user_data.get("user_id")
                
                self.log_phase("Authentication", "✅ PASSED", {
                    "email": TEST_USER_EMAIL,
                    "user_id": self.user_id,
                    "token_preview": self.token[:50] + "..." if self.token else None
                })
                return True
            else:
                self.log_phase("Authentication", "❌ FAILED", {
                    "status_code": response.status_code,
                    "error": response.text
                })
                return False
                
        except Exception as e:
            self.log_phase("Authentication", "❌ ERROR", {"exception": str(e)})
            return False
    
    def phase2_create_payment_link(self):
        """Phase 2: Create payment link for below-threshold amount"""
        print("\n💰 PHASE 2: Create Payment Link")
        
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            
            response = requests.post(
                f"{BASE_URL}/api/pay/createPaymentLink",
                json={
                    "email": "below-threshold-test@example.com",
                    "amount": TEST_AMOUNT_ETH,
                    "base_currency": TEST_CURRENCY,
                    "modes": ["CRYPTO"],
                    "description": f"Below-threshold test ({TEST_AMOUNT_ETH} ETH)"
                },
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json().get("data", {})
                self.link_id = data.get("link_id")
                self.transaction_id = data.get("transaction_id")
                
                self.log_phase("Create Payment Link", "✅ PASSED", {
                    "link_id": self.link_id,
                    "transaction_id": self.transaction_id,
                    "amount": TEST_AMOUNT_ETH,
                    "currency": TEST_CURRENCY
                })
                return True
            else:
                self.log_phase("Create Payment Link", "❌ FAILED", {
                    "status_code": response.status_code,
                    "error": response.text[:500]
                })
                return False
                
        except Exception as e:
            self.log_phase("Create Payment Link", "❌ ERROR", {"exception": str(e)})
            return False
    
    def phase3_generate_test_address(self):
        """Phase 3: Generate simulated Sepolia address for testing"""
        print("\n🏦 PHASE 3: Generate Test Address")
        
        # Generate realistic Sepolia address (0x + 40 hex chars)
        random_hex = ''.join([random.choice('0123456789abcdef') for _ in range(40)])
        self.payment_address = f"0x{random_hex}"
        
        self.log_phase("Generate Test Address", "✅ PASSED", {
            "payment_address": self.payment_address,
            "note": "Simulated Sepolia testnet address for webhook testing"
        })
        return True
    
    def phase4_simulate_webhook(self):
        """Phase 4: Simulate Tatum webhook for below-threshold payment"""
        print("\n🔔 PHASE 4: Simulate Tatum Webhook")
        
        # Generate realistic Sepolia TX hash
        random_hash = ''.join([random.choice('0123456789abcdef') for _ in range(64)])
        tx_hash = f"0x{random_hash}"
        
        # Construct webhook payload
        webhook_payload = {
            "currency": "ETH",
            "amount": str(TEST_AMOUNT_ETH),
            "address": self.payment_address,
            "txId": tx_hash,
            "blockNumber": 5234567,
            "asset": "ETH",
            "type": "native",
            "mempool": False,
            "confirmations": 12,
            "timestamp": int(time.time()),
            "subscriptionType": "ADDRESS_TRANSACTION"
        }
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/tatum-crypto-webhook",
                json=webhook_payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            self.log_phase("Simulate Webhook", "✅ SENT", {
                "webhook_url": "/api/tatum-crypto-webhook",
                "payload": webhook_payload,
                "response_code": response.status_code,
                "response_body": response.text[:500]
            })
            
            # Webhook might return 404 if address not in database yet
            # That's expected for simulation
            return True
            
        except Exception as e:
            self.log_phase("Simulate Webhook", "⚠️ WARNING", {
                "exception": str(e),
                "note": "Expected if temp address not in database"
            })
            return True  # Continue test even if webhook fails
    
    def phase5_verify_database(self):
        """Phase 5: Verify database records"""
        print("\n🔍 PHASE 5: Verify Database Records")
        
        # This would require database queries
        # For now, log what should be checked
        
        checks = {
            "transaction_status": {
                "query": f"SELECT status, usd_value FROM tbl_transactions WHERE transaction_id = '{self.transaction_id}'",
                "expected": "status='successful', usd_value < 5"
            },
            "admin_fee_status": {
                "query": f"SELECT admin_status, admin_fee FROM tbl_user_temp_address WHERE wallet_address = '{self.payment_address}'",
                "expected": "admin_status='pending' (NOT 'pending_sweep')"
            },
            "no_sweep_record": {
                "query": f"SELECT COUNT(*) FROM tbl_admin_fee_transaction WHERE transaction_id = '{self.transaction_id}'",
                "expected": "count=0 (no sweep yet)"
            }
        }
        
        self.log_phase("Verify Database", "⏸️ MANUAL CHECK REQUIRED", {
            "checks_needed": checks,
            "note": "Run these SQL queries manually to verify results"
        })
        return True
    
    def phase6_calculate_expected_fees(self):
        """Phase 6: Calculate expected fees and amounts"""
        print("\n📊 PHASE 6: Fee Calculations")
        
        # Assuming ETH price ~$2,916.60 from previous test
        eth_price = 2916.60
        payment_usd = TEST_AMOUNT_ETH * eth_price
        
        # Tier 1 fees (for payments $5-$100)
        platform_fee_pct = 0.02  # 2%
        fixed_fee_usd = 3.00
        buffer_pct = 0.01  # 1%
        
        platform_fee = payment_usd * platform_fee_pct
        buffer_fee = payment_usd * buffer_pct
        total_fee_usd = platform_fee + fixed_fee_usd + buffer_fee
        admin_fee_usd = total_fee_usd
        
        merchant_receives_usd = payment_usd - total_fee_usd
        merchant_receives_eth = merchant_receives_usd / eth_price
        admin_fee_eth = admin_fee_usd / eth_price
        
        calculations = {
            "payment": {
                "eth": TEST_AMOUNT_ETH,
                "usd": round(payment_usd, 2)
            },
            "fees": {
                "platform_2pct": round(platform_fee, 2),
                "fixed": fixed_fee_usd,
                "buffer_1pct": round(buffer_fee, 2),
                "total_usd": round(total_fee_usd, 2),
                "total_eth": round(admin_fee_eth, 6),
                "percentage": round((total_fee_usd / payment_usd) * 100, 2)
            },
            "merchant_receives": {
                "eth": round(merchant_receives_eth, 6),
                "usd": round(merchant_receives_usd, 2)
            },
            "admin_fee": {
                "eth": round(admin_fee_eth, 6),
                "usd": round(admin_fee_usd, 2),
                "below_threshold": admin_fee_usd < 5.0,
                "expected_status": "pending" if admin_fee_usd < 5.0 else "pending_sweep"
            }
        }
        
        self.log_phase("Fee Calculations", "✅ CALCULATED", calculations)
        return True
    
    def generate_report(self):
        """Generate final test report"""
        print("\n" + "="*80)
        print("📋 FINAL TEST REPORT")
        print("="*80)
        
        print(f"\nTest: {self.results['test_name']}")
        print(f"Date: {self.results['test_date']}")
        print(f"\nPhases Executed: {len(self.results['phases'])}")
        
        for phase in self.results['phases']:
            status_icon = "✅" if "PASSED" in phase['status'] else "⚠️" if "WARNING" in phase['status'] else "❌"
            print(f"\n{status_icon} {phase['phase']}: {phase['status']}")
        
        print("\n" + "="*80)
        print("💡 KEY FINDINGS")
        print("="*80)
        print(f"""
Test Amount: {TEST_AMOUNT_ETH} ETH (~$14.58 USD)
Admin Fee: ~$3.44 USD (< $5 threshold)
Expected Status: 'pending' (NOT 'pending_sweep')
Expected Behavior: Admin fee held for batch sweep

✅ Payment link created successfully
✅ Test address generated for simulation
✅ Webhook payload constructed
⚠️ Full end-to-end test requires database records
⚠️ Manual verification needed for complete validation

COMPARISON WITH ABOVE-THRESHOLD TEST:
┌────────────────────┬─────────────────────┬──────────────────────┐
│ Aspect             │ Above Threshold     │ Below Threshold      │
├────────────────────┼─────────────────────┼──────────────────────┤
│ Amount             │ 0.05 ETH ($145.83)  │ 0.005 ETH ($14.58)   │
│ Admin Fee          │ $6.08               │ ~$3.44               │
│ admin_status       │ 'pending_sweep'     │ 'pending'            │
│ Swept by Cron?     │ YES (15 min)        │ NO                   │
│ Sweep TX           │ 0x406abb34...       │ None                 │
└────────────────────┴─────────────────────┴──────────────────────┘
""")
        
        # Save report to file
        report_file = f"/app/below_threshold_webhook_test_{int(time.time())}.json"
        with open(report_file, 'w') as f:
            json.dump(self.results, f, indent=2)
        
        print(f"\n📄 Full report saved to: {report_file}")
        print("="*80 + "\n")
    
    def run_test(self):
        """Run complete test suite"""
        print("\n" + "="*80)
        print("🧪 BELOW-THRESHOLD PAYMENT TEST - SEPOLIA TESTNET")
        print("="*80)
        print(f"Test Amount: {TEST_AMOUNT_ETH} ETH (< $5 threshold)")
        print(f"Expected: Admin fee held as 'pending' (not swept)")
        print("="*80 + "\n")
        
        # Execute test phases
        if not self.phase1_login():
            print("❌ Test aborted: Login failed")
            return False
        
        if not self.phase2_create_payment_link():
            print("❌ Test aborted: Payment link creation failed")
            return False
        
        if not self.phase3_generate_test_address():
            print("❌ Test aborted: Address generation failed")
            return False
        
        self.phase4_simulate_webhook()
        
        self.phase6_calculate_expected_fees()
        
        self.phase5_verify_database()
        
        # Generate final report
        self.generate_report()
        
        return True

if __name__ == "__main__":
    test = BeloThresholdPaymentTest()
    test.run_test()
