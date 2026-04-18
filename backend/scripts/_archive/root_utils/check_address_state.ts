import sequelize from './utils/dbInstance';
import { QueryTypes } from 'sequelize';

async function checkAddress() {
  try {
    const result = await sequelize.query<any>(
      `SELECT temp_address_id, wallet_address, wallet_type, status, admin_fee_balance, 
              last_merchant_payout, last_swept_at, created_at
       FROM tbl_merchant_temp_address 
       WHERE wallet_address = '0xdb0c01c41879d877654050002e6e6f283841c9c3'
       LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    
    if (result.length > 0) {
      console.log('Address state:', JSON.stringify(result[0], null, 2));
      
      const lastPayout = new Date(result[0].last_merchant_payout);
      const now = new Date();
      const minutesSincePayout = Math.floor((now.getTime() - lastPayout.getTime()) / 60000);
      console.log(`\nMinutes since last payout: ${minutesSincePayout}`);
    } else {
      console.log('Address not found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAddress();
