const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  host: process.env.HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.USER_NAME,
  password: process.env.PASSWORD,
});

async function runMigration() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    const migrationSQL = fs.readFileSync('./database/migrations/add_company_id_to_user_transactions.sql', 'utf8');
    
    console.log('Running migration for tbl_user_transaction...');
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the column was added
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'tbl_user_transaction' 
      AND column_name = 'company_id'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Verified: company_id column exists in tbl_user_transaction');
      console.log('Column details:', result.rows[0]);
    }
    
    // Check how many records were populated
    const populatedCount = await client.query(`
      SELECT COUNT(*) as count 
      FROM tbl_user_transaction 
      WHERE company_id IS NOT NULL
    `);
    
    console.log(`✅ Populated ${populatedCount.rows[0].count} transaction records with company_id`);
    
    // Check indexes
    const indexResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'tbl_user_transaction' 
      AND indexname LIKE '%company%'
    `);
    
    console.log(`✅ Indexes created: ${indexResult.rows.length}`);
    indexResult.rows.forEach(idx => {
      console.log(`  - ${idx.indexname}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
