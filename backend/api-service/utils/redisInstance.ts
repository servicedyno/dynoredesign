import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_PUBLIC_URL,
  socket: {
    connectTimeout: 5000,
    reconnectStrategy: retries => Math.min(retries * 100, 3000),
  },
});

let lastApiRedisErrorLog = 0;

redisClient.on("error", (err) => {
  const now = Date.now();
  const msg = err.message || '';
  if (msg.includes('ECONNRESET') || msg.includes('Connection timeout') || msg.includes('Socket closed')) {
    if (now - lastApiRedisErrorLog < 60000) return;
    lastApiRedisErrorLog = now;
    console.log("[API] Redis connection issue (throttled):", msg);
  } else {
    console.log("[API] Redis Client Error:", msg);
  }
});

redisClient.on("reconnecting", () => {
  redisConnected = false;
});

redisClient.on("ready", () => {
  redisConnected = true;
  console.log("[API] Redis connection ready");
});

let redisConnected = false;

export const connectRedis = async () => {
  if (!redisConnected) {
    await redisClient.connect();
    redisConnected = true;
    console.log("API Service: Redis connected");
  }
};

const setRedisItem = async (key: string, value: unknown) => {
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
