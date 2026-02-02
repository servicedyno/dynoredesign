require('dotenv').config();

console.log('='.repeat(80));
console.log('ENVIRONMENT VERIFICATION');
console.log('='.repeat(80));
console.log();

console.log('Node.js version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log();

console.log('Critical Environment Variables:');
console.log(`  PROJECT_ID: ${process.env.PROJECT_ID}`);
console.log(`  LOCATION_ID: ${process.env.LOCATION_ID}`);
console.log(`  KEY_RING_ID: ${process.env.KEY_RING_ID}`);
console.log(`  XPUB_KEY_ID: ${process.env.XPUB_KEY_ID}`);
console.log(`  PRIVATE_KEY_ID: ${process.env.PRIVATE_KEY_ID}`);
console.log(`  GOOGLE_CLIENT_EMAIL: ${process.env.GOOGLE_CLIENT_EMAIL}`);
console.log();

const key = process.env.GOOGLE_CLIENT_KEY;
if (key) {
  const lines = key.replace(/\\n/g, '\n').split('\n');
  console.log(`GOOGLE_CLIENT_KEY lines: ${lines.length}`);
  console.log(`  First line: ${lines[0]}`);
  console.log(`  Last line: ${lines[lines.length - 1]}`);
} else {
  console.log('❌ GOOGLE_CLIENT_KEY not found!');
}

console.log();
console.log('Expected KMS Key Path:');
const keyPath = `projects/${process.env.PROJECT_ID}/locations/${process.env.LOCATION_ID}/keyRings/${process.env.KEY_RING_ID}/cryptoKeys/${process.env.XPUB_KEY_ID}`;
console.log(`  ${keyPath}`);
console.log();

// Test atob function
console.log('Testing atob function:');
const testBase64 = 'SGVsbG8gV29ybGQ=';
try {
  const decoded = atob(testBase64);
  console.log(`  atob exists: YES`);
  console.log(`  atob('${testBase64}') = '${decoded}'`);
} catch (e) {
  console.log(`  ❌ atob error: ${e.message}`);
}
