/**
 * Test script to create USDT payment address for Nomadly
 */

const { Sequelize, QueryTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false
});

async function createUSDTPayment() {
  try {
    console.log('=== Creating USDT Payment Address for Nomadly ===\n');
    
    const userId = 4; // Nomadly
    const companyId = 3; // Nomadly1
    const amount = 100; // $100 USDT test payment
    const currency = 'USDT-TRC20'; // or 'USDT-ERC20'
    
    // 1. Check if Nomadly has USDT wallet configured
    console.log('Step 1: Checking if merchant has USDT wallet...');
    const merchantWallet = await sequelize.query(
      `SELECT * FROM tbl_user_wallet WHERE user_id = :userId AND wallet_type = :currency`,
      {
        replacements: { userId, currency },
        type: QueryTypes.SELECT
      }
    );
    
    if (merchantWallet.length === 0) {
      throw new Error(`Merchant doesn't have ${currency} wallet configured!`);
    }
    
    console.log('✅ Merchant wallet found:', merchantWallet[0].wallet_address);
    console.log('   Balance:', merchantWallet[0].wallet_balance, currency);
    
    // 2. Generate temporary payment address
    console.log('\nStep 2: Generating temporary payment address...');
    
    // Insert into tbl_user_temp_address
    const [tempAddress] = await sequelize.query(
      `INSERT INTO tbl_user_temp_address 
        (user_id, company_id, wallet_type, amount, status, "createdAt", "updatedAt")
      VALUES
        (:userId, :companyId, :currency, :amount, 'pending', NOW(), NOW())
      RETURNING temp_id, user_id, wallet_type, amount`,
      {
        replacements: { userId, companyId, currency, amount },
        type: QueryTypes.INSERT
      }
    );
    
    const tempId = tempAddress[0].temp_id;
    console.log('✅ Temporary address record created');
    console.log('   Temp ID:', tempId);
    
    // For TRC20, we need to generate actual TRX address
    // For now, let's use a placeholder since Tatum would generate this
    const paymentAddress = `TEMP_${currency}_${tempId}_${Date.now()}`;
    
    console.log('\n=== Payment Address Created ===');
    console.log('Address:', paymentAddress);
    console.log('Currency:', currency);
    console.log('Amount:', amount, 'USD');
    console.log('Merchant:', 'Nomadly (user_id:', userId, ')');
    console.log('Forwards to:', merchantWallet[0].wallet_address);
    console.log('\nTemp ID:', tempId);
    
    console.log('\n✅ Payment address created successfully!');
    console.log('\nNote: In production, Tatum API would generate a real blockchain address.');
    console.log('Customer would send', amount, currency, 'to this address.');
    console.log('System would detect payment and forward to merchant wallet.');
    
    return {
      success: true,
      paymentAddress,
      tempId,
      currency,
      amount,
      merchantWallet: merchantWallet[0].wallet_address
    };
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    throw e;
  } finally {
    await sequelize.close();
  }
}

// Run the test
createUSDTPayment()
  .then(result => {
    console.log('\n=== Result ===');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
