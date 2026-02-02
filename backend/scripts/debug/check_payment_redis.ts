import { getRedisItem, setRedisItem } from '../utils/redisInstance';

async function main() {
  const address = '0x5c8282c96a89f002b908668bab6d5d30c68b610e';
  
  // Check crypto address key
  const cryptoData = await getRedisItem('crypto-' + address);
  console.log('=== REDIS DATA FOR crypto-' + address + ' ===');
  console.log(JSON.stringify(cryptoData, null, 2));
  
  // Check if there's a ref key
  if (cryptoData?.ref) {
    const refData = await getRedisItem(cryptoData.ref);
    console.log('\n=== REF DATA FOR', cryptoData.ref, '===');
    console.log(JSON.stringify(refData, null, 2));
  }
}

main().catch(console.error);
