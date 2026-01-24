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

export default sendEmail;
export {
  sendEmail,
  sendPaymentReceivedEmail,
  sendPaymentPendingEmail,
  sendPaymentConfirmingEmail,
  sendTransactionConfirmedEmail,
  sendWeeklySummaryEmail,
  sendSecurityAlertEmail,
  dynoPayEmailTemplate,
};
