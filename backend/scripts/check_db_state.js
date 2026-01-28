const { Sequelize, DataTypes } = require('sequelize');

async function main() {
  const sequelize = new Sequelize('db_bozzwallet', 'postgres', 'JqdkVTjQujJaEOyUJJHmWMYEWgtAXTfO', {
    host: 'shortline.proxy.rlwy.net',
    port: 44579,
    dialect: 'postgres',
    logging: false
  });

  await sequelize.authenticate();
  console.log('Connected to PostgreSQL');

  // Check merchant temp address with ID 3
  const [tempAddresses] = await sequelize.query(`
    SELECT temp_address_id, owner_user_id, wallet_type, wallet_address, status, 
           current_payment_id, current_company_id, expected_amount, received_amount,
           admin_fee_balance, gas_balance
    FROM tbl_merchant_temp_address 
    WHERE temp_address_id = 3 OR wallet_address = '0xf6dc2d96fa94a4de7fe78aff63e3e2a1fe7cba51'
    ORDER BY temp_address_id
  `);
  
  console.log('\n=== Merchant Temp Address Records ===');
  console.log(JSON.stringify(tempAddresses, null, 2));

  // Also check user temp addresses for comparison
  const [userTempAddresses] = await sequelize.query(`
    SELECT temp_id, user_id, wallet_type, wallet_address, status, customer_id
    FROM tbl_user_temp_address 
    WHERE wallet_address LIKE '0xf6dc2d96fa94a4de7fe78aff63e3e2a1fe7cba51'
       OR wallet_address LIKE '0x63321e829413b33edef295981fa09DE8e8C923F3'
    ORDER BY temp_id
  `);
  
  console.log('\n=== User Temp Address Records ===');
  console.log(JSON.stringify(userTempAddresses, null, 2));

  // Check recent merchant pool transactions
  const [poolTx] = await sequelize.query(`
    SELECT * FROM tbl_merchant_pool_transaction
    ORDER BY pool_tx_id DESC
    LIMIT 5
  `);
  
  console.log('\n=== Recent Pool Transactions ===');
  console.log(JSON.stringify(poolTx, null, 2));

  // Check customer transaction for this payment
  const [customerTx] = await sequelize.query(`
    SELECT * FROM tbl_customer_transaction 
    WHERE transaction_reference LIKE '%0xacacca%'
       OR transaction_reference = '0xacacca62f2fd947f7b0314459142e374f0a790e9daf1680d75778f0ee8fe46f9'
    ORDER BY "createdAt" DESC
    LIMIT 5
  `);
  
  console.log('\n=== Customer Transaction Records ===');
  console.log(JSON.stringify(customerTx, null, 2));

  await sequelize.close();
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
