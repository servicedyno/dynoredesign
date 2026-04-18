/**
 * Direct ETH Payment Creation via Merchant Pool
 * Bypasses normal flow to directly generate address
 */

require('dotenv').config();
const crypto = require('crypto');

// Import models and services
const { merchantPoolService } = require('./services/merchantPoolService');

async function createDirectETHPayment() {
  console.log('='.repeat(80));
  console.log('CREATING $10 ETH PAYMENT - DIRECT MERCHANT POOL');
  console.log('='.repeat(80));
  console.log();
  
  const userId = 28;  // john@dyno.pt
  const companyId = 38;  // Johnnys LDA
  const walletType = 'ETH';
  const amountUSD = 10.00;
  
  console.log(`Merchant: user_id ${userId}, company_id ${companyId}`);
  console.log(`Amount: $${amountUSD} USD`);
  console.log(`Currency: ${walletType}`);
  console.log();
  
  try {
    // Generate unique payment ID
    const paymentId = crypto.randomUUID();
    console.log(`Payment ID: ${paymentId}`);
    console.log();
    
    console.log('STEP 1: Reserving Address from Merchant Pool');
    console.log('-'.repeat(80));
    
    // Reserve address - this will:
    // 1. Check if merchant has ETH wallet (xpub) - if not, generate
    // 2. Find available address or create new one
    // 3. Reserve it for this payment
    const poolAddress = await merchantPoolService.reserveAddress(
      walletType,
      paymentId,
      userId,
      companyId,
      amountUSD
    );
    
    const address = poolAddress.dataValues.wallet_address;
    const tempAddressId = poolAddress.dataValues.temp_address_id;
    
    console.log('✅ Address Reserved!');
    console.log(`   Address: ${address}`);
    console.log(`   Temp ID: ${tempAddressId}`);
    console.log(`   Status: ${poolAddress.dataValues.status}`);
    console.log(`   Reserved Until: ${poolAddress.dataValues.reserved_until}`);
    console.log();
    
    // Get current ETH price to calculate expected ETH amount
    console.log('STEP 2: Calculating ETH Amount');
    console.log('-'.repeat(80));
    
    // Mock price for now (real system would use FastForex)
    const ethPriceUSD = 3000;  // $3000 per ETH
    const expectedETH = amountUSD / ethPriceUSD;
    
    console.log(`   ETH Price: $${ethPriceUSD} USD`);
    console.log(`   Expected ETH: ${expectedETH.toFixed(6)} ETH`);
    console.log();
    
    // Display payment information
    console.log('='.repeat(80));
    console.log('✅ PAYMENT CREATED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log();
    console.log('📧 PAYMENT DETAILS:');
    console.log(`   Payment ID: ${paymentId}`);
    console.log(`   Amount: $${amountUSD} USD (~${expectedETH.toFixed(6)} ETH)`);
    console.log(`   Status: RESERVED (30-minute timeout)`);
    console.log();
    console.log('💰 PAYMENT ADDRESS:');
    console.log(`   ${address}`);
    console.log();
    console.log('⚠️  SEND ETH TO THIS ADDRESS TO COMPLETE PAYMENT');
    console.log();
    
    // Display funds distribution
    console.log('='.repeat(80));
    console.log('📊 FUNDS DISTRIBUTION JOURNEY');
    console.log('='.repeat(80));
    console.log();
    
    const transactionFee = amountUSD * 0.02;  // 2%
    const merchantAmount = amountUSD - transactionFee;
    
    console.log('STEP 1: Customer Sends ETH');
    console.log(`   Customer sends: ${expectedETH.toFixed(6)} ETH (~$${amountUSD} USD)`);
    console.log(`   To address: ${address}`);
    console.log();
    
    console.log('STEP 2: Tatum Webhook Detects Payment');
    console.log('   ✅ Transaction confirmed on blockchain');
    console.log('   ✅ Amount validated');
    console.log(`   ✅ Status: PROCESSING`);
    console.log();
    
    console.log('STEP 3: Funds Distribution (>= $5 threshold)');
    console.log(`   Total Received: $${amountUSD.toFixed(2)} USD`);
    console.log(`   Transaction Fee (2%): $${transactionFee.toFixed(2)} USD`);
    console.log(`   Merchant Receives: $${merchantAmount.toFixed(2)} USD`);
    console.log();
    console.log('   Flow:');
    console.log(`   1. Transfer ${merchantAmount.toFixed(2)} ETH → Merchant wallet`);
    console.log('      0x9a7221b5e32d5f99e8da95585835442e29afb38f');
    console.log(`   2. Keep ${transactionFee.toFixed(2)} ETH → Pool address (admin_fee_balance)`);
    console.log('   3. Pool address status → AVAILABLE (reusable)');
    console.log();
    
    console.log('STEP 4: Admin Fee Sweep (10 minutes after merchant payout)');
    console.log('   Config: ETH_SWEEP=time:10');
    console.log('   Trigger: Cron job runs every 5 minutes');
    console.log();
    console.log(`   When time >= 10 minutes:`);
    console.log(`   1. Collect admin fee: $${transactionFee.toFixed(2)} USD in ETH`);
    console.log('   2. Transfer to admin wallet:');
    console.log('      0x9a7221b5e32d5f99e8da95585835442e29afb38f');
    console.log('   3. Record sweep in tbl_merchant_pool_sweep');
    console.log('   4. Reset admin_fee_balance = 0');
    console.log();
    
    console.log('STEP 5: Database Records Created');
    console.log('   ✅ tbl_merchant_temp_address: Address reservation');
    console.log('   ✅ tbl_merchant_pool_transaction: Merchant payout record');
    console.log('   ✅ tbl_user_transaction: Merchant credit transaction');
    console.log('   ✅ tbl_user_wallet: Balance updated');
    console.log('   ✅ tbl_merchant_pool_sweep: Admin fee sweep (after 10 min)');
    console.log();
    
    console.log('='.repeat(80));
    console.log('🎯 READY FOR REAL-TIME TEST');
    console.log('='.repeat(80));
    console.log();
    console.log('SEND ETH TO:');
    console.log(`${address}`);
    console.log();
    console.log(`Expected Amount: ${expectedETH.toFixed(6)} ETH (~$${amountUSD} USD)`);
    console.log();
    console.log('You can send any amount to test, but:');
    console.log('• >= $5: Merchant receives payout + admin fee accumulated');
    console.log('• < $5: 100% goes to admin wallet');
    console.log();
    
    return {
      success: true,
      payment_id: paymentId,
      address: address,
      temp_address_id: tempAddressId,
      amount_usd: amountUSD,
      expected_eth: expectedETH,
      merchant_amount: merchantAmount,
      admin_fee: transactionFee,
      merchant_wallet: '0x9a7221b5e32d5f99e8da95585835442e29afb38f',
      admin_wallet: '0x9a7221b5e32d5f99e8da95585835442e29afb38f',
      sweep_config: 'time:10 (10 minutes after merchant payout)'
    };
    
  } catch (error) {
    console.error('❌ Error creating payment:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createDirectETHPayment()
    .then(result => {
      console.log('\n📋 Payment Created:');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { createDirectETHPayment };
