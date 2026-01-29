require('dotenv').config();
const { Sequelize } = require('sequelize');
const redis = require('redis');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false
});

async function processPayment() {
  const address = '0x5c8282c96a89f002b908668bab6d5d30c68b610e';
  const paymentId = '3e507ecf-e653-4766-bb73-885666fcc314';
  const txId = '0x98d9b688c1fcbac6f6bb9b5b0dd48056ad8799a6c18ef34e5c27f4829bb16c08';
  const receivedAmount = 0.00357;  // From Redis
  const merchantAmount = 0.00340299;  // From Redis
  const adminFeeAmount = receivedAmount - merchantAmount;
  
  console.log('=== PROCESSING STUCK PAYMENT ===');
  console.log('Address:', address);
  console.log('Payment ID:', paymentId);
  console.log('TX ID:', txId);
  console.log('Received:', receivedAmount, 'ETH');
  console.log('Merchant amount:', merchantAmount, 'ETH');
  console.log('Admin fee:', adminFeeAmount, 'ETH');
  
  const t = await sequelize.transaction();
  
  try {
    // 1. Update user_transaction to successful
    const [userTxUpdated] = await sequelize.query(`
      UPDATE tbl_user_transaction 
      SET status = 'successful', 
          base_amount = ${merchantAmount},
          transaction_reference = '${txId}'
      WHERE id = '${paymentId}'
      RETURNING *
    `, { transaction: t });
    console.log('\n1. Updated user_transaction:', userTxUpdated.length > 0 ? 'SUCCESS' : 'NO ROWS');
    
    // 2. Update merchant wallet balance (wallet_id 370 for ETH)
    await sequelize.query(`
      UPDATE tbl_user_wallet 
      SET amount = amount + ${merchantAmount}
      WHERE wallet_id = 370
    `, { transaction: t });
    console.log('2. Updated merchant wallet');
    
    // 3. Create pool transaction record
    await sequelize.query(`
      INSERT INTO tbl_merchant_pool_transaction 
      (temp_address_id, owner_user_id, company_id, payment_reference, wallet_type, 
       payment_amount, merchant_amount, admin_fee_amount, gas_funded, gas_used,
       incoming_tx_id, merchant_tx_id, status, created_at, updated_at)
      VALUES 
      (2, 28, 38, '${txId}', 'ETH',
       ${receivedAmount}, ${merchantAmount}, ${adminFeeAmount}, 0, 0.0001,
       '${txId}', 'pending_transfer', 'pending_merchant_transfer', NOW(), NOW())
    `, { transaction: t });
    console.log('3. Created pool transaction record');
    
    // 4. Update temp address to IN_USE
    await sequelize.query(`
      UPDATE tbl_merchant_temp_address 
      SET status = 'IN_USE',
          admin_fee_balance = ${adminFeeAmount},
          total_transactions = total_transactions + 1,
          received_amount = ${receivedAmount},
          last_used_at = NOW()
      WHERE temp_address_id = 2
    `, { transaction: t });
    console.log('4. Updated temp address to IN_USE');
    
    // 5. Update admin wallet fee
    await sequelize.query(`
      UPDATE tbl_admin_wallet 
      SET fee = fee + ${adminFeeAmount}
      WHERE wallet_type = 'ETH'
    `, { transaction: t });
    console.log('5. Updated admin wallet fee');
    
    await t.commit();
    console.log('\n=== PAYMENT PROCESSED SUCCESSFULLY ===');
    
    // Verify
    const [verify] = await sequelize.query(`
      SELECT transaction_id, id, status, base_amount, transaction_reference 
      FROM tbl_user_transaction WHERE id = '${paymentId}'
    `);
    console.log('\nVerification:', JSON.stringify(verify[0], null, 2));
    
    console.log('\n⚠️  NOTE: Merchant transfer to their wallet still needs to happen!');
    console.log('The funds are currently in the temp address and need to be swept.');
    
  } catch (error) {
    await t.rollback();
    console.error('ERROR:', error);
  }
  
  process.exit(0);
}

processPayment();
