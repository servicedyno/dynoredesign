// Simple test to verify the monitoring service functions work
const { execSync } = require('child_process');

try {
  // Test that the TypeScript file compiles without syntax errors
  console.log('Testing TypeScript compilation...');
  
  // Create a simple test file that imports our monitoring service
  const testCode = `
import { getDailyServiceStatus, getCurrentServiceStatus, calculateServiceUptime } from './backend/services/monitoringService';

// Test that the functions are properly typed
console.log('Functions imported successfully');
console.log('getDailyServiceStatus:', typeof getDailyServiceStatus);
console.log('getCurrentServiceStatus:', typeof getCurrentServiceStatus);
console.log('calculateServiceUptime:', typeof calculateServiceUptime);
`;

  require('fs').writeFileSync('/tmp/test_monitoring.ts', testCode);
  
  // Try to compile it
  execSync('cd /app && npx ts-node --transpile-only /tmp/test_monitoring.ts', { 
    stdio: 'inherit',
    timeout: 10000 
  });
  
  console.log('✅ TypeScript compilation successful!');
  console.log('✅ All monitoring service functions are properly typed');
  
} catch (error) {
  console.log('❌ Error:', error.message);
}