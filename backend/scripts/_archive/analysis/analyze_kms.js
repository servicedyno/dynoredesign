const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.USER_NAME,
  password: process.env.PASSWORD,
});

async function analyzeKMSData() {
  try {
    await client.connect();
    console.log('='.repeat(80));
    console.log('KMS DATA ANALYSIS');
    console.log('='.repeat(80));
    console.log();

    // Check admin wallet for USDT-TRC20
    const adminWallet = await client.query(`
      SELECT 
        wallet_id,
        wallet_type,
        xpub_mnemonic,
        LENGTH(xpub_mnemonic) as xpub_length,
        SUBSTRING(xpub_mnemonic, 1, 50) as xpub_preview
      FROM tbl_admin_wallet 
      WHERE wallet_type = 'USDT-TRC20'
    `);
    
    if (adminWallet.rows.length === 0) {
      console.log('❌ No USDT-TRC20 admin wallet found');
      return;
    }
    
    const wallet = adminWallet.rows[0];
    console.log('Admin Wallet Data:');
    console.log(`  Wallet ID: ${wallet.wallet_id}`);
    console.log(`  Wallet Type: ${wallet.wallet_type}`);
    console.log(`  xpub_mnemonic length: ${wallet.xpub_length} characters`);
    console.log(`  xpub_mnemonic preview: ${wallet.xpub_preview}...`);
    console.log();
    
    // Check if it looks like base64
    const isBase64 = /^[A-Za-z0-9+/=]+$/.test(wallet.xpub_mnemonic);
    console.log(`  Looks like base64: ${isBase64 ? '✅' : '❌'}`);
    
    // Check if it looks like JSON
    const looksLikeJSON = wallet.xpub_mnemonic.trim().startsWith('{');
    console.log(`  Looks like JSON: ${looksLikeJSON ? '✅' : '❌'}`);
    
    console.log();
    console.log('Expected Format:');
    console.log('  - Should be base64-encoded encrypted data from Google KMS');
    console.log('  - When decrypted, should contain JSON with xpub and mnemonic');
    console.log();
    
    // Check environment configuration
    console.log('Environment Configuration:');
    console.log(`  PROJECT_ID: ${process.env.PROJECT_ID}`);
    console.log(`  LOCATION_ID: ${process.env.LOCATION_ID}`);
    console.log(`  KEY_RING_ID: ${process.env.KEY_RING_ID}`);
    console.log(`  XPUB_KEY_ID: ${process.env.XPUB_KEY_ID}`);
    console.log(`  GOOGLE_CLIENT_EMAIL: ${process.env.GOOGLE_CLIENT_EMAIL}`);
    console.log(`  GOOGLE_CLIENT_KEY exists: ${!!process.env.GOOGLE_CLIENT_KEY}`);
    console.log(`  GOOGLE_CLIENT_KEY length: ${process.env.GOOGLE_CLIENT_KEY?.length}`);
    console.log(`  GOOGLE_CLIENT_KEY has \\n: ${process.env.GOOGLE_CLIENT_KEY?.includes('\\n') ? '✅' : '❌'}`);
    console.log(`  GOOGLE_CLIENT_KEY has real newlines: ${process.env.GOOGLE_CLIENT_KEY?.includes('\n') ? '✅' : '❌'}`);
    console.log();
    
    // Check other admin wallets
    console.log('Other Admin Wallets:');
    const allWallets = await client.query(`
      SELECT wallet_type, LENGTH(xpub_mnemonic) as length
      FROM tbl_admin_wallet
      WHERE currency_type = 'CRYPTO'
      ORDER BY wallet_type
    `);
    
    allWallets.rows.forEach(w => {
      console.log(`  - ${w.wallet_type}: ${w.length} chars`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

analyzeKMSData();
