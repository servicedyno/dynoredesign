/**
 * Create USDT Payment Address for Nomadly using Tatum API
 */

const { TatumApi } = require('@tatumio/api-client');
const { Sequelize, QueryTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false
});

async function createUSDTPaymentAddress() {
  try {
    console.log('=== Creating USDT-TRC20 Payment Address for Nomadly ===\n');
    
    const userId = 4; // Nomadly
    const companyId = 3;
    const amount = 100; // $100 USDT
    const currency = 'USDT-TRC20';
    
    // Step 1: Verify merchant has USDT wallet
    console.log('Step 1: Verifying merchant wallet configuration...');
    const merchantWallet = await sequelize.query(
      `SELECT * FROM tbl_user_wallet WHERE user_id = :userId AND wallet_type = :currency`,
      { replacements: { userId, currency }, type: QueryTypes.SELECT }
    );
    
    if (merchantWallet.length === 0) {
      throw new Error('Merchant USDT-TRC20 wallet not configured!');
    }
    
    console.log('✅ Merchant wallet:', merchantWallet[0].wallet_address);
    console.log('   Current balance:', merchantWallet[0].wallet_balance || '0', currency);
    
    // Step 2: Initialize Tatum SDK
    console.log('\nStep 2: Initializing Tatum API...');
    const tatumKey = process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY;
    if (!tatumKey) {
      throw new Error('Tatum API key not found in environment');
    }
    const tatumSdk = TatumApi(tatumKey);
    console.log('✅ Tatum SDK initialized');
    
    // Step 3: Generate TRX address for USDT-TRC20
    console.log('\nStep 3: Generating TRX address via Tatum...');
    
    try {
      // Generate TRX wallet (for USDT-TRC20)
      const wallet = await tatumSdk.blockchain.tron.tronGenerateWallet();
      console.log('✅ TRX Wallet generated');
      console.log('   Address:', wallet.data.address);
      console.log('   Private Key:', wallet.data.privateKey.substring(0, 20) + '...');
      
      // Step 4: Save to database
      console.log('\nStep 4: Saving to database...');
      const [result] = await sequelize.query(
        `INSERT INTO tbl_user_temp_address 
          (user_id, wallet_type, wallet_address, "privateKey", amount, status, "createdAt", "updatedAt")
        VALUES
          (:userId, :currency, :address, :privateKey, :amount, 'pending', NOW(), NOW())
        RETURNING temp_id, wallet_address, amount, wallet_type`,
        {
          replacements: {
            userId,
            currency,
            address: wallet.data.address,
            privateKey: wallet.data.privateKey,
            amount
          },
          type: QueryTypes.INSERT
        }
      );
      
      const tempId = result[0].temp_id;
      console.log('✅ Payment address saved to database');
      console.log('   Temp ID:', tempId);
      
      // Step 5: Display payment details
      console.log('\n' + '='.repeat(60));
      console.log('🎉 USDT-TRC20 PAYMENT ADDRESS CREATED SUCCESSFULLY!');
      console.log('='.repeat(60));
      console.log('\n📋 PAYMENT DETAILS:');
      console.log('   Payment Address:', wallet.data.address);
      console.log('   Currency:', currency);
      console.log('   Amount Expected:', amount, 'USDT');
      console.log('   Merchant:', 'Nomadly (Company ID: 3)');
      console.log('   Forwards To:', merchantWallet[0].wallet_address);
      console.log('   Reference ID:', tempId);
      console.log('   Network:', 'TRC20 (Tron)');
      console.log('\n💡 INSTRUCTIONS:');
      console.log('   1. Customer sends', amount, 'USDT-TRC20 to:', wallet.data.address);
      console.log('   2. System monitors address for payment');
      console.log('   3. Upon receipt, forwards to Nomadly wallet');
      console.log('   4. Merchant balance updated automatically');
      console.log('\n✅ Status: Active & Monitoring');
      console.log('='.repeat(60));
      
      return {
        success: true,
        paymentAddress: wallet.data.address,
        currency: currency,
        amount: amount,
        merchantWallet: merchantWallet[0].wallet_address,
        tempId: tempId,
        network: 'TRC20'
      };
      
    } catch (tatumError) {
      console.error('❌ Tatum API Error:', tatumError.message);
      throw tatumError;
    }
    
  } catch (e) {
    console.error('\n❌ ERROR:', e.message);
    throw e;
  } finally {
    await sequelize.close();
  }
}

// Execute
createUSDTPaymentAddress()
  .then(result => {
    console.log('\n✅ Success!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Failed:', err.message);
    process.exit(1);
  });
