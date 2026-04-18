import sequelize from './utils/dbInstance';
import { QueryTypes } from 'sequelize';

async function checkUserTable() {
  try {
    await sequelize.authenticate();
    
    // Check user table columns
    console.log('=== TBL_USER COLUMNS ===');
    const userColumns = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tbl_user'
      ORDER BY ordinal_position
    `, { type: QueryTypes.SELECT });

    userColumns.forEach((col: unknown) => {
      console.log(`  ${col.column_name} (${col.data_type})`);
    });

    // Find user 28
    console.log('\n=== FINDING USER 28 ===');
    const user28 = await sequelize.query(`
      SELECT user_id, email, name, username, "createdAt", "updatedAt"
      FROM tbl_user 
      WHERE user_id = 28
    `, { type: QueryTypes.SELECT });

    if (user28.length > 0) {
      console.log('✅ User 28 found:', user28[0]);
    } else {
      console.log('❌ User 28 not found');
      
      // Find john@dyno.pt
      const johnUser = await sequelize.query(`
        SELECT user_id, email, name, username, "createdAt", "updatedAt"
        FROM tbl_user 
        WHERE email = 'john@dyno.pt'
      `, { type: QueryTypes.SELECT });
      
      if (johnUser.length > 0) {
        console.log('✅ john@dyno.pt found:', johnUser[0]);
      } else {
        console.log('❌ john@dyno.pt not found either');
        
        // Show some users for reference
        const someUsers = await sequelize.query(`
          SELECT user_id, email, name, username
          FROM tbl_user 
          ORDER BY user_id
          LIMIT 10
        `, { type: QueryTypes.SELECT });
        
        console.log('Sample users:', someUsers);
      }
    }

  } catch (error) {
    console.error('User check failed:', error);
  } finally {
    await sequelize.close();
  }
}

checkUserTable();