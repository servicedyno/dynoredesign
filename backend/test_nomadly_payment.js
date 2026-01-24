const axios = require('axios');
const CryptoJS = require('crypto-js');
require('dotenv').config();

// Configuration
const API_SERVICE_URL = 'http://localhost:3301';
const MAIN_BACKEND_URL = process.env.SERVER_URL || 'http://localhost:8001';

// Nomadly API Key (encrypted)
const NOMADLY_API_KEY = 'U2FsdGVkX18Y1r7820X9rwDR1ENhHV1PMQyOKXFi3x9mgJyh4TRNAkk3aTkA1gu6DThmC/ncmerkXaqFt640z1iSdC6i84p9+OLVrqL2ojp+7CJ5+d5bAy4jaulxC+UG';

// Decrypt function
function decrypt(ciphertext, secretKey) {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
    return decryptedText;
  } catch (error) {
    console.error('Decryption error:', error.message);
    return null;
  }
}

// Main test function
async function testNomadlyPayment() {
  console.log('='.repeat(80));
  console.log('NOMADLY PAYMENT CREATION TEST');
  console.log('='.repeat(80));
  console.log();

  // Step 1: Verify API Key
  console.log('📋 Step 1: Verify API Key');
  console.log('─'.repeat(80));
  const decrypted = decrypt(NOMADLY_API_KEY, process.env.API_SECRET);
  console.log('Encrypted API Key:', NOMADLY_API_KEY.substring(0, 50) + '...');
  console.log('Decrypted:', decrypted);
  
  if (!decrypted || !decrypted.includes('DYNOPAY_USER_API')) {
    console.error('❌ Invalid API key format');
    return;
  }
  
  const apiData = JSON.parse(decrypted.split('-')[1]);
  console.log('API Data:', JSON.stringify(apiData, null, 2));
  console.log('✅ API Key is valid\n');

  // Step 2: Create or Get Customer
  console.log('👤 Step 2: Create Test Customer');
  console.log('─'.repeat(80));
  
  const testCustomer = {
    name: 'Test Customer',
    email: `test.customer.${Date.now()}@example.com`,
    mobile: '+1234567890'
  };
  
  console.log('Customer Data:', JSON.stringify(testCustomer, null, 2));
  
  let customerToken;
  let customerId;
  
  try {
    const createUserResponse = await axios.post(
      `${API_SERVICE_URL}/api/user/createUser`,
      testCustomer,
      {
        headers: {
          'x-api-key': NOMADLY_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Create User Response:', JSON.stringify(createUserResponse.data, null, 2));
    customerToken = createUserResponse.data.data.token;
    customerId = createUserResponse.data.data.customer_id;
    console.log('✅ Customer created successfully');
    console.log(`   Token: ${customerToken.substring(0, 30)}...`);
    console.log(`   Customer ID: ${customerId}\n`);
  } catch (error) {
    console.error('❌ Error creating customer:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   Message:', error.message);
    }
    return;
  }

  // Step 3: Create Crypto Payment (USDT-TRC20)
  console.log('💰 Step 3: Create USDT-TRC20 Payment');
  console.log('─'.repeat(80));
  
  const paymentRequest = {
    amount: 10,
    currency: 'USDT-TRC20',
    meta_data: {
      product_name: 'Test Product',
      order_id: 'TEST-ORDER-' + Date.now(),
      customer_name: testCustomer.name,
      description: 'Test payment for $10 USDT'
    },
    redirect_uri: 'https://example.com/payment-complete'
  };
  
  console.log('Payment Request:', JSON.stringify(paymentRequest, null, 2));
  
  try {
    const paymentResponse = await axios.post(
      `${API_SERVICE_URL}/api/user/cryptoPayment`,
      paymentRequest,
      {
        headers: {
          'x-api-key': NOMADLY_API_KEY,
          'Authorization': `Bearer ${customerToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('\n✅ PAYMENT CREATED SUCCESSFULLY!');
    console.log('─'.repeat(80));
    console.log('Payment Response:', JSON.stringify(paymentResponse.data, null, 2));
    
    if (paymentResponse.data.data) {
      const { transaction_id, address, qr_code, crypto_amount } = paymentResponse.data.data;
      console.log('\n📝 Payment Details:');
      console.log(`   Transaction ID: ${transaction_id}`);
      console.log(`   Payment Address: ${address}`);
      console.log(`   Amount: ${crypto_amount} USDT-TRC20 (for $${paymentRequest.amount} USD)`);
      console.log(`   QR Code: ${qr_code ? 'Generated ✓' : 'Not available'}`);
      console.log();
      console.log('🔗 Customer should send USDT-TRC20 to the address above');
    }
    
  } catch (error) {
    console.error('\n❌ PAYMENT CREATION FAILED!');
    console.error('─'.repeat(80));
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
      
      // Detailed error analysis
      if (error.response.status === 400) {
        console.error('\n💡 Analysis: This is likely the wallet validation error');
        console.error('   The merchant needs to have USDT-TRC20 wallet configured for company_id=3');
      }
    } else if (error.request) {
      console.error('No response received from server');
      console.error('Error:', error.message);
    } else {
      console.error('Error:', error.message);
    }
    return;
  }

  // Step 4: Get Supported Currencies
  console.log('\n💱 Step 4: Check Supported Currencies');
  console.log('─'.repeat(80));
  
  try {
    const currenciesResponse = await axios.get(
      `${API_SERVICE_URL}/api/getSupportedCurrency`,
      {
        headers: {
          'x-api-key': NOMADLY_API_KEY,
          'Authorization': `Bearer ${customerToken}`
        }
      }
    );
    
    console.log('Supported Currencies:', currenciesResponse.data.data);
    console.log('✅ Total supported:', currenciesResponse.data.data.length);
  } catch (error) {
    console.error('❌ Error getting supported currencies:', error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETED');
  console.log('='.repeat(80));
}

// Run the test
testNomadlyPayment().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
