import { sendCompanyProfileUpdatedEmail } from './services/emailService';

async function testCompanyUpdateEmail() {
  try {
    console.log('Testing Company Profile Updated Email...\n');
    
    await sendCompanyProfileUpdatedEmail(
      process.env.ADMIN_EMAIL || 'moxxcompany@gmail.com',
      'Test User',
      'Test Company Ltd',
      ['Company Name', 'Email Address', 'Phone Number', 'Address', 'Company Logo']
    );
    
    console.log('✅ Company profile updated email sent successfully');
    process.exit(0);
  } catch (error: unknown) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testCompanyUpdateEmail();
