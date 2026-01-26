import mailTransporter from "../utils/mailTransporter";

const dynoPayEmailTemplate = (
  name: string,
  message: string,
  heading: string,
  showImage: boolean = false
) => {
  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <meta charset="UTF-8" />
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <meta name="x-apple-disable-message-reformatting" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <meta content="telephone=no" name="format-detection" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>
        body {
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          font-size: 14px;
          line-height: 1.6;
          color: #1a1a2e;
          margin: 0;
          padding: 0;
          background-color: #f5f7fa;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
        }
        .header {
          background: linear-gradient(135deg, #1034a6 0%, #0d2570 100%);
          padding: 24px 32px;
          text-align: center;
        }
        .logo {
          font-size: 28px;
          font-weight: 700;
          color: #ffffff;
          text-decoration: none;
          letter-spacing: -0.5px;
        }
        .logo span {
          color: #f47323;
        }
        .content {
          padding: 40px 32px;
        }
        .heading {
          font-size: 24px;
          font-weight: 600;
          color: #1034a6;
          margin: 0 0 24px 0;
          text-align: center;
        }
        .greeting {
          font-size: 16px;
          margin-bottom: 16px;
        }
        .message {
          font-size: 15px;
          color: #4a4a4a;
          margin-bottom: 24px;
          white-space: pre-line;
        }
        .highlight-box {
          background: linear-gradient(135deg, #f8f9ff 0%, #eef1ff 100%);
          border-left: 4px solid #1034a6;
          padding: 16px 20px;
          margin: 24px 0;
          border-radius: 0 8px 8px 0;
        }
        .highlight-box p {
          margin: 0;
          color: #1a1a2e;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #f47323 0%, #e05a00 100%);
          color: #ffffff !important;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          margin: 16px 0;
        }
        .button:hover {
          background: linear-gradient(135deg, #e05a00 0%, #c94d00 100%);
        }
        .signature {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
        }
        .footer {
          background: #1a1a2e;
          padding: 32px;
          text-align: center;
        }
        .footer-logo {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 16px;
        }
        .footer-logo span {
          color: #f47323;
        }
        .footer-text {
          color: #9ca3af;
          font-size: 13px;
          margin: 8px 0;
        }
        .footer-links {
          margin-top: 16px;
        }
        .footer-links a {
          color: #9ca3af;
          text-decoration: none;
          margin: 0 12px;
          font-size: 13px;
        }
        .footer-links a:hover {
          color: #ffffff;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 8px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <a href="https://dynopay.com" class="logo">Dyno<span>Pay</span></a>
        </div>
        <div class="content">
          <h1 class="heading">${heading}</h1>
          <p class="greeting">Hey ${name || "there"},</p>
          <div class="message">${message}</div>
          <div class="signature">
            <p>Best regards,<br /><strong>The DynoPay Team</strong></p>
          </div>
        </div>
        <div class="footer">
          <div class="footer-logo">Dyno<span>Pay</span></div>
          <p class="footer-text">Secure Crypto Payment Gateway</p>
          <p class="footer-text">© ${new Date().getFullYear()} DynoPay. All rights reserved.</p>
          <div class="footer-links">
            <a href="https://dynopay.com/privacy">Privacy Policy</a>
            <a href="https://dynopay.com/terms">Terms of Service</a>
            <a href="https://dynopay.com/support">Support</a>
          </div>
        </div>
      </div>
    </body>
  </html>`;
  return html;
};

const sendEmail = async (
  recipientEmail: string,
  name: string,
  subject: string,
  message: string,
  showImage = false
) => {
  try {
    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: message,
    });
    return info;
  } catch (e) {
    console.log("Email send error:", e);
  }
};

/**
 * Send payment received email notification
 * Always sent regardless of user preferences
 */
const sendPaymentReceivedEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  amount: string,
  currency: string,
  transactionId: string
) => {
  try {
    const subject = "Payment Received - DynoPay";
    const message = `Great news! Your company ${companyName} has received a payment.

💰 Amount: ${amount} ${currency}

📝 Transaction Reference:
${transactionId}

The funds have been credited to your wallet. You can view the full transaction details in your DynoPay dashboard.

Thank you for using DynoPay for your crypto payments!`;

    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: message,
    });
    return info;
  } catch (e) {
    console.log("Payment received email error:", e);
  }
};

/**
 * Send transaction confirmed email notification
 */
const sendTransactionConfirmedEmail = async (
  recipientEmail: string,
  name: string,
  transactionId: string,
  amount: string,
  currency: string,
  status: string
) => {
  try {
    const subject = `Transaction ${status} - DynoPay`;
    const message = `Your transaction has been ${status.toLowerCase()}.

📝 Transaction ID: ${transactionId}
💰 Amount: ${amount} ${currency}
✅ Status: ${status}

You can view more details in your DynoPay dashboard.`;

    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: message,
    });
    return info;
  } catch (e) {
    console.log("Transaction confirmed email error:", e);
  }
};

/**
 * Send weekly summary email
 */
const sendWeeklySummaryEmail = async (
  recipientEmail: string,
  name: string,
  summaryData: {
    periodStart: string;
    periodEnd: string;
    transactionCount: number;
    totalVolume: number;
    completedCount: number;
    pendingCount: number;
  }
) => {
  try {
    const subject = "Your Weekly Summary - DynoPay";
    const message = `Here's your weekly activity summary for ${summaryData.periodStart} to ${summaryData.periodEnd}:

📊 Weekly Statistics:
• Total Transactions: ${summaryData.transactionCount}
• Total Volume: $${summaryData.totalVolume.toFixed(2)}
• Completed: ${summaryData.completedCount}
• Pending: ${summaryData.pendingCount}

Log in to your dashboard for detailed analytics and insights.

Keep up the great work!`;

    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: message,
    });
    return info;
  } catch (e) {
    console.log("Weekly summary email error:", e);
  }
};

/**
 * Send security alert email
 */
const sendSecurityAlertEmail = async (
  recipientEmail: string,
  name: string,
  alertType: string,
  details: string
) => {
  try {
    const subject = "🔒 Security Alert - DynoPay";
    const message = `We detected unusual activity on your account.

⚠️ Alert Type: ${alertType}

${details}

If this was you, you can ignore this message. If you didn't perform this action, please secure your account immediately by:
1. Changing your password
2. Enabling two-factor authentication
3. Contacting our support team

Your security is our priority.`;

    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: message,
    });
    return info;
  } catch (e) {
    console.log("Security alert email error:", e);
  }
};

/**
 * Send pending payment notification email
 * Sent when an unconfirmed transaction is detected on the blockchain
 */
const sendPaymentPendingEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  amount: string,
  currency: string,
  transactionId: string,
  confirmationsRequired: number = 1
) => {
  try {
    const subject = "⏳ Payment Pending Confirmation - DynoPay";
    const message = `A new payment has been detected for your company ${companyName}!

💰 Amount: ${amount} ${currency}
📝 Transaction ID: ${transactionId}
⏳ Status: Awaiting Confirmation

The transaction has been broadcast to the ${currency} network and is waiting for blockchain confirmation. This typically takes:
• BTC: 10-60 minutes (${confirmationsRequired} confirmation${confirmationsRequired > 1 ? 's' : ''} required)
• ETH/ERC20: 1-5 minutes
• TRX/TRC20: 1-3 minutes
• LTC: 2-30 minutes
• DOGE: 1-10 minutes

We'll notify you once the payment is fully confirmed and credited to your wallet.

You can track the transaction status in your DynoPay dashboard.`;

    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: message,
    });
    return info;
  } catch (e) {
    console.log("Payment pending email error:", e);
  }
};

/**
 * Send payment confirming notification email
 * Sent when a transaction is being confirmed (for chains requiring multiple confirmations)
 */
const sendPaymentConfirmingEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  amount: string,
  currency: string,
  transactionId: string,
  currentConfirmations: number,
  requiredConfirmations: number
) => {
  try {
    const subject = `🔄 Payment Confirming (${currentConfirmations}/${requiredConfirmations}) - DynoPay`;
    const message = `Good news! Your payment for ${companyName} is being confirmed.

💰 Amount: ${amount} ${currency}
📝 Transaction ID: ${transactionId}
✅ Confirmations: ${currentConfirmations} of ${requiredConfirmations}

${currentConfirmations >= requiredConfirmations 
  ? "The payment has reached the required confirmations and will be credited shortly!"
  : `${requiredConfirmations - currentConfirmations} more confirmation${requiredConfirmations - currentConfirmations > 1 ? 's' : ''} needed before the payment is credited.`}

You can track the full status in your DynoPay dashboard.`;

    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: message,
    });
    return info;
  } catch (e) {
    console.log("Payment confirming email error:", e);
  }
};

/**
 * Send partial payment notification email
 * Sent when a partial payment is received and more funds are needed
 */
const sendPaymentPartialEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  receivedAmount: string,
  expectedAmount: string,
  remainingAmount: string,
  currency: string,
  transactionId: string,
  walletAddress: string,
  gracePeriodMinutes: number = 30
) => {
  try {
    const subject = "⚠️ Partial Payment Received - Action Required - DynoPay";
    const message = `A partial payment has been received for your company ${companyName}.

💰 Expected Amount: ${expectedAmount} ${currency}
✅ Received Amount: ${receivedAmount} ${currency}
⚠️ Remaining Amount: ${remainingAmount} ${currency}

📝 Transaction ID: ${transactionId}
📍 Wallet Address: ${walletAddress}

⏰ IMPORTANT: You have ${gracePeriodMinutes} minutes to send the remaining ${remainingAmount} ${currency} to complete this payment.

What happens next?
• If the remaining amount is received within ${gracePeriodMinutes} minutes, the full payment will be processed and forwarded to your wallet.
• If the grace period expires, the partial amount received will be processed with adjusted fees.

To complete the payment, send exactly ${remainingAmount} ${currency} to:
${walletAddress}

You can track the payment status in your DynoPay dashboard.`;

    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: message,
    });
    return info;
  } catch (e) {
    console.log("Payment partial email error:", e);
  }
};

/**
 * Send partial payment expired notification email
 * Sent when a partial payment grace period has expired
 */
const sendPaymentPartialExpiredEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  receivedAmount: string,
  expectedAmount: string,
  currency: string,
  transactionId: string,
  status: "completed_partial" | "incomplete_expired"
) => {
  try {
    const isCompleted = status === "completed_partial";
    const subject = isCompleted 
      ? "✅ Partial Payment Processed - DynoPay"
      : "⏰ Partial Payment Expired - DynoPay";
    
    const message = isCompleted
      ? `The partial payment for your company ${companyName} has been processed.

💰 Expected Amount: ${expectedAmount} ${currency}
✅ Received Amount: ${receivedAmount} ${currency}
📝 Transaction ID: ${transactionId}

The received amount has been processed with adjusted fees and forwarded to your wallet. The transaction is now complete.

You can view the full transaction details in your DynoPay dashboard.`
      : `The grace period for the partial payment to your company ${companyName} has expired.

💰 Expected Amount: ${expectedAmount} ${currency}
⚠️ Received Amount: ${receivedAmount} ${currency}
📝 Transaction ID: ${transactionId}

Since the full payment was not received within the grace period, the partial amount has been processed. Please note that fees may be higher for incomplete payments.

If you believe this is an error or need assistance, please contact our support team.

You can view the transaction details in your DynoPay dashboard.`;

    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: message,
    });
    return info;
  } catch (e) {
    console.log("Payment partial expired email error:", e);
  }
};

/**
 * Send admin fee received email notification
 * Sent to admin when platform fee is received from a merchant payment
 */
const sendAdminFeeReceivedEmail = async (
  recipientEmail: string,
  name: string,
  feeAmount: string,
  currency: string,
  transactionId: string,
  companyName: string,
  merchantAmount: string,
  totalAmount: string
) => {
  try {
    const subject = "💰 Platform Fee Received - DynoPay";
    
    // Check if this is an under-threshold payment (merchant gets $0)
    const merchantAmountNum = parseFloat(merchantAmount);
    const feeAmountNum = parseFloat(feeAmount);
    const totalAmountNum = parseFloat(totalAmount);
    const isUnderThreshold = merchantAmountNum === 0 && feeAmountNum === totalAmountNum;
    
    let message = `Platform fee received from ${companyName}!\n\n`;
    
    if (isUnderThreshold) {
      // Under-threshold payment - all goes to admin
      message += `⚠️ UNDER THRESHOLD PAYMENT - All funds to platform\n\n`;
      message += `💰 Total Amount Received: ${feeAmount} ${currency}\n`;
      message += `📊 Merchant Received: ${merchantAmount} ${currency} (Below minimum threshold)\n`;
      message += `💵 Platform Received: ${feeAmount} ${currency} (100%)\n`;
      message += `🏢 Company: ${companyName}\n\n`;
      message += `📝 Transaction Reference:\n${transactionId}\n\n`;
      message += `ℹ️ This payment was below the minimum forwarding threshold.\n`;
      message += `All funds have been credited to the admin ${currency} wallet.\n`;
      message += `The merchant will not receive any funds from this transaction.`;
    } else {
      // Normal fee distribution
      message += `💰 Fee Amount: ${feeAmount} ${currency}\n`;
      message += `📊 Merchant Received: ${merchantAmount} ${currency}\n`;
      message += `💵 Total Payment: ${totalAmount} ${currency}\n`;
      message += `🏢 Company: ${companyName}\n\n`;
      message += `📝 Transaction Reference:\n${transactionId}\n\n`;
      message += `Fee Breakdown:\n`;
      message += `• Platform Fee: ${feeAmount} ${currency}\n`;
      message += `• Merchant Net: ${merchantAmount} ${currency}\n`;
      message += `• Total Processed: ${totalAmount} ${currency}\n\n`;
      message += `The fee has been credited to the admin ${currency} wallet.\n\n`;
    }
    
    message += `You can view the full transaction details in the DynoPay admin dashboard.`;

    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: message,
    });
    return info;
  } catch (e) {
    console.log("Admin fee received email error:", e);
  }
};

export default sendEmail;
export {
  sendEmail,
  sendPaymentReceivedEmail,
  sendPaymentPendingEmail,
  sendPaymentConfirmingEmail,
  sendPaymentPartialEmail,
  sendPaymentPartialExpiredEmail,
  sendTransactionConfirmedEmail,
  sendAdminFeeReceivedEmail,
  sendWeeklySummaryEmail,
  sendSecurityAlertEmail,
  dynoPayEmailTemplate,
};
