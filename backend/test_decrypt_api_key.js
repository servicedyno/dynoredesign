const crypto = require('crypto');
require('dotenv').config();

const API_SECRET = process.env.API_SECRET;
const CYPHER_KEY = process.env.CYPHER_KEY;

// Nomadly API Key provided by user
const encryptedApiKey = 'U2FsdGVkX18Y1r7820X9rwDR1ENhHV1PMQyOKXFi3x9mgJyh4TRNAkk3aTkA1gu6DThmC/ncmerkXaqFt640z1iSdC6i84p9+OLVrqL2ojp+7CJ5+d5bAy4jaulxC+UG';

function decrypt(encryptedMessage, key) {
  try {
    const keyBuffer = Buffer.from(key, 'utf-8');
    const keyHash = crypto.createHash('sha256').update(keyBuffer).digest();
    
    const encrypted = Buffer.from(encryptedMessage, 'base64').toString('utf-8');
    
    if (!encrypted.startsWith('Salted__')) {
      console.error('Invalid encrypted data format - missing Salted__ prefix');
      return null;
    }
    
    const encryptedBuffer = Buffer.from(encryptedMessage, 'base64');
    const salt = encryptedBuffer.subarray(8, 16);
    const ciphertext = encryptedBuffer.subarray(16);
    
    const rounds = 1;
    let data = Buffer.concat([keyHash, salt]);
    
    for (let i = 0; i < rounds; i++) {
      data = crypto.createHash('md5').update(data).digest();
    }
    
    const key32 = data.subarray(0, 32);
    const iv = data.subarray(32, 48);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key32, iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    
    return decrypted.toString('utf-8');
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
