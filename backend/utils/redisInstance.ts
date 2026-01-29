import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_PUBLIC_URL,
  socket: {
    connectTimeout: 5000,
    reconnectStrategy: retries => Math.min(retries * 100, 3000),
  },
});

redisClient.on("error", err => {
  console.log("Redis Client Error", err.message);
});

let redisConnected = false;

export const connectRedis = async () => {
  if (!redisConnected) {
    await redisClient.connect();
    redisConnected = true;
    console.log("Redis connected");
  }
};

const setRedisItem = async (key: string, value: any) => {
  for (const [field, val] of Object.entries(value)) {
    if (val !== undefined && val !== null) {
      await redisClient.hSet(key, field, val.toString());
    }
  }
};

// Set Redis item with TTL (time-to-live in seconds)
const setRedisItemWithTTL = async (key: string, value: any, ttlSeconds: number) => {
  for (const [field, val] of Object.entries(value)) {
    if (val !== undefined && val !== null) {
      await redisClient.hSet(key, field, val.toString());
    }
  }
  await redisClient.expire(key, ttlSeconds);
};

// Set TTL on existing key
const setRedisTTL = async (key: string, ttlSeconds: number) => {
  await redisClient.expire(key, ttlSeconds);
};

const getRedisItem = async (key: string) => {
  return await redisClient.hGetAll(key);
};

const deleteRedisItem = async (key: string) => {
  await redisClient.del(key);
};

// Soft delete - set TTL instead of immediate deletion (for checkout polling)
const softDeleteRedisItem = async (key: string, ttlSeconds: number = 1800) => {
  // Default 30 minutes TTL to allow checkout to poll for status
  await redisClient.expire(key, ttlSeconds);
  console.log(`[Redis] Soft delete: ${key} will expire in ${ttlSeconds}s`);
};

export { setRedisItem, setRedisItemWithTTL, setRedisTTL, getRedisItem, deleteRedisItem, softDeleteRedisItem };
