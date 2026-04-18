const { createClient } = require('redis');
require('dotenv').config();

async function deleteRedisAlert() {
  const redisClient = createClient({
    url: process.env.REDIS_PUBLIC_URL,
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: retries => Math.min(retries * 100, 3000),
    },
  });

  try {
    await redisClient.connect();
    console.log('Redis connected successfully');
    
    // Check if key exists
    const alertData = await redisClient.hGetAll('admin_fee_alert');
    console.log('Current alert data:', alertData);
    
    // Delete the key
    const result = await redisClient.del('admin_fee_alert');
    console.log(`\nDeleted admin_fee_alert key. Result: ${result === 1 ? 'SUCCESS' : 'KEY NOT FOUND'}`);
    
    // Verify deletion
    const checkData = await redisClient.hGetAll('admin_fee_alert');
    console.log('After deletion, alert data:', Object.keys(checkData).length === 0 ? 'EMPTY (Success!)' : checkData);
    
    await redisClient.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

deleteRedisAlert();
