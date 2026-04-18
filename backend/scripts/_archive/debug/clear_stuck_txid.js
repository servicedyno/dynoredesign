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
  
  // Delete the txId field to allow webhook to process again
  console.log('\n=== Clearing txId from Redis ===');
  await client.hDel(cryptoKey, 'txId');
  await client.hDel(cryptoKey, 'unique_tx_id');
  console.log('✅ Cleared txId and unique_tx_id fields');
  
  // Verify the change
  const data = await client.hGetAll(cryptoKey);
  console.log('\n=== Updated Redis data ===');
  console.log(JSON.stringify(data, null, 2));
  
  if (!data.txId) {
    console.log('\n✅ txId successfully removed! Webhook can now process the payment.');
  }
  
  await client.quit();
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
