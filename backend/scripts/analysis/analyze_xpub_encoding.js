const { Client } = require('pg');
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
    
    // Try to decode
    try {
      const buffer = Buffer.from(xpubMnemonic, 'base64');
      console.log('Buffer decoding successful:');
      console.log(`  Buffer length: ${buffer.length} bytes`);
      console.log(`  First 50 bytes (hex): ${buffer.slice(0, 50).toString('hex')}`);
      console.log(`  Last 20 bytes (hex): ${buffer.slice(-20).toString('hex')}`);
      console.log();
      
      // Check if it's a KMS encrypted blob
      console.log('KMS blob analysis:');
      console.log(`  First byte: 0x${buffer[0].toString(16).padStart(2, '0')}`);
      console.log(`  Second byte: 0x${buffer[1].toString(16).padStart(2, '0')}`);
      console.log(`  Third byte: 0x${buffer[2].toString(16).padStart(2, '0')}`);
      console.log();
      
      // KMS encrypted data structure (Protocol Buffer):
      // Field 1 (name): tag 0x0a (field 1, wire type 2 = length-delimited)
      if (buffer[0] === 0x0a) {
        console.log('  ✅ Starts with 0x0a - valid KMS encrypted blob structure');
        const nameLength = buffer[1];
        console.log(`  Field 1 (name) length: ${nameLength} bytes`);
        const nameEnd = 2 + nameLength;
        const name = buffer.slice(2, nameEnd).toString('utf-8');
        console.log(`  Key name: ${name}`);
        console.log();
        
        // Next should be ciphertext field
        if (buffer[nameEnd] === 0x12) {
          console.log('  ✅ Field 2 found (0x12) - ciphertext field');
        } else {
          console.log(`  ⚠️  Expected 0x12, got 0x${buffer[nameEnd].toString(16)}`);
        }
      } else {
        console.log('  ⚠️  Does NOT start with 0x0a - unexpected format');
        console.log('  This might not be KMS-encrypted data');
      }
      
    } catch (decodeError) {
      console.error('❌ Buffer decoding failed:', decodeError.message);
    }
    
    // Compare atob vs Buffer.from methods
    console.log('\nComparing decoding methods:');
    const buffer1 = Buffer.from(xpubMnemonic, 'base64');
    const atobEquiv = Buffer.from(xpubMnemonic, 'base64').toString('binary');
    const buffer2 = Uint8Array.from(atobEquiv, (c) => c.charCodeAt(0));
    
    console.log(`  Buffer.from() length: ${buffer1.length}`);
    console.log(`  atob-style length: ${buffer2.length}`);
    console.log(`  Buffers match: ${buffer1.length === buffer2.length && Buffer.from(buffer2).equals(buffer1)}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

analyzeXpubEncoding();
