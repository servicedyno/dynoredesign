import sequelize from '../utils/dbInstance';
import { QueryTypes } from 'sequelize';

async function main() {
  try {
    // Check user wallets for user 28
    const wallets = await sequelize.query(
      `SELECT wallet_id, user_id, company_id, wallet_type, wallet_address 
       FROM tbl_user_wallet 
       WHERE user_id = 28`,
      { type: QueryTypes.SELECT }
    );
    console.log('=== USER 28 WALLETS ===');
    wallets.forEach((w: unknown) => {
      console.log(`- ${w.wallet_type}: ${w.wallet_address?.substring(0,20)}... (company: ${w.company_id})`);
    });

    // Check merchant temp addresses
    const tempAddrs = await sequelize.query(
      `SELECT temp_address_id, wallet_address, status, crypto_type 
       FROM tbl_merchant_temp_address 
       WHERE status = 'AVAILABLE' 
       LIMIT 5`,
      { type: QueryTypes.SELECT }
    );
    console.log('\n=== AVAILABLE MERCHANT TEMP ADDRESSES ===');
    tempAddrs.forEach((t: unknown) => {
      console.log(`- ${t.crypto_type}: ${t.wallet_address?.substring(0,20)}... (status: ${t.status})`);
    });

    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
    await sequelize.close();
  }
}

main();
