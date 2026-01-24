require('dotenv').config();

console.log('='.repeat(80));
console.log('FIX GOOGLE_CLIENT_KEY FORMAT');
console.log('='.repeat(80));
console.log();

const key = process.env.GOOGLE_CLIENT_KEY;
const unescaped = key.replace(/\\n/g, '\n');
const lines = unescaped.split('\n');

console.log(`Original lines: ${lines.length}`);

if (lines.length === 3) {
  console.log('Fixing improperly formatted key...\n');
  
  const header = lines[0];
  const body = lines[1];
  const footer = lines[2];
  
  // Split body into 64-character chunks
  const chunks = [];
  for (let i = 0; i < body.length; i += 64) {
    chunks.push(body.substring(i, i + 64));
  }
  
  // Reconstruct properly formatted key
  const properKey = [header, ...chunks, footer].join('\n');
  
  console.log('Properly formatted key:');
  console.log('─'.repeat(80));
  console.log(properKey);
  console.log('─'.repeat(80));
  console.log();
  console.log(`New line count: ${properKey.split('\n').length} lines`);
  console.log();
  
  // Create escaped version for .env
  const escapedKey = properKey.replace(/\n/g, '\\n');
  
  console.log('.env format (copy this to your .env file):');
  console.log('─'.repeat(80));
  console.log(`GOOGLE_CLIENT_KEY=${escapedKey}`);
  console.log('─'.repeat(80));
  console.log();
  
  console.log('✅ Key is now properly formatted with 64-char lines');
  
} else {
  console.log('✅ Key is already properly formatted');
}
