import sequelize from '../utils/dbInstance';
import { QueryTypes } from 'sequelize';

async function main() {
  try {
    // Check merchant temp address
    const [tempAddr] = await sequelize.query(
      `SELECT status, received_amount, is_partial_payment, expected_amount, admin_fee_balance 
       FROM tbl_merchant_temp_address 
       WHERE wallet_address = '0x5c8282c96a89f002b908668bab6d5d30c68b610e'`,
      { type: QueryTypes.SELECT }
    ) as Array<Record<string, unknown>>;
    console.log('=== MERCHANT TEMP ADDRESS STATE ===');
    console.log(JSON.stringify(tempAddr, null, 2));

    // Check user transaction
    const [tx] = await sequelize.query(
      `SELECT id, status, base_amount, base_currency, transaction_type 
       FROM tbl_user_transaction 
       WHERE id = '75f8a3f0-762c-4df2-88f5-c81369caf09d'`,
      { type: QueryTypes.SELECT }
    ) as Array<Record<string, unknown>>;
    console.log('\n=== USER TRANSACTION STATE ===');
    console.log(JSON.stringify(tx, null, 2));

    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
    await sequelize.close();
  }
}

main();
