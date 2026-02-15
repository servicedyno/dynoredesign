import tatumApi from './apis/tatumApi';
import { adminWalletModel } from './models';
import dotenv from 'dotenv';

dotenv.config();

async function generateFreshMainnetWallet() {
  console.log('\n=== Generating Fresh Mainnet BTC Wallet ===\n');
  
  try {
    // Temporarily set testnet to false to generate mainnet wallet
    const originalTestnetValue = process.env.TATUM_TESTNET;
    process.env.TATUM_TESTNET = 'false';
    
    console.log('🔧 Generating mainnet BTC wallet with Tatum...');
    console.log('Using TATUM_TESTNET=false for mainnet generation');
    
    const wallet = await tatumApi.generateWallet('BTC');
    
    // Restore original testnet value
    process.env.TATUM_TESTNET = originalTestnetValue;
    
    console.log('\n✅ Mainnet Wallet Generated:');
    console.log(`- XPUB: ${wallet.xpub}`);
    console.log(`- Mnemonic: ${wallet.mnemonic.split(' ').slice(0, 3).join(' ')}... (24 words)`);
    
    // Verify it's mainnet
    if (wallet.xpub.startsWith('xpub')) {
      console.log('✅ CONFIRMED: This is a mainnet xpub');
    } else if (wallet.xpub.startsWith('tpub')) {
      console.log('❌ WARNING: Generated testnet xpub instead of mainnet!');
      console.log('   Check TATUM_TESTNET configuration');
      return;
    }
    
    // Generate first address to verify
    console.log('\n🏠 Generating first mainnet address...');
    const firstAddress = await tatumApi.generateUserAddress({
      currency: 'BTC',
      xpub: wallet.xpub,
      index: 1,
      mnemonic: wallet.mnemonic
    });
    
    console.log(`✅ First mainnet address: ${firstAddress.address}`);
    
    if (firstAddress.address.startsWith('bc1') || firstAddress.address.startsWith('1') || firstAddress.address.startsWith('3')) {
      console.log('✅ MAINNET address confirmed (bc1/1/3 prefix)');
    } else {
      console.log('⚠️  Address prefix unexpected:', firstAddress.address.substring(0, 4));
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
      
      console.log('\n🎉 SUCCESS! Mainnet BTC wallet with mnemonic configured.');
      console.log('\n⚠️  IMPORTANT: Save these credentials securely:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`XPUB: ${wallet.xpub}`);
      console.log(`First Address: ${firstAddress.address}`);
      console.log('Mnemonic: [ENCRYPTED IN DATABASE]');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n✅ BTC payments can now be created on mainnet!');
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

generateFreshMainnetWallet().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
