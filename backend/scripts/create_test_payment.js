require('dotenv').config();
process.chdir('/app/backend');
require('ts-node').register({ 
  transpileOnly: true, 
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true } 
});

const { Sequelize } = require('sequelize');
const crypto = require('crypto');
const merchantPoolService = require('/app/backend/services/merchantPoolService');
const tatumApi = require('/app/backend/apis/tatumApi').default;
const QRCode = require('qrcode');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false
});

async function createTestPayment() {
  const userId = 28;  // john@dyno.pt
  const companyId = 38;
  const currency = 'ETH';
  const amountUSD = 10;  // $10 USD
  
  console.log('=== CREATING TEST PAYMENT ===');
  console.log('User ID:', userId);
  console.log('Company ID:', companyId);
  console.log('Currency:', currency);
  console.log('Amount: $', amountUSD, 'USD');
  
  try {
    // 1. Generate unique payment ID
    const paymentId = crypto.randomUUID();
    console.log('\n1. Payment ID:', paymentId);
    
    // 2. Get crypto amount (convert USD to ETH)
    const ethPrice = await getEthPrice();
    const cryptoAmount = (amountUSD / ethPrice).toFixed(8);
    console.log('2. ETH Price: $', ethPrice);
    console.log('   Crypto amount:', cryptoAmount, 'ETH');
    
    // 3. Reserve address from pool
    console.log('\n3. Reserving address from pool...');
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
    const { userTransactionModel } = require('/app/backend/models');
    await userTransactionModel.create({
      id: paymentId,
      wallet_id: 370,  // ETH wallet
      user_id: userId,
      payment_mode: 'CRYPTO',
      base_amount: parseFloat(cryptoAmount),
      base_currency: currency,
      transaction_type: 'CREDIT',
      status: 'pending',
      company_id: companyId,
    });
    console.log('4. Created user transaction record');
    
    // 5. Store in Redis
    const redis = require('redis');
    const client = redis.createClient({ url: process.env.REDIS_PUBLIC_URL });
    await client.connect();
    
    const customerRef = 'customer-test-' + Date.now();
    
    // Store customer data
    await client.hSet(customerRef, {
      adm_id: String(userId),
      company_id: String(companyId),
      base_currency: 'USD',
      pathType: 'createPayment',
    });
    
    // Store payment data for address
    await client.del('crypto-' + address);  // Clear any old data
    await client.hSet('crypto-' + address, {
      mode: 'CRYPTO',
      amount: cryptoAmount,
      status: 'pending',
      ref: customerRef,
      currency: currency,
      payment_id: paymentId,
      unique_tx_id: paymentId,  // Add both for compatibility
      walletType: 'customer',
      temp_id: String(poolAddress.dataValues.temp_address_id),
      is_merchant_pool: 'true',
      fee_payer: 'company',
      merchant_amount: cryptoAmount,
      base_amount_usd: String(amountUSD),
    });
    
    await client.quit();
    console.log('5. Stored payment data in Redis');
    
    // 6. Generate QR code
    const qrCode = await QRCode.toDataURL(address, { width: 300 });
    
    console.log('\n========================================');
    console.log('✅ TEST PAYMENT CREATED SUCCESSFULLY');
    console.log('========================================');
    console.log('\nPayment Details:');
    console.log('  Payment ID:', paymentId);
    console.log('  Address:', address);
    console.log('  Amount:', cryptoAmount, 'ETH (~$' + amountUSD + ' USD)');
    console.log('\n📋 Send', cryptoAmount, 'ETH to:');
    console.log('   ', address);
    console.log('\n⏰ Reservation expires in 30 minutes');
    console.log('\nAfter sending, the webhook should automatically:');
    console.log('  1. Detect the payment');
    console.log('  2. Update user_transaction to successful');
    console.log('  3. Transfer merchant amount to their wallet');
    console.log('  4. Mark address as IN_USE for sweep');
    
  } catch (error) {
    console.error('ERROR:', error.message || error);
    if (error.stack) console.error(error.stack);
  }
  
  process.exit(0);
}

async function getEthPrice() {
  try {
    const axios = require('axios');
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    return response.data.ethereum.usd;
  } catch (e) {
    console.log('Could not fetch ETH price, using estimate');
    return 3300;  // Fallback
  }
}

createTestPayment();
