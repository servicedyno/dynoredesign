/**
 * Binance API Connectivity Test Script
 * Tests Binance integration with proxy support
 */

import * as binanceService from '../services/binanceService';

async function testBinanceConnection() {
  console.log('🧪 Testing Binance API Connection\n');
  console.log('=' .repeat(50));
  
  const proxyUrl = process.env.BINANCE_PROXY_URL;
  if (proxyUrl) {
    console.log(`🌐 Using proxy: ${proxyUrl}`);
  } else {
    console.log('⚠️  No proxy configured (may fail from US IPs)');
  }
  console.log('=' .repeat(50) + '\n');
  
  let testsPass = 0;
  let testsFail = 0;
  
  // Test 1: Server Time (Public endpoint, no auth required)
  try {
    console.log('Test 1: Server Time (public endpoint)');
    console.log('Endpoint: GET /api/v3/time');
    const serverTime = await binanceService.getServerTime();
    const date = new Date(serverTime);
    console.log(`✅ SUCCESS - Server time: ${date.toISOString()}`);
    console.log(`   Timestamp: ${serverTime}\n`);
    testsPass++;
  } catch (error) {
    console.error(`❌ FAILED - ${error.message}\n`);
    testsFail++;
  }
  
  // Test 2: Ping (Connectivity check)
  try {
    console.log('Test 2: Ping (connectivity check)');
    console.log('Endpoint: GET /api/v3/ping');
    await binanceService.ping();
    console.log('✅ SUCCESS - Ping successful\n');
    testsPass++;
  } catch (error) {
    console.error(`❌ FAILED - ${error.message}\n`);
    testsFail++;
  }
  
  // Test 3: Exchange Info (Public endpoint with data)
  try {
    console.log('Test 3: Exchange Info (public endpoint)');
    console.log('Endpoint: GET /api/v3/exchangeInfo');
    const exchangeInfo = await binanceService.getExchangeInfo();
    const symbolCount = exchangeInfo.symbols?.length || 0;
    console.log(`✅ SUCCESS - Exchange info retrieved`);
    console.log(`   Trading pairs available: ${symbolCount}\n`);
    testsPass++;
  } catch (error) {
    console.error(`❌ FAILED - ${error.message}\n`);
    testsFail++;
  }
  
  // Test 4: Account Info (Requires API key)
  const hasApiKey = process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET;
  if (hasApiKey) {
    try {
      console.log('Test 4: Account Info (requires authentication)');
      console.log('Endpoint: GET /api/v3/account');
      const accountInfo = await binanceService.getAccountInfo();
      const balanceCount = accountInfo.balances?.length || 0;
      console.log(`✅ SUCCESS - Account info retrieved`);
      console.log(`   Account type: ${accountInfo.accountType || 'SPOT'}`);
      console.log(`   Balance entries: ${balanceCount}\n`);
      testsPass++;
    } catch (error) {
      console.error(`❌ FAILED - ${error.message}`);
      console.error('   Check your BINANCE_API_KEY and BINANCE_API_SECRET\n');
      testsFail++;
    }
  } else {
    console.log('Test 4: Account Info - ⏭️  SKIPPED (no API key configured)\n');
  }
  
  // Test 5: Convert Quote (Requires API key and trading permission)
  if (hasApiKey) {
    try {
      console.log('Test 5: Convert Quote (BTC → USDT)');
      console.log('Endpoint: POST /sapi/v1/convert/getQuote');
      const quote = await binanceService.getConvertQuote('BTC', 'USDT', 0.001);
      console.log(`✅ SUCCESS - Quote received`);
      console.log(`   From: 0.001 BTC`);
      console.log(`   To: ${quote.toAmount} USDT`);
      console.log(`   Quote ID: ${quote.quoteId}\n`);
      testsPass++;
    } catch (error) {
      console.error(`❌ FAILED - ${error.message}`);
      if (error.message.includes('-2015')) {
        console.error('   API key may not have "Enable Trading" permission');
      }
      console.log('');
      testsFail++;
    }
  } else {
    console.log('Test 5: Convert Quote - ⏭️  SKIPPED (no API key configured)\n');
  }
  
  // Summary
  console.log('=' .repeat(50));
  console.log('📊 Test Summary');
  console.log('=' .repeat(50));
  console.log(`✅ Tests Passed: ${testsPass}`);
  console.log(`❌ Tests Failed: ${testsFail}`);
  console.log(`📝 Total Tests: ${testsPass + testsFail}`);
  
  if (testsFail === 0 && testsPass >= 3) {
    console.log('\n🎉 All tests passed! Binance integration is working correctly.');
    console.log('✅ You can now test the auto-stablecoin conversion feature.\n');
    process.exit(0);
  } else if (testsPass >= 3) {
    console.log('\n⚠️  Some tests failed, but basic connectivity works.');
    console.log('   Public endpoints: ✅ Working');
    console.log('   Authenticated endpoints: Check API credentials\n');
    process.exit(0);
  } else {
    console.log('\n❌ Connection tests failed.');
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Check if BINANCE_PROXY_URL is set correctly');
    console.log('   2. Verify proxy server is reachable');
    console.log('   3. Test proxy: curl -x $BINANCE_PROXY_URL https://api.binance.com/api/v3/time');
    console.log('   4. Try a different proxy server');
    console.log('   5. See /app/BINANCE_TESTING_GUIDE.md for more help\n');
    process.exit(1);
  }
}

// Run tests
testBinanceConnection().catch((error) => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
