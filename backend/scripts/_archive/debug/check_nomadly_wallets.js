const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.USER_NAME,
  password: process.env.PASSWORD,
});

async function checkNomadlyWallets() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Check ALL wallet configurations for Nomadly
    const wallets = await client.query(`
      SELECT 
        user_address_id, 
        user_id, 
        company_id, 
        currency, 
        wallet_name,
        wallet_address,
        "createdAt"
      FROM tbl_user_addresses 
      WHERE user_id = 4
      ORDER BY company_id, currency
    `);
    
    console.log('=== ALL Wallet Addresses for User ID 4 (Nomadly) ===');
    console.log(`Total wallets found: ${wallets.rows.length}\n`);
    
    if (wallets.rows.length > 0) {
      // Group by company
      const byCompany = {};
      wallets.rows.forEach(w => {
        const companyId = w.company_id || 'NULL';
        if (!byCompany[companyId]) byCompany[companyId] = [];
        byCompany[companyId].push(w);
      });
      
      Object.keys(byCompany).forEach(companyId => {
        console.log(`\n📁 Company ID: ${companyId}`);
        byCompany[companyId].forEach(w => {
          console.log(`  - ${w.currency.padEnd(15)} | Wallet: ${w.wallet_name || 'N/A'} | Address: ${w.wallet_address.substring(0, 20)}...`);
        });
      });
    } else {
      console.log('⚠️  No wallet addresses found for user_id=4');
    }
    
    // Check company info
    console.log('\n=== Company Information ===');
    const companies = await client.query(`
      SELECT company_id, company_name, email 
      FROM tbl_company 
      WHERE user_id = 4
      ORDER BY company_id
    `);
    
    companies.rows.forEach(c => {
      console.log(`  - Company ID ${c.company_id}: ${c.company_name} (${c.email})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkNomadlyWallets();
