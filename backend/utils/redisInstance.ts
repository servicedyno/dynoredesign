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

const getRedisItem = async (key: string) => {
  return await redisClient.hGetAll(key);
};

const deleteRedisItem = async (key: string) => {
  await redisClient.del(key);
};

export { setRedisItem, getRedisItem, deleteRedisItem };
