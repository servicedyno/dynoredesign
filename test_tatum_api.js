const tatumApi = require('./backend/apis/tatumApi.ts').default;

async function testTatumApi() {
    console.log('Testing Tatum API...');
    
    try {
        console.log('Testing BTC address validation...');
        const result = await tatumApi.getAddressBalance('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'BTC');
        console.log('✅ SUCCESS: Tatum API working!');
        console.log('Result:', result);
    } catch (error) {
        console.log('❌ ERROR: Tatum API failed!');
        console.log('Error details:', error);
        console.log('Error message:', error.message);
        console.log('Error stack:', error.stack);
    }
}

testTatumApi();