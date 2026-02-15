const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.USER_NAME,
  password: process.env.PASSWORD,
});

async function checkNomadly() {
  try {
    await client.connect();
    
    // Find Nomadly company
    const companies = await client.query(`
      SELECT * FROM tbl_company 
      WHERE company_name ILIKE '%nomad%' 
      ORDER BY company_id
    `);
    
    console.log('\n=== Companies with "Nomadly" ===');
    console.log(JSON.stringify(companies.rows, null, 2));
    
    if (companies.rows.length > 0) {
      const nomadly = companies.rows[0];
      
      // Get user info
      const user = await client.query(`
        SELECT user_id, name, email FROM tbl_user 
        WHERE user_id = $1
      `, [nomadly.user_id]);
      
      console.log('\n=== User Info ===');
      console.log(JSON.stringify(user.rows, null, 2));
      
      // Get wallet addresses for this company
      const wallets = await client.query(`
        SELECT * FROM tbl_user_addresses 
        WHERE user_id = $1 AND company_id = $2
      `, [nomadly.user_id, nomadly.company_id]);
      
      console.log('\n=== Wallet Addresses ===');
      console.log(JSON.stringify(wallets.rows, null, 2));
      
      // Get API keys for this company
      const apis = await client.query(`
        SELECT api_id, company_id, base_currency, api_name, withdrawal_whitelist 
        FROM tbl_api 
        WHERE company_id = $1
      `, [nomadly.company_id]);
      
      console.log('\n=== API Keys ===');
      console.log(JSON.stringify(apis.rows, null, 2));
      
      // Get payment links for this company
      const links = await client.query(`
        SELECT link_id, company_id, base_amount, base_currency, description, status, company_id
        FROM tbl_payment_link 
        WHERE user_id = $1
        LIMIT 5
      `, [nomadly.user_id]);
      
      console.log('\n=== Payment Links ===');
      console.log(JSON.stringify(links.rows, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkNomadly();
