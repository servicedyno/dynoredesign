require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false
});

async function fix() {
  console.log('=== FIXING DATABASE STATE FOR NEW PAYMENT ===\n');
  
  const paymentId = '23772306-bfd4-4bc2-b3c9-a260d76554f2';
  const merchantTxId = '0x86af591717f6d5ccff1ca358a171044e4e7d777aa1d3761a75754a31bcfd85a8';
  const incomingTxId = '0xa36fe4007305b07c4bd591c02dd1d372858daf242b149b636413ffbca9f3b75c';
  const paymentAmount = 0.00357;
  const merchantAmount = 0.00243704;  // From first successful processing
  const adminFee = paymentAmount - merchantAmount;
  
  const t = await sequelize.transaction();
  
  try {
    // 1. Update user transaction
    await sequelize.query(`
      UPDATE tbl_user_transaction 
      SET status = 'successful', 
          base_amount = ${merchantAmount},
          transaction_reference = '${merchantTxId}'
      WHERE id = '${paymentId}'
    `, { transaction: t });
    console.log('1. Updated user_transaction to successful');
    
    // 2. Update merchant wallet
    await sequelize.query(`
      UPDATE tbl_user_wallet 
      SET amount = amount + ${merchantAmount}
      WHERE wallet_id = 370
    `, { transaction: t });
    console.log('2. Added', merchantAmount, 'ETH to merchant wallet');
    
    // 3. Create pool transaction
    await sequelize.query(`
      INSERT INTO tbl_merchant_pool_transaction 
      (temp_address_id, owner_user_id, company_id, payment_reference, wallet_type, 
       payment_amount, merchant_amount, admin_fee_amount, gas_funded, gas_used,
       incoming_tx_id, merchant_tx_id, status, created_at, updated_at)
      VALUES 
      (1, 28, 38, '${incomingTxId.substring(0, 40)}', 'ETH',
       ${paymentAmount}, ${merchantAmount}, ${adminFee}, 0, 0.0001,
       '${incomingTxId}', '${merchantTxId}', 'completed', NOW(), NOW())
    `, { transaction: t });
    console.log('3. Created pool transaction record');
    
    // 4. Update temp address to IN_USE
    await sequelize.query(`
      UPDATE tbl_merchant_temp_address 
      SET status = 'IN_USE',
          admin_fee_balance = ${adminFee},
          total_transactions = total_transactions + 1,
          received_amount = ${paymentAmount},
          last_merchant_payout = NOW(),
          last_used_at = NOW()
      WHERE temp_address_id = 1
    `, { transaction: t });
    console.log('4. Updated temp address #1 to IN_USE');
    
    // 5. Update admin wallet fee
    await sequelize.query(`
      UPDATE tbl_admin_wallet 
      SET fee = fee + ${adminFee}
      WHERE wallet_type = 'ETH'
    `, { transaction: t });
    console.log('5. Updated admin wallet fee');
    
    await t.commit();
    console.log('\n=== DATABASE FIXED SUCCESSFULLY ===');
    
    // Verify
    const [userTx] = await sequelize.query(`
      SELECT status, base_amount, transaction_reference FROM tbl_user_transaction WHERE id = '${paymentId}'
    `);
    console.log('\nUser Transaction:', userTx[0]?.status, '-', userTx[0]?.base_amount, 'ETH');
    
    const [wallet] = await sequelize.query(`SELECT amount FROM tbl_user_wallet WHERE wallet_id = 370`);
    console.log('Merchant Wallet Balance:', wallet[0]?.amount, 'ETH');
    
    const [addr] = await sequelize.query(`
      SELECT status, admin_fee_balance FROM tbl_merchant_temp_address WHERE temp_address_id = 1
    `);
    console.log('Temp Address #1:', addr[0]?.status, '- Admin Fee:', addr[0]?.admin_fee_balance, 'ETH');
    
  } catch (error) {
    await t.rollback();
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

fix();
