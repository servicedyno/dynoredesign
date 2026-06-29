/**
 * Re-onboarding Feature Test Suite
 * Tests the new feature where existing email/phone users can "re-onboard" (login via OTP)
 * instead of getting a 400 "already registered" error.
 */

const axios = require('axios');
const Redis = require('ioredis');

// Configuration
const BASE_URL = 'https://d80dbf30-dcc7-4bc4-bd8b-f0937d6af218.preview.emergentagent.com';
const REDIS_URL = 'redis://default:HAEMJseUAdqAjpiICURxlefSoSYXKEUg@nozomi.proxy.rlwy.net:15794';
const TEST_EMAIL = 'qa.empty.1782626169@dynopaytest.com';
const EXPECTED_USER_ID = 8;
const UNDELIVERABLE_PHONE = '18022100479'; // Account's own DID (undeliverable)

// Initialize Redis client
const redis = new Redis(REDIS_URL, {
  retryStrategy: (times) => {
    if (times > 3) return null;
    return Math.min(times * 200, 2000);
  },
  maxRetriesPerRequest: 3,
});

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper: Log test result
function logTest(testName, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${testName}`);
  if (details) console.log(`   ${details}`);
  
  results.tests.push({ testName, passed, details });
  if (passed) results.passed++;
  else results.failed++;
}

// Helper: Read OTP from Redis
async function readOTPFromRedis(email) {
  try {
    // The OTP is stored at key `otp:<email>` but with `:json` suffix for JSON storage
    const key = `otp:${email}:json`;
    console.log(`   Reading OTP from Redis key: ${key}`);
    
    const value = await redis.get(key);
    if (!value) {
      console.log(`   ⚠️  No value found at key ${key}`);
      return null;
    }
    
    const parsed = JSON.parse(value);
    console.log(`   ✓ OTP retrieved: ${parsed.otp}`);
    return parsed.otp;
  } catch (error) {
    console.error(`   ❌ Error reading OTP from Redis:`, error.message);
    return null;
  }
}

// Helper: Make HTTP request with error handling
async function makeRequest(method, url, data = null, headers = {}) {
  try {
    const config = {
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...headers
      },
      validateStatus: () => true, // Don't throw on any status
    };
    
    if (data) config.data = data;
    
    const response = await axios(config);
    return {
      status: response.status,
      data: response.data,
      headers: response.headers
    };
  } catch (error) {
    console.error(`   ❌ Request error:`, error.message);
    return {
      status: 0,
      data: { error: error.message },
      headers: {}
    };
  }
}

// TEST 1: Email returning-user end-to-end
async function test1_EmailReturningUserE2E() {
  console.log('\n=== TEST 1: Email Returning-User End-to-End ===');
  
  // Step 1a: POST /api/user/registerEmail
  console.log('\n1a. POST /api/user/registerEmail with existing email');
  const step1Response = await makeRequest(
    'POST',
    `${BASE_URL}/api/user/registerEmail`,
    { email: TEST_EMAIL }
  );
  
  console.log(`   Status: ${step1Response.status}`);
  console.log(`   Response:`, JSON.stringify(step1Response.data, null, 2));
  
  // Verify: Should return 200 with existing_user: true
  const step1Pass = 
    step1Response.status === 200 &&
    step1Response.data?.data?.existing_user === true;
  
  logTest(
    'TEST 1a: registerEmail returns 200 with existing_user=true',
    step1Pass,
    `Status: ${step1Response.status}, existing_user: ${step1Response.data?.data?.existing_user}`
  );
  
  if (!step1Pass) {
    console.log('   ⚠️  Skipping remaining steps of TEST 1 due to step 1a failure');
    return;
  }
  
  // Step 1b: Read OTP from Redis
  console.log('\n1b. Read OTP from Redis');
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s for OTP to be written
  
  const otp = await readOTPFromRedis(TEST_EMAIL);
  const step1bPass = otp !== null && /^\d{6}$/.test(otp);
  
  logTest(
    'TEST 1b: OTP retrieved from Redis',
    step1bPass,
    `OTP: ${otp || 'null'}`
  );
  
  if (!step1bPass) {
    console.log('   ⚠️  Skipping step 1c due to OTP retrieval failure');
    return;
  }
  
  // Step 1c: POST /api/user/registerEmail/verify-otp
  console.log('\n1c. POST /api/user/registerEmail/verify-otp with correct OTP');
  const step1cResponse = await makeRequest(
    'POST',
    `${BASE_URL}/api/user/registerEmail/verify-otp`,
    { email: TEST_EMAIL, otp }
  );
  
  console.log(`   Status: ${step1cResponse.status}`);
  console.log(`   Response:`, JSON.stringify(step1cResponse.data, null, 2));
  
  // Verify: Should return 200 with accessToken, existing_user=true, userData.user_id=8
  const hasAccessToken = !!step1cResponse.data?.data?.accessToken;
  const isExistingUser = step1cResponse.data?.data?.existing_user === true;
  const correctUserId = step1cResponse.data?.data?.userData?.user_id === EXPECTED_USER_ID;
  
  const step1cPass = 
    step1cResponse.status === 200 &&
    hasAccessToken &&
    isExistingUser &&
    correctUserId;
  
  logTest(
    'TEST 1c: verify-otp logs in existing user',
    step1cPass,
    `Status: ${step1cResponse.status}, accessToken: ${hasAccessToken ? 'present' : 'missing'}, existing_user: ${isExistingUser}, user_id: ${step1cResponse.data?.data?.userData?.user_id}`
  );
  
  // Additional checks
  if (step1cResponse.status === 200) {
    logTest(
      'TEST 1c-extra: accessToken is non-empty',
      hasAccessToken && step1cResponse.data.data.accessToken.length > 20,
      `Token length: ${step1cResponse.data?.data?.accessToken?.length || 0}`
    );
    
    logTest(
      'TEST 1c-extra: user_id matches expected',
      correctUserId,
      `Expected: ${EXPECTED_USER_ID}, Got: ${step1cResponse.data?.data?.userData?.user_id}`
    );
  }
}

// TEST 2: Wrong OTP rejected
async function test2_WrongOTPRejected() {
  console.log('\n=== TEST 2: Wrong OTP Rejected ===');
  
  // Step 2a: POST /api/user/registerEmail (send fresh OTP)
  console.log('\n2a. POST /api/user/registerEmail to send fresh OTP');
  const step2aResponse = await makeRequest(
    'POST',
    `${BASE_URL}/api/user/registerEmail`,
    { email: TEST_EMAIL }
  );
  
  console.log(`   Status: ${step2aResponse.status}`);
  const step2aPass = 
    step2aResponse.status === 200 &&
    step2aResponse.data?.data?.existing_user === true;
  
  logTest(
    'TEST 2a: registerEmail sends fresh OTP',
    step2aPass,
    `Status: ${step2aResponse.status}, existing_user: ${step2aResponse.data?.data?.existing_user}`
  );
  
  if (!step2aPass) {
    console.log('   ⚠️  Skipping step 2b due to step 2a failure');
    return;
  }
  
  // Step 2b: POST /api/user/registerEmail/verify-otp with wrong OTP
  console.log('\n2b. POST /api/user/registerEmail/verify-otp with wrong OTP');
  
  // Read the real OTP to ensure we use a different one
  await new Promise(resolve => setTimeout(resolve, 1000));
  const realOtp = await readOTPFromRedis(TEST_EMAIL);
  let wrongOtp = '000000';
  
  // If 000000 happens to be the real OTP, use 111111
  if (realOtp === '000000') {
    wrongOtp = '111111';
    console.log('   ℹ️  Real OTP is 000000, using 111111 as wrong OTP');
  }
  
  const step2bResponse = await makeRequest(
    'POST',
    `${BASE_URL}/api/user/registerEmail/verify-otp`,
    { email: TEST_EMAIL, otp: wrongOtp }
  );
  
  console.log(`   Status: ${step2bResponse.status}`);
  console.log(`   Response:`, JSON.stringify(step2bResponse.data, null, 2));
  
  // Verify: Should return 400 "Invalid verification code."
  const step2bPass = 
    step2bResponse.status === 400 &&
    step2bResponse.data?.message?.toLowerCase().includes('invalid');
  
  logTest(
    'TEST 2b: Wrong OTP returns 400 Invalid',
    step2bPass,
    `Status: ${step2bResponse.status}, Message: "${step2bResponse.data?.message}"`
  );
  
  // Ensure it's NOT 500 and NOT a login/token
  const noServerError = step2bResponse.status !== 500;
  const noToken = !step2bResponse.data?.data?.accessToken;
  
  logTest(
    'TEST 2b-extra: No 500 error',
    noServerError,
    `Status: ${step2bResponse.status}`
  );
  
  logTest(
    'TEST 2b-extra: No accessToken in response',
    noToken,
    `accessToken present: ${!!step2bResponse.data?.data?.accessToken}`
  );
}

// TEST 3: Phone step1 no longer hard-blocks
async function test3_PhoneNoHardBlock() {
  console.log('\n=== TEST 3: Phone Step1 No Longer Hard-Blocks ===');
  
  console.log('\n3a. POST /api/user/registerPhone with undeliverable DID');
  const step3Response = await makeRequest(
    'POST',
    `${BASE_URL}/api/user/registerPhone`,
    { mobile: UNDELIVERABLE_PHONE }
  );
  
  console.log(`   Status: ${step3Response.status}`);
  console.log(`   Response:`, JSON.stringify(step3Response.data, null, 2));
  
  // Verify: Should return 503 "Failed to send verification code..."
  // Must NOT return 400 "already registered" and must NOT return 500
  const is503 = step3Response.status === 503;
  const messageOk = step3Response.data?.message?.toLowerCase().includes('failed to send');
  const not400 = step3Response.status !== 400;
  const not500 = step3Response.status !== 500;
  
  logTest(
    'TEST 3a: registerPhone returns 503 (delivery failed)',
    is503 && messageOk,
    `Status: ${step3Response.status}, Message: "${step3Response.data?.message}"`
  );
  
  logTest(
    'TEST 3a-extra: NOT 400 "already registered"',
    not400,
    `Status: ${step3Response.status}`
  );
  
  logTest(
    'TEST 3a-extra: NOT 500 server error',
    not500,
    `Status: ${step3Response.status}`
  );
}

// TEST 4: Health check
async function test4_HealthCheck() {
  console.log('\n=== TEST 4: Health Check ===');
  
  const response = await makeRequest('GET', `${BASE_URL}/api/`);
  
  console.log(`   Status: ${response.status}`);
  console.log(`   Response:`, JSON.stringify(response.data, null, 2));
  
  const pass = response.status === 200;
  
  logTest(
    'TEST 4: GET /api/ returns 200',
    pass,
    `Status: ${response.status}, Service: ${response.data?.service}`
  );
}

// Main test runner
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Re-onboarding Feature Test Suite                             ║');
  console.log('║  Testing: Existing email/phone logs user in (not 400 error)   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`Test Account: ${TEST_EMAIL} (user_id: ${EXPECTED_USER_ID})`);
  console.log(`Redis: Connected to ${REDIS_URL.split('@')[1]}`);
  
  try {
    // Test Redis connection
    await redis.ping();
    console.log('✓ Redis connection successful\n');
    
    // Run all tests
    await test4_HealthCheck();
    await test1_EmailReturningUserE2E();
    await test2_WrongOTPRejected();
    await test3_PhoneNoHardBlock();
    
    // Print summary
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  TEST SUMMARY                                                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\nTotal Tests: ${results.passed + results.failed}`);
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
    
    console.log('\n--- Detailed Results ---');
    results.tests.forEach((test, idx) => {
      const status = test.passed ? '✅' : '❌';
      console.log(`${idx + 1}. ${status} ${test.testName}`);
      if (test.details) console.log(`   ${test.details}`);
    });
    
    // Key confirmations
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  KEY CONFIRMATIONS                                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    
    const test1aResult = results.tests.find(t => t.testName.includes('TEST 1a'));
    const test1cResult = results.tests.find(t => t.testName.includes('TEST 1c: verify-otp'));
    const test2bResult = results.tests.find(t => t.testName.includes('TEST 2b: Wrong OTP'));
    const test3aResult = results.tests.find(t => t.testName.includes('TEST 3a: registerPhone'));
    
    console.log(`\n(a) registerEmail for existing account returns 200 existing_user:true (NOT 400):`);
    console.log(`    ${test1aResult?.passed ? '✅ CONFIRMED' : '❌ FAILED'}`);
    
    console.log(`\n(b) verify-otp logs in as user_id ${EXPECTED_USER_ID} with existing_user:true:`);
    console.log(`    ${test1cResult?.passed ? '✅ CONFIRMED' : '❌ FAILED'}`);
    
    console.log(`\n(c) wrong OTP → 400:`);
    console.log(`    ${test2bResult?.passed ? '✅ CONFIRMED' : '❌ FAILED'}`);
    
    console.log(`\n(d) no 500 anywhere:`);
    const no500 = !results.tests.some(t => t.details?.includes('Status: 500'));
    console.log(`    ${no500 ? '✅ CONFIRMED' : '❌ FAILED - Found 500 error'}`);
    
  } catch (error) {
    console.error('\n❌ Test suite error:', error);
  } finally {
    // Cleanup
    redis.disconnect();
    console.log('\n✓ Redis connection closed');
  }
}

// Run tests
runTests().catch(console.error);
