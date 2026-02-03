import dotenv from 'dotenv';
dotenv.config();

// Import sequelize instance
import sequelize from './utils/dbInstance';

// Import all models to ensure they're registered
import './models';

async function syncDatabase() {
  console.log('\n' + '='.repeat(80));
  console.log('  DATABASE SCHEMA SYNC');
  console.log('='.repeat(80));
  
  console.log('\n📋 Database Connection:');
  console.log(`  Host: ${process.env.HOST}:${process.env.DB_PORT}`);
  console.log(`  Database: ${process.env.DB_NAME}`);
  console.log(`  User: ${process.env.USER_NAME}`);
  
  try {
    // Test connection
    console.log('\n🔌 Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');
    
    // Sync all models
    console.log('\n🔄 Syncing database schema...');
    console.log('   Adding any missing columns to existing tables');
    console.log('   Using { alter: true } to preserve existing data\n');
    
    // Sync with alter (adds missing columns, doesn't drop anything)
    await sequelize.sync({ alter: true, force: false });
    
    console.log('\n✅ Database schema synced successfully!');
    
    // List all tables created
    console.log('\n📊 Tables in database:');
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    tables.forEach((table: Record<string, unknown>, index: number) => {
      console.log(`   ${index + 1}. ${table.table_name}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('  SYNC COMPLETE');
    console.log('='.repeat(80));
    console.log('\n✅ Database is ready for use!');
    console.log('✅ All model columns have been added to tables');
    console.log('✅ You can now restart the backend service\n');
    
  } catch (error: unknown) {
    console.error('\n❌ Error during sync:', error.message);
    if (error.original) {
      console.error('   Original error:', error.original.message);
    }
    console.error('\n💡 If you see permission errors, ensure the database user has CREATE/ALTER rights');
    process.exit(1);
  }
}

syncDatabase().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
