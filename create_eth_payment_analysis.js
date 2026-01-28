/**
 * Create ETH Payment - Direct Database + Service Call
 */

require('dotenv').config();
const crypto = require('crypto');
const { Sequelize, Op } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.USER_NAME,
  process.env.PASSWORD,
  {
    host: process.env.HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false
  }
);

async function createETHPayment() {
  console.log('='.repeat(80));
  console.log('CREATING $10 ETH PAYMENT');
  console.log('='.repeat(80));
  console.log();
  
  const userId = 28;
  const companyId = 38;
  const walletType = 'ETH';
  const amountUSD = 10.00;
  const paymentId = crypto.randomUUID();
  
  console.log(`Merchant: user_id ${userId}, company_id ${companyId}`);
  console.log(`Payment ID: ${paymentId}`);
  console.log(`Amount: $${amountUSD} USD`);
  console.log(`Currency: ${walletType}`);
  console.log();
  
  try {
    // Step 1: Check if ETH wallet configured
    console.log('STEP 1: Validating ETH Wallet Configuration');
    console.log('-'.repeat(80));
    
    const [wallets] = await sequelize.query(
      `SELECT * FROM tbl_user_wallet WHERE user_id = ${userId} AND wallet_type = '${walletType}' AND wallet_address IS NOT NULL AND company_id = ${companyId} LIMIT 1`
    );
    
    if (wallets.length === 0) {
      throw new Error('ETH wallet not configured for this merchant');
    }
    
    console.log('✅ ETH wallet configured');
    console.log(`   Admin Wallet: ${wallets[0].wallet_address}`);
    console.log();
    
    // Step 2: Check merchant pool wallet
    console.log('STEP 2: Checking Merchant Pool Wallet');
    console.log('-'.repeat(80));
    
    const [merchantWallets] = await sequelize.query(
      `SELECT * FROM tbl_merchant_wallet WHERE user_id = ${userId} AND wallet_type = '${walletType}' LIMIT 1`
    );
    
    if (merchantWallets.length > 0) {
      console.log('✅ Merchant pool wallet exists');
      console.log(`   Wallet ID: ${merchantWallets[0].wallet_id}`);
      console.log(`   Last Index: ${merchantWallets[0].last_derivation_index}`);
    } else {
      console.log('⚠️  Merchant pool wallet NOT found');
      console.log('   Will be auto-generated on first address request');
    }
    console.log();
    
    // Step 3: Check available pool addresses
    console.log('STEP 3: Checking Pool Addresses');
    console.log('-'.repeat(80));
    
    const [poolAddresses] = await sequelize.query(
      `SELECT * FROM tbl_merchant_temp_address WHERE owner_user_id = ${userId} AND wallet_type = '${walletType}' ORDER BY status, created_at`
    );
    
    console.log(`   Total ${walletType} addresses: ${poolAddresses.length}`);
    if (poolAddresses.length > 0) {
      const available = poolAddresses.filter(a => a.status === 'AVAILABLE').length;
      const reserved = poolAddresses.filter(a => a.status === 'RESERVED').length;
      const processing = poolAddresses.filter(a => a.status === 'PROCESSING').length;
      
      console.log(`   Available: ${available}`);
      console.log(`   Reserved: ${reserved}`);
      console.log(`   Processing: ${processing}`);
      
      if (available > 0) {
        const addr = poolAddresses.find(a => a.status === 'AVAILABLE');
        console.log(`   Next address to use: ${addr.wallet_address}`);
      }
    } else {
      console.log('   No addresses in pool - will create new');
    }
    console.log();
    
    // Step 4: Display what would happen
    console.log('='.repeat(80));
    console.log('💡 MERCHANT POOL BEHAVIOR (When Payment Created)');
    console.log('='.repeat(80));
    console.log();
    console.log('1. WALLET GENERATION (If needed):');
    console.log('   - Generate ETH xpub using Tatum API');
    console.log('   - Encrypt and store in tbl_merchant_wallet');
    console.log('   - Initialize last_derivation_index = 0');
    console.log();
    console.log('2. ADDRESS DERIVATION:');
    console.log('   - Derive address from xpub at index 0 (or next)');
    console.log('   - Encrypt private key');
    console.log('   - Create Tatum webhook subscription');
    console.log('   - Store in tbl_merchant_temp_address');
    console.log();
    console.log('3. ADDRESS RESERVATION:');
    console.log('   - Status: RESERVED');
    console.log('   - Payment ID: Linked to this payment');
    console.log('   - Company ID: 38');
    console.log('   - Expected Amount: $10 USD');
    console.log('   - Reserved Until: 30 minutes');
    console.log();
    
    // Calculate expected ETH
    const ethPrice = 3000;  // Mock price
    const expectedETH = amountUSD / ethPrice;
    const transactionFee = amountUSD * 0.02;
    const merchantAmount = amountUSD - transactionFee;
    
    console.log('='.repeat(80));
    console.log('📊 FUNDS DISTRIBUTION JOURNEY - $10 ETH PAYMENT');
    console.log('='.repeat(80));
    console.log();
    
    console.log('💰 PAYMENT DETAILS:');
    console.log(`   Amount: $${amountUSD.toFixed(2)} USD`);
    console.log(`   Expected ETH: ~${expectedETH.toFixed(6)} ETH (at $${ethPrice}/ETH)`);
    console.log(`   Transaction Fee (2%): $${transactionFee.toFixed(2)} USD`);
    console.log(`   Merchant Receives: $${merchantAmount.toFixed(2)} USD`);
    console.log();
    
    console.log('🔄 STEP-BY-STEP FLOW:');
    console.log();
    console.log('PHASE 1: PAYMENT CREATION');
    console.log('  1. Customer requests $10 ETH payment');
    console.log('  2. System validates ETH wallet configured ✅');
    console.log('  3. Merchant pool generates/reserves address');
    console.log('  4. Customer receives payment address');
    console.log('  5. QR code generated');
    console.log();
    
    console.log('PHASE 2: CUSTOMER SENDS ETH');
    console.log(`  1. Customer sends ~${expectedETH.toFixed(6)} ETH to generated address`);
    console.log('  2. Transaction broadcasts to Ethereum network');
    console.log('  3. Tatum webhook detects incoming transaction');
    console.log('  4. System validates:');
    console.log(`     - Amount >= expected (${expectedETH.toFixed(6)} ETH)`);
    console.log('     - Correct address');
    console.log('  5. Status: PROCESSING');
    console.log();
    
    console.log('PHASE 3: FUNDS DISTRIBUTION (>= $5 threshold)');
    console.log(`  Total: $${amountUSD.toFixed(2)} USD in ETH`);
    console.log();
    console.log(`  MERCHANT PAYOUT ($${merchantAmount.toFixed(2)}): `);
    console.log(`    1. Calculate: $${amountUSD} - 2% = $${merchantAmount.toFixed(2)}`);
    console.log('    2. Transfer from pool address → Merchant admin wallet');
    console.log('       From: [Generated Pool Address]');
    console.log('       To: 0x9a7221b5e32d5f99e8da95585835442e29afb38f');
    console.log(`    3. Amount: ${(expectedETH * (merchantAmount/amountUSD)).toFixed(6)} ETH`);
    console.log('    4. Gas funded from: ETH_FEE_WALLET');
    console.log('       0x033d2bb052e3d85bfe96fbd86cf876a350ad6b1c');
    console.log('    5. Record in tbl_merchant_pool_transaction');
    console.log('    6. Update tbl_user_wallet balance');
    console.log('    7. Create tbl_user_transaction (CREDIT)');
    console.log();
    
    console.log(`  ADMIN FEE ACCUMULATION ($${transactionFee.toFixed(2)}): `);
    console.log(`    1. Keep ${(expectedETH * (transactionFee/amountUSD)).toFixed(6)} ETH in pool address`);
    console.log('    2. Update admin_fee_balance in tbl_merchant_temp_address');
    console.log('    3. Status: AVAILABLE (address ready for reuse)');
    console.log('    4. Sweep timer starts: 10 minutes');
    console.log();
    
    console.log('PHASE 4: ADMIN FEE SWEEP (10 minutes later)');
    console.log('  Config: ETH_SWEEP=time:10');
    console.log('  Cron: Runs every 5 minutes');
    console.log();
    console.log('  When 10 minutes elapsed after merchant payout:');
    console.log(`    1. Check admin_fee_balance: $${transactionFee.toFixed(2)} USD`);
    console.log('    2. Transfer from pool address → Admin wallet');
    console.log('       From: [Pool Address]');
    console.log('       To: 0x9a7221b5e32d5f99e8da95585835442e29afb38f');
    console.log(`    3. Amount: ${(expectedETH * (transactionFee/amountUSD)).toFixed(6)} ETH`);
    console.log('    4. Gas funded from: ETH_FEE_WALLET');
    console.log('    5. Record in tbl_merchant_pool_sweep');
    console.log('    6. Reset admin_fee_balance = 0');
    console.log();
    
    console.log('PHASE 5: DATABASE RECORDS');
    console.log('  Tables Updated:');
    console.log('    ✅ tbl_merchant_wallet: Xpub storage (if new)');
    console.log('    ✅ tbl_merchant_temp_address: Address status & balances');
    console.log('    ✅ tbl_merchant_pool_transaction: Merchant payout record');
    console.log('    ✅ tbl_user_transaction: Merchant credit entry');
    console.log('    ✅ tbl_user_wallet: Balance increment');
    console.log('    ✅ tbl_merchant_pool_sweep: Admin fee sweep record');
    console.log();
    
    console.log('='.repeat(80));
    console.log('⚠️  CANNOT CREATE ACTUAL PAYMENT WITHOUT FULL SERVICE CONTEXT');
    console.log('='.repeat(80));
    console.log();
    console.log('The merchant pool service requires:');
    console.log('  1. Tatum API access (for address generation)');
    console.log('  2. Google Cloud KMS (for encryption)');
    console.log('  3. Full TypeScript service context');
    console.log();
    console.log('RECOMMENDED: Use the frontend UI or API endpoint:');
    console.log('  POST /api/pay/createCryptoPayment');
    console.log('  With proper Redis session setup');
    console.log();
    
    console.log('='.repeat(80));
    console.log('📋 SUMMARY');
    console.log('='.repeat(80));
    console.log();
    console.log('Merchant Configuration:');
    console.log(`  ✅ ETH admin wallet: ${wallets[0].wallet_address}`);
    console.log(`  ${merchantWallets.length > 0 ? '✅' : '⏳'} Merchant pool wallet: ${merchantWallets.length > 0 ? 'Configured' : 'Will auto-generate'}`);
    console.log(`  📍 Pool addresses: ${poolAddresses.length} existing`);
    console.log();
    console.log('Payment Flow:');
    console.log(`  Amount: $${amountUSD} USD → ~${expectedETH.toFixed(6)} ETH`);
    console.log(`  Merchant gets: $${merchantAmount.toFixed(2)} USD (98%)`);
    console.log(`  Admin fee: $${transactionFee.toFixed(2)} USD (2%)`);
    console.log(`  Admin sweep: 10 minutes after merchant payout`);
    console.log();
    console.log('Wallets:');
    console.log(`  Merchant: 0x9a7221b5e32d5f99e8da95585835442e29afb38f`);
    console.log(`  Admin: 0x9a7221b5e32d5f99e8da95585835442e29afb38f`);
    console.log(`  Gas Funding: 0x033d2bb052e3d85bfe96fbd86cf876a350ad6b1c`);
    console.log();
    
    await sequelize.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await sequelize.close();
    throw error;
  }
}

createETHPayment()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal:', error);
    process.exit(1);
  });
