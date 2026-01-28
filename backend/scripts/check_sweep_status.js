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

  // Check merchant temp address status - particularly admin_fee_balance
  const [tempAddresses] = await sequelize.query(`
    SELECT temp_address_id, owner_user_id, wallet_type, wallet_address, status, 
           admin_fee_balance, gas_balance, total_transactions, 
           last_used_at, last_swept_at, last_merchant_payout
    FROM tbl_merchant_temp_address 
    WHERE admin_fee_balance > 0
    ORDER BY temp_address_id
  `);
  
  console.log('\n=== Addresses with Admin Fee Balance ===');
  console.log(JSON.stringify(tempAddresses, null, 2));

  // Check current time vs last_merchant_payout
  const now = new Date();
  console.log('\n=== Time Check ===');
  console.log('Current time:', now.toISOString());
  
  if (tempAddresses.length > 0) {
    const addr = tempAddresses[0];
    const payoutTime = new Date(addr.last_merchant_payout);
    const diffMinutes = (now - payoutTime) / 1000 / 60;
    console.log('Last merchant payout:', addr.last_merchant_payout);
    console.log('Minutes since payout:', diffMinutes.toFixed(2));
    console.log('ETH_SWEEP config: time:10 (should sweep after 10 minutes)');
    console.log('Eligible for sweep:', diffMinutes >= 10 ? 'YES' : `NO (${(10 - diffMinutes).toFixed(2)} minutes remaining)`);
  }

  await sequelize.close();
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
