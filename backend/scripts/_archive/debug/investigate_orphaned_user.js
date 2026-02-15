const { Client } = require('pg');
require('dotenv').config();

async function investigateOrphanedUser() {
  const client = new Client({
    host: process.env.HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.USER_NAME,
    password: process.env.PASSWORD,
  });

  try {
    await client.connect();
    console.log('='.repeat(80));
    console.log('ORPHANED USER INVESTIGATION - User 24');
    console.log('='.repeat(80));
    console.log();

    // Get user details
    const user = await client.query(`
      SELECT user_id, name, email, "createdAt"
      FROM tbl_user
      WHERE user_id = 24
    `);

    if (user.rows.length === 0) {
      console.log('❌ User 24 does not exist in tbl_user');
      console.log('   This means wallets are orphaned (user was deleted)');
      console.log();
    } else {
      console.log('User Details:');
      const u = user.rows[0];
      console.log(`  ID: ${u.user_id}`);
      console.log(`  Name: ${u.name}`);
      console.log(`  Email: ${u.email}`);
      console.log(`  Created: ${new Date(u.createdAt).toLocaleString()}`);
      console.log();
    }

    // Get wallet details
    const wallets = await client.query(`
      SELECT 
        user_address_id,
        currency,
        wallet_name,
        wallet_address,
        company_id,
        "createdAt"
      FROM tbl_user_addresses
      WHERE user_id = 24
      ORDER BY currency
    `);

    console.log(`Wallets for User 24: ${wallets.rows.length}`);
    console.log();
    wallets.rows.forEach(w => {
      const date = new Date(w.createdAt).toLocaleDateString();
      console.log(`  ${w.currency}:`);
      console.log(`    Name: ${w.wallet_name || 'N/A'}`);
      console.log(`    Address: ${w.wallet_address}`);
      console.log(`    Company ID: ${w.company_id}`);
      console.log(`    Created: ${date}`);
      console.log();
    });

    // Check if there are any transactions using these wallets
    const transactions = await client.query(`
      SELECT COUNT(*) as count
      FROM tbl_user_transaction
      WHERE user_id = 24
    `);

    console.log(`Transactions for User 24: ${transactions.rows[0].count}`);
    console.log();

    // Recommendation
    console.log('RECOMMENDATION:');
    console.log('─'.repeat(80));
    console.log();

    if (user.rows.length === 0) {
      console.log('❌ User deleted but wallets remain - ORPHANED DATA');
      console.log();
      console.log('Options:');
      console.log('  1. Delete orphaned wallets (if no transactions)');
      console.log('  2. Create placeholder company for user 24');
      console.log('  3. Reassign wallets to admin user');
      console.log();
      console.log('SQL to delete orphaned wallets:');
      console.log('  DELETE FROM tbl_user_addresses WHERE user_id = 24;');
    } else {
      console.log('✅ User exists but has no company');
      console.log();
      console.log('Action: Create default company for User 24');
      console.log();
      console.log('SQL to create default company:');
      console.log(`  INSERT INTO tbl_company (company_name, email, user_id, "createdAt", "updatedAt")`);
      console.log(`  VALUES ('${user.rows[0].name} Default', '${user.rows[0].email}', 24, NOW(), NOW())`);
      console.log(`  RETURNING company_id;`);
      console.log();
      console.log('Then no migration needed as wallets already have company_id = 1');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

investigateOrphanedUser();
