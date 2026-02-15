const { Client } = require('pg');

// Source database (yamanote)
const sourceConfig = {
  host: process.env.SOURCE_DB_HOST,
  port: parseInt(process.env.SOURCE_DB_PORT || '5432', 10),
  database: process.env.SOURCE_DB_NAME || 'db_bozzwallet',
  user: process.env.SOURCE_DB_USER || 'postgres',
  password: process.env.SOURCE_DB_PASSWORD,
  connectionTimeoutMillis: 30000
};

// Destination database (shortline)
const destConfig = {
  host: process.env.DEST_DB_HOST,
  port: parseInt(process.env.DEST_DB_PORT || '5432', 10),
  database: process.env.DEST_DB_NAME || 'db_bozzwallet',
  user: process.env.DEST_DB_USER || 'postgres',
  password: process.env.DEST_DB_PASSWORD,
  connectionTimeoutMillis: 30000
};

async function migrateUser() {
  const sourceClient = new Client(sourceConfig);
  const destClient = new Client(destConfig);
  
  try {
    console.log('Connecting to databases...');
    await sourceClient.connect();
    console.log('✅ Connected to source database (yamanote)');
    await destClient.connect();
    console.log('✅ Connected to destination database (shortline)');
    
    // ==========================================
    // STEP 1: Get source user data
    // ==========================================
    console.log('\n=== STEP 1: Fetching source user data ===');
    
    const sourceUser = await sourceClient.query(
      "SELECT * FROM tbl_user WHERE email = 'john@dyno.pt'"
    );
    
    if (sourceUser.rows.length === 0) {
      throw new Error('User john@dyno.pt not found in source database');
    }
    
    const user = sourceUser.rows[0];
    const sourceUserId = user.user_id;
    console.log(`Source user_id: ${sourceUserId}`);
    console.log(`User: ${user.name} (${user.email})`);
    
    // Get all related data from source
    const sourceCompanies = await sourceClient.query(
      'SELECT * FROM tbl_company WHERE user_id = $1', [sourceUserId]
    );
    console.log(`Found ${sourceCompanies.rows.length} companies`);
    
    const sourceWallets = await sourceClient.query(
      'SELECT * FROM tbl_user_wallet WHERE user_id = $1', [sourceUserId]
    );
    console.log(`Found ${sourceWallets.rows.length} wallets`);
    
    const sourceAddresses = await sourceClient.query(
      'SELECT * FROM tbl_user_addresses WHERE user_id = $1', [sourceUserId]
    );
    console.log(`Found ${sourceAddresses.rows.length} wallet addresses`);
    
    const sourceApis = await sourceClient.query(
      'SELECT * FROM tbl_api WHERE user_id = $1', [sourceUserId]
    );
    console.log(`Found ${sourceApis.rows.length} API keys`);
    
    const sourceNotifications = await sourceClient.query(
      'SELECT * FROM tbl_notification WHERE user_id = $1', [sourceUserId]
    );
    console.log(`Found ${sourceNotifications.rows.length} notifications`);
    
    const sourceNotifPrefs = await sourceClient.query(
      'SELECT * FROM tbl_notification_preferences WHERE user_id = $1', [sourceUserId]
    );
    console.log(`Found ${sourceNotifPrefs.rows.length} notification preferences`);
    
    // ==========================================
    // STEP 2: Delete existing user in destination
    // ==========================================
    console.log('\n=== STEP 2: Deleting existing user in destination ===');
    
    const destUser = await destClient.query(
      "SELECT user_id FROM tbl_user WHERE email = 'john@dyno.pt'"
    );
    
    if (destUser.rows.length > 0) {
      const destUserId = destUser.rows[0].user_id;
      console.log(`Found existing user with user_id: ${destUserId}`);
      
      // Get company IDs for this user to delete related data
      const destCompanies = await destClient.query(
        'SELECT company_id FROM tbl_company WHERE user_id = $1', [destUserId]
      );
      const companyIds = destCompanies.rows.map(c => c.company_id);
      
      // Delete in correct order (foreign key constraints)
      if (companyIds.length > 0) {
        console.log(`Deleting data for companies: ${companyIds.join(', ')}`);
        
        // Delete payment links
        await destClient.query(
          'DELETE FROM tbl_payment_link WHERE company_id = ANY($1)', [companyIds]
        );
        console.log('  - Deleted payment links');
        
        // Delete user transactions
        await destClient.query(
          'DELETE FROM tbl_user_transaction WHERE company_id = ANY($1)', [companyIds]
        );
        console.log('  - Deleted user transactions');
        
        // Delete user self transactions (by user_id since no company_id column)
        await destClient.query(
          'DELETE FROM tbl_user_self_transaction WHERE user_id = $1', [destUserId]
        );
        console.log('  - Deleted user self transactions');
        
        // Delete invoices
        await destClient.query(
          'DELETE FROM tbl_invoice WHERE company_id = ANY($1)', [companyIds]
        );
        console.log('  - Deleted invoices');
      }
      
      // Delete API keys
      await destClient.query('DELETE FROM tbl_api WHERE user_id = $1', [destUserId]);
      console.log('  - Deleted API keys');
      
      // Delete wallet addresses
      await destClient.query('DELETE FROM tbl_user_addresses WHERE user_id = $1', [destUserId]);
      console.log('  - Deleted wallet addresses');
      
      // Delete wallets
      await destClient.query('DELETE FROM tbl_user_wallet WHERE user_id = $1', [destUserId]);
      console.log('  - Deleted wallets');
      
      // Delete notifications
      await destClient.query('DELETE FROM tbl_notification WHERE user_id = $1', [destUserId]);
      console.log('  - Deleted notifications');
      
      // Delete notification preferences
      await destClient.query('DELETE FROM tbl_notification_preferences WHERE user_id = $1', [destUserId]);
      console.log('  - Deleted notification preferences');
      
      // Delete companies
      await destClient.query('DELETE FROM tbl_company WHERE user_id = $1', [destUserId]);
      console.log('  - Deleted companies');
      
      // Delete user
      await destClient.query('DELETE FROM tbl_user WHERE user_id = $1', [destUserId]);
      console.log('  - Deleted user');
      
      console.log(`✅ Deleted existing user and all related data`);
    } else {
      console.log('No existing user found in destination');
    }
    
    // ==========================================
    // STEP 3: Insert user with same user_id
    // ==========================================
    console.log('\n=== STEP 3: Inserting user ===');
    
    // Helper to quote column names for PostgreSQL
    const quoteCol = (col) => `"${col}"`;
    
    // Get column names from source user (excluding any auto-generated ones)
    const userColumns = Object.keys(user).filter(k => user[k] !== null);
    const userValues = userColumns.map(k => user[k]);
    const userPlaceholders = userColumns.map((_, i) => `$${i + 1}`);
    
    // Check if user_id already exists
    const existingUserId = await destClient.query(
      'SELECT user_id FROM tbl_user WHERE user_id = $1', [sourceUserId]
    );
    
    if (existingUserId.rows.length > 0) {
      // Update sequence to use different ID
      console.log(`user_id ${sourceUserId} already exists, will use auto-generated ID`);
      const userColumnsNoId = userColumns.filter(k => k !== 'user_id');
      const userValuesNoId = userColumnsNoId.map(k => user[k]);
      const userPlaceholdersNoId = userColumnsNoId.map((_, i) => `$${i + 1}`);
      
      const insertResult = await destClient.query(
        `INSERT INTO tbl_user (${userColumnsNoId.map(quoteCol).join(', ')}) VALUES (${userPlaceholdersNoId.join(', ')}) RETURNING user_id`,
        userValuesNoId
      );
      var newUserId = insertResult.rows[0].user_id;
    } else {
      await destClient.query(
        `INSERT INTO tbl_user (${userColumns.map(quoteCol).join(', ')}) VALUES (${userPlaceholders.join(', ')})`,
        userValues
      );
      var newUserId = sourceUserId;
      // Update sequence
      await destClient.query(`SELECT setval('tbl_user_user_id_seq', (SELECT MAX(user_id) FROM tbl_user))`);
    }
    
    console.log(`✅ Inserted user with user_id: ${newUserId}`);
    
    // ==========================================
    // STEP 4: Insert companies
    // ==========================================
    console.log('\n=== STEP 4: Inserting companies ===');
    
    const companyIdMap = {}; // Map old company_id to new company_id
    
    for (const company of sourceCompanies.rows) {
      const oldCompanyId = company.company_id;
      
      // VAT Country Validation - Check for mismatches and warn
      if (company.vat_number && company.country) {
        const vatCountry = company.vat_number.substring(0, 2).toUpperCase();
        const companyCountry = company.country.toUpperCase();
        
        if (vatCountry !== companyCountry) {
          console.warn(`⚠️  VAT country mismatch for company ${company.company_name}:`);
          console.warn(`   VAT: ${company.vat_number} (Country: ${vatCountry})`);
          console.warn(`   Company Country: ${companyCountry}`);
          console.warn(`   Auto-correcting country to match VAT...`);
          company.country = vatCountry; // Auto-fix to match VAT
        }
      }
      
      // Auto-suggest country from VAT if country is missing
      if (company.vat_number && !company.country) {
        const suggestedCountry = company.vat_number.substring(0, 2).toUpperCase();
        console.log(`ℹ️  Auto-suggesting country ${suggestedCountry} for company ${company.company_name} based on VAT ${company.vat_number}`);
        company.country = suggestedCountry;
      }
      
      // Update user_id to new one
      company.user_id = newUserId;
      
      // Check if company_id exists
      const existingCompany = await destClient.query(
        'SELECT company_id FROM tbl_company WHERE company_id = $1', [oldCompanyId]
      );
      
      const companyColumns = Object.keys(company).filter(k => company[k] !== null);
      
      if (existingCompany.rows.length > 0) {
        // Insert without company_id
        const colsNoId = companyColumns.filter(k => k !== 'company_id');
        const valsNoId = colsNoId.map(k => company[k]);
        const placeholdersNoId = colsNoId.map((_, i) => `$${i + 1}`);
        
        const result = await destClient.query(
          `INSERT INTO tbl_company (${colsNoId.map(quoteCol).join(', ')}) VALUES (${placeholdersNoId.join(', ')}) RETURNING company_id`,
          valsNoId
        );
        companyIdMap[oldCompanyId] = result.rows[0].company_id;
      } else {
        const vals = companyColumns.map(k => company[k]);
        const placeholders = companyColumns.map((_, i) => `$${i + 1}`);
        
        await destClient.query(
          `INSERT INTO tbl_company (${companyColumns.map(quoteCol).join(', ')}) VALUES (${placeholders.join(', ')})`,
          vals
        );
        companyIdMap[oldCompanyId] = oldCompanyId;
      }
      
      console.log(`  - Inserted company: ${company.company_name} (${oldCompanyId} -> ${companyIdMap[oldCompanyId]})`);
    }
    
    // Update sequence
    await destClient.query(`SELECT setval('tbl_company_company_id_seq', (SELECT MAX(company_id) FROM tbl_company))`);
    
    // ==========================================
    // STEP 5: Insert wallets
    // ==========================================
    console.log('\n=== STEP 5: Inserting wallets ===');
    
    for (const wallet of sourceWallets.rows) {
      wallet.user_id = newUserId;
      
      // Map company_id if exists
      if (wallet.company_id && companyIdMap[wallet.company_id]) {
        wallet.company_id = companyIdMap[wallet.company_id];
      }
      
      const walletColumns = Object.keys(wallet).filter(k => wallet[k] !== null && k !== 'wallet_id');
      const walletValues = walletColumns.map(k => wallet[k]);
      const walletPlaceholders = walletColumns.map((_, i) => `$${i + 1}`);
      
      await destClient.query(
        `INSERT INTO tbl_user_wallet (${walletColumns.map(quoteCol).join(', ')}) VALUES (${walletPlaceholders.join(', ')})`,
        walletValues
      );
      console.log(`  - Inserted wallet: ${wallet.wallet_type || wallet.currency_type}`);
    }
    
    // ==========================================
    // STEP 6: Insert wallet addresses
    // ==========================================
    console.log('\n=== STEP 6: Inserting wallet addresses ===');
    
    for (const addr of sourceAddresses.rows) {
      addr.user_id = newUserId;
      
      // Map company_id if exists
      if (addr.company_id && companyIdMap[addr.company_id]) {
        addr.company_id = companyIdMap[addr.company_id];
      }
      
      const addrColumns = Object.keys(addr).filter(k => addr[k] !== null && k !== 'user_address_id');
      const addrValues = addrColumns.map(k => addr[k]);
      const addrPlaceholders = addrColumns.map((_, i) => `$${i + 1}`);
      
      await destClient.query(
        `INSERT INTO tbl_user_addresses (${addrColumns.map(quoteCol).join(', ')}) VALUES (${addrPlaceholders.join(', ')})`,
        addrValues
      );
      console.log(`  - Inserted address: ${addr.currency || addr.label} - ${addr.wallet_address?.substring(0, 20)}...`);
    }
    
    // ==========================================
    // STEP 7: Insert API keys
    // ==========================================
    console.log('\n=== STEP 7: Inserting API keys ===');
    
    for (const api of sourceApis.rows) {
      api.user_id = newUserId;
      
      // Map company_id if exists
      if (api.company_id && companyIdMap[api.company_id]) {
        api.company_id = companyIdMap[api.company_id];
      }
      
      const apiColumns = Object.keys(api).filter(k => api[k] !== null && k !== 'api_id');
      const apiValues = apiColumns.map(k => api[k]);
      const apiPlaceholders = apiColumns.map((_, i) => `$${i + 1}`);
      
      await destClient.query(
        `INSERT INTO tbl_api (${apiColumns.map(quoteCol).join(', ')}) VALUES (${apiPlaceholders.join(', ')})`,
        apiValues
      );
      console.log(`  - Inserted API key: ${api.api_name || 'unnamed'}`);
    }
    
    // ==========================================
    // STEP 8: Insert notifications
    // ==========================================
    console.log('\n=== STEP 8: Inserting notifications ===');
    
    for (const notif of sourceNotifications.rows) {
      notif.user_id = newUserId;
      
      if (notif.company_id && companyIdMap[notif.company_id]) {
        notif.company_id = companyIdMap[notif.company_id];
      }
      
      const notifColumns = Object.keys(notif).filter(k => notif[k] !== null && k !== 'notification_id');
      const notifValues = notifColumns.map(k => notif[k]);
      const notifPlaceholders = notifColumns.map((_, i) => `$${i + 1}`);
      
      try {
        await destClient.query(
          `INSERT INTO tbl_notification (${notifColumns.map(quoteCol).join(', ')}) VALUES (${notifPlaceholders.join(', ')})`,
          notifValues
        );
      } catch (e) {
        console.log(`  - Skipped notification (${e.message})`);
      }
    }
    console.log(`  - Inserted ${sourceNotifications.rows.length} notifications`);
    
    // ==========================================
    // STEP 9: Insert notification preferences
    // ==========================================
    console.log('\n=== STEP 9: Inserting notification preferences ===');
    
    for (const pref of sourceNotifPrefs.rows) {
      pref.user_id = newUserId;
      
      const prefColumns = Object.keys(pref).filter(k => pref[k] !== null && k !== 'preference_id');
      const prefValues = prefColumns.map(k => pref[k]);
      const prefPlaceholders = prefColumns.map((_, i) => `$${i + 1}`);
      
      try {
        await destClient.query(
          `INSERT INTO tbl_notification_preferences (${prefColumns.map(quoteCol).join(', ')}) VALUES (${prefPlaceholders.join(', ')})`,
          prefValues
        );
        console.log('  - Inserted notification preferences');
      } catch (e) {
        console.log(`  - Skipped preferences (${e.message})`);
      }
    }
    
    // ==========================================
    // FINAL: Summary
    // ==========================================
    console.log('\n========================================');
    console.log('✅ MIGRATION COMPLETE');
    console.log('========================================');
    console.log(`User: ${user.name} (${user.email})`);
    console.log(`New user_id: ${newUserId}`);
    console.log(`Companies: ${sourceCompanies.rows.length}`);
    console.log(`Wallets: ${sourceWallets.rows.length}`);
    console.log(`Addresses: ${sourceAddresses.rows.length}`);
    console.log(`API Keys: ${sourceApis.rows.length}`);
    console.log(`Company ID mappings:`, companyIdMap);
    
  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    console.error(err.stack);
  } finally {
    await sourceClient.end();
    await destClient.end();
  }
}

migrateUser();
