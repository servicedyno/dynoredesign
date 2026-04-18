/**
 * Direct manual processing of stuck ETH payment
 * Bypasses Redis and directly processes the payout
 */

import dotenv from 'dotenv';
import { Sequelize, Transaction } from 'sequelize';
import * as merchantPoolService from './services/merchantPoolService';

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME!,
  process.env.USER_NAME!,
  process.env.PASSWORD!,
  {
    host: process.env.HOST!,
    port: parseInt(process.env.DB_PORT!),
    dialect: 'postgres',
    logging: false
  }
);

async function manualProcessPayment() {
  console.log('='.repeat(80));
  console.log('MANUAL PAYMENT PROCESSING - DIRECT DATABASE');
  console.log('='.repeat(80));
  console.log();
  
  const paymentAddress = '0xf6dc2d96fa94a4de7fe78aff63e3e2a1fe7cba51';
  const receivedAmount = 0.00367; // Amount user sent
  const expectedAmount = 0.00332151;
  
  try {
    // Step 1: Get pool address details
    console.log('Step 1: Fetching pool address details...');
    const [poolAddresses] = await sequelize.query(
      `SELECT * FROM tbl_merchant_temp_address WHERE wallet_address = '${paymentAddress}' LIMIT 1`
    );
    
    if (!poolAddresses || poolAddresses.length === 0) {
      throw new Error('Payment address not found in database');
    }
    
    const poolAddress: unknown = poolAddresses[0];
    console.log('✅ Found pool address');
    console.log('   Temp ID:', poolAddress.temp_address_id);
    console.log('   Status:', poolAddress.status);
    console.log('   Owner:', poolAddress.owner_user_id);
    console.log('   Expected:', poolAddress.expected_amount, 'ETH');
    console.log();
    
    // Step 2: Check if already processed
    const [existingTxs] = await sequelize.query(
      `SELECT * FROM tbl_merchant_pool_transaction WHERE temp_address_id = ${poolAddress.temp_address_id}`
    );
    
    if (existingTxs && existingTxs.length > 0) {
      console.log('⚠️  Payment already processed!');
      console.log('   Transactions found:', existingTxs.length);
      return;
    }
    
    console.log('✅ No existing transactions - proceeding with payout');
    console.log();
    
    // Step 3: Call merchant pool service to process payment
    console.log('Step 2: Processing merchant payout...');
    console.log('   Received Amount:', receivedAmount, 'ETH');
    console.log('   Currency: ETH');
    console.log();
    
    // Mark payment as received using the correct function
    const result = await merchantPoolService.markPaymentReceived(
      poolAddress.temp_address_id,
      receivedAmount,
      '0xacacca62f2fd947f7b0314459142e374f0a790e9daf1680d75778f0ee8fe46f9' // TX hash
    );
    
    console.log('='.repeat(80));
    console.log('✅ PAYMENT PROCESSED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log();
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log();
    
    // Verify in database
    const [newTxs] = await sequelize.query(
      `SELECT * FROM tbl_merchant_pool_transaction WHERE temp_address_id = ${poolAddress.temp_address_id}`
    );
    
    if (newTxs && newTxs.length > 0) {
      console.log('✅ Transaction recorded in database:');
      const tx: unknown = newTxs[0];
      console.log('   Merchant Amount:', tx.merchant_amount_crypto, 'ETH');
      console.log('   USD Value: $' + tx.merchant_amount_usd);
      console.log('   TX ID:', tx.merchant_payout_tx_id);
      console.log('   Status:', tx.status);
    }
    
    await sequelize.close();
    process.exit(0);
    
  } catch (error: unknown) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await sequelize.close();
    process.exit(1);
  }
}

manualProcessPayment();
