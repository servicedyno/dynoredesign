require('dotenv').config();

const key = process.env.GOOGLE_CLIENT_KEY;
const fixed = key.replace(/\\n/g, '\n');

console.log('='.repeat(80));
console.log('PRIVATE KEY LINE COUNT ANALYSIS');
console.log('='.repeat(80));
console.log();

const lines = fixed.split('\n');
console.log(`Total lines: ${lines.length}`);
console.log();

console.log('All lines:');
lines.forEach((line, i) => {
  if (i === 0 || i === lines.length - 1) {
    console.log(`Line ${i + 1}: ${line}`);
  } else {
    console.log(`Line ${i + 1}: ${line.substring(0, 64)}... (length: ${line.length})`);
  }
});

console.log();
console.log('EXPECTED FORMAT:');
console.log('  -----BEGIN PRIVATE KEY-----');
console.log('  base64line1 (64 chars)');
console.log('  base64line2 (64 chars)');
console.log('  ...');
console.log('  base64lineN (remaining chars)');
console.log('  -----END PRIVATE KEY-----');
console.log();

console.log('ACTUAL FORMAT:');
if (lines.length === 3) {
  console.log('  ❌ All base64 content is on ONE line!');
  console.log('  This is INVALID for PEM format');
  console.log('  Google Cloud KMS expects proper PEM line breaks (64 chars per line)');
} else if (lines.length >= 27) {
  console.log('  ✅ Properly formatted with line breaks');
} else {
  console.log(`  ⚠️  Unexpected line count: ${lines.length}`);
}

console.log();
console.log('ROOT CAUSE:');
console.log('  The .env file has the private key with \\n for newlines,');
console.log('  but the key body should ALSO have \\n every 64 characters.');
console.log('  Currently, the entire key body is one long line.');
console.log();
console.log('SOLUTION:');
console.log('  Need to properly format the private key in .env with:');
console.log('  1. Newlines between header/body/footer');
console.log('  2. Newlines every 64 characters in the body');
