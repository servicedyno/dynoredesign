/**
 * Test Script: Send Sample Payment Receipt Email
 * Sends a test email with PDF receipt to verify the email + PDF functionality
 */

import "dotenv/config";
import { sendCustomerPaymentConfirmationEmail } from "./services/emailService";

async function sendTestReceipt() {
  console.log("=".repeat(60));
  console.log("📧 SENDING TEST PAYMENT RECEIPT EMAIL");
  console.log("=".repeat(60));
  
  const testEmail = "email@dyno.pt";
  const testData = {
    customerEmail: testEmail,
    customerName: "Test Customer",
    companyName: "DynoPay Test Merchant",
    amount: "50.00",
    currency: "USD",
    transactionId: "test-" + Date.now().toString().slice(-8),
    description: "Test Payment - PDF Receipt Verification",
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    cryptoAmount: "0.01523",
    cryptoCurrency: "ETH",
    transactionReference: "0xabc123def456789..."
  };

  console.log("\n📋 Test Email Details:");
  console.log(`   To: ${testData.customerEmail}`);
  console.log(`   Amount: ${testData.amount} ${testData.currency}`);
  console.log(`   Crypto: ${testData.cryptoAmount} ${testData.cryptoCurrency}`);
  console.log(`   Transaction ID: ${testData.transactionId}`);
  console.log(`   Company: ${testData.companyName}`);
  
  try {
    await sendCustomerPaymentConfirmationEmail(
      testData.customerEmail,
      testData.customerName,
      testData.companyName,
      testData.amount,
      testData.currency,
      testData.transactionId,
      testData.description,
      testData.date,
      testData.time,
      testData.cryptoAmount,
      testData.cryptoCurrency,
      testData.transactionReference
    );
    
    console.log("\n✅ SUCCESS: Test email sent to " + testEmail);
    console.log("   - Email should contain branded DynoPay template");
    console.log("   - Email should have PDF receipt attachment");
    console.log("\n📬 Please check inbox at: " + testEmail);
    
  } catch (error: any) {
    console.error("\n❌ FAILED to send test email:", error.message);
    if (error.response?.data) {
      console.error("   API Response:", JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log("\n" + "=".repeat(60));
}

// Run the test
sendTestReceipt().then(() => {
  console.log("Test complete. Exiting...");
  process.exit(0);
}).catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
