import { adminWalletModel } from './models';
import dotenv from 'dotenv';

dotenv.config();

async function checkAllAdminWallets() {
  console.log('\n=== Checking All Admin Wallet Configurations ===\n');
  
  try {
    // Get all crypto wallets
    const wallets = await adminWalletModel.findAll({
      where: {
        wallet_type: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'RLUSD-ERC20', 'RLUSD', 'USDT-POLYGON', 'SOL', 'XRP', 'POLYGON', 'BCH']
      }
    });

    console.log(`Found ${wallets.length} admin wallets\n`);
    
    for (const wallet of wallets) {
      const walletData = wallet.dataValues;
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Wallet Type: ${walletData.wallet_type}`);
      console.log(`Wallet Address: ${walletData.wallet_address}`);
      console.log(`Last Index: ${walletData.last_index}`);
      console.log(`XPUB/Mnemonic: ${walletData.xpub_mnemonic ? 'Encrypted' : 'NOT SET'}`);
      
      // Try to decrypt and show xpub type
      if (walletData.xpub_mnemonic) {
        try {
          const tatumApi = require('./apis/tatumApi').default;
          const decrypted = await tatumApi.decryptSymmetric(
            walletData.xpub_mnemonic,
            process.env.XPUB_KEY_ID
          );
          const walletInfo = JSON.parse(decrypted);
          
          if (walletInfo.xpub) {
            const xpubPrefix = walletInfo.xpub.substring(0, 4);
            console.log(`XPUB Prefix: ${xpubPrefix}`);
            
            // Check if it's mainnet or testnet
            if (walletData.wallet_type === 'BTC') {
              if (xpubPrefix === 'xpub') {
                console.log('⚠️  BTC MAINNET xpub (should be tpub for testnet)');
              } else if (xpubPrefix === 'tpub') {
                console.log('✅ BTC TESTNET xpub');
              }
            } else if (walletData.wallet_type === 'ETH' || walletData.wallet_type.includes('ERC20')) {
              // For Ethereum, xpub format is the same for mainnet and testnet
              // The network is determined by the Tatum API key and RPC endpoint
              console.log('ℹ️  ETH xpub (network determined by Tatum API key)');
            } else if (walletData.wallet_type === 'TRX' || walletData.wallet_type.includes('TRC20')) {
              console.log('ℹ️  TRX xpub (network determined by Tatum API key)');
            }
          } else {
            console.log('Mnemonic-only (no xpub)');
          }
        } catch (decryptError: unknown) {
          console.log(`❌ Could not decrypt: ${decryptError.message}`);
        }
      }
      console.log('');
    }

    console.log('\n=== Environment Configuration ===');
    console.log(`TATUM_TESTNET: ${process.env.TATUM_TESTNET}`);
    console.log(`TATUM_TESTNET_TYPE: ${process.env.TATUM_TESTNET_TYPE}`);
    console.log(`TATUM_TESTNET_KEY: ${process.env.TATUM_TESTNET_KEY?.substring(0, 20)}...`);
    
    console.log('\n=== Key Differences ===');
    console.log('BTC: Uses different xpub formats (xpub=mainnet, tpub=testnet)');
    console.log('ETH/TRX: Same xpub format, network determined by API key/RPC');
    console.log('');
    
  } catch (error: unknown) {
    console.error('Error:', error.message);
  }
}

checkAllAdminWallets().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
