const { createClient } = require('redis');
require('dotenv').config();

async function testRedisSetGet() {
  const redisClient = createClient({
    url: process.env.REDIS_PUBLIC_URL,
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: retries => Math.min(retries * 100, 3000),
    },
  });

  try {
    console.log('Testing Redis connection and operations...\n');
    console.log('REDIS_PUBLIC_URL:', process.env.REDIS_PUBLIC_URL ? 'SET' : 'NOT SET');
    
    await redisClient.connect();
    console.log('✅ Redis connected successfully\n');
    
    // Test setting a hash (like setRedisItem does)
    const testKey = 'test_fee_alert';
    const testData = {
      status: 'sent',
      expiresAt: (new Date().getTime() + 60 * 60 * 1000).toString() // 1 hour from now
    };
    
    console.log('Testing hSet (hash set)...');
    for (const [field, val] of Object.entries(testData)) {
      await redisClient.hSet(testKey, field, val);
    }
    console.log('✅ Data written to Redis hash:', testKey);
    
    // Test getting the hash
    console.log('\nTesting hGetAll (hash get all)...');
    const retrievedData = await redisClient.hGetAll(testKey);
    console.log('✅ Retrieved data:', retrievedData);
    
    // Verify data matches
    console.log('\nVerifying data integrity...');
    if (retrievedData.status === testData.status && retrievedData.expiresAt === testData.expiresAt) {
      console.log('✅ Data integrity verified - Redis operations working correctly');
    } else {
      console.log('❌ Data mismatch!');
      console.log('  Expected:', testData);
      console.log('  Got:', retrievedData);
    }
    
    // Check if key has TTL
    console.log('\nChecking TTL (Time To Live) on key...');
    const ttl = await redisClient.ttl(testKey);
    console.log('TTL:', ttl === -1 ? 'NO EXPIRATION SET (Key will persist forever!)' : `${ttl} seconds`);
    
    if (ttl === -1) {
      console.log('\n⚠️  ISSUE FOUND: Redis keys created with hSet do NOT have automatic expiration!');
      console.log('   The application must manually check the expiresAt field.');
      console.log('   This means keys stay in Redis forever unless manually deleted.');
    }
    
    // Cleanup
    await redisClient.del(testKey);
    console.log('\n✅ Test key cleaned up');
    
    await redisClient.disconnect();
    console.log('✅ Redis disconnected');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testRedisSetGet();
