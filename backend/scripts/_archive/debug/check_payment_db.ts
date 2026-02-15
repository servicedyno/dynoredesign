import sequelize from '../utils/dbInstance';
import { QueryTypes } from 'sequelize';

async function main() {
  try {
    // Check payment link with transaction_id = 57
    const paymentLinks = await sequelize.query(
      `SELECT * FROM tbl_payment_link WHERE transaction_id = '57'`,
      { type: QueryTypes.SELECT }
    );
    console.log('=== PAYMENT LINK TRANSACTION_ID=57 ===');
    console.log(JSON.stringify(paymentLinks[0], null, 2));

    // Check merchant temp address for this address
    const tempAddresses = await sequelize.query(
      `SELECT * FROM tbl_merchant_temp_address WHERE wallet_address = '0x5c8282c96a89f002b908668bab6d5d30c68b610e'`,
      { type: QueryTypes.SELECT }
    );
    console.log('\n=== MERCHANT TEMP ADDRESS ===');
    console.log(JSON.stringify(tempAddresses[0], null, 2));

    // Check user transactions 
    const transactions = await sequelize.query(
      `SELECT * FROM tbl_user_transaction ORDER BY "createdAt" DESC LIMIT 5`,
      { type: QueryTypes.SELECT }
    );
    console.log('\n=== RECENT USER TRANSACTIONS ===');
    transactions.forEach((tx: unknown) => {
      console.log(`ID: ${tx.id}, Status: ${tx.status}, Amount: ${tx.base_amount} ${tx.base_currency}`);
    });

    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
    await sequelize.close();
  }
}

main();
