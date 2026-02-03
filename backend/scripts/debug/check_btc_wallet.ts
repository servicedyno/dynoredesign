import { userWalletModel } from './models';
import dotenv from 'dotenv';

dotenv.config();

async function checkAndFixBTCWallet() {
  console.log('\n=== Checking BTC Wallet Configuration ===\n');
  
  try {
    // Find BTC wallet for user 28, company 38
    const wallet = await userWalletModel.findOne({
      where: {
        user_id: 28,
        wallet_type: 'BTC',
        company_id: 38
      }
    });

    if (!wallet) {
      console.log('❌ No BTC wallet found for user 28, company 38');
      return;
    }

    const walletData = wallet.dataValues;
    console.log('Current BTC Wallet:');
    console.log(`- User ID: ${walletData.user_id}`);
    console.log(`- Company ID: ${walletData.company_id}`);
    console.log(`- Wallet Type: ${walletData.wallet_type}`);
    console.log(`- Wallet Address: ${walletData.wallet_address}`);
    console.log(`- XPUB: ${walletData.xpub}`);
    console.log(`- Derivation Index: ${walletData.derivation_index || 0}`);

    // Check if xpub is mainnet or testnet
    if (walletData.xpub) {
      if (walletData.xpub.startsWith('xpub')) {
        console.log('\n⚠️  WARNING: Using MAINNET xpub with testnet configuration!');
        console.log('   Mainnet xpubs start with "xpub"');
        console.log('   Testnet xpubs start with "tpub"');
        console.log('\n✅ Solution: Generate a testnet xpub using Tatum testnet key');
        console.log('   OR: Update TATUM_TESTNET=false to use mainnet');
      } else if (walletData.xpub.startsWith('tpub')) {
        console.log('\n✅ Correct: Using testnet xpub');
      } else {
        console.log(`\n⚠️  Unknown xpub format: ${walletData.xpub.substring(0, 4)}...`);
      }
    }

    console.log('\n=== Environment Configuration ===');
    console.log(`TATUM_TESTNET: ${process.env.TATUM_TESTNET}`);
    console.log(`TATUM_TESTNET_TYPE: ${process.env.TATUM_TESTNET_TYPE}`);
    
  } catch (error: unknown) {
    console.error('Error:', error.message);
  }
}

checkAndFixBTCWallet().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
