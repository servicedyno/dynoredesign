const { createClient } = require('redis');

async function main() {
  const client = createClient({ 
    url: process.env.REDIS_PUBLIC_URL,
    socket: { connectTimeout: 10000 }
  });
  
  client.on('error', (err) => console.log('Redis error:', err.message));
  
  console.log('Connecting to Redis...');
  await client.connect();
  console.log('Connected!');
  
  const address = '0xf6dc2d96fa94a4de7fe78aff63e3e2a1fe7cba51';
  const cryptoKey = 'crypto-' + address;
  
  // Use hGetAll since the app uses hSet
  const data = await client.hGetAll(cryptoKey);
  console.log('\n=== Redis data for', cryptoKey, '===');
  console.log(JSON.stringify(data, null, 2));
  
  // Check if txId exists in Redis
  if (data && data.txId) {
    console.log('\n⚠️  txId EXISTS in Redis:', data.txId);
    console.log('This is why the webhook is ignoring retries!');
  } else {
    console.log('\n✅ No txId in Redis - webhook should process');
  }
  
  await client.quit();
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
