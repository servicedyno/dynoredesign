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

async function addMissingColumns() {
  try {
    await sequelize.authenticate();
    console.log('Connected to PostgreSQL');

    // Add wallet_reminder_sent column to tbl_user if not exists
    await sequelize.query(`
      ALTER TABLE tbl_user 
      ADD COLUMN IF NOT EXISTS wallet_reminder_sent BOOLEAN DEFAULT false;
    `);
    console.log('✅ Added wallet_reminder_sent column to tbl_user');

    // Check for any other potentially missing columns
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tbl_user'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Current tbl_user columns:');
    results.forEach(r => console.log(`  - ${r.column_name}`));

    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

addMissingColumns();
