const crypto = require('crypto');
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false
});

async function updatePassword() {
  try {
    const [results] = await sequelize.query("SELECT user_id, email, password FROM tbl_user WHERE email = 'john@dyno.pt'");
    
    if (results.length === 0) {
      console.log('❌ User john@dyno.pt not found');
      return;
    }
    
    const user = results[0];
    console.log('✅ User found:', user.email);
    console.log('Current password hash:', user.password ? user.password.substring(0, 20) + '...' : 'None');
    
    // Import bcrypt from helper
    const { hashPassword } = require('./helper/hashing');
    
    // Hash new password
    const newPassword = 'Katiekendra123@';
    const newHash = await hashPassword(newPassword);
    
    console.log('\nUpdating password to:', newPassword);
    console.log('New hash:', newHash.substring(0, 20) + '...');
    
    // Update password
    await sequelize.query("UPDATE tbl_user SET password = ? WHERE email = 'john@dyno.pt'", {
      replacements: [newHash]
    });
    
    console.log('✅ Password updated successfully');
    
    // Test login
    console.log('\nTesting login...');
    const { verifyPassword } = require('./helper/hashing');
    const [updatedUser] = await sequelize.query("SELECT password FROM tbl_user WHERE email = 'john@dyno.pt'");
    const isValid = await verifyPassword(newPassword, updatedUser[0].password);
    console.log('Password verification:', isValid ? '✅ Success' : '❌ Failed');
    
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    await sequelize.close();
    process.exit(1);
  }
}

updatePassword();
