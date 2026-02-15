/**
 * Clear Redis txId and manually trigger payment processing
 */

import axios from 'axios';

async function fixPayment() {
  console.log('='.repeat(80));
  console.log('FIXING STUCK PAYMENT');
  console.log('='.repeat(80));
  console.log();
  
  const address = '0xf6dc2d96fa94a4de7fe78aff63e3e2a1fe7cba51';
  const txHash = '0xacacca62f2fd947f7b0314459142e374f0a790e9daf1680d75778f0ee8fe46f9';
  
  // Simulate fresh webhook call
  console.log('Simulating webhook call with fresh data...');
  
  try {
    const response = await axios.post('http://localhost:8001/api/webhook/tatum', {
      subscriptionType: 'ADDRESS_TRANSACTION',
      address: address,
      counterAddress: address,
      amount: '0.00367',
      asset: 'ETH',
      currency: 'ETH',
      txId: txHash,
      blockNumber: 12345678,
      confirmations: 3
    });
    
    console.log('✅ Webhook response:', response.status);
    console.log();
    console.log('Check logs: tail -f /var/log/supervisor/backend.out.log | grep cryptoVerification');
    
  } catch (error: unknown) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

fixPayment();
