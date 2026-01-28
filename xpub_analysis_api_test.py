#!/usr/bin/env python3
"""
XPUB ANALYSIS FOR john@dyno.pt - API-Based Analysis
Comprehensive analysis of merchant xpub wallet creation status using API endpoints.
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any, Optional

class XPubAnalysisAPI:
    def __init__(self):
        self.backend_url = self.get_backend_url()
        self.jwt_token = None
        self.user_data = None
        self.analysis_results = {
            'user_info': {},
            'merchant_wallets': [],
            'pool_addresses': [],
            'transaction_count': 0,
            'sweep_count': 0,
            'initialization_status': 'unknown'
        }
        
    def get_backend_url(self):
        """Get backend URL from frontend .env file"""
        try:
            with open('/app/frontend/.env', 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        return line.split('=', 1)[1].strip()
        except:
            pass
        return "http://localhost:8001"
    
    def authenticate(self):
        """Authenticate with john@dyno.pt"""
        print("🔐 Authenticating with john@dyno.pt...")
        
        credentials = {
            "email": "john@dyno.pt",
            "password": "Katiekendra123@"
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json=credentials,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    self.jwt_token = data['data']['accessToken']
                    self.user_data = data['data']['userData']
                    
                    # Store user info for analysis
                    self.analysis_results['user_info'] = {
                        'user_id': self.user_data.get('user_id'),
                        'email': self.user_data.get('email'),
                        'name': self.user_data.get('name'),
                        'username': self.user_data.get('username')
                    }
                    
                    print(f"✅ Authentication successful!")
                    print(f"   - User ID: {self.user_data.get('user_id')}")
                    print(f"   - Email: {self.user_data.get('email')}")
                    print(f"   - Name: {self.user_data.get('name')}")
                    
                    return True
                else:
                    print(f"❌ Login succeeded but no token received")
                    return False
            else:
                print(f"❌ Login failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication failed: {str(e)}")
            return False
    
    def create_test_payment_link(self):
        """Create a test payment link to trigger merchant pool initialization"""
        print("\n🔗 Creating test payment link to check merchant pool system...")
        
        if not self.jwt_token:
            print("❌ No authentication token available")
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Create a payment link with CRYPTO mode to trigger merchant pool
            payment_data = {
                "email": "test@example.com",
                "amount": "100",
                "currency": "USD",
                "allowedModes": "CRYPTO",
                "description": "XPUB Analysis Test Payment"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=payment_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Payment link created successfully")
                
                # Extract useful information
                if 'available_currencies' in data:
                    currencies = data['available_currencies']
                    print(f"   - Available currencies: {', '.join(currencies)}")
                    
                    # This indicates merchant pool is working
                    if len(currencies) > 0:
                        print(f"   - Merchant pool system appears to be initialized")
                        self.analysis_results['initialization_status'] = 'initialized'
                    else:
                        print(f"   - No currencies available - pool may not be initialized")
                        self.analysis_results['initialization_status'] = 'not_initialized'
                
                return True
            else:
                print(f"❌ Payment link creation failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Payment link creation failed: {str(e)}")
            return False
    
    def check_wallet_endpoints(self):
        """Check wallet-related endpoints for merchant pool information"""
        print("\n💰 Checking wallet endpoints...")
        
        if not self.jwt_token:
            print("❌ No authentication token available")
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Check user wallets
            response = requests.get(
                f"{self.backend_url}/api/wallet/getWallet",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                wallets = data.get('data', []) if isinstance(data.get('data'), list) else []
                
                print(f"✅ Found {len(wallets)} user wallets")
                
                # Analyze wallet types
                wallet_types = []
                for wallet in wallets:
                    if isinstance(wallet, dict) and 'currency' in wallet:
                        wallet_types.append(wallet['currency'])
                
                if wallet_types:
                    print(f"   - Wallet types: {', '.join(set(wallet_types))}")
                    self.analysis_results['merchant_wallets'] = wallets
                else:
                    print(f"   - No wallet currencies found")
                
                return True
            else:
                print(f"❌ Wallet endpoint failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Wallet check failed: {str(e)}")
            return False
    
    def check_wallet_addresses(self):
        """Check wallet addresses"""
        print("\n📍 Checking wallet addresses...")
        
        if not self.jwt_token:
            print("❌ No authentication token available")
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Check wallet addresses
            response = requests.get(
                f"{self.backend_url}/api/wallet/getWalletAddresses",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                addresses = data.get('data', []) if isinstance(data.get('data'), list) else []
                
                print(f"✅ Found {len(addresses)} wallet addresses")
                
                # Analyze address types
                address_types = []
                for address in addresses:
                    if isinstance(address, dict) and 'currency' in address:
                        address_types.append(address['currency'])
                
                if address_types:
                    print(f"   - Address types: {', '.join(set(address_types))}")
                    self.analysis_results['pool_addresses'] = addresses
                else:
                    print(f"   - No address currencies found")
                
                return True
            else:
                print(f"❌ Wallet addresses endpoint failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Wallet addresses check failed: {str(e)}")
            return False
    
    def check_transaction_history(self):
        """Check transaction history using the enhanced endpoint"""
        print("\n📊 Checking transaction history...")
        
        if not self.jwt_token:
            print("❌ No authentication token available")
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Use the enhanced transaction endpoint
            transaction_data = {
                "page": 1,
                "rowsPerPage": 10
            }
            
            response = requests.post(
                f"{self.backend_url}/api/wallet/getAllTransactions",
                json=transaction_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Extract transaction counts
                customers_tx = data.get('data', {}).get('customers_transactions', [])
                self_tx = data.get('data', {}).get('self_transactions', [])
                pagination = data.get('data', {}).get('pagination', {})
                
                total_customer_tx = pagination.get('total', 0) if 'customers_transactions' in str(data) else len(customers_tx)
                total_self_tx = len(self_tx)
                
                print(f"✅ Transaction history retrieved")
                print(f"   - Customer transactions: {total_customer_tx}")
                print(f"   - Self transactions: {total_self_tx}")
                print(f"   - Total transactions: {total_customer_tx + total_self_tx}")
                
                self.analysis_results['transaction_count'] = total_customer_tx + total_self_tx
                
                return True
            else:
                print(f"❌ Transaction history failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Transaction history check failed: {str(e)}")
            return False
    
    def check_dashboard_stats(self):
        """Check dashboard statistics for additional insights"""
        print("\n📈 Checking dashboard statistics...")
        
        if not self.jwt_token:
            print("❌ No authentication token available")
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            # Check main dashboard stats
            response = requests.get(
                f"{self.backend_url}/api/dashboard",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                dashboard_data = data.get('data', {})
                
                total_tx = dashboard_data.get('total_transactions', {})
                total_vol = dashboard_data.get('total_volume', {})
                active_wallets = dashboard_data.get('active_wallets', {})
                fee_tier = dashboard_data.get('fee_tier', {})
                
                print(f"✅ Dashboard statistics retrieved")
                print(f"   - Total transactions: {total_tx.get('count', 0)}")
                print(f"   - Total volume: {total_vol.get('amount', 0)} {total_vol.get('currency', 'USD')}")
                print(f"   - Active wallets: {active_wallets.get('count', 0)}")
                print(f"   - Fee tier: {fee_tier.get('current_tier', 'Unknown')}")
                
                return True
            else:
                print(f"❌ Dashboard stats failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Dashboard stats check failed: {str(e)}")
            return False
    
    def analyze_initialization_status(self):
        """Analyze the overall initialization status based on collected data"""
        print("\n🔍 Analyzing initialization status...")
        
        merchant_wallets = len(self.analysis_results.get('merchant_wallets', []))
        pool_addresses = len(self.analysis_results.get('pool_addresses', []))
        transaction_count = self.analysis_results.get('transaction_count', 0)
        
        print(f"   - Merchant wallets: {merchant_wallets}")
        print(f"   - Pool addresses: {pool_addresses}")
        print(f"   - Transaction count: {transaction_count}")
        
        # Determine status based on available data
        if merchant_wallets == 0 and pool_addresses == 0:
            status = "not_initialized"
            message = "Lazy initialization NOT triggered - No wallets or addresses found"
            recommendation = "Create a payment link with CRYPTO mode to trigger initialization"
        elif merchant_wallets > 0 or pool_addresses > 0:
            status = "initialized"
            message = f"System appears initialized - Found {merchant_wallets} wallets and {pool_addresses} addresses"
            recommendation = "System is ready for crypto payments"
        else:
            status = "unknown"
            message = "Unable to determine initialization status from API responses"
            recommendation = "Manual database inspection may be required"
        
        self.analysis_results['initialization_status'] = status
        
        print(f"   - Status: {status}")
        print(f"   - Assessment: {message}")
        print(f"   - Recommendation: {recommendation}")
        
        return True
    
    def generate_report(self):
        """Generate the comprehensive XPUB analysis report"""
        print("\n" + "="*80)
        print("XPUB ANALYSIS REPORT FOR john@dyno.pt")
        print("="*80)
        
        # 1. User Information
        user_info = self.analysis_results.get('user_info', {})
        print(f"\n1. USER INFORMATION")
        print(f"   - User ID: {user_info.get('user_id', 'Not found')}")
        print(f"   - Email: {user_info.get('email', 'Not found')}")
        print(f"   - Name: {user_info.get('name', 'Not available')}")
        print(f"   - Username: {user_info.get('username', 'Not available')}")
        
        # 2. Merchant Wallet Status
        merchant_wallets = self.analysis_results.get('merchant_wallets', [])
        print(f"\n2. MERCHANT WALLET STATUS")
        print(f"   - Total wallets found via API: {len(merchant_wallets)}")
        
        if merchant_wallets:
            wallet_currencies = set()
            for wallet in merchant_wallets:
                if isinstance(wallet, dict) and 'currency' in wallet:
                    wallet_currencies.add(wallet['currency'])
            
            if wallet_currencies:
                print(f"   - Wallet currencies: {', '.join(sorted(wallet_currencies))}")
            
            # Show sample wallet info
            sample_wallet = merchant_wallets[0] if merchant_wallets else None
            if sample_wallet and isinstance(sample_wallet, dict):
                print(f"   - Sample wallet: {sample_wallet.get('currency', 'Unknown')} - {sample_wallet.get('wallet_address', 'No address')[:20]}...")
        else:
            print(f"   - No merchant wallets found via API")
        
        # 3. Pool Address Status  
        pool_addresses = self.analysis_results.get('pool_addresses', [])
        print(f"\n3. POOL ADDRESS STATUS")
        print(f"   - Total addresses found via API: {len(pool_addresses)}")
        
        if pool_addresses:
            address_currencies = set()
            for address in pool_addresses:
                if isinstance(address, dict) and 'currency' in address:
                    address_currencies.add(address['currency'])
            
            if address_currencies:
                print(f"   - Address currencies: {', '.join(sorted(address_currencies))}")
        else:
            print(f"   - No pool addresses found via API")
        
        # 4. Activity Summary
        transaction_count = self.analysis_results.get('transaction_count', 0)
        print(f"\n4. ACTIVITY SUMMARY")
        print(f"   - Total transactions: {transaction_count}")
        print(f"   - Overall status: {self.analysis_results.get('initialization_status', 'unknown')}")
        
        # 5. Expected vs Actual
        print(f"\n5. EXPECTED MERCHANT POOL CONFIGURATION")
        print(f"   - Expected base chains: BTC, ETH, LTC, DOGE, TRX, BCH")
        print(f"   - Expected token chains: USDT-TRC20, USDT-ERC20, USDC-ERC20")
        print(f"   - Expected initial pool size: 2 addresses per chain")
        print(f"   - Expected sweep threshold: $30 USD")
        
        # 6. Conclusion
        print(f"\n6. CONCLUSION")
        status = self.analysis_results.get('initialization_status', 'unknown')
        
        if status == 'not_initialized':
            print(f"   ❌ MERCHANT POOL NOT INITIALIZED")
            print(f"   - No xpub wallets or pool addresses detected")
            print(f"   - Lazy initialization has not been triggered")
            print(f"   - Action required: Create payment link with CRYPTO mode")
        elif status == 'initialized':
            print(f"   ✅ MERCHANT POOL APPEARS INITIALIZED")
            print(f"   - Wallets and/or addresses detected via API")
            print(f"   - System appears ready for crypto payments")
            print(f"   - Pool health: Operational")
        else:
            print(f"   ⚠️  INITIALIZATION STATUS UNCLEAR")
            print(f"   - Unable to determine status from API responses")
            print(f"   - May require direct database inspection")
        
        print(f"\n" + "="*80)
        print("END OF XPUB ANALYSIS REPORT")
        print("="*80)
    
    def run_analysis(self):
        """Run the complete XPUB analysis"""
        print("🔍 Starting XPUB Analysis for john@dyno.pt")
        print("="*60)
        
        success_count = 0
        total_tests = 6
        
        # Step 1: Authentication
        if self.authenticate():
            success_count += 1
        else:
            print("❌ Cannot proceed without authentication")
            return False
        
        # Step 2: Create test payment link
        if self.create_test_payment_link():
            success_count += 1
        
        # Step 3: Check wallet endpoints
        if self.check_wallet_endpoints():
            success_count += 1
        
        # Step 4: Check wallet addresses
        if self.check_wallet_addresses():
            success_count += 1
        
        # Step 5: Check transaction history
        if self.check_transaction_history():
            success_count += 1
        
        # Step 6: Check dashboard stats
        if self.check_dashboard_stats():
            success_count += 1
        
        # Analyze results
        self.analyze_initialization_status()
        
        # Generate report
        self.generate_report()
        
        # Summary
        print(f"\n📊 ANALYSIS SUMMARY")
        print(f"   - Tests completed: {total_tests}")
        print(f"   - Tests passed: {success_count}")
        print(f"   - Success rate: {(success_count/total_tests*100):.1f}%")
        
        return success_count >= 4  # At least 4 out of 6 tests should pass

def main():
    """Main execution function"""
    analyzer = XPubAnalysisAPI()
    
    try:
        success = analyzer.run_analysis()
        
        if success:
            print(f"\n✅ XPUB Analysis completed successfully!")
            sys.exit(0)
        else:
            print(f"\n❌ XPUB Analysis completed with issues")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print(f"\n⚠️  Analysis interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Analysis failed with exception: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()