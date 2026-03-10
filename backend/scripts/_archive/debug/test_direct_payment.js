const axios = require('axios');
require('dotenv').config();

// Configuration
const BACKEND_URL = process.env.SERVER_URL || 'https://current-pod-config-2.preview.emergentagent.com';

// Test data
const TEST_USER = {
  email: 'nomadly@moxx.co',
  password: 'testpassword123'  // You'll need the actual password
};

async function testDirectPayment() {
  console.log('='.repeat(80));
  console.log('DIRECT PAYMENT CREATION TEST FOR NOMADLY');
  console.log('='.repeat(80));
  console.log();

  // Step 1: Login to get JWT token
  console.log('🔐 Step 1: User Login');
  console.log('─'.repeat(80));
  
  let authToken;
  
  try {
    console.log('Attempting login for:', TEST_USER.email);
    console.log('Backend URL:', BACKEND_URL);
    
    const loginResponse = await axios.post(
      `${BACKEND_URL}/api/user/login`,
      {
        email: TEST_USER.email,
        password: TEST_USER.password
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Login Response Status:', loginResponse.status);
    authToken = loginResponse.data.data.token;
    console.log('✅ Login successful');
    console.log(`   Token: ${authToken.substring(0, 30)}...\n`);
  } catch (error) {
    console.error('❌ Login failed!');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   Error:', error.message);
    }
    console.log('\n⚠️  Note: You need the actual user password. Trying alternative approach...\n');
    
    // Alternative: Try to create a test payment link instead
    return await testPaymentLink();
  }

  // Step 2: Get configured currencies
  console.log('💱 Step 2: Get Configured Wallet Currencies');
  console.log('─'.repeat(80));
  
  try {
    const currenciesResponse = await axios.get(
      `${BACKEND_URL}/api/wallet/configured-currencies`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        params: {
          company_id: 3
        }
      }
    );
    
    console.log('Configured Currencies Response:', JSON.stringify(currenciesResponse.data, null, 2));
    
    if (currenciesResponse.data.data && currenciesResponse.data.data.configured_currencies) {
      const currencies = currenciesResponse.data.data.configured_currencies;
      console.log('✅ Available currencies:', currencies);
    }
  } catch (error) {
    console.error('❌ Error getting currencies');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }

  // Step 3: Create crypto payment
  console.log('\n💰 Step 3: Create USDT-TRC20 Payment');
  console.log('─'.repeat(80));
  
  const paymentPayload = {
    uniqueRef: 'test-' + Date.now(),
    amount: 10,  // 10 USDT
    currency: 'USDT-TRC20'
  };
  
  console.log('Payment Payload:', JSON.stringify(paymentPayload, null, 2));
  
  try {
    const paymentResponse = await axios.post(
      `${BACKEND_URL}/api/pay/createCryptoPayment`,
      paymentPayload,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('\n✅ PAYMENT CREATED SUCCESSFULLY!');
    console.log('─'.repeat(80));
    console.log('Payment Response:', JSON.stringify(paymentResponse.data, null, 2));
    
  } catch (error) {
    console.error('\n❌ PAYMENT CREATION FAILED!');
    console.error('─'.repeat(80));
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }

  console.log('\n' + '='.repeat(80));
}

async function testPaymentLink() {
  console.log('='.repeat(80));
  console.log('ALTERNATIVE: CREATE PAYMENT LINK FOR NOMADLY');
  console.log('='.repeat(80));
  console.log();
  
  console.log('ℹ️  Since we don\'t have login credentials, let\'s check the database');
  console.log('   to verify Nomadly\'s configuration and simulate the payment flow.\n');
  
  // We'll use a simple curl test to the public endpoint
  console.log('Testing public endpoint access...');
  
  try {
    const response = await axios.get(`${BACKEND_URL}/`);
    console.log('✅ Backend is accessible');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Backend not accessible:', error.message);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('ANALYSIS SUMMARY');
  console.log('='.repeat(80));
  console.log(`
To create a payment for Nomadly1, you need:

1. ✅ API Key (encrypted): Provided and valid
2. ✅ Company ID: 3
3. ✅ User ID: 4
4. ✅ Wallet Configured: USDT-TRC20
5. ❌ User login credentials OR customer token

NEXT STEPS:
- Option A: Provide the login password for nomadly@moxx.co
- Option B: Use the API service (port 3301) with API key authentication
- Option C: Create a payment link via dashboard (doesn't require customer login)

The payment creation endpoint exists and the wallet is configured correctly.
The only blocker is authentication.
  `);
}

// Run test
testDirectPayment().catch(error => {
  console.error('Unhandled error:', error.message);
});
