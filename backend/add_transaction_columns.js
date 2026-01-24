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

async function addColumns() {
  try {
    await sequelize.authenticate();
    console.log('Connected to PostgreSQL');

    // Add missing columns to tbl_user_transaction
    const columns = [
      { name: 'crypto_amount', type: 'DOUBLE PRECISION', default: '0' },
      { name: 'crypto_currency', type: 'VARCHAR(20)', default: null },
      { name: 'usd_value', type: 'DOUBLE PRECISION', default: '0' },
      { name: 'transaction_fee', type: 'DOUBLE PRECISION', default: '0' },
      { name: 'fixed_fee', type: 'DOUBLE PRECISION', default: '0' },
      { name: 'blockchain_buffer_fee', type: 'DOUBLE PRECISION', default: '0' },
      { name: 'confirmations', type: 'INTEGER', default: '0' },
      { name: 'required_confirmations', type: 'INTEGER', default: '6' },
      { name: 'incoming_tx_hash', type: 'VARCHAR(255)', default: null },
      { name: 'outgoing_tx_hash', type: 'VARCHAR(255)', default: null },
      { name: 'webhook_response', type: 'TEXT', default: null },
    ];

    for (const col of columns) {
      try {
        const defaultClause = col.default !== null ? `DEFAULT ${col.default}` : '';
        await sequelize.query(`
          ALTER TABLE tbl_user_transaction 
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} ${defaultClause};
        `);
        console.log(`✅ Added column: ${col.name}`);
      } catch (e) {
        console.log(`⏭️ Column ${col.name} may already exist or error: ${e.message}`);
      }
    }

    // Also add callback_url and webhook_url if not exists
    await sequelize.query(`
      ALTER TABLE tbl_user_transaction 
      ADD COLUMN IF NOT EXISTS callback_url VARCHAR(500);
    `);
    console.log('✅ Added column: callback_url');
    
    await sequelize.query(`
      ALTER TABLE tbl_user_transaction 
      ADD COLUMN IF NOT EXISTS webhook_url VARCHAR(500);
    `);
    console.log('✅ Added column: webhook_url');

    // Verify columns
    const [results] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tbl_user_transaction'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Updated tbl_user_transaction columns:');
    results.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));

    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

addColumns();
