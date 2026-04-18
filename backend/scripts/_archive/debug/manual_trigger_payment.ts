import { paymentController } from '../controller';
import { setRedisItem, getRedisItem } from '../utils/redisInstance';
import sequelize from '../utils/dbInstance';
import { QueryTypes } from 'sequelize';

async function main() {
  const address = '0x5c8282c96a89f002b908668bab6d5d30c68b610e';
  
  try {
    // First, check and update Redis with the payment info
    let cryptoData = await getRedisItem('crypto-' + address);
    console.log('=== CURRENT REDIS DATA ===');
    console.log(JSON.stringify(cryptoData, null, 2));
    
    // If Redis doesn't have complete data, reconstruct it from DB
    if (!cryptoData || Object.keys(cryptoData).length === 0) {
      console.log('Redis data missing, reconstructing from DB...');
      
      // Get temp address info
      const [tempAddr] = await sequelize.query(
        `SELECT * FROM tbl_merchant_temp_address WHERE wallet_address = :address`,
        { replacements: { address }, type: QueryTypes.SELECT }
      ) as Array<Record<string, unknown>>;
      
      if (!tempAddr) {
        console.error('No temp address found in DB');
        return;
      }
      
      cryptoData = {
        mode: 'CRYPTO',
        amount: tempAddr.expected_amount,
        status: 'pending',
        currency: 'ETH',
        payment_id: tempAddr.current_payment_id,
        unique_tx_id: tempAddr.current_payment_id,
        temp_id: tempAddr.temp_address_id,
        is_merchant_pool: 'true',
        ref: `customer-${tempAddr.current_payment_id}`,
      };
      
      await setRedisItem('crypto-' + address, cryptoData);
      console.log('Reconstructed Redis data:', cryptoData);
    }
    
    console.log('\n=== CALLING cryptoVerification ===');
    await paymentController.cryptoVerification(address, true);
    console.log('=== cryptoVerification COMPLETED ===');
    
    // Check the result
    const updatedCryptoData = await getRedisItem('crypto-' + address);
    console.log('\n=== UPDATED REDIS DATA ===');
    console.log(JSON.stringify(updatedCryptoData, null, 2));
    
    // Check DB state
    const [updatedTempAddr] = await sequelize.query(
      `SELECT status, received_amount, is_partial_payment FROM tbl_merchant_temp_address WHERE wallet_address = :address`,
      { replacements: { address }, type: QueryTypes.SELECT }
    ) as Array<Record<string, unknown>>;
    console.log('\n=== UPDATED DB STATE ===');
    console.log(JSON.stringify(updatedTempAddr, null, 2));
    
  } catch (error: unknown) {
    console.error('Error:', error.message || error);
    console.error(error.stack);
  } finally {
    // Don't close connections, just exit
    process.exit(0);
  }
}

main();
