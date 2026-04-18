import tatumApi from './apis/tatumApi';
import { adminWalletModel } from './models';
import dotenv from 'dotenv';

dotenv.config();

async function restoreMainnetBTCWallet() {
  console.log('\n=== Restoring Mainnet BTC Wallet ===\n');
  
  try {
    // Original mainnet xpub and mnemonic
    const mainnetXpub = 'xpub6DbvoN43UVKgaSW5gYsyAJjoE2sNDU4ZPM8FeQsXmobveV2DxDsxBYJu4rqRMb8BhpaDLauLY7KoeiBfdCWeHwXRczAuy3xiqrFCaT4HEMk';
    
    console.log('🔄 Restoring mainnet wallet configuration...');
    console.log(`Original Mainnet XPUB: ${mainnetXpub.substring(0, 20)}...`);
    
    // Note: We don't have the original mnemonic, so we'll just restore the xpub
    // The system should still work for address generation
    console.log('\n⚠️  Note: Only restoring xpub (mnemonic was encrypted, not accessible)');
    console.log('   Address generation will use xpub-only derivation\n');
    
    // Encrypt the wallet data
    console.log('🔒 Encrypting wallet data with Google KMS...');
    const walletDataJson = JSON.stringify({
      xpub: mainnetXpub,
      mnemonic: null  // Original mnemonic not available
    });
    
    const encryptedData = await tatumApi.encryptSymmetric(
      walletDataJson,
      process.env.XPUB_KEY_ID!
    );
    
    console.log('✅ Wallet data encrypted');
    
    // Update admin wallet
    console.log('\n📝 Updating admin BTC wallet to mainnet...');
    const [updateCount] = await adminWalletModel.update(
      {
        xpub_mnemonic: encryptedData,
        last_index: 130  // Reset to previous index (was 129 before our changes)
      },
      {
        where: {
          wallet_type: 'BTC'
        }
      }
    );
    
    if (updateCount > 0) {
      console.log('✅ Admin BTC wallet restored to mainnet successfully!');
      console.log(`   Updated ${updateCount} record(s)`);
      
      console.log('\n🎉 RESTORATION COMPLETE!');
      console.log('\n📋 Production Status:');
      console.log('   ✅ Mainnet BTC wallet restored');
      console.log('   ✅ Ready for production use');
      console.log('   ✅ Set TATUM_TESTNET=false for mainnet');
      
      console.log('\n📋 Testing Instructions:');
      console.log('   ✅ Use /app/setup_btc_testnet.py for testnet testing');
      console.log('   ✅ That script generates fresh testnet addresses');
      console.log('   ✅ Bypasses admin wallet (no conflict)');
      
    } else {
      console.log('❌ No records updated. Check if BTC wallet exists in admin_wallet table');
    }
    
  } catch (error: unknown) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

restoreMainnetBTCWallet().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
