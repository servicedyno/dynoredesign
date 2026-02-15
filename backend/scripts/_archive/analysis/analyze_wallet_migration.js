const { Client } = require('pg');
require('dotenv').config();

async function analyzeWalletMigration() {
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
    console.log('WALLET DATA MIGRATION ANALYSIS');
    console.log('='.repeat(80));
    console.log();

    // Check wallets without company_id
    const walletsWithoutCompany = await client.query(`
      SELECT 
        user_address_id,
        user_id,
        company_id,
        currency,
        wallet_name,
        wallet_address
      FROM tbl_user_addresses
      WHERE company_id IS NULL
      ORDER BY user_id, currency
    `);

    console.log('1. Wallets WITHOUT company_id:');
    console.log(`   Total: ${walletsWithoutCompany.rows.length}`);
    console.log();

    if (walletsWithoutCompany.rows.length > 0) {
      console.log('   Breakdown by user:');
      const byUser = {};
      walletsWithoutCompany.rows.forEach(w => {
        if (!byUser[w.user_id]) byUser[w.user_id] = [];
        byUser[w.user_id].push(w);
      });

      Object.keys(byUser).forEach(userId => {
        console.log(`   User ${userId}: ${byUser[userId].length} wallets`);
        byUser[userId].forEach(w => {
          console.log(`     - ${w.currency}: ${w.wallet_name || 'No name'}`);
        });
      });
      console.log();
    }

    // Check wallets WITH company_id
    const walletsWithCompany = await client.query(`
      SELECT 
        user_id,
        company_id,
        COUNT(*) as wallet_count
      FROM tbl_user_addresses
      WHERE company_id IS NOT NULL
      GROUP BY user_id, company_id
      ORDER BY user_id, company_id
    `);

    console.log('2. Wallets WITH company_id:');
    console.log(`   Total groups: ${walletsWithCompany.rows.length}`);
    console.log();
    walletsWithCompany.rows.forEach(row => {
      console.log(`   User ${row.user_id}, Company ${row.company_id}: ${row.wallet_count} wallets`);
    });
    console.log();

    // Get all companies and their first company per user
    const companies = await client.query(`
      SELECT 
        company_id,
        company_name,
        user_id,
        email,
        "createdAt"
      FROM tbl_company
      ORDER BY user_id, company_id
    `);

    console.log('3. Companies in Database:');
    console.log(`   Total: ${companies.rows.length}`);
    console.log();

    const companiesByUser = {};
    companies.rows.forEach(c => {
      if (!companiesByUser[c.user_id]) companiesByUser[c.user_id] = [];
      companiesByUser[c.user_id].push(c);
    });

    Object.keys(companiesByUser).forEach(userId => {
      const userCompanies = companiesByUser[userId];
      console.log(`   User ${userId}:`);
      userCompanies.forEach((c, idx) => {
        const first = idx === 0 ? ' (FIRST - would be used for migration)' : '';
        const date = new Date(c.createdAt).toLocaleDateString();
        console.log(`     ${c.company_id}. ${c.company_name} - ${c.email} (${date})${first}`);
      });
    });
    console.log();

    // Migration Strategy
    console.log('4. MIGRATION STRATEGY:');
    console.log('─'.repeat(80));
    console.log();

    if (walletsWithoutCompany.rows.length === 0) {
      console.log('✅ NO MIGRATION NEEDED - All wallets already have company_id assigned');
    } else {
      console.log('⚠️  MIGRATION REQUIRED for', walletsWithoutCompany.rows.length, 'wallets');
      console.log();
      console.log('Proposed Migration:');
      console.log();

      const byUser = {};
      walletsWithoutCompany.rows.forEach(w => {
        if (!byUser[w.user_id]) byUser[w.user_id] = [];
        byUser[w.user_id].push(w);
      });

      Object.keys(byUser).forEach(userId => {
        const userCompanies = companiesByUser[userId];
        if (!userCompanies || userCompanies.length === 0) {
          console.log(`   ❌ User ${userId}: NO COMPANIES FOUND - Cannot migrate!`);
          console.log(`      Affected wallets: ${byUser[userId].length}`);
        } else {
          const firstCompany = userCompanies[0];
          console.log(`   User ${userId} → Company ${firstCompany.company_id} (${firstCompany.company_name})`);
          console.log(`      Wallets to migrate: ${byUser[userId].length}`);
          byUser[userId].forEach(w => {
            console.log(`        - ${w.currency} (wallet_id: ${w.user_address_id})`);
          });
        }
        console.log();
      });

      console.log('SQL Migration Script:');
      console.log('─'.repeat(80));
      console.log();

      Object.keys(byUser).forEach(userId => {
        const userCompanies = companiesByUser[userId];
        if (userCompanies && userCompanies.length > 0) {
          const firstCompany = userCompanies[0];
          console.log(`-- Migrate User ${userId} wallets to Company ${firstCompany.company_id}`);
          console.log(`UPDATE tbl_user_addresses`);
          console.log(`SET company_id = ${firstCompany.company_id}`);
          console.log(`WHERE user_id = ${userId} AND company_id IS NULL;`);
          console.log();
        }
      });
    }

    // Check for orphaned data
    console.log('5. DATA INTEGRITY CHECKS:');
    console.log('─'.repeat(80));
    console.log();

    // Users with wallets but no companies
    const usersWithWalletsNoCompany = await client.query(`
      SELECT DISTINCT ua.user_id
      FROM tbl_user_addresses ua
      LEFT JOIN tbl_company c ON ua.user_id = c.user_id
      WHERE c.company_id IS NULL
    `);

    if (usersWithWalletsNoCompany.rows.length > 0) {
      console.log(`⚠️  Found ${usersWithWalletsNoCompany.rows.length} users with wallets but NO companies:`);
      usersWithWalletsNoCompany.rows.forEach(row => {
        console.log(`   - User ${row.user_id}`);
      });
      console.log('   Action: Create default company or remove orphaned wallets');
      console.log();
    } else {
      console.log('✅ All users with wallets have at least one company');
      console.log();
    }

    // Impact Analysis
    console.log('6. IMPACT ANALYSIS:');
    console.log('─'.repeat(80));
    console.log();

    const totalWallets = await client.query(`SELECT COUNT(*) as count FROM tbl_user_addresses`);
    const walletsWithCompanyCount = await client.query(`SELECT COUNT(*) as count FROM tbl_user_addresses WHERE company_id IS NOT NULL`);
    
    const total = parseInt(totalWallets.rows[0].count);
    const withCompany = parseInt(walletsWithCompanyCount.rows[0].count);
    const withoutCompany = total - withCompany;
    const percentage = total > 0 ? ((withoutCompany / total) * 100).toFixed(2) : 0;

    console.log(`Total Wallets: ${total}`);
    console.log(`With company_id: ${withCompany} (${(100 - percentage).toFixed(2)}%)`);
    console.log(`Without company_id: ${withoutCompany} (${percentage}%)`);
    console.log();

    if (withoutCompany > 0) {
      console.log('⚠️  Impact: Payment creation will FAIL for these wallets until migrated');
      console.log('   Affected Features:');
      console.log('   - Crypto payment creation');
      console.log('   - Wallet address validation');
      console.log('   - Company-specific transaction filtering');
    } else {
      console.log('✅ No impact - all wallets properly configured');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

analyzeWalletMigration();
