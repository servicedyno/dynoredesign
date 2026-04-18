/**
 * BTC Recovery Script
 * Resets the stuck BTC payment state and re-triggers the webhook processing.
 * 
 * The BTC payment at bc1qrwecur55uvlhpha0j39dzg36x89vysvvme8gkz failed during
 * settlement because of a floating-point precision error in the UTXO multi-output
 * path (Tatum API requires values with <=8 decimal places).
 * 
 * The code fix has been applied in paymentController.ts:
 * - settleCryptoTransaction now uses satoshi-level integer arithmetic for UTXO multi-output
 * 
 * This script:
 * 1. Resets the customer_transaction status from "successful" to "received"
 * 2. Restores Redis data for the BTC address
 * 3. Clears the processed-tx duplicate prevention key
 * 4. Triggers the webhook to re-process with the fixed code
 * 
 * Usage: npx ts-node scripts/btc_recovery.ts
 */
import dotenv from "dotenv";
dotenv.config();

import { Sequelize, QueryTypes } from "sequelize";
import redis from "redis";
import https from "https";
import http from "http";

// BTC payment data from webhook logs
const BTC_PAYMENT = {
  address: 'bc1qrwecur55uvlhpha0j39dzg36x89vysvvme8gkz',
  txId: '638c32371c6dd9942c68bce15e4666e86d993a0ad65798ae0e43580df935e373',
  amount: '0.000155',
  currency: 'BTC',
  paymentId: 'bc415a61-469a-46df-8f67-bd2112ad42d9',
  companyId: 38,
  userId: 28,
  addressId: 18,
  expectedAmount: 0.0001422,
};

async function main() {
  console.log('=== BTC Recovery Script ===');
  console.log(`Address: ${BTC_PAYMENT.address}`);
  console.log(`TX: ${BTC_PAYMENT.txId}`);
  console.log(`Amount: ${BTC_PAYMENT.amount} BTC`);
  
  // Connect to DB
  const sequelize = new Sequelize(
    process.env.DB_NAME!,
    process.env.USER_NAME!,
    process.env.PASSWORD!,
    {
      host: process.env.HOST,
      port: parseInt(process.env.DB_PORT || "5432"),
      dialect: "postgres",
      logging: false,
    }
  );
  await sequelize.authenticate();
  console.log('DB connected');

  // Connect to Redis
  const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
  const client = redis.createClient({ url: redisUrl, socket: { connectTimeout: 5000 } });
  await client.connect();
  console.log('Redis connected');

  // Step 1: Check current DB status
  console.log('\n--- Step 1: Checking current DB status ---');
  const [txRow] = await sequelize.query<any>(
    `SELECT id, status, transaction_reference, amount, currency 
     FROM tbl_customer_transaction 
     WHERE transaction_reference = :txId OR id = :paymentId
     ORDER BY "createdAt" DESC LIMIT 5`,
    { replacements: { txId: BTC_PAYMENT.txId, paymentId: BTC_PAYMENT.paymentId }, type: QueryTypes.SELECT }
  );
  
  if (txRow) {
    console.log(`  Found: id=${txRow.id}, status=${txRow.status}, ref=${txRow.transaction_reference}`);
    
    if (txRow.status === 'successful' || txRow.status === 'completed') {
      console.log('  Resetting status to "received" for re-processing...');
      await sequelize.query(
        `UPDATE tbl_customer_transaction SET status = 'received', transaction_reference = NULL
         WHERE id = :id`,
        { replacements: { id: txRow.id } }
      );
      console.log('  DB status reset to "received"');
    }
  } else {
    console.log('  No matching transaction found in DB');
  }

  // Step 2: Clear Redis duplicate prevention
  console.log('\n--- Step 2: Clearing Redis locks ---');
  const processedKey = `processed-tx-${BTC_PAYMENT.txId}`;
  const atomicLock = `atomic-lock-${BTC_PAYMENT.txId}`;
  
  const deletedProcessed = await client.del(processedKey);
  const deletedAtomic = await client.del(atomicLock);
  console.log(`  Deleted processed-tx key: ${deletedProcessed}`);
  console.log(`  Deleted atomic-lock key: ${deletedAtomic}`);

  // Step 3: Restore Redis payment data
  console.log('\n--- Step 3: Restoring Redis payment data ---');
  const cryptoKey = `crypto-${BTC_PAYMENT.address}`;
  
  const existingData = await client.get(cryptoKey);
  if (existingData) {
    const parsed = JSON.parse(existingData);
    console.log(`  Existing Redis data: status=${parsed.status}, txId=${parsed.txId}`);
    
    // Reset status and txId so cryptoVerification can re-process
    parsed.status = 'received';
    parsed.txId = BTC_PAYMENT.txId;
    await client.set(cryptoKey, JSON.stringify(parsed));
    await client.expire(cryptoKey, 86400);
    console.log('  Redis data restored with status=received');
  } else {
    // Restore from scratch using known data
    const redisData = {
      currency: BTC_PAYMENT.currency,
      amount: BTC_PAYMENT.expectedAmount,
      payment_id: BTC_PAYMENT.paymentId,
      company_id: BTC_PAYMENT.companyId,
      user_id: BTC_PAYMENT.userId,
      address_id: BTC_PAYMENT.addressId,
      txId: BTC_PAYMENT.txId,
      status: 'received',
      received_amount: BTC_PAYMENT.amount,
      is_merchant_pool: false, // Legacy address
    };
    await client.set(cryptoKey, JSON.stringify(redisData));
    await client.expire(cryptoKey, 86400);
    console.log('  Redis data created from scratch');
  }

  // Step 4: Trigger webhook
  console.log('\n--- Step 4: Triggering webhook ---');
  const webhookUrl = process.env.WEBHOOK_URL || process.env.APP_URL || 'http://localhost:3300';
  const webhookPayload = JSON.stringify({
    address: BTC_PAYMENT.address,
    amount: BTC_PAYMENT.amount,
    asset: BTC_PAYMENT.currency,
    blockNumber: 0,
    counterAddress: '',
    date: Date.now(),
    index: 0,
    mempool: false,
    subscriptionType: 'ADDRESS_TRANSACTION',
    tokenId: '',
    transactionId: BTC_PAYMENT.txId,
    transactionType: 'incoming',
    txId: BTC_PAYMENT.txId,
    type: 'native',
  });

  const url = new URL(`${webhookUrl}/api/tatum/events?company_id=${BTC_PAYMENT.companyId}&user_id=${BTC_PAYMENT.userId}&address_id=${BTC_PAYMENT.addressId}`);
  
  console.log(`  POST ${url.toString()}`);
  
  const httpModule = url.protocol === 'https:' ? https : http;
  
  await new Promise<void>((resolve, reject) => {
    const req = httpModule.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(webhookPayload),
      },
    }, (res) => {
      console.log(`  Response status: ${res.statusCode}`);
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (data) console.log(`  Response: ${data.substring(0, 200)}`);
        resolve();
      });
    });
    req.on('error', (err) => {
      console.error(`  Request failed: ${err.message}`);
      reject(err);
    });
    req.write(webhookPayload);
    req.end();
  });

  // Step 5: Wait and verify
  console.log('\n--- Step 5: Waiting 10s for processing... ---');
  await new Promise(r => setTimeout(r, 10000));
  
  // Check final status
  const [finalRow] = await sequelize.query<any>(
    `SELECT id, status, transaction_reference FROM tbl_customer_transaction 
     WHERE id = :id`,
    { replacements: { id: txRow?.id || BTC_PAYMENT.paymentId }, type: QueryTypes.SELECT }
  );
  
  if (finalRow) {
    console.log(`\nFinal status: ${finalRow.status}, ref: ${finalRow.transaction_reference || 'none'}`);
    if (finalRow.status === 'successful') {
      console.log('BTC sweep completed successfully!');
    } else {
      console.log('BTC still not successful. Check webhook logs for errors.');
    }
  }

  await client.disconnect();
  await sequelize.close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Recovery failed:', err);
  process.exit(1);
});
