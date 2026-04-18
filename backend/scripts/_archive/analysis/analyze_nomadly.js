const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.USER_NAME,
  password: process.env.PASSWORD,
});

async function analyzeNomadly() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Find Nomadly company with company_id=3
    const company = await client.query(`
      SELECT * FROM tbl_company 
      WHERE company_id = 3
    `);
    
    console.log('=== Company Information (company_id=3) ===');
    if (company.rows.length > 0) {
      console.log(JSON.stringify(company.rows[0], null, 2));
    } else {
      console.log('⚠️  No company found with company_id=3');
    }
    
    // Get user info for adm_id=4
    const user = await client.query(`
      SELECT user_id, name, email FROM tbl_user 
      WHERE user_id = 4
    `);
    
    console.log('\n=== User Information (user_id=4) ===');
    if (user.rows.length > 0) {
      console.log(JSON.stringify(user.rows, null, 2));
    } else {
      console.log('⚠️  No user found with user_id=4');
    }
    
    // Get wallet addresses for this user and company
    const wallets = await client.query(`
      SELECT user_address_id, user_id, company_id, currency, wallet_name
      FROM tbl_user_addresses 
      WHERE user_id = 4 AND company_id = 3
      ORDER BY currency
    `);
    
    console.log('\n=== Wallet Addresses (user_id=4, company_id=3) ===');
    console.log(`Found ${wallets.rows.length} wallet addresses`);
    if (wallets.rows.length > 0) {
      wallets.rows.forEach(w => {
        console.log(`  - ${w.currency}: wallet_name="${w.wallet_name}"`);
      });
    } else {
      console.log('⚠️  No wallet addresses configured for this user/company combination');
    }
    
    // Get API keys for this company
    const apis = await client.query(`
      SELECT api_id, company_id, base_currency, api_name, "createdAt"
      FROM tbl_api 
      WHERE company_id = 3
    `);
    
    console.log('\n=== API Keys (company_id=3) ===');
    console.log(`Found ${apis.rows.length} API keys`);
    if (apis.rows.length > 0) {
      console.log(JSON.stringify(apis.rows, null, 2));
    } else {
      console.log('⚠️  No API keys found for company_id=3');
    }
    
    // Get transactions for this user/company
    const transactions = await client.query(`
      SELECT id as transaction_id, base_amount, base_currency, status, payment_mode, company_id, "createdAt" as created_at
      FROM tbl_user_transaction 
      WHERE user_id = 4 AND company_id = 3
      ORDER BY "createdAt" DESC
      LIMIT 5
    `);
    
    console.log('\n=== Recent Transactions (user_id=4, company_id=3) ===');
    console.log(`Found ${transactions.rows.length} transactions`);
    if (transactions.rows.length > 0) {
      transactions.rows.forEach(t => {
        console.log(`  - ${t.transaction_id}: ${t.base_amount} ${t.base_currency} (${t.status}) - ${t.payment_mode}`);
      });
    } else {
      console.log('⚠️  No transactions found');
    }
    
    // Check admin wallets for BTC (required for crypto payments)
    const adminWallets = await client.query(`
      SELECT wallet_id, wallet_type, currency_type, last_index
      FROM tbl_admin_wallet 
      WHERE currency_type = 'CRYPTO'
      ORDER BY wallet_type
    `);
    
    console.log('\n=== Admin Wallets (Crypto) ===');
    console.log(`Found ${adminWallets.rows.length} admin crypto wallets`);
    if (adminWallets.rows.length > 0) {
      adminWallets.rows.forEach(w => {
        console.log(`  - ${w.wallet_type}: last_index=${w.last_index}`);
      });
    } else {
      console.log('⚠️  No admin crypto wallets found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

analyzeNomadly();
