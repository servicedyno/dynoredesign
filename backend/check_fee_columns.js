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
    logging: false
  }
);

async function checkFees() {
  try {
    // Check transaction table for fee columns
    const [txCols] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tbl_user_transaction'
      AND column_name LIKE '%fee%' OR column_name LIKE '%confirm%' OR column_name LIKE '%hash%' OR column_name LIKE '%callback%' OR column_name LIKE '%webhook%'
      ORDER BY column_name;
    `);
    
    console.log('📋 Fee/confirmation related columns in tbl_user_transaction:');
    txCols.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));
    
    // Check if tbl_fees exists
    const [feeTable] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tbl_fees'
      ORDER BY ordinal_position;
    `);
    
    if (feeTable.length > 0) {
      console.log('\n📋 tbl_fees columns:');
      feeTable.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));
    }
    
    // Check customer_transaction for fees
    const [custTx] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tbl_customer_transaction'
      ORDER BY ordinal_position;
    `);
    
    if (custTx.length > 0) {
      console.log('\n📋 tbl_customer_transaction columns:');
      custTx.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkFees();
