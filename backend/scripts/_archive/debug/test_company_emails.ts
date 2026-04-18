import { sendCompanyProfileCreatedEmail, sendCompanyContactWelcomeEmail } from './services/emailService';

async function testCompanyEmails() {
  try {
    console.log('Testing Company Email Notifications...\n');
    
    // Test 1: Company Profile Created Email (to account holder)
    console.log('1. Testing sendCompanyProfileCreatedEmail...');
    try {
      await sendCompanyProfileCreatedEmail(
        process.env.ADMIN_EMAIL || 'moxxcompany@gmail.com',
        'Test User',
        'Test Company Ltd'
      );
      console.log('   ✅ Company profile created email sent successfully');
    } catch (error: unknown) {
      console.log('   ❌ Error:', error.message);
    }
    
    // Test 2: Company Contact Welcome Email
    console.log('\n2. Testing sendCompanyContactWelcomeEmail...');
    try {
      await sendCompanyContactWelcomeEmail(
        process.env.ADMIN_EMAIL || 'moxxcompany@gmail.com',
        'Test Company Ltd',
        'Test User'
      );
      console.log('   ✅ Company contact welcome email sent successfully');
    } catch (error: unknown) {
      console.log('   ❌ Error:', error.message);
    }
    
    console.log('\n=== Test Complete ===');
    process.exit(0);
  } catch (error: unknown) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

testCompanyEmails();
