const { KeyManagementServiceClient } = require('@google-cloud/kms');
const crc32c = require('fast-crc32c');
const { Client } = require('pg');
require('dotenv').config();

async function testKMSDirectly() {
  try {
    console.log('='.repeat(80));
    console.log('DIRECT KMS DECRYPTION TEST');
    console.log('='.repeat(80));
    console.log();

    // Get encrypted data from database
    const dbClient = new Client({
      host: process.env.HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.USER_NAME,
      password: process.env.PASSWORD,
    });

    await dbClient.connect();
    const result = await dbClient.query(`
      SELECT xpub_mnemonic FROM tbl_admin_wallet 
      WHERE wallet_type = 'USDT-TRC20'
    `);
    await dbClient.end();

    const ciphertext = result.rows[0].xpub_mnemonic;
    console.log('Encrypted data from database:');
    console.log(`  Length: ${ciphertext.length} chars`);
    console.log(`  First 50: ${ciphertext.substring(0, 50)}...`);
    console.log();

    // Setup KMS client
    const privateKey = process.env.GOOGLE_CLIENT_KEY?.replace(/\\n/g, '\n');
    const kmsClient = new KeyManagementServiceClient({
      credentials: {
        type: "service_account",
        project_id: process.env.PROJECT_ID,
        private_key_id: process.env.PRIVATE_KEY_ID,
        private_key: privateKey,
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      },
    });

    const keyName = kmsClient.cryptoKeyPath(
      process.env.PROJECT_ID,
      process.env.LOCATION_ID,
      process.env.KEY_RING_ID,
      process.env.XPUB_KEY_ID
    );

    console.log('KMS Key Path:', keyName);
    console.log();

    // Test with atob (original method)
    console.log('Method 1: Using atob()');
    try {
      const buffer1 = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
      console.log(`  Buffer length: ${buffer1.length} bytes`);
      
      const checksum1 = crc32c.calculate(Buffer.from(buffer1));
      console.log(`  CRC32C checksum: ${checksum1}`);
      
      const [decryptResponse1] = await kmsClient.decrypt({
        name: keyName,
        ciphertext: buffer1,
        ciphertextCrc32c: { value: checksum1 },
      });
      
      console.log('  ✅ SUCCESS! Decryption worked');
      const plaintext1 = decryptResponse1.plaintext.toString();
      console.log(`  Decrypted length: ${plaintext1.length} chars`);
      console.log(`  First 50 chars: ${plaintext1.substring(0, 50)}`);
    } catch (e) {
      console.log(`  ❌ FAILED: ${e.message}`);
    }

    console.log();
    
    // Test with Buffer.from (alternative method)
    console.log('Method 2: Using Buffer.from()');
    try {
      const buffer2 = Buffer.from(ciphertext, 'base64');
      console.log(`  Buffer length: ${buffer2.length} bytes`);
      
      const checksum2 = crc32c.calculate(buffer2);
      console.log(`  CRC32C checksum: ${checksum2}`);
      
      const [decryptResponse2] = await kmsClient.decrypt({
        name: keyName,
        ciphertext: buffer2,
        ciphertextCrc32c: { value: checksum2 },
      });
      
      console.log('  ✅ SUCCESS! Decryption worked');
      const plaintext2 = decryptResponse2.plaintext.toString();
      console.log(`  Decrypted length: ${plaintext2.length} chars`);
      console.log(`  First 50 chars: ${plaintext2.substring(0, 50)}`);
    } catch (e) {
      console.log(`  ❌ FAILED: ${e.message}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testKMSDirectly();
