const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.USER_NAME,
  password: process.env.PASSWORD,
});

async function verifySchema() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Check if tbl_invoice exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tbl_invoice'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ tbl_invoice table does NOT exist');
      console.log('Creating tbl_invoice table...');
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS tbl_invoice (
          invoice_id SERIAL PRIMARY KEY,
          invoice_number VARCHAR(50) UNIQUE NOT NULL,
          transaction_id INTEGER,
          company_id INTEGER REFERENCES tbl_company(company_id) ON DELETE SET NULL,
          provider_name VARCHAR(200),
          provider_address TEXT,
          provider_vat_id VARCHAR(50),
          customer_name VARCHAR(200),
          customer_address TEXT,
          customer_tax_id VARCHAR(50),
          description TEXT,
          unit_price DECIMAL(15, 2),
          quantity INTEGER DEFAULT 1,
          vat_rate DECIMAL(5, 2) DEFAULT 0,
          vat_amount DECIMAL(15, 2) DEFAULT 0,
          fixed_fee DECIMAL(15, 2) DEFAULT 0,
          transaction_fee_percent DECIMAL(5, 2) DEFAULT 0,
          blockchain_buffer_percent DECIMAL(5, 2) DEFAULT 0,
          total_usd DECIMAL(15, 2),
          total_crypto DECIMAL(15, 8),
          crypto_currency VARCHAR(10),
          payment_terms TEXT,
          invoice_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      console.log('✅ tbl_invoice table created');
    } else {
      console.log('✅ tbl_invoice table exists');
    }
    
    // Get column count
    const columns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tbl_invoice'
      ORDER BY ordinal_position
    `);
    
    console.log(`✅ tbl_invoice has ${columns.rows.length} columns:`);
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

verifySchema();
