/**
 * Recovery script for stuck test payments:
 * 1. DOGE: Re-link address, update status, trigger sweep
 * 2. BTC: Restore Redis data, retrigger webhook
 * 3. BCH: Restore Redis data, retrigger webhook (with bitcoincash: prefix fix)
 */
const { Sequelize, QueryTypes } = require('sequelize');
const redis = require('redis');
const http = require('http');
const https = require('https');

const DB_URL = {
  database: 'db_bozzwallet',
  username: 'postgres',
  password: 'oYLtGbXGKLFLWjoEbLjzxOzTXPLtJXQV',
  host: 'tramway.proxy.rlwy.net',
  port: 57376,
};

const REDIS_URL = 'redis://default:nGRWpSIBrXftcfgRCQDxtAJGowmXlgUg@turntable.proxy.rlwy.net:21752';

// Payment data
const DOGE = {
  paymentId: 'e232ef32-0235-4f64-9fd9-955567d36076',
  address: 'D9dE9G6ofwPvCVSiQtPvbMZbna9JGhsuXK',
  addressId: 183,
  expectedAmount: 88.24,
  receivedAmount: 91,
  txId: '96ebc0de14b8f96c6559c473ee1fa6fc5e8e932a9d4fe5448922130fc72874a9',
};

const BTC = {
  paymentId: '26b5bd38-f0e3-4d77-bd39-cb20c4272fef',
  address: 'bc1qh2hhcesallu4fpfkvvhus3z3tkqmrtzn8n5rc9',
  addressId: 23,
  expectedAmount: 0.00014216,
  // BTC txId - need to find from logs or blockchain
};

const BCH = {
  paymentId: '0b1c8b3c-dd78-4637-b55d-b19a9b1a178c',
  address: 'bitcoincash:qqxer0q7d4jqgasfz4tgpw34n0w5ltt47yvncdx577',
  addressId: 128,
  expectedAmount: 0.01781635,
  receivedAmount: 0.0188,
  txId: '8c858cb25b906c638af6d9052118aecade4f931738a814797caf3655dceac1b5',
};

async function main() {
  const s = new Sequelize(DB_URL.database, DB_URL.username, DB_URL.password, {
    host: DB_URL.host, port: DB_URL.port, dialect: 'postgres', logging: false
  });
  
  const client = redis.createClient({ url: REDIS_URL, socket: { connectTimeout: 5000 } });
  
  await s.authenticate();
  await client.connect();
  console.log('Connected to DB and Redis');

  // ═══════════════════════════════════════════
  // 1. FIX DOGE: Re-link address, reset for sweep
  // ═══════════════════════════════════════════
  console.log('\n=== DOGE Recovery ===');
  
  // Re-link address to payment
  await s.query(
    `UPDATE tbl_merchant_temp_address 
     SET status = 'IN_USE', current_payment_id = :paymentId, expected_amount = :expected,
         received_amount = :received
     WHERE temp_address_id = :addrId`,
    { replacements: { paymentId: DOGE.paymentId, expected: DOGE.expectedAmount, received: DOGE.receivedAmount, addrId: DOGE.addressId } }
  );
  console.log('DOGE: Address re-linked to payment');
  
  // Update payment status
  await s.query(
    `UPDATE tbl_user_transaction SET status = 'received', crypto_amount = :received
     WHERE id = :id`,
    { replacements: { received: DOGE.receivedAmount, id: DOGE.paymentId } }
  );
  console.log('DOGE: Payment status set to received');
  
  // Set Redis data for the address
  const dogeRedisData = {
    currency: 'DOGE',
    amount: DOGE.expectedAmount,
    payment_id: DOGE.paymentId,
    company_id: 38,
    user_id: 28,
    address_id: DOGE.addressId,
    txId: DOGE.txId,
    status: 'received',
    received_amount: DOGE.receivedAmount,
  };
  await client.set(`crypto-${DOGE.address}`, JSON.stringify(dogeRedisData));
  await client.expire(`crypto-${DOGE.address}`, 86400); // 24h TTL
  console.log('DOGE: Redis data restored');
  
  // Delete any failed conversion (it will be recreated after sweep)
  await s.query(
    `DELETE FROM tbl_stablecoin_conversion WHERE conversion_id = 23`
  );
  console.log('DOGE: Cleared failed conversion record');

  // ═══════════════════════════════════════════
  // 2. FIX BCH: Restore Redis, will be picked up by checkMissedPayments or re-webhook
  // ═══════════════════════════════════════════
  console.log('\n=== BCH Recovery ===');
  
  const bchRedisData = {
    currency: 'BCH',
    amount: BCH.expectedAmount,
    payment_id: BCH.paymentId,
    company_id: 38,
    user_id: 28,
    address_id: BCH.addressId,
    status: 'pending',
  };
  await client.set(`crypto-${BCH.address}`, JSON.stringify(bchRedisData));
  await client.expire(`crypto-${BCH.address}`, 86400);
  console.log('BCH: Redis data restored with full bitcoincash: prefix');
  
  // Clear any processed-tx dedup key
  await client.del(`processed-tx-${BCH.txId}`);
  console.log('BCH: Cleared dedup key');

  // ═══════════════════════════════════════════
  // 3. FIX BTC: Restore Redis, find tx from blockchain 
  // ═══════════════════════════════════════════
  console.log('\n=== BTC Recovery ===');
  
  const btcRedisData = {
    currency: 'BTC',
    amount: BTC.expectedAmount,
    payment_id: BTC.paymentId,
    company_id: 38,
    user_id: 28,
    address_id: BTC.addressId,
    status: 'pending',
  };
  await client.set(`crypto-${BTC.address}`, JSON.stringify(btcRedisData));
  await client.expire(`crypto-${BTC.address}`, 86400);
  console.log('BTC: Redis data restored');

  console.log('\n=== Recovery Complete ===');
  console.log('DOGE: Address re-linked, will be swept by next cron cycle');
  console.log('BCH: Redis restored, retrigger webhook with BCH txId');
  console.log('BTC: Redis restored, need to find BTC txId from blockchain and retrigger');
  
  await client.disconnect();
  await s.close();
}

main().catch(e => { console.error('Recovery failed:', e.message); process.exit(1); });
