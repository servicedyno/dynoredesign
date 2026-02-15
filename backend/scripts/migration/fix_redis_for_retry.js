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
  
  // Step 1: Clear the stuck state - remove txId so webhook can process again
  console.log('\n=== Step 1: Clearing txId ===');
  await client.hDel(cryptoKey, 'txId');
  await client.hDel(cryptoKey, 'unique_tx_id');
  console.log('✅ Cleared txId and unique_tx_id');
  
  // Step 2: Add the missing is_merchant_pool flag
  console.log('\n=== Step 2: Adding is_merchant_pool flag ===');
  await client.hSet(cryptoKey, 'is_merchant_pool', 'true');
  console.log('✅ Added is_merchant_pool = true');
  
  // Step 3: Reset status to pending
  console.log('\n=== Step 3: Resetting status ===');
  await client.hSet(cryptoKey, 'status', 'pending');
  console.log('✅ Reset status to pending');
  
  // Verify the changes
  const data = await client.hGetAll(cryptoKey);
  console.log('\n=== Final Redis data ===');
  console.log(JSON.stringify(data, null, 2));
  
  console.log('\n✅ Redis is ready for webhook retry!');
  
  await client.quit();
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
