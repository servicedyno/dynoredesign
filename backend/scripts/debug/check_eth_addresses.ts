import { userWalletModel, adminWalletModel } from './models';
import dotenv from 'dotenv';

dotenv.config();

async function checkETHWalletAddresses() {
  console.log('\n=== ETH Wallet Addresses Analysis ===\n');
  
  try {
    // Step 1: Get merchant wallet (user_id 28)
    console.log('📋 Merchant Wallet (User ID: 28):');
    const merchantWallet = await userWalletModel.findOne({
      where: {
        user_id: 28,
        wallet_type: 'ETH'
      }
    });
    
    if (merchantWallet) {
      const data = merchantWallet.dataValues;
      console.log(`  Wallet ID: ${data.wallet_id}`);
      console.log(`  Address: ${data.wallet_address}`);
      console.log(`  Balance: ${data.amount} ETH`);
      console.log(`  Status: ${data.wallet_address ? '✅ Active' : '❌ No address'}`);
    } else {
      console.log('  ❌ No ETH wallet found for this user/company');
    }
    
    // Step 2: Get admin wallet for ETH
    console.log('\n📋 Admin Wallet (ETH):');
    const adminWallet = await adminWalletModel.findOne({
      where: {
        wallet_type: 'ETH'
      }
    });
    
    if (adminWallet) {
      const data = adminWallet.dataValues;
      console.log(`  Address: ${data.wallet_address}`);
      console.log(`  Accumulated Fees: ${data.fee} ETH`);
      console.log(`  Last Index: ${data.last_index}`);
      console.log(`  Status: ${data.wallet_address ? '✅ Active' : '❌ No address'}`);
    } else {
      console.log('  ❌ No ETH admin wallet found');
    }
    
    // Step 3: Check .env admin addresses
    console.log('\n📋 Admin Addresses from .env:');
    console.log(`  ETH: ${process.env.ETH || 'NOT SET'}`);
    console.log(`  USDT_ERC20: ${process.env.USDT_ERC20 || 'NOT SET'}`);
    
    // Step 4: Summary
    console.log('\n' + '='.repeat(80));
    console.log('FUND ROUTING SUMMARY:');
    console.log('='.repeat(80));
    
    if (merchantWallet && adminWallet) {
      console.log('\n💰 For $10 ETH Payment (0.0034169 ETH):');
      console.log('');
      console.log('1️⃣  MERCHANT FUNDS ($6.70 = 0.00228932 ETH):');
      console.log(`    FROM: Temp address (0x909fea292d116763d5...)`);
      console.log(`    TO: ${merchantWallet.dataValues.wallet_address}`);
      console.log(`    STATUS: Sent immediately via Tatum`);
      console.log('');
      console.log('2️⃣  ADMIN FEES ($3.30 = 0.00112758 ETH):');
      console.log(`    RETAINED IN: Temp address (0x909fea292d116763d5...)`);
      console.log(`    WILL SWEEP TO: ${adminWallet.dataValues.wallet_address}`);
      console.log(`    STATUS: Pending batch sweep (pending_sweep)`);
      console.log('');
      console.log('Note: ETH is account-based, so admin fees stay in temp address');
      console.log('      until batch sweep process moves them to admin wallet.');
    }
    
  } catch (error: unknown) {
    console.error('❌ Error:', error.message);
  }
}

checkETHWalletAddresses().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
