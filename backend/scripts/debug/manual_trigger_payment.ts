/**
 * Manual trigger for crypto verification
 * Run via: ts-node manual_trigger_payment.ts
 */

import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';
import axios from 'axios';

dotenv.config();

async function triggerPayment() {
  console.log('='.repeat(80));
  console.log('MANUAL PAYMENT TRIGGER');
  console.log('='.repeat(80));
  console.log();
  
  const address = '0xf6dc2d96fa94a4de7fe78aff63e3e2a1fe7cba51';
  
  try {
    // Trigger via internal API call
    console.log('Calling cryptoVerification endpoint...');
    
    const response = await axios.post('http://localhost:8001/api/pay/verifyCryptoPayment', {
      address: address
    });
    
    console.log('✅ Response:', response.data);
    
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

triggerPayment();
