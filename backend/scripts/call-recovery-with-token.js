/**
 * Generate admin JWT token and call recovery endpoint
 */
const jwt = require('jsonwebtoken');
const https = require('https');
const http = require('http');

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const PAYMENT_ID = '13a02388-f14e-4d03-b1dd-5e40cd4de2fb';

async function callRecoveryEndpoint() {
  console.log('🔧 Generating Admin Token & Calling Recovery Endpoint');
  console.log('======================================================\n');
  
  // Generate admin JWT token
  const adminToken = jwt.sign(
    {
      user_id: 1,
      email: 'admin@dynopay.com',
      role: 'ADMIN',
      name: 'System Admin',
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: '1h' }
  );
  
  console.log('✅ Admin JWT token generated');
  console.log('Token:', adminToken.substring(0, 50) + '...\n');
  
  // Prepare request
  const url = new URL(`${API_URL}/api/diagnostics/recover-stuck-payment`);
  const isHttps = url.protocol === 'https:';
  const client = isHttps ? https : http;
  
  const postData = JSON.stringify({
    payment_id: PAYMENT_ID
  });
  
  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': `Bearer ${adminToken}`,
    },
  };
  
  console.log('📡 Calling recovery endpoint...');
  console.log('URL:', `${url.protocol}//${url.hostname}${url.pathname}`);
  console.log('Payment ID:', PAYMENT_ID);
  console.log('');
  
  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('📥 Response Status:', res.statusCode);
        console.log('📥 Response Body:\n');
        
        try {
          const response = JSON.parse(data);
          console.log(JSON.stringify(response, null, 2));
          
          if (res.statusCode === 200 && response.status === 'success') {
            console.log('\n✅ PAYMENT RECOVERY SUCCESSFUL!');
            console.log('TX Hash:', response.tx_id);
          } else if (response.error) {
            console.log('\n❌ Error:', response.error);
          }
          
          resolve(response);
        } catch (e) {
          console.log(data);
          resolve(data);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request Error:', error.message);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

callRecoveryEndpoint()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
