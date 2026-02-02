/**
 * @deprecated This file is deprecated. OTP storage has been moved to Redis.
 * Use getRedisItem/setRedisItem from redisInstance.ts instead.
 * 
 * This file is kept for backward compatibility but should not be used.
 */

// Placeholder export to prevent import errors
const localStorage = {
  push: async (key: string, data: any) => {
    console.warn('[DEPRECATED] localStorage.push called - use Redis instead');
    throw new Error('localStorage is deprecated. Use Redis for OTP storage.');
  },
  getData: async (key: string) => {
    console.warn('[DEPRECATED] localStorage.getData called - use Redis instead');
    throw new Error('localStorage is deprecated. Use Redis for OTP storage.');
  }
};

export default localStorage;
