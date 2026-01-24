const { Client } = require('pg');
const crc32c = require('fast-crc32c');
require('dotenv').config();

const client = new Client({
  host: process.env.HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.USER_NAME,
  password: process.env.PASSWORD,
});

async function analyzeXpubEncoding() {
  try {
    await client.connect();
    console.log('='.repeat(80));
    console.log('XPUB_MNEMONIC ENCODING ANALYSIS');
    console.log('='.repeat(80));
    console.log();

    // Get xpub_mnemonic for USDT-TRC20
    const result = await client.query(`
      SELECT xpub_mnemonic FROM tbl_admin_wallet 
      WHERE wallet_type = 'USDT-TRC20'
    `);
    
    const xpubMnemonic = result.rows[0].xpub_mnemonic;
    
    console.log('Raw xpub_mnemonic from database:');
    console.log(`  Length: ${xpubMnemonic.length} characters`);
    console.log(`  First 100 chars: ${xpubMnemonic.substring(0, 100)}`);
    console.log(`  Last 50 chars: ${xpubMnemonic.substring(xpubMnemonic.length - 50)}`);
    console.log();
    
    // Check if it's valid base64
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    const isValidBase64 = base64Regex.test(xpubMnemonic);
    console.log(`Is valid base64: ${isValidBase64}`);
    console.log();
    
    // Try to decode and calculate checksum
    try {
      const buffer = Buffer.from(xpubMnemonic, 'base64');
      console.log('Buffer decoding successful:');
      console.log(`  Buffer length: ${buffer.length} bytes`);
      console.log(`  First 20 bytes (hex): ${buffer.slice(0, 20).toString('hex')}`);
      console.log();
      
      // Calculate CRC32C like the code does
      const checksum = crc32c.calculate(buffer);
      console.log(`CRC32C checksum: ${checksum}`);
      console.log(`CRC32C checksum (hex): 0x${checksum.toString(16)}`);
      console.log();
      
      // Check if it's a KMS encrypted blob (should start with specific bytes)
      console.log('KMS blob analysis:');
      console.log(`  First byte: 0x${buffer[0].toString(16)}`);
      console.log(`  Second byte: 0x${buffer[1].toString(16)}`);
      
      // KMS encrypted data typically starts with 0x0a (field number 1, wire type 2)
      if (buffer[0] === 0x0a) {
        console.log('  ✅ Looks like valid KMS encrypted data (starts with 0x0a)');
      } else {
        console.log('  ⚠️ Unexpected first byte for KMS encrypted data');
      }
      
    } catch (decodeError) {
      console.error('❌ Buffer decoding failed:', decodeError.message);
    }
    
    // Test with atob (browser-style base64 decoding)
    console.log('\nTesting atob-style decoding (as used in code):');
    try {
      const atobBuffer = Uint8Array.from(Buffer.from(xpubMnemonic, 'base64').toString('binary'), (c) => c.charCodeAt(0));
      console.log(`  Uint8Array length: ${atobBuffer.length}`);
      const atobChecksum = crc32c.calculate(Buffer.from(atobBuffer));
      console.log(`  CRC32C checksum: ${atobChecksum}`);
      console.log(`  Matches Buffer method: ${atobChecksum === crc32c.calculate(Buffer.from(xpubMnemonic, 'base64'))}`);
    } catch (atobError) {
      console.error('  Error:', atobError.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

analyzeXpubEncoding();
