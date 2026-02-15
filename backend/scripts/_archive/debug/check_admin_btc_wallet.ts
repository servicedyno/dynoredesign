import { adminWalletModel } from './models';
import dotenv from 'dotenv';

dotenv.config();

async function checkAdminBTCWallet() {
  console.log('\n=== Checking Admin BTC Wallet Configuration ===\n');
  
  try {
    // Find BTC wallet in admin wallet
    const wallet = await adminWalletModel.findOne({
      where: {
        wallet_type: 'BTC'
      }
    });

    if (!wallet) {
      console.log('❌ No BTC wallet found in admin wallet table');
      return;
    }

    const walletData = wallet.dataValues;
    console.log('Admin BTC Wallet:');
    console.log(`- Wallet Type: ${walletData.wallet_type}`);
    console.log(`- Wallet Address: ${walletData.wallet_address}`);
    console.log(`- Last Index: ${walletData.last_index}`);
    console.log(`- XPUB/Mnemonic Encrypted: ${walletData.xpub_mnemonic ? 'YES (encrypted)' : 'NO'}`);
    
    // Try to decrypt and show first few chars
    if (walletData.xpub_mnemonic) {
      try {
        const tatumApi = require('./apis/tatumApi').default;
        const decrypted = await tatumApi.decryptSymmetric(
          walletData.xpub_mnemonic,
          process.env.XPUB_KEY_ID
        );
        const walletInfo = JSON.parse(decrypted);
        
        console.log(`\n📋 Decrypted Wallet Info:`);
        console.log(`- XPUB: ${walletInfo.xpub || 'NOT SET'}`);
        console.log(`- Mnemonic: ${walletInfo.mnemonic ? 'SET (hidden)' : 'NOT SET'}`);
        
        if (walletInfo.xpub) {
          if (walletInfo.xpub.startsWith('xpub')) {
            console.log('\n⚠️  WARNING: Using MAINNET xpub!');
            console.log('   For Bitcoin Testnet, you need a tpub (testnet public key)');
            console.log('\n🔧 FIX NEEDED:');
            console.log('   1. Generate a testnet wallet using Tatum testnet key');
            console.log('   2. Update the xpub_mnemonic in admin wallet table');
          } else if (walletInfo.xpub.startsWith('tpub')) {
            console.log('\n✅ CORRECT: Using testnet xpub (tpub)');
          } else {
            console.log(`\n⚠️  Unknown xpub type: ${walletInfo.xpub.substring(0, 4)}`);
          }
        }
      } catch (decryptError: unknown) {
        console.log(`\n❌ Could not decrypt: ${decryptError.message}`);
      }
    }

    console.log('\n=== Environment Configuration ===');
    console.log(`TATUM_TESTNET: ${process.env.TATUM_TESTNET}`);
    console.log(`TATUM_TESTNET_TYPE: ${process.env.TATUM_TESTNET_TYPE}`);
    console.log(`TATUM_TESTNET_KEY: ${process.env.TATUM_TESTNET_KEY?.substring(0, 20)}...`);
    
  } catch (error: unknown) {
    console.error('Error:', error.message);
  }
}

checkAdminBTCWallet().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
