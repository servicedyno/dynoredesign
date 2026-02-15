import sequelize from './utils/dbInstance';
import { QueryTypes } from 'sequelize';

async function resetAddress() {
  try {
    // Reset status to IN_USE so sweep can be retried
    const result = await sequelize.query(
      `UPDATE tbl_merchant_temp_address 
       SET status = 'IN_USE'
       WHERE wallet_address = '0xdb0c01c41879d877654050002e6e6f283841c9c3'
       RETURNING *`,
      { type: QueryTypes.UPDATE }
    );
    
    console.log('Address status reset to IN_USE');
    if (result && result[0] && result[0][0]) {
      console.log('Updated record:', JSON.stringify(result[0][0], null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetAddress();
