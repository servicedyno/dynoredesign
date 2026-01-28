/**
 * Manual Payment Processing for 0xf6dc2d96fa94a4de7fe78aff63e3e2a1fe7cba51
 */

const express = require('express');
const app = express();

// Import necessary modules
require('dotenv').config();

// Import payment controller
const { paymentController } = require('./controller');

async function manualProcessPayment() {
  console.log('='.repeat(80));
  console.log('MANUAL PAYMENT PROCESSING');
  console.log('='.repeat(80));
  console.log();
  
  const address = '0xf6dc2d96fa94a4de7fe78aff63e3e2a1fe7cba51';
  
  console.log('Payment Address:', address);
  console.log('Processing...');
  console.log();
  
  try {
    // Call cryptoVerification directly
    const result = await paymentController.cryptoVerification(address, false);
    
    console.log('✅ Payment processed successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error processing payment:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

manualProcessPayment();
