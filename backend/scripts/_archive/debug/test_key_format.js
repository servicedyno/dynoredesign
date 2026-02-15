require('dotenv').config();

console.log('='.repeat(80));
console.log('GOOGLE_CLIENT_KEY ANALYSIS');
console.log('='.repeat(80));
console.log();

const key = process.env.GOOGLE_CLIENT_KEY;

console.log('Key stats:');
console.log(`  Total length: ${key.length}`);
console.log(`  Contains \\n (escaped): ${key.includes('\\n')}`);
console.log(`  Contains real newline: ${key.includes('\n')}`);
console.log();

console.log('First 200 characters:');
console.log(key.substring(0, 200));
console.log();

console.log('Test replacement:');
const fixed = key.replace(/\\n/g, '\n');
console.log(`  After replace length: ${fixed.length}`);
console.log(`  Contains \\n (escaped): ${fixed.includes('\\n')}`);
console.log(`  Contains real newline: ${fixed.includes('\n')}`);
console.log();

console.log('First 200 characters after replacement:');
console.log(fixed.substring(0, 200));
console.log();

// Check if the key is actually correct format
const lines = fixed.split('\n');
console.log(`Number of lines after split: ${lines.length}`);
console.log('First 5 lines:');
lines.slice(0, 5).forEach((line, i) => {
  console.log(`  ${i + 1}: ${line}`);
});

console.log();
console.log('ANALYSIS:');
if (key.includes('\\n') && !key.includes('\n')) {
  console.log('  ✅ Key has escaped newlines (\\n) - will be fixed by .replace()');
} else if (!key.includes('\\n') && key.includes('\n')) {
  console.log('  ✅ Key already has real newlines - no replacement needed');
} else {
  console.log('  ⚠️  Unusual key format - investigate further');
}
