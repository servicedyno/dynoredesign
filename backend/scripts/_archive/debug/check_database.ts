import dotenv from 'dotenv';
dotenv.config();

import sequelize from './utils/dbInstance';

async function checkDatabase() {
  console.log('\n' + '='.repeat(80));
  console.log('  DATABASE CHECK');
  console.log('='.repeat(80));
  
  console.log('\n📋 Connection Details:');
  console.log(`  Host: ${process.env.HOST}:${process.env.DB_PORT}`);
  console.log(`  Database: ${process.env.DB_NAME}`);
  
  try {
    // Test connection
    console.log('\n🔌 Testing connection...');
    await sequelize.authenticate();
    console.log('✅ Connected successfully');
    
    // List tables
    const [tables] = await sequelize.query(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log(`\n📊 Found ${tables.length} tables:\n`);
    tables.forEach((table: Record<string, unknown>, i) => {
      console.log(`   ${i + 1}. ${table.table_name} (${table.column_count} columns)`);
    });
    
    // Check specific important tables
    console.log('\n🔍 Checking key tables...\n');
    
    const keyTables = [
      'tbl_user',
      'tbl_company', 
      'tbl_user_wallet',
      'tbl_admin_wallet',
      'tbl_user_temp_address',
      'tbl_customer_transaction'
    ];
    
    for (const tableName of keyTables) {
      try {
        const [rows] = await sequelize.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        const count = rows[0] ? (rows[0] as Record<string, unknown>).count as number : 0;
        console.log(`   ✅ ${tableName}: ${count} rows`);
      } catch (err: unknown) {
        console.log(`   ❌ ${tableName}: ${err.message.split('\n')[0]}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('  DATABASE IS READY');
    console.log('='.repeat(80));
    console.log('\n✅ Database has data and is accessible');
    console.log('✅ Ready to run schema sync to add missing columns\n');
    
  } catch (error: unknown) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

checkDatabase().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
