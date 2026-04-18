import sequelize from '../utils/dbInstance';
import { QueryTypes } from 'sequelize';

async function main() {
  try {
    // Check all merchant temp addresses for company 38 with any balance
    const addresses = await sequelize.query(
      `SELECT 
        temp_address_id,
        wallet_address,
        status,
        admin_fee_balance,
        received_amount,
        expected_amount,
        last_swept_at,
        current_company_id,
        owner_user_id,
        created_at,
        updated_at
       FROM tbl_merchant_temp_address 
       WHERE current_company_id = 38 OR owner_user_id = 28
       ORDER BY updated_at DESC`,
      { type: QueryTypes.SELECT }
    ) as Array<Record<string, unknown>>;
    
    console.log('=== MERCHANT POOL ADDRESSES (Company 38 / User 28) ===\n');
    
    let totalUnsweptFees = 0;
    let addressesWithFees = 0;
    
    for (const addr of addresses) {
      const feeBalance = parseFloat(addr.admin_fee_balance || '0');
      if (feeBalance > 0) {
        addressesWithFees++;
        totalUnsweptFees += feeBalance;
      }
      
      console.log(`Address: ${addr.wallet_address}`);
      console.log(`  Status: ${addr.status}`);
      console.log(`  Admin Fee Balance: ${addr.admin_fee_balance || '0'} ETH`);
      console.log(`  Received Amount: ${addr.received_amount || '0'}`);
      console.log(`  Last Swept: ${addr.last_swept_at || 'Never'}`);
      console.log(`  Updated: ${addr.updated_at}`);
      console.log('');
    }
    
    console.log('=== SUMMARY ===');
    console.log(`Total addresses: ${addresses.length}`);
    console.log(`Addresses with unswept fees: ${addressesWithFees}`);
    console.log(`Total unswept admin fees: ${totalUnsweptFees.toFixed(8)} ETH`);
    
    // Also check actual on-chain balances using Tatum
    console.log('\n=== CHECKING ON-CHAIN BALANCES ===\n');
    
    const axios = require('axios');
    const TATUM_KEY = process.env.TATUM_KEY;
    
    for (const addr of addresses) {
      if (addr.wallet_address) {
        try {
          const response = await axios.get(
            `https://api.tatum.io/v3/ethereum/account/balance/${addr.wallet_address}`,
            { headers: { 'x-api-key': TATUM_KEY } }
          );
          const onChainBalance = parseFloat(response.data.balance || '0');
          console.log(`${addr.wallet_address.substring(0,20)}...: ${onChainBalance.toFixed(8)} ETH on-chain (DB fee: ${addr.admin_fee_balance || '0'})`);
        } catch (e: unknown) {
          console.log(`${addr.wallet_address.substring(0,20)}...: Error fetching balance`);
        }
      }
    }
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
    await sequelize.close();
  }
}

main();
