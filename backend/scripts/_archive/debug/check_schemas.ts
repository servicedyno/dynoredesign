import sequelize from './utils/dbInstance';
import { QueryTypes } from 'sequelize';

async function checkTableSchemas() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Check column names for each table
    const tables = [
      'tbl_merchant_temp_address',
      'tbl_merchant_wallet', 
      'tbl_user_wallet',
      'tbl_merchant_pool_transaction'
    ];

    for (const table of tables) {
      console.log(`\n=== ${table.toUpperCase()} COLUMNS ===`);
      try {
        const columns = await sequelize.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = '${table}'
          ORDER BY ordinal_position
        `, { type: QueryTypes.SELECT });

        columns.forEach((col: unknown) => {
          console.log(`  ${col.column_name} (${col.data_type})`);
        });
      } catch (error) {
        console.log(`  ❌ Table ${table} not found or error: ${error}`);
      }
    }

    // Also check if user 28 exists
    console.log(`\n=== USER 28 VERIFICATION ===`);
    const user = await sequelize.query(`
      SELECT user_id, email, first_name, last_name, "createdAt", "updatedAt"
      FROM tbl_user 
      WHERE user_id = 28
    `, { type: QueryTypes.SELECT });

    if (user.length > 0) {
      console.log('✅ User 28 found:', user[0]);
    } else {
      console.log('❌ User 28 not found');
      
      // Check what users exist
      const allUsers = await sequelize.query(`
        SELECT user_id, email, first_name, last_name
        FROM tbl_user 
        WHERE email LIKE '%john%' OR email LIKE '%dyno%'
        ORDER BY user_id
      `, { type: QueryTypes.SELECT });
      
      console.log('Users with john/dyno in email:', allUsers);
    }

  } catch (error) {
    console.error('Schema check failed:', error);
  } finally {
    await sequelize.close();
  }
}

checkTableSchemas();