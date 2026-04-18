// Manual sweep trigger script
const { Sequelize, Op } = require('sequelize');

// Replicate the sweep logic to debug
async function main() {
  const sequelize = new Sequelize('db_bozzwallet', 'postgres', 'JqdkVTjQujJaEOyUJJHmWMYEWgtAXTfO', {
    host: 'shortline.proxy.rlwy.net',
    port: 44579,
    dialect: 'postgres',
    logging: false
  });

  await sequelize.authenticate();
  console.log('Connected to PostgreSQL');

  // Check exact query that the sweep function runs
  const [addressesWithFees] = await sequelize.query(`
    SELECT temp_address_id, wallet_type, wallet_address, admin_fee_balance, 
           last_merchant_payout, status
    FROM tbl_merchant_temp_address 
    WHERE status = 'AVAILABLE' 
      AND admin_fee_balance > 0 
      AND last_merchant_payout IS NOT NULL
  `);
  
  console.log('\n=== Addresses matching sweep query ===');
  console.log('Count:', addressesWithFees.length);
  console.log(JSON.stringify(addressesWithFees, null, 2));

  // Check ETH_SWEEP config
  const ETH_SWEEP = 'time:10'; // From .env
  console.log('\n=== ETH Sweep Config ===');
  console.log('ETH_SWEEP:', ETH_SWEEP);
  
  const [mode, value] = ETH_SWEEP.split(':');
  console.log('Mode:', mode);
  console.log('Value:', value);

  // Check time eligibility
  if (addressesWithFees.length > 0) {
    const addr = addressesWithFees[0];
    const lastPayout = new Date(addr.last_merchant_payout);
    const now = new Date();
    const timeThresholdMinutes = parseInt(value) || 10;
    
    const timeThreshold = new Date();
    timeThreshold.setMinutes(timeThreshold.getMinutes() - timeThresholdMinutes);
    
    const timeSincePayout = Math.floor((now.getTime() - lastPayout.getTime()) / 60000);
    
    console.log('\n=== Time Check ===');
    console.log('Now:', now.toISOString());
    console.log('Last Payout:', lastPayout.toISOString());
    console.log('Time Threshold (cutoff):', timeThreshold.toISOString());
    console.log('Minutes since payout:', timeSincePayout);
    console.log('Time threshold (minutes):', timeThresholdMinutes);
    console.log('lastPayout < timeThreshold:', lastPayout < timeThreshold);
    console.log('Should be eligible:', timeSincePayout >= timeThresholdMinutes);
  }

  await sequelize.close();
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
