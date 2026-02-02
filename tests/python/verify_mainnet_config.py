#!/usr/bin/env python3
"""
Verify Mainnet Configuration
Checks that all settings are correctly configured for mainnet
"""

import os
import subprocess

print("\n" + "="*80)
print("🔍 MAINNET CONFIGURATION VERIFICATION")
print("="*80)

# Read .env file
env_vars = {}
with open('/app/backend/.env', 'r') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            env_vars[key] = value

print("\n📋 Testnet Configuration:")
print(f"   TATUM_TESTNET: {env_vars.get('TATUM_TESTNET', 'NOT SET')}")
testnet_enabled = env_vars.get('TATUM_TESTNET', '').lower() == 'true'

if testnet_enabled:
    print("   ❌ WARNING: Testnet is ENABLED")
else:
    print("   ✅ Testnet is DISABLED (Mainnet mode)")

print("\n📋 Blockchain Thresholds (Minimum forwarding amount in USD):")
thresholds = {
    'BTC': env_vars.get('BTC_THRESHOLD', 'NOT SET'),
    'ETH': env_vars.get('ETH_THRESHOLD', 'NOT SET'),
    'USDT-TRC20': env_vars.get('USDT_TRC20_THRESHOLD', 'NOT SET'),
    'USDT-ERC20': env_vars.get('USDT_ERC20_THRESHOLD', 'NOT SET'),
    'TRX': env_vars.get('TRX_THRESHOLD', 'NOT SET'),
    'LTC': env_vars.get('LTC_THRESHOLD', 'NOT SET'),
    'DOGE': env_vars.get('DOGE_THRESHOLD', 'NOT SET'),
    'BCH': env_vars.get('BCH_THRESHOLD', 'NOT SET'),
}

all_correct = True
for crypto, threshold in thresholds.items():
    status = "✅" if threshold == "3" else "❌"
    print(f"   {status} {crypto}: ${threshold}")
    if threshold != "3":
        all_correct = False

print("\n📋 Admin Wallet Addresses (Mainnet):")
admin_addresses = {
    'BTC': env_vars.get('BTC', 'NOT SET'),
    'ETH': env_vars.get('ETH', 'NOT SET'),
    'LTC': env_vars.get('LTC', 'NOT SET'),
    'DOGE': env_vars.get('DOGE', 'NOT SET'),
    'TRX': env_vars.get('TRX', 'NOT SET'),
    'USDT-TRC20': env_vars.get('USDT_TRC20', 'NOT SET'),
    'USDT-ERC20': env_vars.get('USDT_ERC20', 'NOT SET'),
}

for crypto, address in admin_addresses.items():
    # Check if address looks like mainnet
    is_mainnet = False
    if crypto == 'BTC' and address.startswith('1'):
        is_mainnet = True
    elif crypto in ['ETH', 'USDT-ERC20'] and address.startswith('0x'):
        is_mainnet = True
    elif crypto in ['TRX', 'USDT-TRC20'] and address.startswith('T'):
        is_mainnet = True
    elif crypto == 'LTC' and address.startswith('L'):
        is_mainnet = True
    elif crypto == 'DOGE' and address.startswith('D'):
        is_mainnet = True
    
    status = "✅" if is_mainnet else "⚠️"
    print(f"   {status} {crypto}: {address[:20]}...")

# Check admin wallet database
print("\n📋 Admin Wallet Database (BTC):")
result = subprocess.run([
    'node', '-e',
    '''
    const { adminWalletModel } = require('./backend/models');
    require('dotenv').config({ path: './backend/.env' });
    
    (async () => {
        const wallet = await adminWalletModel.findOne({ where: { wallet_type: 'BTC' } });
        if (wallet) {
            const tatumApi = require('./backend/apis/tatumApi').default;
            const decrypted = await tatumApi.decryptSymmetric(
                wallet.xpub_mnemonic,
                process.env.XPUB_KEY_ID
            );
            const data = JSON.parse(decrypted);
            const prefix = data.xpub ? data.xpub.substring(0, 4) : 'unknown';
            console.log(`XPUB_PREFIX:${prefix}`);
        }
        process.exit(0);
    })();
    '''
], capture_output=True, text=True, cwd='/app')

if 'XPUB_PREFIX:xpub' in result.stdout:
    print("   ✅ Admin wallet has MAINNET xpub (xpub...)")
elif 'XPUB_PREFIX:tpub' in result.stdout:
    print("   ❌ WARNING: Admin wallet has TESTNET xpub (tpub...)")
else:
    print("   ⚠️  Could not verify xpub")

print("\n" + "="*80)
print("📊 SUMMARY")
print("="*80)

if not testnet_enabled and all_correct:
    print("\n✅ MAINNET MODE ACTIVE")
    print("✅ All thresholds set to $3")
    print("✅ Configuration ready for production")
    print("\n🚀 System is configured for MAINNET production use!")
else:
    print("\n⚠️  CONFIGURATION ISSUES:")
    if testnet_enabled:
        print("   - Testnet is still enabled")
    if not all_correct:
        print("   - Some thresholds not set to $3")
    print("\n❌ Please review configuration before production use")

print("\n" + "="*80 + "\n")
