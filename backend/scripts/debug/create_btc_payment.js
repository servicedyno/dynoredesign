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

async function createBTCPayment() {
  const userId = 28;
  const companyId = 38;
  const currency = 'BTC';
  const amountUSD = 10;
  
  console.log('=== CREATING BTC TEST PAYMENT ===');
  console.log('User ID:', userId);
  console.log('Currency:', currency);
  console.log('Amount: $', amountUSD, 'USD');
  
  try {
    // 1. Generate unique payment ID
    const paymentId = crypto.randomUUID();
    console.log('\n1. Payment ID:', paymentId);
    
    // 2. Get crypto amount
    const axios = require('axios');
    let btcPrice;
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      btcPrice = response.data.bitcoin.usd;
    } catch (e) {
      btcPrice = 102000;  // Fallback
    }
    const cryptoAmount = (amountUSD / btcPrice).toFixed(8);
    console.log('2. BTC Price: $', btcPrice);
    console.log('   Crypto amount:', cryptoAmount, 'BTC');
    
    // 3. Reserve address from pool
    console.log('\n3. Reserving BTC address from pool...');
    const poolAddress = await merchantPoolService.reserveAddress(
      currency,
      paymentId,
      userId,
      companyId,
      parseFloat(cryptoAmount)
    );
    
    const address = poolAddress.dataValues.wallet_address;
    console.log('   Reserved address:', address);
    console.log('   Temp address ID:', poolAddress.dataValues.temp_address_id);
    
    // 4. Create user transaction record
    // First find or create BTC wallet
    let btcWallet = await sequelize.query(`
      SELECT wallet_id FROM tbl_user_wallet WHERE user_id = ${userId} AND wallet_type = 'BTC' LIMIT 1
    `);
    
    let walletId;
    if (btcWallet[0].length === 0) {
      // Create BTC wallet
      const [result] = await sequelize.query(`
        INSERT INTO tbl_user_wallet (user_id, wallet_type, amount, "createdAt", "updatedAt")
        VALUES (${userId}, 'BTC', 0, NOW(), NOW())
        RETURNING wallet_id
      `);
      walletId = result[0].wallet_id;
      console.log('4. Created new BTC wallet:', walletId);
    } else {
      walletId = btcWallet[0][0].wallet_id;
      console.log('4. Using existing BTC wallet:', walletId);
    }
    
    const { userTransactionModel } = require('/app/backend/models');
    await userTransactionModel.create({
      id: paymentId,
      wallet_id: walletId,
      user_id: userId,
      payment_mode: 'CRYPTO',
      base_amount: parseFloat(cryptoAmount),
      base_currency: currency,
      transaction_type: 'CREDIT',
      status: 'pending',
      company_id: companyId,
    });
    console.log('   Created user transaction record');
    
    // 5. Store in Redis
    const client = redis.createClient({ url: process.env.REDIS_PUBLIC_URL });
    await client.connect();
    
    const customerRef = 'customer-btc-test-' + Date.now();
    
    await client.hSet(customerRef, {
      adm_id: String(userId),
      company_id: String(companyId),
      base_currency: 'USD',
      pathType: 'createPayment',
    });
    
    await client.del('crypto-' + address);
    await client.hSet('crypto-' + address, {
      mode: 'CRYPTO',
      amount: cryptoAmount,
      status: 'pending',
      ref: customerRef,
      currency: currency,
      payment_id: paymentId,
      unique_tx_id: paymentId,
      walletType: 'customer',
      temp_id: String(poolAddress.dataValues.temp_address_id),
      is_merchant_pool: 'true',
      fee_payer: 'company',
      merchant_amount: cryptoAmount,
      base_amount_usd: String(amountUSD),
    });
    
    await client.quit();
    console.log('5. Stored payment data in Redis');
    
    console.log('\n========================================');
    console.log('✅ BTC TEST PAYMENT CREATED SUCCESSFULLY');
    console.log('========================================');
    console.log('\nPayment Details:');
    console.log('  Payment ID:', paymentId);
    console.log('  Address:', address);
    console.log('  Amount:', cryptoAmount, 'BTC (~$' + amountUSD + ' USD)');
    console.log('\n📋 Send', cryptoAmount, 'BTC to:');
    console.log('   ', address);
    console.log('\n⚠️  BTC is a UTXO chain - merchant + admin paid in single TX');
    
  } catch (error) {
    console.error('ERROR:', error.message || error);
    if (error.stack) console.error(error.stack);
  }
  
  process.exit(0);
}

createBTCPayment();
