require('dotenv').config();
process.chdir('/app/backend');
require('ts-node').register({ 
  transpileOnly: true, 
  compilerOptions: { 
    module: 'commonjs', 
    moduleResolution: 'node',
    esModuleInterop: true
  } 
});

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {
  host: process.env.HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false
});

async function checkAndSend() {
  // Import tatumApi after ts-node is registered
  const tatumApi = require('/app/backend/apis/tatumApi').default;
  
  const tempAddress = '0x5c8282c96a89f002b908668bab6d5d30c68b610e';
  const merchantAddress = '0x9a7221b5e32d5f99e8da95585835442e29afb38f';
  const merchantAmount = 0.00340299;
  
  console.log('=== CHECKING BALANCE AND SENDING TO MERCHANT ===');
  console.log('Temp address:', tempAddress);
  console.log('Merchant address:', merchantAddress);
  console.log('Merchant amount:', merchantAmount, 'ETH');
  
  try {
    // 1. Check current balance
    console.log('\n1. Checking balance...');
    const balance = await tatumApi.getAddressBalance(tempAddress, 'ETH');
    console.log('   Balance:', JSON.stringify(balance));
    
    const currentBalance = parseFloat(balance?.balance || 0);
    if (currentBalance < merchantAmount) {
      console.log('ERROR: Insufficient balance! Have:', currentBalance, 'Need:', merchantAmount);
      process.exit(1);
    }
    
    // 2. Get temp address private key
    console.log('\n2. Getting private key...');
    const [addr] = await sequelize.query(`
      SELECT private_key FROM tbl_merchant_temp_address WHERE wallet_address = '${tempAddress}'
    `);
    
    if (!addr || addr.length === 0) {
      console.log('ERROR: Temp address not found in DB');
      process.exit(1);
    }
    
    // 3. Decrypt private key
    console.log('3. Decrypting key...');
    const decryptedKey = await tatumApi.decryptSymmetric(
      addr[0].private_key,
      process.env.TEMP_KEY_ID
    );
    
    // 4. Estimate fees
    console.log('\n4. Estimating fees...');
    const fees = await tatumApi.feeEstimation(
      'ETH',
      tempAddress,
      merchantAddress,
      merchantAmount
    );
    console.log('   Fees:', JSON.stringify(fees));
    
    // 5. Send to merchant
    console.log('\n5. Sending', merchantAmount, 'ETH to merchant...');
    
    const txResult = await tatumApi.assetToOtherAddress({
      currency: 'ETH',
      fromAddress: tempAddress,
      toAddress: merchantAddress,
      privateKey: decryptedKey,
      amount: merchantAmount,
      fee: fees,
    });
    
    console.log('\n=== MERCHANT TRANSFER RESULT ===');
    console.log(JSON.stringify(txResult, null, 2));
    
    if (txResult?.txId) {
      // Update pool transaction
      await sequelize.query(`
        UPDATE tbl_merchant_pool_transaction 
        SET merchant_tx_id = '${txResult.txId}', status = 'completed'
        WHERE temp_address_id = 2 AND status = 'pending'
      `);
      console.log('\n✅ Updated pool transaction record');
      
      // Update temp address - set last_merchant_payout for sweep timing
      await sequelize.query(`
        UPDATE tbl_merchant_temp_address 
        SET last_merchant_payout = NOW()
        WHERE temp_address_id = 2
      `);
      console.log('✅ Updated temp address last_merchant_payout');
    }
    
  } catch (error) {
    console.error('ERROR:', error.message || error);
    if (error.response?.data) {
      console.error('API Error:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  process.exit(0);
}

checkAndSend();
