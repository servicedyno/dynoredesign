const { Sequelize, QueryTypes, Op } = require('sequelize');
const { createClient } = require('redis');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false
});

async function testFeeCheck() {
  try {
    console.log('=== Testing Fee Balance Check Logic ===\n');
    
    // Get all fee wallets
    const feeWallets = await sequelize.query(
      'SELECT fee_wallet_id, wallet_type, wallet_address, amount, "feeLimit", alert_duration FROM tbl_admin_fee_wallet',
      { type: QueryTypes.SELECT }
    );
    
    console.log(`Found ${feeWallets.length} fee wallets to monitor:\n`);
    
    let shouldAlert = false;
    let alertMessage = '';
    
    for (const wallet of feeWallets) {
      const { wallet_type, wallet_address, amount, feeLimit } = wallet;
      
      // For testing, we'll assume the amount in DB is already in crypto
      // In real code, it would fetch from blockchain API
      // For USDT, amount 0 means 0 USD
      const amount_in_usd = amount; // Simplified - real code does currency conversion
      
      console.log(`  ${wallet_type}:`);
      console.log(`    Address: ${wallet_address}`);
      console.log(`    Current Balance: $${amount_in_usd}`);
      console.log(`    Alert Threshold: $${feeLimit}`);
      console.log(`    Status: ${amount_in_usd < feeLimit ? '⚠️  BELOW THRESHOLD' : '✅ OK'}\n`);
      
      if (amount_in_usd < feeLimit) {
        shouldAlert = true;
        alertMessage += `\\n Your ${wallet_type} fee wallet has low fee amount ($${amount_in_usd}) then limit of ($${feeLimit}).`;
      }
    }
    
    console.log('\\n=== Alert Check Result ===');
    if (shouldAlert) {
      console.log('🚨 LOW BALANCE DETECTED - Alert should be sent!');
      console.log('\\nAlert message:');
      console.log(alertMessage);
      
      // Check Redis key
      console.log('\\n=== Checking Redis Alert Key ===');
      const redisClient = createClient({
        url: process.env.REDIS_PUBLIC_URL,
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: retries => Math.min(retries * 100, 3000),
        },
      });
      
      await redisClient.connect();
      const alertData = await redisClient.hGetAll('admin_fee_alert');
      
      if (Object.keys(alertData).length === 0) {
        console.log('✅ No Redis key found - Alert will be sent on next cron run (20:15)');
      } else {
        const expiresAt = Number(alertData.expiresAt);
        const now = new Date().getTime();
        const expired = now >= expiresAt;
        
        console.log('Redis key exists:');
        console.log('  Status:', alertData.status);
        console.log('  Expires at:', new Date(expiresAt).toISOString());
        console.log('  Is expired:', expired);
        
        if (expired) {
          console.log('  ✅ Key is expired - Alert will be sent on next cron run');
        } else {
          console.log('  ⚠️  Key is still active - Alert will NOT be sent until it expires');
        }
      }
      
      await redisClient.disconnect();
    } else {
      console.log('✅ All fee wallets above threshold - No alert needed');
    }
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testFeeCheck();
