import { getRedisItem } from '../utils/redisInstance';

async function main() {
  const key = 'customer-49004eed5e213043e20c612c5e65365e5926bd8451458262';
  const data = await getRedisItem(key);
  console.log('Redis data for', key, ':', data);
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
