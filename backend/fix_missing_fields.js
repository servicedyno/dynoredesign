const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.USER_NAME,
  process.env.PASSWORD,
  {
    host: process.env.HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: console.log
  }
);

async function fixMissingFields() {
  try {
    await sequelize.authenticate();
    console.log('Connected to PostgreSQL');

    // 1. Add fee_payer to tbl_payment_link
    await sequelize.query(`
      ALTER TABLE tbl_payment_link 
      ADD COLUMN IF NOT EXISTS fee_payer VARCHAR(20) DEFAULT 'customer';
    `);
    console.log('✅ Added fee_payer to tbl_payment_link');

    // 2. Add permissions to tbl_api (JSON array)
    await sequelize.query(`
      ALTER TABLE tbl_api 
      ADD COLUMN IF NOT EXISTS permissions TEXT DEFAULT '["payments","transactions","webhooks","wallets"]';
    `);
    console.log('✅ Added permissions to tbl_api');

    console.log('\n✅ All missing fields added!');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

fixMissingFields();
