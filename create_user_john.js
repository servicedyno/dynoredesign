const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const client = new Client({
  host: 'shortline.proxy.rlwy.net',
  port: 44579,
  user: 'postgres',
  password: 'JqdkVTjQujJaEOyUJJHmWMYEWgtAXTfO',
  database: 'db_bozzwallet'
});

async function createUser() {
  console.log('\n================================================================================');
  console.log('  CREATING USER: john@dyno.pt');
  console.log('================================================================================\n');

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check if user already exists
    const checkUser = await client.query('SELECT user_id FROM tbl_user WHERE email = $1', ['john@dyno.pt']);
    
    if (checkUser.rows.length > 0) {
      console.log('⚠️  User already exists with ID:', checkUser.rows[0].user_id);
      console.log('   Updating password...');
      
      const hashedPassword = await bcrypt.hash('Katiekendra123@', 10);
      await client.query('UPDATE tbl_user SET password = $1 WHERE email = $2', [hashedPassword, 'john@dyno.pt']);
      
      console.log('✅ Password updated successfully\n');
      await client.end();
      return;
    }

    // Hash password
    console.log('🔒 Hashing password...');
    const hashedPassword = await bcrypt.hash('Katiekendra123@', 10);
    console.log('✅ Password hashed\n');

    // Create user
    console.log('👤 Creating user account...');
    const userResult = await client.query(`
      INSERT INTO tbl_user (email, password, name, mobile, status, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING user_id, email, name
    `, ['john@dyno.pt', hashedPassword, 'Johnny LTD', '+1234567890', 'active']);
    
    const user = userResult.rows[0];
    console.log('✅ User created:');
    console.log(`   User ID: ${user.user_id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}\n`);

    // Create company
    console.log('🏢 Creating company...');
    const companyResult = await client.query(`
      INSERT INTO tbl_company (
        user_id, company_name, email, phone, address, 
        country, state, city, postal_code, status, 
        createdAt, updatedAt
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING company_id, company_name
    `, [
      user.user_id, 
      'Johnnys LDA', 
      'john@dyno.pt', 
      '+1234567890',
      '123 Test Street',
      'United States',
      'California',
      'San Francisco',
      '94102',
      'active'
    ]);
    
    const company = companyResult.rows[0];
    console.log('✅ Company created:');
    console.log(`   Company ID: ${company.company_id}`);
    console.log(`   Company Name: ${company.company_name}\n`);

    // Create ETH wallet
    console.log('💰 Creating ETH wallet...');
    const walletResult = await client.query(`
      INSERT INTO tbl_user_wallet (
        user_id, wallet_type, wallet_address, amount, 
        currency_type, createdAt, updatedAt
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING wallet_id, wallet_type, wallet_address
    `, [
      user.user_id,
      'ETH',
      '', // Will be generated when needed
      0,
      'CRYPTO'
    ]);
    
    const wallet = walletResult.rows[0];
    console.log('✅ ETH wallet created:');
    console.log(`   Wallet ID: ${wallet.wallet_id}`);
    console.log(`   Type: ${wallet.wallet_type}\n`);

    // Create BTC wallet
    console.log('💰 Creating BTC wallet...');
    await client.query(`
      INSERT INTO tbl_user_wallet (
        user_id, wallet_type, wallet_address, amount, 
        currency_type, createdAt, updatedAt
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    `, [
      user.user_id,
      'BTC',
      '',
      0,
      'CRYPTO'
    ]);
    console.log('✅ BTC wallet created\n');

    console.log('================================================================================');
    console.log('  USER ACCOUNT CREATED SUCCESSFULLY! ✅');
    console.log('================================================================================\n');
    console.log('Login Credentials:');
    console.log('  Email: john@dyno.pt');
    console.log('  Password: Katiekendra123@');
    console.log(`  User ID: ${user.user_id}`);
    console.log(`  Company ID: ${company.company_id}\n`);
    console.log('You can now use these credentials to create payments!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createUser().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
