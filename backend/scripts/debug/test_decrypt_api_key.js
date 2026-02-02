const CryptoJS = require('crypto-js');
require('dotenv').config();

const API_SECRET = process.env.API_SECRET;
const CYPHER_KEY = process.env.CYPHER_KEY;

// Nomadly API Key provided by user
const encryptedApiKey = 'U2FsdGVkX18Y1r7820X9rwDR1ENhHV1PMQyOKXFi3x9mgJyh4TRNAkk3aTkA1gu6DThmC/ncmerkXaqFt640z1iSdC6i84p9+OLVrqL2ojp+7CJ5+d5bAy4jaulxC+UG';

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

console.log('=== Testing Nomadly API Key Decryption ===\n');
console.log('Encrypted API Key:', encryptedApiKey);
console.log('API_SECRET:', API_SECRET);
console.log('\nAttempting decryption...\n');

const decrypted = decrypt(encryptedApiKey, API_SECRET);

if (decrypted) {
  console.log('✅ Decryption successful!');
  console.log('Decrypted value:', decrypted);
  
  if (decrypted.includes('DYNOPAY_USER_API')) {
    console.log('\n✅ Valid DynoPay API key format detected');
    
    const parts = decrypted.split('-');
    console.log('\nAPI Key Structure:');
    console.log('- Prefix:', parts[0]);
    
    if (parts[1]) {
      try {
        const apiData = JSON.parse(parts[1]);
        console.log('- API Data:', JSON.stringify(apiData, null, 2));
        console.log('\nExtracted Information:');
        console.log('  - Company ID:', apiData.company_id);
        console.log('  - Admin/User ID:', apiData.adm_id);
        console.log('  - Base Currency:', apiData.base_currency);
        console.log('  - API Name:', apiData.api_name);
      } catch (e) {
        console.log('- API Data (raw):', parts[1]);
        console.log('  ⚠️  Could not parse as JSON');
      }
    }
  } else {
    console.log('\n❌ Not a valid DynoPay API key format');
  }
} else {
  console.log('❌ Decryption failed');
}
