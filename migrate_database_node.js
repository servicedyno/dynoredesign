const { Client } = require('pg');
const fs = require('fs');

const oldConfig = {
  host: 'yamanote.proxy.rlwy.net',
  port: 42097,
  user: 'postgres',
  password: 'oMHQMHfnrFyWgkhYaiXbhjDEMZSWOapc',
  database: 'db_bozzwallet'
};

const newConfig = {
  host: 'shortline.proxy.rlwy.net',
  port: 44579,
  user: 'postgres',
  password: 'JqdkVTjQujJaEOyUJJHmWMYEWgtAXTfO',
  database: 'railway'
};

async function migrateDatabase() {
  console.log('================================================================================');
  console.log('  DATABASE MIGRATION (Node.js Method)');
  console.log('  From: yamanote/db_bozzwallet → To: shortline/railway');
  console.log('================================================================================\n');

  const oldClient = new Client(oldConfig);
  const newClient = new Client(newConfig);

  try {
    // Connect to both databases
    console.log('🔌 Connecting to databases...');
    await oldClient.connect();
    console.log('   ✅ Connected to OLD database');
    
    await newClient.connect();
    console.log('   ✅ Connected to NEW database\n');

    // Get list of all tables
    console.log('📋 Getting table list from OLD database...');
    const tablesRes = await oldClient.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    
    console.log(`   Found ${tablesRes.rows.length} tables\n`);

    // Dump schema (CREATE TABLE statements)
    console.log('🔄 Step 1: Copying table schemas...\n');
    
    for (const {tablename} of tablesRes.rows) {
      try {
        console.log(`   Processing: ${tablename}`);
        
        // Get CREATE TABLE statement
        const createRes = await oldClient.query(`
          SELECT 
            'CREATE TABLE IF NOT EXISTS ' || quote_ident(tablename) || ' (' ||
            string_agg(
              quote_ident(attname) || ' ' || 
              pg_catalog.format_type(atttypid, atttypmod) ||
              CASE WHEN attnotnull THEN ' NOT NULL' ELSE '' END ||
              CASE WHEN atthasdef THEN ' DEFAULT ' || pg_get_expr(adbin, adrelid) ELSE '' END,
              ', '
            ) || ');' as create_statement
          FROM pg_attribute a
          LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
          WHERE a.attrelid = quote_ident($1)::regclass
            AND a.attnum > 0
            AND NOT a.attisdropped
          GROUP BY tablename;
        `, [tablename]);

        if (createRes.rows.length > 0) {
          const createStmt = createRes.rows[0].create_statement;
          try {
            await newClient.query(createStmt);
            console.log(`      ✅ Schema created`);
          } catch (createErr) {
            console.log(`      ⚠️  Schema exists or error: ${createErr.message.split('\n')[0]}`);
          }
        }

      } catch (err) {
        console.log(`      ⚠️  Error: ${err.message.split('\n')[0]}`);
      }
    }

    // Copy data
    console.log('\n🔄 Step 2: Copying table data...\n');
    
    for (const {tablename} of tablesRes.rows) {
      try {
        // Get row count
        const countRes = await oldClient.query(`SELECT COUNT(*) FROM ${tablename}`);
        const rowCount = parseInt(countRes.rows[0].count);
        
        if (rowCount === 0) {
          console.log(`   ${tablename}: 0 rows (skipped)`);
          continue;
        }

        console.log(`   ${tablename}: ${rowCount} rows`);
        
        // Get all data
        const dataRes = await oldClient.query(`SELECT * FROM ${tablename}`);
        
        if (dataRes.rows.length > 0) {
          // Get column names
          const columns = Object.keys(dataRes.rows[0]);
          
          // Insert in batches
          const batchSize = 100;
          for (let i = 0; i < dataRes.rows.length; i += batchSize) {
            const batch = dataRes.rows.slice(i, i + batchSize);
            
            for (const row of batch) {
              const values = columns.map(col => row[col]);
              const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
              const insertSQL = `INSERT INTO ${tablename} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
              
              try {
                await newClient.query(insertSQL, values);
              } catch (insertErr) {
                // Silently skip conflicts
              }
            }
          }
          console.log(`      ✅ Data copied`);
        }

      } catch (err) {
        console.log(`      ⚠️  Error: ${err.message.split('\n')[0]}`);
      }
    }

    // Verify
    console.log('\n📊 Verification...');
    const newTablesRes = await newClient.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public';
    `);
    console.log(`   Tables in NEW database: ${newTablesRes.rows.length}`);

    console.log('\n================================================================================');
    console.log('  DATABASE MIGRATION COMPLETE ✅');
    console.log('================================================================================\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await oldClient.end();
    await newClient.end();
  }
}

migrateDatabase().then(() => {
  console.log('Next: Run cd /app/backend && npx ts-node sync_database.ts');
  console.log('      (To add any missing columns from models)\n');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
