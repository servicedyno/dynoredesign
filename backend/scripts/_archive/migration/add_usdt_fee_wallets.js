const { Sequelize, QueryTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false
});

async function addUSDTFeeWallets() {
  try {
    console.log('Adding USDT fee wallet monitoring entries...\n');
    
    // Add USDT-TRC20 fee wallet
    const usdtTrc20Result = await sequelize.query(`
      INSERT INTO tbl_admin_fee_wallet 
        (wallet_type, wallet_address, amount, "feeLimit", alert_duration, "createdAt", "updatedAt")
      VALUES 
        ('USDT-TRC20', '${process.env.USDT_TRC20}', 0, 50, 1, NOW(), NOW())
      ON CONFLICT DO NOTHING
      RETURNING *
    `, { type: QueryTypes.INSERT });
    
    if (usdtTrc20Result[1] > 0) {
      console.log('✅ Added USDT-TRC20 fee wallet:', process.env.USDT_TRC20);
    } else {
      console.log('⚠️  USDT-TRC20 fee wallet already exists');
    }
    
    // Add USDT-ERC20 fee wallet
    const usdtErc20Result = await sequelize.query(`
      INSERT INTO tbl_admin_fee_wallet 
        (wallet_type, wallet_address, amount, "feeLimit", alert_duration, "createdAt", "updatedAt")
      VALUES 
        ('USDT-ERC20', '${process.env.USDT_ERC20}', 0, 50, 1, NOW(), NOW())
      ON CONFLICT DO NOTHING
      RETURNING *
    `, { type: QueryTypes.INSERT });
    
    if (usdtErc20Result[1] > 0) {
      console.log('✅ Added USDT-ERC20 fee wallet:', process.env.USDT_ERC20);
    } else {
      console.log('⚠️  USDT-ERC20 fee wallet already exists');
    }
    
    // Verify
    console.log('\nVerifying fee wallets in database:');
    const allWallets = await sequelize.query(
      'SELECT fee_wallet_id, wallet_type, wallet_address, amount, "feeLimit", alert_duration FROM tbl_admin_fee_wallet ORDER BY wallet_type',
      { type: QueryTypes.SELECT }
    );
    console.log(JSON.stringify(allWallets, null, 2));
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

addUSDTFeeWallets();
