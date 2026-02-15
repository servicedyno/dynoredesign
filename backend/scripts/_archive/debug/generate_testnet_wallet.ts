import tatumApi from './apis/tatumApi';
import { adminWalletModel } from './models';
import dotenv from 'dotenv';

dotenv.config();

async function generateTestnetBTCWallet() {
  console.log('\n=== Generating Bitcoin Testnet Wallet ===\n');
  
  try {
    // Generate testnet wallet using Tatum
    console.log('🔧 Generating testnet BTC wallet with Tatum...');
    const wallet = await tatumApi.generateWallet('BTC');
    
    console.log('\n✅ Testnet Wallet Generated:');
    console.log(`- XPUB: ${wallet.xpub}`);
    console.log(`- Mnemonic: ${wallet.mnemonic.substring(0, 20)}...`);
    
    // Verify it's testnet
    if (wallet.xpub.startsWith('tpub')) {
      console.log('✅ CONFIRMED: This is a testnet xpub (tpub)');
    } else if (wallet.xpub.startsWith('xpub')) {
      console.log('⚠️  WARNING: Generated mainnet xpub, but should be testnet!');
      console.log('   Check TATUM_TESTNET configuration');
    }
    
    // Encrypt the wallet data
    console.log('\n🔒 Encrypting wallet data with Google KMS...');
    const walletDataJson = JSON.stringify({
      xpub: wallet.xpub,
      mnemonic: wallet.mnemonic
    });
    
    const encryptedData = await tatumApi.encryptSymmetric(
      walletDataJson,
      process.env.XPUB_KEY_ID!
    );
    
    console.log('✅ Wallet data encrypted');
    
    // Update admin wallet
    console.log('\n📝 Updating admin BTC wallet...');
    const [updateCount] = await adminWalletModel.update(
      {
        xpub_mnemonic: encryptedData,
        last_index: 0  // Reset index for new wallet
      },
      {
        where: {
          wallet_type: 'BTC'
        }
      }
    );
    
    if (updateCount > 0) {
      console.log('✅ Admin BTC wallet updated successfully!');
      console.log(`   Updated ${updateCount} record(s)`);
      
      // Generate first address
      console.log('\n🏠 Generating first testnet address...');
      const firstAddress = await tatumApi.generateUserAddress({
        currency: 'BTC',
        xpub: wallet.xpub,
        index: 1,
        mnemonic: wallet.mnemonic
      });
      
      console.log(`✅ First testnet address: ${firstAddress.address}`);
      
      console.log('\n🎉 SUCCESS! Bitcoin Testnet wallet is now configured.');
      console.log('   You can now create BTC testnet payment links.');
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

generateTestnetBTCWallet().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
