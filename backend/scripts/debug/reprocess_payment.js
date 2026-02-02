require('dotenv').config();
process.chdir('/app/backend');
require('ts-node').register({ 
  transpileOnly: true, 
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true } 
});

const redis = require('redis');
const { paymentController } = require('/app/backend/controller');

async function reprocess() {
  const address = '0xb3336b75366d3a4363a7413c032e69cc7382c0e4';
  const txId = '0xa36fe4007305b07c4bd591c02dd1d372858daf242b149b636413ffbca9f3b75c';
  const amount = 0.00357;
  
  console.log('=== REPROCESSING PAYMENT ===');
  console.log('Address:', address);
  console.log('TX ID:', txId);
  console.log('Amount:', amount, 'ETH');
  
  try {
    // 1. First, clear the processed-tx key so we can reprocess
    const client = redis.createClient({ url: process.env.REDIS_PUBLIC_URL });
    await client.connect();
    
    // Get current Redis data
    const currentData = await client.hGetAll('crypto-' + address);
    console.log('\nCurrent Redis status:', currentData.status);
    
    // Update Redis with txId if not present
    if (!currentData.txId || currentData.txId !== txId) {
      await client.hSet('crypto-' + address, 'txId', txId);
      await client.hSet('crypto-' + address, 'receivedAmount', String(amount));
      await client.hSet('crypto-' + address, 'status', 'processing');
      console.log('Updated Redis with txId');
    }
    
    // Delete the processed-tx marker so we can reprocess
    await client.del('processed-tx-' + txId);
    console.log('Cleared processed-tx marker');
    
    await client.quit();
    
    // 2. Call cryptoVerification
    console.log('\nCalling cryptoVerification...');
    const result = await paymentController.cryptoVerification(address, true);
    console.log('\nResult:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message || error);
    if (error.stack) console.error(error.stack);
  }
  
  process.exit(0);
}

reprocess();
