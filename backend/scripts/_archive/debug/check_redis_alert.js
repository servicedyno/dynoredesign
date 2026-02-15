const { createClient } = require('redis');
require('dotenv').config();

async function checkRedisAlert() {
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
    
    const alertData = await redisClient.hGetAll('admin_fee_alert');
    console.log('\nRedis admin_fee_alert key data:');
    console.log(JSON.stringify(alertData, null, 2));
    
    if (alertData && alertData.expiresAt) {
      const expiresAt = Number(alertData.expiresAt);
      const now = new Date().getTime();
      const expired = now >= expiresAt;
      
      console.log('\nAlert Status:');
      console.log('  Current time:', new Date(now).toISOString());
      console.log('  Expires at:', new Date(expiresAt).toISOString());
      console.log('  Is expired:', expired);
      console.log('  Time until expiry:', expired ? 'EXPIRED' : Math.round((expiresAt - now) / 1000 / 60) + ' minutes');
    } else {
      console.log('\nNo alert data found in Redis - alerts will be sent on next cron run');
    }
    
    await redisClient.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkRedisAlert();
