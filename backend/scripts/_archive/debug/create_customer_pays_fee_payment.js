require('dotenv').config();
process.chdir('/app/backend');
require('ts-node').register({ 
  transpileOnly: true, 
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true } 
});

const { Sequelize } = require('sequelize');
const crypto = require('crypto');
const merchantPoolService = require('/app/backend/services/merchantPoolService');
const redis = require('redis');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false
});

async function createPayment() {
  const userId = 28;
  const companyId = 38;
  const currency = 'ETH';
  const amountUSD = 10;  // $10 base amount
  const feePayer = 'customer';  // Customer pays the fees
  const ADMIN_FEE_PERCENT = 0.33;
  
  console.log('=== CREATING TEST PAYMENT (CUSTOMER PAYS FEES) ===');
  console.log('User ID:', userId);
  console.log('Currency:', currency);
  console.log('Base Amount: $', amountUSD, 'USD');
  console.log('Fee Payer:', feePayer);
  console.log('Admin Fee %:', ADMIN_FEE_PERCENT * 100 + '%');
  
  try {
    // 1. Generate unique payment ID
    const paymentId = crypto.randomUUID();
    console.log('\n1. Payment ID:', paymentId);
    
    // 2. Get crypto amount
    const axios = require('axios');
    let ethPrice;
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      ethPrice = response.data.ethereum.usd;
    } catch (e) {
      ethPrice = 2930;
    }
    
    // Calculate amounts for CUSTOMER PAYS FEES mode
    const baseCryptoAmount = amountUSD / ethPrice;
    const merchantAmount = baseCryptoAmount;  // Merchant gets full base amount
    const feeAmount = baseCryptoAmount * ADMIN_FEE_PERCENT / (1 - ADMIN_FEE_PERCENT);  // Fees on top
    const totalCryptoAmount = merchantAmount + feeAmount;  // Customer pays base + fees
    
    console.log('\n2. ETH Price: $', ethPrice);
    console.log('   Base crypto amount:', baseCryptoAmount.toFixed(8), 'ETH');
    console.log('   Merchant receives:', merchantAmount.toFixed(8), 'ETH (full base)');
    console.log('   Admin fee:', feeAmount.toFixed(8), 'ETH (on top)');
    console.log('   CUSTOMER PAYS TOTAL:', totalCryptoAmount.toFixed(8), 'ETH');
    
    // 3. Reserve address from pool
    console.log('\n3. Reserving address from pool...');
    const poolAddress = await merchantPoolService.reserveAddress(
      currency,
      paymentId,
      userId,
      companyId,
      totalCryptoAmount
    );
    
    const address = poolAddress.dataValues.wallet_address;
    console.log('   Reserved address:', address);
    console.log('   Temp address ID:', poolAddress.dataValues.temp_address_id);
    
    // 4. Create user transaction record
    const { userTransactionModel } = require('/app/backend/models');
    await userTransactionModel.create({
      id: paymentId,
      wallet_id: 370,
      user_id: userId,
      payment_mode: 'CRYPTO',
      base_amount: merchantAmount,  // Merchant expects this amount
      base_currency: currency,
      transaction_type: 'CREDIT',
      status: 'pending',
      company_id: companyId,
    });
    console.log('4. Created user transaction record');
    
    // 5. Store in Redis
    const client = redis.createClient({ url: process.env.REDIS_PUBLIC_URL });
    await client.connect();
    
    const customerRef = 'customer-test-' + Date.now();
    
    // Store customer data (for notifications)
    await client.hSet(customerRef, {
      adm_id: String(userId),
      company_id: String(companyId),
      base_currency: 'USD',
      pathType: 'createPayment',
    });
    
    await client.del('crypto-' + address);
    await client.hSet('crypto-' + address, {
      mode: 'CRYPTO',
      amount: totalCryptoAmount.toFixed(8),  // Total customer pays
      merchant_amount: merchantAmount.toFixed(8),  // What merchant receives
      total_fees: feeAmount.toFixed(8),  // Admin fees
      fee_payer: feePayer,
      base_amount_usd: String(amountUSD),
      status: 'pending',
      ref: customerRef,
      currency: currency,
      payment_id: paymentId,
      unique_tx_id: paymentId,
      walletType: 'customer',
      temp_id: String(poolAddress.dataValues.temp_address_id),
      is_merchant_pool: 'true',
    });
    
    await client.quit();
    console.log('5. Stored payment data in Redis');
    
    console.log('\n========================================');
    console.log('✅ TEST PAYMENT CREATED SUCCESSFULLY');
    console.log('========================================');
    console.log('\n📋 CUSTOMER PAYS FEES MODE:');
    console.log('   Base amount (merchant gets): $', amountUSD, '=', merchantAmount.toFixed(8), 'ETH');
    console.log('   + Fees (33%):', feeAmount.toFixed(8), 'ETH');
    console.log('   = TOTAL TO PAY:', totalCryptoAmount.toFixed(8), 'ETH');
    console.log('\n📍 Send', totalCryptoAmount.toFixed(8), 'ETH to:');
    console.log('   ', address);
    console.log('\n⏰ After payment:');
    console.log('   - Merchant receives FULL', merchantAmount.toFixed(8), 'ETH (~$' + amountUSD + ')');
    console.log('   - Admin fee', feeAmount.toFixed(8), 'ETH swept later');
    
  } catch (error) {
    console.error('ERROR:', error.message || error);
    if (error.stack) console.error(error.stack);
  }
  
  process.exit(0);
}

createPayment();
