require('dotenv').config();

console.log('='.repeat(80));
console.log('KMS KEY PATH ANALYSIS');
console.log('='.repeat(80));
console.log();

const projectId = process.env.PROJECT_ID;
const locationId = process.env.LOCATION_ID;
const keyRingId = process.env.KEY_RING_ID;
const keyId = process.env.XPUB_KEY_ID;

console.log('Environment Variables:');
console.log(`  PROJECT_ID: ${projectId}`);
console.log(`  LOCATION_ID: ${locationId}`);
console.log(`  KEY_RING_ID: ${keyRingId}`);
console.log(`  XPUB_KEY_ID: ${keyId}`);
console.log();

// Construct the key name as the code does
const keyName = `projects/${projectId}/locations/${locationId}/keyRings/${keyRingId}/cryptoKeys/${keyId}`;
console.log('Constructed Key Name:');
console.log(`  ${keyName}`);
console.log(`  Length: ${keyName.length} characters`);
console.log();

// The embedded key name from the encrypted data should match this
console.log('Expected key name in encrypted data:');
console.log('  The first field of the KMS encrypted blob contains the key resource name');
console.log('  This must match the key used for decryption');
console.log();

console.log('Analysis:');
console.log('  The encrypted data was created with a specific KMS key');
console.log('  If the key name doesn\'t match, decryption will fail with checksum error');
console.log('  The checksum error might be misleading - it\'s actually a key mismatch');
console.log();

console.log('Possible Issues:');
console.log('  1. Production data encrypted with production KMS key');
console.log('  2. Development environment using different KMS key');
console.log('  3. Key name/path changed after data was encrypted');
console.log('  4. Wrong PROJECT_ID, LOCATION_ID, KEY_RING_ID, or XPUB_KEY_ID');
console.log();

console.log('To verify:');
console.log('  - Check if this is production or development database');
console.log('  - Ensure KMS key matches the environment');
console.log('  - Verify all environment variables are correct');
