const { Client } = require('pg');
require('dotenv').config();

async function verifySubscriptions() {
  const client = new Client({
    host: process.env.HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.USER_NAME,
    password: process.env.PASSWORD,
  });

  try {
    await client.connect();
    
    // Get the 5 most recent temp addresses with subscriptions
    const result = await client.query(`
      SELECT 
        temp_id,
        wallet_address,
        subscription_id,
        status,
        "createdAt"
      FROM tbl_user_temp_address
      WHERE subscription_id IS NOT NULL
      ORDER BY "createdAt" DESC
      LIMIT 5
    `);
    
    console.log('='.repeat(80));
    console.log('RECENT TATUM SUBSCRIPTIONS');
    console.log('='.repeat(80));
    console.log();
    console.log(`Total found: ${result.rows.length}`);
    console.log();
    
    result.rows.forEach((row, i) => {
      const date = new Date(row.createdAt).toLocaleString();
      console.log(`${i + 1}. Address: ${row.wallet_address}`);
      console.log(`   Subscription ID: ${row.subscription_id}`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Created: ${date}`);
      console.log();
    });
    
    // Check if any are local (fallback) subscriptions
    const localSubs = result.rows.filter(r => r.subscription_id.startsWith('local-'));
    if (localSubs.length > 0) {
      console.log(`⚠️  Found ${localSubs.length} local fallback subscriptions`);
    } else {
      console.log(`✅ All subscriptions are real Tatum subscriptions`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

verifySubscriptions();
