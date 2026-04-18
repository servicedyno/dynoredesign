const axios = require('axios');
require('dotenv').config();

async function testBrevoAPI() {
  console.log('Testing Brevo API directly...\n');
  console.log('API Key present:', !!process.env.BREVO_API_KEY);
  console.log('API Key length:', process.env.BREVO_API_KEY?.length);
  
  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          name: 'DynoPay Test',
          email: 'notify@dynocash.com',
        },
        subject: 'Test Email from DynoPay',
        to: [
          {
            email: process.env.ADMIN_EMAIL || 'moxxcompany@gmail.com',
            name: 'Test User',
          },
        ],
        htmlContent: '<html><body><h1>Test Email</h1><p>This is a test email from DynoPay.</p></body></html>',
      },
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('\n✅ Email sent successfully!');
    console.log('Response:', response.data);
  } catch (error) {
    console.log('\n❌ Error sending email:');
    console.log('Status:', error.response?.status);
    console.log('Message:', error.response?.data);
  }
}

testBrevoAPI();
