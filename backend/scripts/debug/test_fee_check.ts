import paymentController from './controller/paymentController';
import { connectRedis } from './utils/redisInstance';

async function testFeeBalance() {
  try {
    console.log('Connecting to Redis...');
    await connectRedis();
    console.log('Redis connected successfully');
    
    console.log('Running checkFeeBalance...');
    await paymentController.checkFeeBalance();
    console.log('checkFeeBalance completed');
    
    process.exit(0);
  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

testFeeBalance();
