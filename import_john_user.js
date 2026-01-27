const { Client } = require('pg');

const oldDB = new Client({
  host: 'yamanote.proxy.rlwy.net',
  port: 42097,
  user: 'postgres',
  password: 'oMHQMHfnrFyWgkhYaiXbhjDEMZSWOapc',
  database: 'railway'
});

const newDB = new Client({
  host: 'shortline.proxy.rlwy.net',
  port: 44579,
  user: 'postgres',
  password: 'JqdkVTjQujJaEOyUJJHmWMYEWgtAXTfO',
  database: 'db_bozzwallet'
});

async function importUserData() {
  console.log('================================================================================');
  console.log('  IMPORTING USER: john@dyno.pt');
  console.log('  From: yamanote/railway → To: shortline/db_bozzwallet');
  console.log('================================================================================\n');

  try {
    await oldDB.connect();
    console.log('✅ Connected to OLD database (yamanote/railway)\n');
    
    await newDB.connect();
    console.log('✅ Connected to NEW database (shortline/db_bozzwallet)\n');

    // Step 1: Delete existing test user from new database
    console.log('🗑️  Step 1: Deleting test user from new database...');
    await newDB.query('DELETE FROM tbl_user_wallet WHERE user_id = 24');
    await newDB.query('DELETE FROM tbl_company WHERE user_id = 24');
    await newDB.query('DELETE FROM tbl_user WHERE user_id = 24');
    console.log('✅ Test user deleted\n');

    // Step 2: Get user from old database
    console.log('📋 Step 2: Fetching user data from OLD database...');
    const userRes = await oldDB.query(`
      SELECT * FROM tbl_user WHERE email = 'john@dyno.pt'
    `);

    if (userRes.rows.length === 0) {
      console.log('❌ User john@dyno.pt not found in old database');
      return;
    }

    const user = userRes.rows[0];
    console.log('✅ Found user:');
    console.log(`   User ID: ${user.user_id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}\n`);

    // Step 3: Import user
    console.log('📥 Step 3: Importing user...');
    const userColumns = Object.keys(user).filter(k => k !== 'user_id');
    const userValues = userColumns.map(k => user[k]);
    const userPlaceholders = userValues.map((_, i) => `$${i + 1}`).join(', ');
    
    const newUserRes = await newDB.query(`
      INSERT INTO tbl_user (${userColumns.join(', ')})
      VALUES (${userPlaceholders})
      RETURNING user_id
    `, userValues);
    
    const newUserId = newUserRes.rows[0].user_id;
    console.log(`✅ User imported with new ID: ${newUserId}\n`);

    // Step 4: Get companies from old database
    console.log('📋 Step 4: Fetching companies...');
    const companiesRes = await oldDB.query(`
      SELECT * FROM tbl_company WHERE user_id = $1
    `, [user.user_id]);
    
    console.log(`✅ Found ${companiesRes.rows.length} companies\n`);

    const companyIdMap = {}; // old_id -> new_id

    // Import companies
    for (const company of companiesRes.rows) {
      console.log(`📥 Importing company: ${company.company_name}`);
      const oldCompanyId = company.company_id;
      const companyColumns = Object.keys(company).filter(k => k !== 'company_id' && k !== 'user_id');
      const companyValues = [newUserId, ...companyColumns.map(k => company[k])];
      const companyPlaceholders = companyValues.map((_, i) => `$${i + 1}`).join(', ');
      
      const newCompanyRes = await newDB.query(`
        INSERT INTO tbl_company (user_id, ${companyColumns.join(', ')})
        VALUES (${companyPlaceholders})
        RETURNING company_id
      `, companyValues);
      
      companyIdMap[oldCompanyId] = newCompanyRes.rows[0].company_id;
      console.log(`   ✅ Company imported: ${oldCompanyId} → ${companyIdMap[oldCompanyId]}`);
    }
    console.log('');

    // Step 5: Get wallets
    console.log('📋 Step 5: Fetching wallets...');
    const walletsRes = await oldDB.query(`
      SELECT * FROM tbl_user_wallet WHERE user_id = $1
    `, [user.user_id]);
    
    console.log(`✅ Found ${walletsRes.rows.length} wallets\n`);

    // Import wallets
    for (const wallet of walletsRes.rows) {
      console.log(`📥 Importing wallet: ${wallet.wallet_type}`);
      const walletColumns = Object.keys(wallet).filter(k => k !== 'wallet_id' && k !== 'user_id');
      const walletValues = [newUserId, ...walletColumns.map(k => wallet[k])];
      const walletPlaceholders = walletValues.map((_, i) => `$${i + 1}`).join(', ');
      
      await newDB.query(`
        INSERT INTO tbl_user_wallet (user_id, ${walletColumns.join(', ')})
        VALUES (${walletPlaceholders})
      `, walletValues);
      
      console.log(`   ✅ ${wallet.wallet_type} wallet imported (Balance: ${wallet.amount})`);
    }
    console.log('');

    // Step 6: Get temp addresses
    console.log('📋 Step 6: Fetching temp addresses...');
    const tempAddressRes = await oldDB.query(`
      SELECT * FROM tbl_user_temp_address WHERE user_id = $1
    `, [user.user_id]);
    
    console.log(`✅ Found ${tempAddressRes.rows.length} temp addresses\n`);

    // Import temp addresses
    let imported = 0;
    for (const addr of tempAddressRes.rows) {
      try {
        const addrColumns = Object.keys(addr).filter(k => k !== 'temp_id' && k !== 'user_id');
        const addrValues = [newUserId, ...addrColumns.map(k => addr[k])];
        const addrPlaceholders = addrValues.map((_, i) => `$${i + 1}`).join(', ');
        
        await newDB.query(`
          INSERT INTO tbl_user_temp_address (user_id, ${addrColumns.join(', ')})
          VALUES (${addrPlaceholders})
        `, addrValues);
        imported++;
      } catch (err) {
        // Skip if already exists
      }
    }
    console.log(`📥 Imported ${imported} temp addresses\n`);

    // Step 7: Summary
    console.log('================================================================================');
    console.log('  IMPORT COMPLETE ✅');
    console.log('================================================================================\n');
    console.log('Imported Data:');
    console.log(`  ✅ User: john@dyno.pt (ID: ${user.user_id} → ${newUserId})`);
    console.log(`  ✅ Companies: ${companiesRes.rows.length}`);
    console.log(`  ✅ Wallets: ${walletsRes.rows.length}`);
    console.log(`  ✅ Temp Addresses: ${imported}`);
    console.log('\nYou can now login with:');
    console.log('  Email: john@dyno.pt');
    console.log('  Password: Katiekendra123@');
    console.log('');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await oldDB.end();
    await newDB.end();
  }
}

importUserData().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
