const { createClient } = require('redis');
require('dotenv').config();

async function testEmptyHashBug() {
  const redisClient = createClient({
    url: process.env.REDIS_PUBLIC_URL,
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: retries => Math.min(retries * 100, 3000),
    },
  });

  try {
    await redisClient.connect();
    console.log('=== Testing Empty Hash Bug ===\n');
    
    // Ensure key doesn't exist
    await redisClient.del('admin_fee_alert');
    console.log('1. Deleted admin_fee_alert key');
    
    // Get the empty hash (simulating what happens after deletion)
    const sentData = await redisClient.hGetAll('admin_fee_alert');
    console.log('2. Retrieved data:', sentData);
    console.log('   Object.keys length:', Object.keys(sentData).length);
    
    // Test OLD buggy logic
    console.log('\n=== OLD BUGGY LOGIC ===');
    let flag_old = true;
    if (sentData) {  // BUG: Empty object is truthy!
      const { expiresAt } = sentData;
      console.log('   sentData is truthy, expiresAt:', expiresAt);
      console.log('   Number(undefined):', Number(expiresAt));
      if (new Date().getTime() < Number(expiresAt)) {
        flag_old = false;
        console.log('   Flag set to FALSE (blocked)');
      } else {
        console.log('   Comparison result: NaN < timestamp is always false');
      }
    }
    console.log('   Final flag_old:', flag_old, flag_old ? '✅ Would send alert' : '❌ Would NOT send alert');
    
    // Test NEW fixed logic
    console.log('\n=== NEW FIXED LOGIC ===');
    let flag_new = true;
    if (sentData && Object.keys(sentData).length > 0) {  // FIX: Check if hash has keys
      const { expiresAt } = sentData;
      console.log('   Hash has keys, checking expiry...');
      if (expiresAt && new Date().getTime() < Number(expiresAt)) {
        flag_new = false;
      }
    } else {
      console.log('   Hash is empty or doesn\'t exist - proceeding');
    }
    console.log('   Final flag_new:', flag_new, flag_new ? '✅ Would send alert' : '❌ Would NOT send alert');
    
    console.log('\n=== RESULT ===');
    if (flag_old === false && flag_new === true) {
      console.log('✅ BUG FIXED! Old logic blocked alerts, new logic allows them.');
    } else {
      console.log('⚠️  Unexpected result');
    }
    
    await redisClient.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testEmptyHashBug();
