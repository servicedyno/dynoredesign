const { Sequelize, QueryTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false
});

async function removeUSDTFeeWallets() {
  try {
    console.log('Removing USDT fee wallet entries...\n');
    
    // Show current state
    const before = await sequelize.query(
      'SELECT fee_wallet_id, wallet_type, wallet_address FROM tbl_admin_fee_wallet ORDER BY wallet_type',
      { type: QueryTypes.SELECT }
    );
    console.log('Current fee wallets:');
    console.log(JSON.stringify(before, null, 2));
    
    // Delete USDT wallets
    const deleteResult = await sequelize.query(
      `DELETE FROM tbl_admin_fee_wallet WHERE wallet_type IN ('USDT-TRC20', 'USDT-ERC20')`,
      { type: QueryTypes.DELETE }
    );
    
    console.log('\n✅ Deleted USDT fee wallet entries');
    
    // Verify
    console.log('\nRemaining fee wallets:');
    const after = await sequelize.query(
      'SELECT fee_wallet_id, wallet_type, wallet_address FROM tbl_admin_fee_wallet ORDER BY wallet_type',
      { type: QueryTypes.SELECT }
    );
    console.log(JSON.stringify(after, null, 2));
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

removeUSDTFeeWallets();
