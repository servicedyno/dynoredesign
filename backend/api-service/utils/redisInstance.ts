import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_PUBLIC_URL,
})
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();

const setRedisItem = async (key: string, value: any) => {
  (await redisClient).hSet(key, value);
};

const getRedisItem = async (key: string) => {
  const resData = await (await redisClient).hGetAll(key);
  return resData;
};

const deleteRedisItem = async (key: string) => {
  (await redisClient).del(key);
};

export { setRedisItem, getRedisItem, deleteRedisItem };
