const { Sequelize } = require('sequelize');

async function main() {
  const sequelize = new Sequelize('db_bozzwallet', 'postgres', 'JqdkVTjQujJaEOyUJJHmWMYEWgtAXTfO', {
    host: 'shortline.proxy.rlwy.net',
    port: 44579,
    dialect: 'postgres',
    logging: false
  });

  await sequelize.authenticate();
  console.log('Connected to PostgreSQL');

  // Check customer transaction for this payment
  const [customerTx] = await sequelize.query(`
    SELECT id, company_id, customer_id, payment_mode, base_amount, base_currency, 
           paid_amount, paid_currency, transaction_reference, status, "createdAt"
    FROM tbl_customer_transaction 
    WHERE transaction_reference LIKE '%0xacacca%'
       OR transaction_reference = '0xacacca62f2fd947f7b0314459142e374f0a790e9daf1680d75778f0ee8fe46f9'
    ORDER BY "createdAt" DESC
    LIMIT 5
  `);
  
  console.log('\n=== Customer Transaction Records ===');
  console.log(JSON.stringify(customerTx, null, 2));

  // Check merchant pool transaction
  const [poolTx] = await sequelize.query(`
    SELECT pool_tx_id, temp_address_id, owner_user_id, company_id, wallet_type,
           payment_amount, merchant_amount, admin_fee_amount, incoming_tx_id, merchant_tx_id, status
    FROM tbl_merchant_pool_transaction
    WHERE incoming_tx_id = '0xacacca62f2fd947f7b0314459142e374f0a790e9daf1680d75778f0ee8fe46f9'
       OR merchant_tx_id = '0xcbe7ca10edd2d9f795c506e16c5c4086c5d91fffdcd97f0e1ad912bb6dcbe213'
    ORDER BY pool_tx_id DESC
    LIMIT 5
  `);
  
  console.log('\n=== Pool Transaction Records ===');
  console.log(JSON.stringify(poolTx, null, 2));

  // Check merchant temp address status
  const [tempAddress] = await sequelize.query(`
    SELECT temp_address_id, owner_user_id, wallet_type, wallet_address, status, 
           admin_fee_balance, total_transactions, last_used_at
    FROM tbl_merchant_temp_address 
    WHERE temp_address_id = 3
  `);
  
  console.log('\n=== Merchant Temp Address Status ===');
  console.log(JSON.stringify(tempAddress, null, 2));

  // Check if user wallet balance was updated
  const [userWallet] = await sequelize.query(`
    SELECT wallet_id, user_id, company_id, wallet_type, wallet_address, amount, "updatedAt"
    FROM tbl_user_wallet 
    WHERE user_id = 28 AND wallet_type = 'ETH'
    LIMIT 1
  `);
  
  console.log('\n=== User Wallet Status ===');
  console.log(JSON.stringify(userWallet, null, 2));

  await sequelize.close();
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
