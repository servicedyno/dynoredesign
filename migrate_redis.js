#!/usr/bin/env node

const Redis = require('ioredis');

// Old Redis (DynoBackend)
const oldRedis = new Redis('redis://default:fgPwEPwoyHhbAeDhPJakxOByMoNyUSpw@crossover.proxy.rlwy.net:37463');

// New Redis (This repo)
const newRedis = new Redis('redis://default:nGRWpSIBrXftcfgRCQDxtAJGowmXlgUg@turntable.proxy.rlwy.net:21752');

async function migrateRedis() {
  console.log('================================================================================');
  console.log('  REDIS DATA MIGRATION');
  console.log('  From: crossover.proxy.rlwy.net:37463 (DynoBackend)');
  console.log('  To:   turntable.proxy.rlwy.net:21752 (This repo)');
  console.log('================================================================================\n');

  try {
    // Test connections
    console.log('🔌 Testing Redis connections...');
    await oldRedis.ping();
    console.log('   ✅ OLD Redis connected');
    
    await newRedis.ping();
    console.log('   ✅ NEW Redis connected\n');

    // Get all keys from old Redis
    console.log('📋 Scanning keys in OLD Redis...');
    const keys = await oldRedis.keys('*');
    console.log(`   Found ${keys.length} keys\n`);

    if (keys.length === 0) {
      console.log('   ℹ️  No keys to migrate (old Redis is empty)');
      return;
    }

    // Copy each key
    console.log('🔄 Copying keys to NEW Redis...');
    let copied = 0;
    let failed = 0;

    for (const key of keys) {
      try {
        // Get key type
        const type = await oldRedis.type(key);
        
        // Get TTL
        const ttl = await oldRedis.ttl(key);

        // Copy based on type
        if (type === 'string') {
          const value = await oldRedis.get(key);
          await newRedis.set(key, value);
          if (ttl > 0) await newRedis.expire(key, ttl);
        } else if (type === 'hash') {
          const value = await oldRedis.hgetall(key);
          await newRedis.hmset(key, value);
          if (ttl > 0) await newRedis.expire(key, ttl);
        } else if (type === 'list') {
          const value = await oldRedis.lrange(key, 0, -1);
          if (value.length > 0) {
            await newRedis.rpush(key, ...value);
            if (ttl > 0) await newRedis.expire(key, ttl);
          }
        } else if (type === 'set') {
          const value = await oldRedis.smembers(key);
          if (value.length > 0) {
            await newRedis.sadd(key, ...value);
            if (ttl > 0) await newRedis.expire(key, ttl);
          }
        } else if (type === 'zset') {
          const value = await oldRedis.zrange(key, 0, -1, 'WITHSCORES');
          if (value.length > 0) {
            await newRedis.zadd(key, ...value);
            if (ttl > 0) await newRedis.expire(key, ttl);
          }
        }

        copied++;
        if (copied % 10 === 0) {
          process.stdout.write(`\r   Copied: ${copied}/${keys.length}`);
        }
      } catch (err) {
        failed++;
        console.error(`\n   ⚠️  Failed to copy key: ${key} - ${err.message}`);
      }
    }

    console.log(`\n\n✅ Migration complete!`);
    console.log(`   Copied: ${copied} keys`);
    console.log(`   Failed: ${failed} keys`);

    // Verify
    console.log('\n📊 Verifying NEW Redis...');
    const newKeys = await newRedis.keys('*');
    console.log(`   Keys in NEW Redis: ${newKeys.length}`);

    if (newKeys.length > 0) {
      console.log('\n   Sample keys:');
      newKeys.slice(0, 5).forEach(key => {
        console.log(`   - ${key}`);
      });
    }

    console.log('\n================================================================================');
    console.log('  REDIS MIGRATION COMPLETE ✅');
    console.log('================================================================================\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await oldRedis.quit();
    await newRedis.quit();
  }
}

migrateRedis().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
