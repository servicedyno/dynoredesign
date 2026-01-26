#!/usr/bin/env python3
"""
Test script to verify one wallet address per blockchain type per company restriction.
This ensures merchants can only add one wallet address for each blockchain (BTC, ETH, etc.) per company.
"""

import requests
import json
from typing import Dict, Any

# Configuration
BASE_URL = "https://payment-api-6.preview.emergentagent.com/api"
TEST_EMAIL = "nomadly@moxx.co"
TEST_PASSWORD = "test123"

# Test wallet addresses (VALID format for testing)
TEST_WALLETS = {
    "BTC": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",  # Genesis block address
    "BTC_ALT": "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",  # Different BTC address
    "ETH": "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
    "ETH_ALT": "0xdAC17F958D2ee523a2206206994597C13D831ec7",  # Different ETH address
}

class WalletBlockchainValidator:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.company_id = None

    def login(self) -> bool:
        """Authenticate and get JWT token"""
        print(f"\n{'='*60}")
        print("🔐 STEP 1: Authentication")
        print(f"{'='*60}")
        
        response = requests.post(
            f"{BASE_URL}/user/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if response.status_code == 200:
            data = response.json()
            self.token = data["data"]["accessToken"]
            self.user_id = data["data"]["userData"]["user_id"]
            print(f"✅ Login successful")
            print(f"   User ID: {self.user_id}")
            print(f"   Token: {self.token[:30]}...")
            return True
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False

    def get_company(self) -> bool:
        """Get user's company"""
        print(f"\n{'='*60}")
        print("🏢 STEP 2: Get Company")
        print(f"{'='*60}")
        
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.get(f"{BASE_URL}/company/getCompany", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if data["data"]:
                self.company_id = data["data"][0]["company_id"]
                print(f"✅ Company found")
                print(f"   Company ID: {self.company_id}")
                print(f"   Company Name: {data['data'][0].get('company_name', 'N/A')}")
                return True
            else:
                print("⚠️  No company found for this user")
                return False
        else:
            print(f"❌ Failed to get company: {response.status_code}")
            return False

    def validate_wallet(self, currency: str, wallet_address: str, test_name: str) -> Dict[str, Any]:
        """Validate wallet address (sends OTP)"""
        print(f"\n{'─'*60}")
        print(f"🧪 TEST: {test_name}")
        print(f"{'─'*60}")
        print(f"   Currency: {currency}")
        print(f"   Address: {wallet_address}")
        print(f"   Company ID: {self.company_id}")
        
        headers = {"Authorization": f"Bearer {self.token}"}
        payload = {
            "wallet_address": wallet_address,
            "currency": currency,
            "company_id": self.company_id,
            "wallet_name": f"{currency} Main Wallet"
        }
        
        response = requests.post(
            f"{BASE_URL}/wallet/validateWalletAddress",
            headers=headers,
            json=payload
        )
        
        result = {
            "status_code": response.status_code,
            "success": response.status_code == 200,
            "response": response.json() if response.status_code in [200, 400] else response.text
        }
        
        if result["success"]:
            print(f"✅ PASS: Validation successful - OTP sent")
            print(f"   Message: {result['response'].get('message', 'N/A')}")
        else:
            if response.status_code == 400:
                print(f"❌ BLOCKED: {result['response'].get('message', 'N/A')}")
                # Check if it's the expected error for duplicate blockchain type
                msg = result['response'].get('message', '').lower()
                if 'already exists' in msg and 'wallet address' in msg:
                    print(f"   ✓ Correct validation: Duplicate blockchain type prevented!")
            else:
                print(f"❌ FAIL: Unexpected error - Status {response.status_code}")
                print(f"   Response: {result['response']}")
        
        return result

    def check_existing_wallets(self):
        """Check what wallets already exist for this company"""
        print(f"\n{'='*60}")
        print("📊 STEP 3: Check Existing Wallets")
        print(f"{'='*60}")
        
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.get(
            f"{BASE_URL}/wallet/getWallet?company_id={self.company_id}",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            wallets = data.get("data", [])
            
            # Filter wallets with addresses
            wallets_with_addresses = [w for w in wallets if w.get("wallet_address")]
            
            print(f"   Total wallets: {len(wallets)}")
            print(f"   Wallets with addresses: {len(wallets_with_addresses)}")
            
            if wallets_with_addresses:
                print(f"\n   Configured wallet addresses:")
                for wallet in wallets_with_addresses:
                    addr = wallet.get('wallet_address', 'N/A')
                    wtype = wallet.get('wallet_type', 'N/A')
                    print(f"   • {wtype}: {addr[:15]}...{addr[-10:]}")
            else:
                print(f"   ℹ️  No wallet addresses configured yet")
            
            return wallets_with_addresses
        else:
            print(f"❌ Failed to get wallets: {response.status_code}")
            return []

    def run_validation_tests(self):
        """Run comprehensive validation tests"""
        print(f"\n{'='*60}")
        print("🧪 STEP 4: Blockchain Type Validation Tests")
        print(f"{'='*60}")
        
        # Get existing wallets first
        existing = self.check_existing_wallets()
        existing_types = {w.get('wallet_type') for w in existing if w.get('wallet_address')}
        
        print(f"\n📋 Test Plan:")
        print(f"   • Test adding first BTC wallet (should succeed)")
        print(f"   • Test adding second BTC wallet (should fail)")
        print(f"   • Test adding first ETH wallet (should succeed)")
        print(f"   • Test adding second ETH wallet (should fail)")
        
        results = []
        
        # Test 1: Add first BTC wallet (should succeed if not exists)
        if "BTC" not in existing_types:
            print(f"\n{'='*60}")
            print("TEST 1: Add First BTC Wallet")
            print(f"{'='*60}")
            result = self.validate_wallet(
                "BTC", 
                TEST_WALLETS["BTC"],
                "First BTC wallet - Should SUCCEED"
            )
            results.append(("First BTC", result))
        else:
            print(f"\n{'='*60}")
            print("TEST 1: BTC wallet already exists, skipping first add")
            print(f"{'='*60}")
        
        # Test 2: Try to add second BTC wallet (should fail)
        print(f"\n{'='*60}")
        print("TEST 2: Add Second BTC Wallet (Duplicate)")
        print(f"{'='*60}")
        result = self.validate_wallet(
            "BTC", 
            TEST_WALLETS["BTC_ALT"],
            "Second BTC wallet - Should FAIL (duplicate blockchain type)"
        )
        results.append(("Second BTC (duplicate)", result))
        
        # Test 3: Add first ETH wallet (should succeed if not exists)
        if "ETH" not in existing_types:
            print(f"\n{'='*60}")
            print("TEST 3: Add First ETH Wallet")
            print(f"{'='*60}")
            result = self.validate_wallet(
                "ETH", 
                TEST_WALLETS["ETH"],
                "First ETH wallet - Should SUCCEED"
            )
            results.append(("First ETH", result))
        else:
            print(f"\n{'='*60}")
            print("TEST 3: ETH wallet already exists, skipping first add")
            print(f"{'='*60}")
        
        # Test 4: Try to add second ETH wallet (should fail)
        print(f"\n{'='*60}")
        print("TEST 4: Add Second ETH Wallet (Duplicate)")
        print(f"{'='*60}")
        result = self.validate_wallet(
            "ETH", 
            TEST_WALLETS["ETH_ALT"],
            "Second ETH wallet - Should FAIL (duplicate blockchain type)"
        )
        results.append(("Second ETH (duplicate)", result))
        
        return results

    def print_summary(self, results):
        """Print test summary"""
        print(f"\n{'='*60}")
        print("📊 TEST SUMMARY")
        print(f"{'='*60}")
        
        duplicate_tests = [r for r in results if "duplicate" in r[0].lower()]
        
        print(f"\n🎯 Validation Rules:")
        print(f"   ✓ Each company can have ONE wallet per blockchain type")
        print(f"   ✓ First wallet for a blockchain type: ALLOWED")
        print(f"   ✗ Second wallet for same blockchain type: BLOCKED")
        
        print(f"\n📋 Test Results:")
        for test_name, result in results:
            status = "✅ PASS" if (
                ("duplicate" in test_name.lower() and not result["success"]) or
                ("First" in test_name and result["success"])
            ) else "⚠️  UNEXPECTED"
            print(f"   {status} | {test_name}")
        
        # Check if duplicate prevention is working
        duplicate_blocked = all(not r[1]["success"] for r in duplicate_tests)
        
        print(f"\n{'='*60}")
        if duplicate_blocked:
            print("🎉 SUCCESS: Blockchain type restriction is working correctly!")
            print("   • Duplicate blockchain types are properly blocked")
            print("   • Each company can only have one wallet per blockchain")
        else:
            print("⚠️  WARNING: Some validation tests did not behave as expected")
        print(f"{'='*60}\n")

def main():
    """Main test execution"""
    print(f"\n{'#'*60}")
    print("# WALLET BLOCKCHAIN TYPE VALIDATION TEST")
    print("# One wallet address per blockchain type per company")
    print(f"{'#'*60}")
    
    validator = WalletBlockchainValidator()
    
    # Step 1: Login
    if not validator.login():
        print("\n❌ Test aborted: Login failed")
        return
    
    # Step 2: Get company
    if not validator.get_company():
        print("\n❌ Test aborted: No company found")
        return
    
    # Step 3 & 4: Run tests
    results = validator.run_validation_tests()
    
    # Step 5: Print summary
    validator.print_summary(results)

if __name__ == "__main__":
    main()
